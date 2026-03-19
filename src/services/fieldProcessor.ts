/**
 * fieldProcessor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Core decision-making pipeline for FillAI.
 *
 * Pipeline stages
 * ───────────────
 *   1. Guard  – skip disabled / readonly / very-short-max-length fields
 *   2. Extract – build FieldContext from the live DOM element
 *   3. Classify – call the heuristic classifier to identify the field type
 *   4. Heuristic attempt – try the profile-driven fast path
 *   5. Decision engine – choose: heuristic ▸ LLM ▸ none
 *   6. LLM call (when needed) – call local WebLLM via generateFieldResponse
 *   7. Return – structured FillResult with optional debug payload
 */

import { classifyField, FieldContext, FieldType, ClassifierResult } from '../utils/classifier';
import { getHeuristicFill } from './heuristics';
import { UserProfile } from '../types';
import { getCache, getContextKey, getSimpleKey, setCache } from '../utils/cache';

interface BackgroundGenerateResponse {
  success: boolean;
  text?: string;
  error?: string;
}

const SIMPLE_CACHE_TYPES: ReadonlySet<FieldType> = new Set([
  'full_name',
  'first_name',
  'last_name',
  'email',
  'phone',
  'linkedin',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Public output type
// ─────────────────────────────────────────────────────────────────────────────

export type FillResult = {
  /** The value to write into the field, or null when skipped. */
  value: string | null;
  /** Which code path produced the value. */
  source: 'heuristic' | 'llm' | 'cache' | 'none';
  /** 0–1 confidence estimate for this fill. */
  confidence: number;
  /** Resolved field type from the classifier. */
  type: FieldType;
  /** Optional diagnostic info — useful during development / testing. */
  debug?: {
    classification: ClassifierResult;
    heuristicTried: boolean;
    llmUsed: boolean;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────────────────────

export interface ProcessFieldOptions {
  /** Free-text instruction the user may have typed before triggering fill. */
  userInstruction?: string;
  /** Attach a `debug` key to FillResult (default: false). */
  debug?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1 – Guard: skip fields that should never be autofilled
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when the element is safe to fill, false when it must be
 * skipped (disabled, readonly, hidden, or has an absurdly short maxLength).
 */
function isElementFillable(
  el: HTMLInputElement | HTMLTextAreaElement
): boolean {
  if (el.disabled) return false;
  if (el.readOnly) return false;

  // Hidden via attribute or computed style
  if (el.type === 'hidden') return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;

  // maxLength of 1 or 2 is almost certainly a single-char picker — skip to
  // avoid LLM spam on fields like "Y/N", checkboxes styled as inputs, etc.
  if (el.maxLength > 0 && el.maxLength < 3) return false;

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2 – Context extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the human-readable label for a field element.
 *
 * Strategy (in priority order):
 *   1. `<label for="…">` explicitly linked via the id attribute
 *   2. Wrapping `<label>` ancestor
 *   3. aria-label / aria-labelledby attributes
 *   4. None (returns undefined)
 */
function resolveLabel(el: HTMLInputElement | HTMLTextAreaElement): string | undefined {
  // 1. Explicit <label for="…">
  if (el.id) {
    const linked = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(el.id)}"]`);
    if (linked?.textContent?.trim()) return linked.textContent.trim();
  }

  // 2. Ancestor <label>
  const ancestorLabel = el.closest('label');
  if (ancestorLabel) {
    // Clone to exclude the input/textarea own text representation
    const clone = ancestorLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input, textarea, select').forEach(n => n.remove());
    const text = clone.textContent?.trim();
    if (text) return text;
  }

  // 3. aria-label / aria-labelledby
  const ariaLabel = el.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledById = el.getAttribute('aria-labelledby');
  if (labelledById) {
    const labelEl = document.getElementById(labelledById);
    const text = labelEl?.textContent?.trim();
    if (text) return text;
  }

  return undefined;
}

/**
 * Collects visible text from the closest non-trivial ancestor container,
 * capped at `maxChars` characters to avoid bloating the context object.
 */
function resolveNearbyText(
  el: HTMLInputElement | HTMLTextAreaElement,
  maxChars = 200
): string | undefined {
  // Walk up at most 4 levels to find a container with meaningful text
  let node: Element | null = el.parentElement;
  for (let depth = 0; depth < 4 && node; depth++, node = node.parentElement) {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text.length > 10) {
      return text.slice(0, maxChars);
    }
  }
  return undefined;
}

/**
 * Builds the `FieldContext` object that the classifier and heuristic engine
 * both consume. Pure — no side-effects beyond DOM reads.
 */
export function extractContext(
  el: HTMLInputElement | HTMLTextAreaElement
): FieldContext {
  return {
    label: resolveLabel(el) || undefined,
    placeholder: el.placeholder?.trim() || undefined,
    name: el.name?.trim() || undefined,
    id: el.id?.trim() || undefined,
    // For <textarea>, classify as 'textarea' so the classifier biases to essay
    type: el.tagName.toLowerCase() === 'textarea' ? 'textarea' : (el.type || undefined),
    nearbyText: resolveNearbyText(el),
    formTitle: document.title?.trim() || undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 3 – Confidence assignment for heuristic fills
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a classified field type to the confidence score we assign when the
 * heuristic engine successfully returns a value — reflecting how reliable a
 * keyword / profile match is for each type.
 */
function heuristicConfidence(type: FieldType): number {
  switch (type) {
    case 'email':
    case 'phone':
      return 0.95;

    case 'full_name':
    case 'first_name':
    case 'last_name':
    case 'dob':
    case 'linkedin':
    case 'github':
    case 'portfolio':
    case 'education':
    case 'job_title':
    case 'experience_years':
    case 'skills':
      return 0.9;

    case 'address':
    case 'city':
      return 0.8;

    default:
      // salary, unknown, …
      return 0.8;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 6 – LLM confidence
// ─────────────────────────────────────────────────────────────────────────────

function llmConfidence(type: FieldType): number {
  return type === 'essay' ? 0.9 : 0.7;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper – build the final FillResult
// ─────────────────────────────────────────────────────────────────────────────

function buildResult(
  value: string | null,
  source: FillResult['source'],
  confidence: number,
  type: FieldType,
  classification: ClassifierResult,
  heuristicTried: boolean,
  llmUsed: boolean,
  includeDebug: boolean
): FillResult {
  const result: FillResult = { value, source, confidence, type };
  if (includeDebug) {
    result.debug = { classification, heuristicTried, llmUsed };
  }
  return result;
}

function canUseBackgroundLlm(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    !!chrome.runtime?.sendMessage &&
    typeof chrome.runtime.id === 'string' &&
    chrome.runtime.id.length > 0
  );
}

function callLlmViaBackground(
  profile: UserProfile,
  llmContext: {
    label: string;
    placeholder: string;
    name: string;
    id: string;
    type?: string;
  },
  userInstruction?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!canUseBackgroundLlm()) {
      reject(new Error('Background messaging unavailable'));
      return;
    }

    try {
      const extensionId = chrome.runtime.id;
      chrome.runtime.sendMessage(
        extensionId,
        {
          type: 'FILLAI_GENERATE',
          profile,
          fieldContext: {
            label: llmContext.label,
            placeholder: llmContext.placeholder,
            name: llmContext.name,
            id: llmContext.id,
            type: llmContext.type ?? '',
          },
          userInstruction,
        },
        (resp?: BackgroundGenerateResponse) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message || 'Extension messaging failed'));
            return;
          }

          if (!resp?.success) {
            reject(new Error(resp?.error || 'Background AI generation failed'));
            return;
          }

          const text = (resp.text || '').trim();
          if (!text) {
            reject(new Error('Background AI returned empty response'));
            return;
          }

          resolve(text);
        }
      );
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export – processField
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full autofill pipeline for a single DOM field.
 *
 * @param el      - The input or textarea element to fill.
 * @param profile - The user's saved profile data.
 * @param options - Optional user instruction and debug flag.
 *
 * @returns A `FillResult` describing the outcome. `value` is null when the
 *          field was skipped or no suitable content could be generated.
 *
 * @example
 * ```ts
 * const input = document.querySelector<HTMLInputElement>('#email');
 * const result = await processField(input, userProfile, { debug: true });
 * if (result.value) input.value = result.value;
 * ```
 */
export async function processField(
  el: HTMLInputElement | HTMLTextAreaElement,
  profile: UserProfile,
  options: ProcessFieldOptions = {}
): Promise<FillResult> {
  const includeDebug = options.debug ?? false;

  // ── Guard ────────────────────────────────────────────────────────────────
  if (!isElementFillable(el)) {
    // Return a typed 'none' result without wasting cycles on classification
    const emptyCtx: FieldContext = {};
    const stubClassification: ClassifierResult = {
      type: 'unknown',
      confidence: 0,
      matchedKeywords: [],
    };
    return buildResult(null, 'none', 0, 'unknown', stubClassification, false, false, includeDebug);
  }

  // ── Stage 2: Extract context ─────────────────────────────────────────────
  const context = extractContext(el);

  // If the context carries absolutely no textual signal, bail early.
  const hasAnyContext =
    context.label ||
    context.placeholder ||
    context.name ||
    context.id ||
    context.nearbyText ||
    context.formTitle;

  // ── Stage 3: Classify ────────────────────────────────────────────────────
  const classification = classifyField(context);
  const { type, confidence: classConfidence } = classification;

  // ── Stage 4: Heuristic attempt ───────────────────────────────────────────
  // The heuristic engine expects at least label/placeholder/name/id strings.
  const heuristicContext = {
    label: context.label ?? '',
    placeholder: context.placeholder ?? '',
    name: context.name ?? '',
    id: context.id ?? '',
  };

  let heuristicValue: string | null = null;
  let heuristicTried = false;

  // Never run heuristics on essay-type fields — they need LLM generation.
  if (type !== 'essay') {
    heuristicTried = true;
    heuristicValue = getHeuristicFill(profile, heuristicContext);
  }

  // ── Stage 5: Decision engine ─────────────────────────────────────────────

  /**
   * CASE 4 – No context at all AND unknown type with very low confidence.
   * Avoid filling random opaque fields.
   */
  if (!hasAnyContext && type === 'unknown' && classConfidence < 0.5) {
    return buildResult(null, 'none', 0, type, classification, heuristicTried, false, includeDebug);
  }

  /**
   * CASE 1 – Heuristic fill for a non-essay field.
   * If heuristics can confidently map profile data to this field, prefer
   * that deterministic path over LLM generation.
   */
  if (heuristicValue && type !== 'essay') {
    const conf = heuristicConfidence(type);
    return buildResult(heuristicValue, 'heuristic', conf, type, classification, heuristicTried, false, includeDebug);
  }

  /**
   * CASE 2 – Essay field.
   * Always use the LLM — a profile-lifted excerpt is a poor essay substitute.
   */
  if (type === 'essay') {
    return await callLlm(
      profile, context, type, classification,
      heuristicTried, options, includeDebug, heuristicValue
    );
  }

  /**
   * CASE 3 – Heuristic failed or classifier returned low confidence.
   * Try LLM to fill a field that heuristics couldn't match.
   *
   * We still skip the LLM for 'unknown' fields with very low confidence to
   * avoid blasting irrelevant content into mystery fields.
   */
  if (type !== 'unknown' || classConfidence >= 0.5) {
    return await callLlm(
      profile, context, type, classification,
      heuristicTried, options, includeDebug, heuristicValue
    );
  }

  // CASE 4 – Unknown + low confidence → do not fill
  return buildResult(null, 'none', 0, type, classification, heuristicTried, false, includeDebug);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper – LLM call with error handling
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls generateFieldResponse and gracefully handles failures.
 *
 * On LLM error:
 *   - if a heuristicValue happens to be available as a fallback, use it.
 *   - otherwise return source:'none' with value:null.
 */
async function callLlm(
  profile: UserProfile,
  context: FieldContext,
  type: FieldType,
  classification: ClassifierResult,
  heuristicTried: boolean,
  options: ProcessFieldOptions,
  includeDebug: boolean,
  heuristicFallback?: string | null
): Promise<FillResult> {
  // Build the field context object that generateFieldResponse expects
  const llmContext = {
    label: context.label ?? '',
    placeholder: context.placeholder ?? '',
    name: context.name ?? '',
    id: context.id ?? '',
    type: context.type,
  };

  const canUseCache = classification.confidence >= 0.6;
  let cacheKey: string | null = null;

  if (canUseCache) {
    cacheKey = SIMPLE_CACHE_TYPES.has(type)
      ? getSimpleKey(type, profile)
      : getContextKey(type, context.label ?? '');

    const cached = await getCache(cacheKey);
    if (cached) {
      return buildResult(cached, 'cache', 0.95, type, classification, heuristicTried, true, includeDebug);
    }
  }

  try {
    if (!canUseBackgroundLlm()) {
      throw new Error('Background messaging unavailable for LLM generation');
    }

    const value = await callLlmViaBackground(profile, llmContext, options.userInstruction);

    if (canUseCache && cacheKey) {
      await setCache(cacheKey, value);
    }

    const conf = llmConfidence(type);
    return buildResult(value, 'llm', conf, type, classification, heuristicTried, true, includeDebug);

  } catch (err) {
    // Log but don't rethrow — the extension must remain responsive
    console.warn('[FillAI] LLM call failed, attempting fallback.', err);

    if (heuristicFallback) {
      // We have a heuristic value that was not used as the primary path;
      // use it as a graceful degradation.
      const conf = heuristicConfidence(type);
      return buildResult(heuristicFallback, 'heuristic', conf, type, classification, heuristicTried, true, includeDebug);
    }

    return buildResult(null, 'none', 0, type, classification, heuristicTried, true, includeDebug);
  }
}
