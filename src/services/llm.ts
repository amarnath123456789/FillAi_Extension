/// <reference types="vite/client" />
import { CreateMLCEngine, MLCEngineInterface } from '@mlc-ai/web-llm';
import { UserProfile } from '../types';

const DEFAULT_MODEL = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
let _enginePromise: Promise<MLCEngineInterface> | null = null;

function getSelectedModel(): string {
  const modelFromEnv = (import.meta as ImportMeta & { env?: { VITE_WEBLLM_MODEL?: string } })?.env?.VITE_WEBLLM_MODEL;
  return typeof modelFromEnv === 'string' && modelFromEnv.trim().length > 0
    ? modelFromEnv.trim()
    : DEFAULT_MODEL;
}

async function getEngine(): Promise<MLCEngineInterface> {
  if (!_enginePromise) {
    const model = getSelectedModel();
    _enginePromise = CreateMLCEngine(model, {
      initProgressCallback: (report) => {
        if (report.progress >= 0 && report.progress <= 1) {
          console.info(`[FillAI][WebLLM] loading ${Math.round(report.progress * 100)}%`);
        }
      },
    }).catch((error: unknown) => {
      _enginePromise = null;
      throw error;
    });
  }
  return _enginePromise;
}

const SYSTEM_INSTRUCTION = `Act as FillAI, an expert for filling job forms.
RULES:
1. ONLY output field value. No quotes, markdown, or intros.
2. Simple data: Output exact value only.
3. Essays/Textareas: Write 1st person, 100-200 words. No bullets.
4. Grounding: Use profile. If details missing, extrapolate plausibly from skills/role. Never leave blank.
5. User Instruction: This is top priority. Honor requested style/length.
6. Style: Human-sounding, specific, confident. No generic buzzwords.
7. Bio Weight: Use "Bio / Summary" as primary source for identity and tone.
8. Completeness: Never stop mid-sentence. Ensure every thought is fully concluded within the output rules.`;

function extractModelText(response: unknown): string {
  if (!response || typeof response !== 'object') return '';

  const choices = (response as {
    choices?: Array<{
      message?: {
        content?:
          | string
          | Array<{ text?: string; type?: string }>;
      };
    }>;
  }).choices;

  if (!Array.isArray(choices) || choices.length === 0) return '';
  const content = choices[0]?.message?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (!Array.isArray(content)) return '';
  return content
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

function classifyLlmError(rawMessage: string): string {
  const low = rawMessage.toLowerCase();

  if (low.includes('webgpu') || low.includes('adapter') || low.includes('gpu')) {
    return 'WebLLM requires WebGPU support, but this browser/runtime could not initialize it.';
  }

  if (low.includes('download') || low.includes('network') || low.includes('fetch')) {
    return 'Failed to download or load the local WebLLM model assets. Check connection and try again.';
  }

  if (low.includes('out of memory') || low.includes('insufficient') || low.includes('allocation')) {
    return 'Not enough memory to run this local model. Try a smaller model or close other heavy tabs/apps.';
  }

  if (low.includes('empty response')) {
    return 'WebLLM returned an empty response for this field. Try a shorter instruction or save more profile details.';
  }

  return rawMessage || 'Failed to generate response.';
}

export async function generateFieldResponse(
  profile: UserProfile,
  fieldContext: {
    label: string;
    placeholder: string;
    name: string;
    id: string;
    type?: string;
  },
  options?: { userInstruction?: string }
): Promise<string> {
  // Build a compact, non-empty-only profile section
  const profileLines: string[] = [];
  const add = (key: string, val: string) => { if (val?.trim()) profileLines.push(`${key}: ${val.trim()}`); };
  add('Full Name', profile.fullName);
  add('Email', profile.email);
  add('Phone', profile.phone);
  add('Date of Birth', profile.dob);
  add('Address', profile.address);
  add('LinkedIn', profile.linkedin);
  add('GitHub', profile.github);
  add('Portfolio', profile.portfolio);
  add('Current Role', profile.currentRole);
  add('Years of Experience', profile.yearsOfExperience);
  add('Education', profile.education);
  add('Certifications', profile.certifications);
  add('Skills', profile.skills);
  add('Achievements', profile.achievements);
  add('Other Details', profile.otherDetails);


  const fieldLines: string[] = [];
  if (fieldContext.label) fieldLines.push(`Label: ${fieldContext.label}`);
  if (fieldContext.placeholder) fieldLines.push(`Placeholder: ${fieldContext.placeholder}`);
  if (fieldContext.name) fieldLines.push(`Name attr: ${fieldContext.name}`);
  if (fieldContext.id) fieldLines.push(`ID attr: ${fieldContext.id}`);
  if (fieldContext.type) fieldLines.push(`Input type: ${fieldContext.type}`);

  const instructionSection = options?.userInstruction
    ? `\n## CRITICAL: USER DIRECTIVE / INSTRUCTION\n"${options.userInstruction}"\n(You MUST prioritize this instruction. If it asks for specific content like a "hackathon", ensure you bridge it naturally into the job context without stopping abruptly.)\n`
    : '';


  const bioSection = profile.bio?.trim()
    ? `\n## Applicant's Core Bio / Summary (CRITICAL CONTEXT)\n${profile.bio.trim()}\n(Always ensure the generated text aligns closely with this bio.)\n`
    : '';

  const prompt = `\
## Applicant Profile
${profileLines.join('\n') || '(no standard profile data provided)'}
${bioSection}
## Target Field
${fieldLines.join('\n') || '(no field context)'}
${instructionSection}
Write the complete, final value for this field:`;

  try {
    const engine = await getEngine();
    const response = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt },
      ],
      temperature: 0.75,
      top_p: 0.9,
      max_tokens: 1000,
    });

    const text = extractModelText(response);
    if (!text) throw new Error('AI returned an empty response.');

    // Strip any residual markdown code fences the model might still emit
    return text.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '').trim();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[FillAI LLM error]', msg, error);
    throw new Error(classifyLlmError(msg));
  }
}
