import { generateFieldResponse } from '../services/llm';
import type { UserProfile } from '../types';

interface GenerateRequest {
  type: 'FILLAI_GENERATE';
  profile: UserProfile;
  fieldContext: { label: string; placeholder: string; name: string; id: string; type: string };
  userInstruction?: string;
}
interface GenerateResponse { success: boolean; text?: string; error?: string; }

chrome.runtime.onMessage.addListener(
  (msg: GenerateRequest, _sender: chrome.runtime.MessageSender, sendResponse: (r: GenerateResponse) => void) => {
    if (msg.type !== 'FILLAI_GENERATE') return false;
    handleGenerate(msg)
      .then(sendResponse)
      .catch((err: unknown) => sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }));
    return true; // keep channel open for async response
  }
);

async function handleGenerate(msg: GenerateRequest): Promise<GenerateResponse> {
  try {
    const r = await chrome.storage.local.get([
      'fillai_api_key',
      // Backward compatibility for older builds / key names.
      'gemini_api_key',
      'api_key',
      'apiKey',
    ]);

    const apiKey = [
      r.fillai_api_key,
      r.gemini_api_key,
      r.api_key,
      r.apiKey,
    ].find((v): v is string => typeof v === 'string' && v.trim().length > 0);

    // Migrate legacy keys so future lookups use one canonical storage key.
    if (apiKey && r.fillai_api_key !== apiKey) {
      await chrome.storage.local.set({ fillai_api_key: apiKey });
    }

    if (!apiKey?.trim()) {
      return {
        success: false,
        error: 'No API key set. Open FillAI Options ⚙ and enter your Gemini API key.',
      };
    }
    const text = await generateFieldResponse(msg.profile, msg.fieldContext, {
      userInstruction: msg.userInstruction,
      apiKey: apiKey.trim(),
    });
    return { success: true, text };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
