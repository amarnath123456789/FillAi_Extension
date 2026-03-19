/// <reference types="vite/client" />
import { CreateMLCEngine, MLCEngineInterface } from '@mlc-ai/web-llm';
import { UserProfile } from '../types';

const MODEL_STORAGE_KEY = 'fillai_selected_model';
const DEFAULT_MODEL = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

export type ModelLoadPhase = 'idle' | 'loading' | 'ready' | 'error';

export interface FillAiModelOption {
  id: string;
  name: string;
  sizeLabel: string;
  recommendedFor: string;
}

export interface ModelLoadStatus {
  selectedModel: string;
  activeModel: string | null;
  phase: ModelLoadPhase;
  progress: number;
  message: string;
  error: string | null;
}

const MODEL_OPTIONS: FillAiModelOption[] = [
  {
    id: 'Qwen3-0.6B-q4f16_1-MLC',
    name: 'Qwen3 0.6B Instruct',
    sizeLabel: '0.6B',
    recommendedFor: 'Faster local generation on smaller devices',
  },
  {
    id: DEFAULT_MODEL,
    name: 'Llama 3.2 1B Instruct',
    sizeLabel: '1B',
    recommendedFor: 'Best overall quality for FillAI prompts',
  },
];

let _enginePromise: Promise<MLCEngineInterface> | null = null;
let _activeModel: string | null = null;
let _selectedModelCache: string | null = null;
let _loadStatus: Omit<ModelLoadStatus, 'selectedModel' | 'activeModel'> = {
  phase: 'idle',
  progress: 0,
  message: 'Pick a model and click load.',
  error: null,
};

function hasLocalStorageApi(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

function isAllowedModel(modelId: string): boolean {
  return MODEL_OPTIONS.some((model) => model.id === modelId);
}

async function readSelectedModelFromStorage(): Promise<string | null> {
  if (!hasLocalStorageApi()) return null;
  const data = await chrome.storage.local.get(MODEL_STORAGE_KEY);
  const modelId = data?.[MODEL_STORAGE_KEY];
  return typeof modelId === 'string' ? modelId : null;
}

async function persistSelectedModel(modelId: string): Promise<void> {
  if (!hasLocalStorageApi()) return;
  await chrome.storage.local.set({ [MODEL_STORAGE_KEY]: modelId });
}

function setLoadStatus(
  patch: Partial<Omit<ModelLoadStatus, 'selectedModel' | 'activeModel'>>
): void {
  _loadStatus = {
    ..._loadStatus,
    ...patch,
  };
}

function getProgressMessage(reportText?: string): string {
  if (reportText && reportText.trim()) return reportText.trim();
  return 'Downloading and initializing model...';
}

async function getSelectedModel(): Promise<string> {
  if (_selectedModelCache) return _selectedModelCache;

  const savedModel = await readSelectedModelFromStorage();
  if (savedModel && isAllowedModel(savedModel)) {
    _selectedModelCache = savedModel;
    return savedModel;
  }

  _selectedModelCache = DEFAULT_MODEL;
  await persistSelectedModel(DEFAULT_MODEL);
  return DEFAULT_MODEL;
}

export function getFillAiModelOptions(): FillAiModelOption[] {
  return MODEL_OPTIONS;
}

export async function setSelectedModel(modelId: string): Promise<void> {
  if (!isAllowedModel(modelId)) {
    throw new Error('Unsupported model selection.');
  }

  _selectedModelCache = modelId;
  await persistSelectedModel(modelId);

  if (_activeModel && _activeModel !== modelId) {
    _enginePromise = null;
    _activeModel = null;
    setLoadStatus({
      phase: 'idle',
      progress: 0,
      message: 'Model changed. Click load to initialize.',
      error: null,
    });
  }
}

export async function getModelLoadStatus(): Promise<ModelLoadStatus> {
  const selectedModel = await getSelectedModel();
  return {
    selectedModel,
    activeModel: _activeModel,
    ..._loadStatus,
  };
}

async function createEngineForModel(model: string): Promise<MLCEngineInterface> {
  setLoadStatus({
    phase: 'loading',
    progress: 0,
    message: 'Starting model load...',
    error: null,
  });

  _enginePromise = CreateMLCEngine(model, {
    initProgressCallback: (report) => {
      const normalizedProgress = report.progress >= 0 && report.progress <= 1
        ? report.progress
        : 0;
      setLoadStatus({
        phase: 'loading',
        progress: normalizedProgress,
        message: getProgressMessage(report.text),
        error: null,
      });
    },
  })
    .then((engine) => {
      _activeModel = model;
      setLoadStatus({
        phase: 'ready',
        progress: 1,
        message: 'Model loaded. FillAI is ready.',
        error: null,
      });
      return engine;
    })
    .catch((error: unknown) => {
      _enginePromise = null;
      _activeModel = null;
      const rawMessage = error instanceof Error ? error.message : String(error);
      setLoadStatus({
        phase: 'error',
        progress: 0,
        message: 'Model load failed.',
        error: classifyLlmError(rawMessage),
      });
      throw error;
    });

  return _enginePromise;
}

export async function loadSelectedModelEngine(): Promise<void> {
  const model = await getSelectedModel();
  if (_enginePromise && _activeModel === model) {
    await _enginePromise;
    return;
  }
  await createEngineForModel(model);
}

async function getEngine(): Promise<MLCEngineInterface> {
  const selectedModel = await getSelectedModel();
  if (_enginePromise && _activeModel === selectedModel) {
    return _enginePromise;
  }
  return createEngineForModel(selectedModel);
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
        content?: string | Array<{ text?: string; type?: string }>;
      };
    }>;
  }).choices;

  if (!Array.isArray(choices) || choices.length === 0) return '';
  const content = choices[0]?.message?.content;

  if (typeof content === 'string' && content.trim()) {
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
    const response = await (await getEngine()).chat.completions.create({
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

    return text.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '').trim();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[FillAI LLM error]', msg, error);
    throw new Error(classifyLlmError(msg));
  }
}
