/// <reference types="vite/client" />
import { GoogleGenAI } from '@google/genai';
import { UserProfile } from '../types';

// Lazily instantiated so a missing key doesn't crash the module at load time
let _devAi: GoogleGenAI | null = null;
function getClient(explicitKey?: string): GoogleGenAI {
  // Extension mode: always use the explicitly provided key
  if (explicitKey) return new GoogleGenAI({ apiKey: explicitKey });
  // Dev mode: fall back to the .env variable

  const key = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY/VITE_GEMINI_API_KEY is not set. Add VITE_GEMINI_API_KEY to your .env file and restart the dev server.');
  if (!_devAi) _devAi = new GoogleGenAI({ apiKey: key });
  return _devAi;
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

  const maybeText = (response as { text?: string }).text;
  if (typeof maybeText === 'string' && maybeText.trim()) return maybeText.trim();

  const candidates = (response as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  }).candidates;

  if (!Array.isArray(candidates) || candidates.length === 0) return '';
  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';

  const joined = parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim();

  return joined;
}

function classifyLlmError(rawMessage: string): string {
  const low = rawMessage.toLowerCase();

  if (low.includes('resource_exhausted') || low.includes('quota exceeded') || low.includes('code":429') || low.includes('spending cap')) {
    return 'Gemini API quota/spending cap has been reached for this project. Add billing or use a fresh API key/project, then retry.';
  }

  if (low.includes('permission denied') || low.includes('api key') || low.includes('unauthorized') || low.includes('forbidden')) {
    return 'Gemini API key is invalid or does not have permission for this model. Check key validity and project access in AI Studio.';
  }

  if (low.includes('empty response')) {
    return 'Gemini returned an empty response for this field. Try a shorter instruction or save more profile details.';
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
  options?: { userInstruction?: string; apiKey?: string }
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
    const response = await getClient(options?.apiKey).models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.75,
        topP: 0.9,
        maxOutputTokens: 1000,
      }
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
