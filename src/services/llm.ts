import { GoogleGenAI } from '@google/genai';
import { UserProfile } from '../types';

// Lazily instantiated so a missing key doesn't crash the module at load time
let _devAi: GoogleGenAI | null = null;
function getClient(explicitKey?: string): GoogleGenAI {
  // Extension mode: always use the explicitly provided key
  if (explicitKey) return new GoogleGenAI({ apiKey: explicitKey });
  // Dev mode: fall back to the .env variable
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set. Add it to your .env file and restart the dev server.');
  if (!_devAi) _devAi = new GoogleGenAI({ apiKey: key });
  return _devAi;
}

const SYSTEM_INSTRUCTION = `\
You are FillAI, an expert AI assistant that fills job application and professional form fields on behalf of the user.

STRICT OUTPUT RULES — read carefully:
1. Output ONLY the final text that should appear in the field. No quotes, no markdown, no prefixes, no explanations, no "Here is…" openers.
2. For simple data fields (name, email, phone, URL, years): output only that exact piece of data, nothing else.
3. For descriptive or essay fields (bio, cover letter, "why us", challenge, summary): write naturally in first person. Max ~150 words unless the field clearly expects more. Avoid bullet points unless the field label implies them.
4. Grounding: every claim in your response must be supported by the provided profile data. Do not invent facts.
5. User instruction: if a "User Instruction" section is present, treat it as the user's direct directive — honour the requested tone, style, length, or any specific rewording. The instruction takes priority over default style choices.
6. Writing quality: aim for authentic, human-sounding prose — clear, confident, and specific. Avoid corporate buzzword overuse (e.g. "leverage synergies"), excessive self-praise, or generic filler.`;

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
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.75,
        topP: 0.9,
      }
    });

    const text = response.text?.trim();
    if (!text) throw new Error('AI returned an empty response.');

    // Strip any residual markdown code fences the model might still emit
    return text.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '').trim();
  } catch (error) {
    // Surface the real error message so we can diagnose it
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[FillAI LLM error]', msg, error);
    throw new Error(msg || 'Failed to generate response.');
  }
}
