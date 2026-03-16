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

const SYSTEM_INSTRUCTION = `\
You are FillAI, an expert AI assistant that fills job application and professional form fields on behalf of the user.

STRICT OUTPUT RULES — read carefully:
1. Output ONLY the final text that should appear in the field. No quotes, no markdown, no prefixes, no explanations, no "Here is…" openers.
2. For simple data fields (name, email, phone, URL, years): output only that exact piece of data, nothing else.
3. For descriptive or essay fields (bio, cover letter, "why us", challenge, summary, or "textarea" inputs): write naturally in first person. Expand on the point generously (produce a rich, detailed response of at least 100-200 words unless instructed otherwise). Overcome brevity! Avoid bullet points unless the field label implies them.
4. Grounding: base your response primarily on the provided profile data. For descriptive fields (like challenges or cover letters), if exact details are missing, extrapolate reasonably and plausibly from the user's skills, role, and experience to provide a complete, substantial answer. Do not leave the field blank or refuse to answer.
5. User instruction: if a "User Instruction" section is present, treat it as the user's direct directive — honour the requested tone, style, length, or any specific rewording. The instruction takes priority over default style choices.
6. Writing quality: aim for authentic, human-sounding prose — clear, confident, and specific. Avoid corporate buzzword overuse (e.g. "leverage synergies"), excessive self-praise, or generic filler.`;

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
  add('Full Name',          profile.fullName);
  add('Email',              profile.email);
  add('Phone',              profile.phone);
  add('Date of Birth',      profile.dob);
  add('Address',            profile.address);
  add('LinkedIn',           profile.linkedin);
  add('GitHub',             profile.github);
  add('Portfolio',          profile.portfolio);
  add('Current Role',       profile.currentRole);
  add('Years of Experience',profile.yearsOfExperience);
  add('Education',          profile.education);
  add('Certifications',     profile.certifications);
  add('Bio / Summary',      profile.bio);
  add('Skills',             profile.skills);
  add('Achievements',       profile.achievements);
  add('Other Details',      profile.otherDetails);

  const fieldLines: string[] = [];
  if (fieldContext.label)       fieldLines.push(`Label: ${fieldContext.label}`);
  if (fieldContext.placeholder) fieldLines.push(`Placeholder: ${fieldContext.placeholder}`);
  if (fieldContext.name)        fieldLines.push(`Name attr: ${fieldContext.name}`);
  if (fieldContext.id)          fieldLines.push(`ID attr: ${fieldContext.id}`);
  if (fieldContext.type)        fieldLines.push(`Input type: ${fieldContext.type}`);

  const instructionSection = options?.userInstruction
    ? `\n## User Instruction\n"${options.userInstruction}"\n(Apply the above as a style/tone/content directive. If it reads like a partial draft, build upon it naturally.)\n`
    : '';

  const prompt = `\
## Applicant Profile
${profileLines.join('\n') || '(no profile data provided)'}

## Target Field
${fieldLines.join('\n') || '(no field context)'}
${instructionSection}
Write the complete, final value for this field:`;

  try {
    const response = await getClient(options?.apiKey).models.generateContent({
      model: 'gemini-2.5-flash',
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
