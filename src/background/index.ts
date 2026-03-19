import {
  generateFieldResponse,
  getFillAiModelOptions,
  getModelLoadStatus,
  loadSelectedModelEngine,
  setSelectedModel,
} from '../services/llm';
import { getHeuristicFill } from '../services/heuristics';
import type { UserProfile } from '../types';

interface GenerateRequest {
  type: 'FILLAI_GENERATE';
  profile: UserProfile;
  fieldContext: { label: string; placeholder: string; name: string; id: string; type: string };
  userInstruction?: string;
}
interface GenerateResponse {
  success: boolean;
  text?: string;
  error?: string;
  source?: 'llm' | 'heuristic';
}

interface ModelListRequest {
  type: 'FILLAI_MODEL_LIST';
}

interface ModelStatusRequest {
  type: 'FILLAI_MODEL_STATUS';
}

interface ModelSetRequest {
  type: 'FILLAI_MODEL_SET';
  modelId: string;
}

interface ModelLoadRequest {
  type: 'FILLAI_MODEL_LOAD';
}

type IncomingRequest =
  | GenerateRequest
  | ModelListRequest
  | ModelStatusRequest
  | ModelSetRequest
  | ModelLoadRequest;

let modelLoadPromise: Promise<void> | null = null;

chrome.runtime.onMessage.addListener(
  (msg: IncomingRequest, _sender: chrome.runtime.MessageSender, sendResponse: (r: unknown) => void) => {
    handleMessage(msg)
      .then(sendResponse)
      .catch((err: unknown) => sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }));
    return true; // keep channel open for async response
  }
);

async function handleMessage(msg: IncomingRequest): Promise<unknown> {
  switch (msg.type) {
    case 'FILLAI_GENERATE':
      return handleGenerate(msg);
    case 'FILLAI_MODEL_LIST':
      return {
        success: true,
        models: getFillAiModelOptions(),
      };
    case 'FILLAI_MODEL_STATUS':
      return {
        success: true,
        status: await getModelLoadStatus(),
      };
    case 'FILLAI_MODEL_SET':
      await setSelectedModel(msg.modelId);
      return {
        success: true,
        status: await getModelLoadStatus(),
      };
    case 'FILLAI_MODEL_LOAD':
      if (!modelLoadPromise) {
        modelLoadPromise = loadSelectedModelEngine().finally(() => {
          modelLoadPromise = null;
        });
      }
      return {
        success: true,
        status: await getModelLoadStatus(),
      };
    default:
      return { success: false, error: 'Unsupported message type.' };
  }
}

async function handleGenerate(msg: GenerateRequest): Promise<GenerateResponse> {
  try {
    try {
      const text = await generateFieldResponse(msg.profile, msg.fieldContext, {
        userInstruction: msg.userInstruction,
      });
      return { success: true, text, source: 'llm' };
    } catch (llmErr) {
      const fallback = getHeuristicFill(msg.profile, msg.fieldContext);
      if (fallback?.trim()) {
        console.warn('[FillAI] LLM failed, using heuristic fallback.', llmErr);
        return { success: true, text: fallback, source: 'heuristic' };
      }

      const errMsg = llmErr instanceof Error ? llmErr.message : String(llmErr);
      return {
        success: false,
        error: `AI generation failed and no profile fallback matched this field. ${errMsg}`,
      };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
