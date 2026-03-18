import { processField, FillResult } from './fieldProcessor';
import { UserProfile } from '../types';

type SupportedField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type ProcessableField = HTMLInputElement | HTMLTextAreaElement;
type AutofillAction = 'autofill' | 'suggest' | 'skip';

const SUGGESTION_Z_INDEX = '2147483647';
const FIELD_DELAY_MS = 100;
const DEBUG_AUTOFILL = false;
const REPOSITION_THROTTLE_MS = 16;

const THEME = {
  black: '#0e0e0e',
  blackSoft: '#151515',
  card: 'rgba(26,26,26,0.96)',
  border: 'rgba(200,241,53,0.28)',
  borderSoft: 'rgba(255,255,255,0.12)',
  lime: '#c8f135',
  limeDark: '#a8d020',
  limeGlow: 'rgba(200,241,53,0.22)',
  white: '#ffffff',
  muted: '#b8b8b8',
  dim: '#7a7a7a',
  fontDisplay: "'Syne', 'Inter', system-ui, -apple-system, sans-serif",
  fontBody: "'Inter', system-ui, -apple-system, sans-serif",
};

type SuggestionEntry = {
  host: HTMLDivElement;
};

const suggestionByField = new Map<SupportedField, SuggestionEntry>();
let hasTrackingListeners = false;
let lastRepositionTs = 0;

function isStyleHidden(field: SupportedField): boolean {
  const style = window.getComputedStyle(field);
  return style.display === 'none' || style.visibility === 'hidden';
}

function isEligibleField(field: SupportedField): boolean {
  if (!field.isConnected) return false;
  if (field.disabled) return false;
  if ('readOnly' in field && field.readOnly) return false;
  if (field instanceof HTMLInputElement && field.type.toLowerCase() === 'hidden') return false;
  if (isStyleHidden(field)) return false;
  return true;
}

function hasExistingValue(field: SupportedField): boolean {
  if (field instanceof HTMLSelectElement) {
    return field.value.trim().length > 0;
  }
  return field.value.trim().length > 0;
}

function truncatePreview(value: string, maxLength = 72): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dispatchFieldEvents(field: SupportedField): void {
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
}

function setInputOrTextareaValue(field: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) {
    setter.call(field, value);
  } else {
    field.value = value;
  }
}

function setSelectValue(field: HTMLSelectElement, value: string): void {
  const byExactValue = Array.from(field.options).find(option => option.value === value);
  if (byExactValue) {
    field.value = byExactValue.value;
    return;
  }

  const normalized = value.trim().toLowerCase();
  const byText = Array.from(field.options).find(option => option.text.trim().toLowerCase() === normalized);
  if (byText) {
    field.value = byText.value;
    return;
  }

  const byContains = Array.from(field.options).find(option => {
    const optionText = option.text.trim().toLowerCase();
    return optionText.includes(normalized) || normalized.includes(optionText);
  });
  if (byContains) {
    field.value = byContains.value;
  }
}

function removeSuggestion(field: SupportedField): void {
  const existing = suggestionByField.get(field);
  if (existing) {
    existing.host.remove();
    suggestionByField.delete(field);
  }
  if (suggestionByField.size === 0) {
    disableSuggestionTracking();
  }
}

function removeAllStaleSuggestions(): void {
  for (const [field, entry] of suggestionByField.entries()) {
    if (!field.isConnected) {
      entry.host.remove();
      suggestionByField.delete(field);
    }
  }
  if (suggestionByField.size === 0) {
    disableSuggestionTracking();
  }
}

function positionSuggestion(host: HTMLDivElement, field: SupportedField): void {
  const rect = field.getBoundingClientRect();
  const margin = 8;
  const viewportPadding = 8;

  const rightLeft = rect.right + margin;
  const leftLeft = rect.left - host.offsetWidth - margin;
  const centeredTop = rect.top + Math.max(0, (rect.height - host.offsetHeight) / 2);

  const canPlaceRight = rightLeft + host.offsetWidth <= window.innerWidth - viewportPadding;
  const canPlaceLeft = leftLeft >= viewportPadding;

  let top = centeredTop;
  let left = rect.left;

  if (canPlaceRight) {
    left = rightLeft;
  } else if (canPlaceLeft) {
    left = leftLeft;
  } else {
    const belowTop = rect.bottom + margin;
    const aboveTop = rect.top - host.offsetHeight - margin;
    const maxTop = Math.max(viewportPadding, window.innerHeight - host.offsetHeight - viewportPadding);
    top = belowTop <= maxTop ? belowTop : Math.max(viewportPadding, aboveTop);
    left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - host.offsetWidth - viewportPadding)
    );
  }

  top = Math.min(
    Math.max(viewportPadding, top),
    Math.max(viewportPadding, window.innerHeight - host.offsetHeight - viewportPadding)
  );

  host.style.top = `${top}px`;
  host.style.left = `${left}px`;
}

function repositionAllSuggestions(): void {
  removeAllStaleSuggestions();
  for (const [field, entry] of suggestionByField.entries()) {
    positionSuggestion(entry.host, field);
  }
}

function onViewportMove(): void {
  const now = Date.now();
  if (now - lastRepositionTs < REPOSITION_THROTTLE_MS) return;
  lastRepositionTs = now;
  repositionAllSuggestions();
}

function enableSuggestionTracking(): void {
  if (hasTrackingListeners) return;
  window.addEventListener('scroll', onViewportMove, true);
  window.addEventListener('resize', onViewportMove);
  hasTrackingListeners = true;
}

function disableSuggestionTracking(): void {
  if (!hasTrackingListeners) return;
  window.removeEventListener('scroll', onViewportMove, true);
  window.removeEventListener('resize', onViewportMove);
  hasTrackingListeners = false;
}

function applyButtonMotion(button: HTMLButtonElement, options: { hoverBg?: string; hoverColor?: string; hoverBorder?: string }): void {
  const baseTransform = 'translateY(0) scale(1)';
  const pressedTransform = 'translateY(0) scale(0.97)';
  const hoverTransform = 'translateY(-1px) scale(1.01)';
  const baseBg = button.style.background;
  const baseColor = button.style.color;
  const baseBorder = button.style.border;

  button.style.transition = 'transform 140ms ease, box-shadow 140ms ease, background 140ms ease, color 140ms ease, border-color 140ms ease';
  button.style.transform = baseTransform;

  button.addEventListener('mouseenter', () => {
    button.style.transform = hoverTransform;
    button.style.boxShadow = '0 6px 14px rgba(0,0,0,0.22)';
    if (options.hoverBg) button.style.background = options.hoverBg;
    if (options.hoverColor) button.style.color = options.hoverColor;
    if (options.hoverBorder) button.style.border = options.hoverBorder;
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = baseTransform;
    button.style.boxShadow = 'none';
    button.style.background = baseBg;
    button.style.color = baseColor;
    button.style.border = baseBorder;
  });

  button.addEventListener('mousedown', () => {
    button.style.transform = pressedTransform;
  });

  button.addEventListener('mouseup', () => {
    button.style.transform = hoverTransform;
  });
}

function animateSuggestionIn(host: HTMLDivElement): void {
  host.style.opacity = '0';
  host.style.transform = 'translateY(4px) scale(0.98)';
  host.style.transition = 'opacity 150ms ease, transform 150ms ease';
  requestAnimationFrame(() => {
    host.style.opacity = '1';
    host.style.transform = 'translateY(0) scale(1)';
  });
}

function processAnyField(field: SupportedField, profile: UserProfile): Promise<FillResult> {
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    return processField(field, profile);
  }

  return processField(field as unknown as ProcessableField, profile);
}

export function getAllFields(): SupportedField[] {
  const fields = Array.from(document.querySelectorAll<SupportedField>('input, textarea, select'));
  return fields.filter(isEligibleField);
}

export function decideAction(result: FillResult): AutofillAction {
  if (!result.value) return 'skip';
  if (result.source === 'heuristic') return 'autofill';
  if (result.confidence >= 0.9) return 'autofill';
  if (result.confidence >= 0.6) return 'suggest';
  return 'skip';
}

export function autofillField(field: SupportedField, value: string): void {
  if (!value) return;

  if (field instanceof HTMLSelectElement) {
    setSelectValue(field, value);
  } else {
    setInputOrTextareaValue(field, value);
  }

  dispatchFieldEvents(field);
}

export function showSuggestion(field: SupportedField, value: string): void {
  if (!value) return;

  removeSuggestion(field);
  enableSuggestionTracking();

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.zIndex = SUGGESTION_Z_INDEX;
  host.style.maxWidth = '200px';
  host.style.minWidth = '170px';
  host.style.padding = '6px';
  host.style.borderRadius = '10px';
  host.style.border = `1px solid ${THEME.border}`;
  host.style.background = THEME.card;
  host.style.color = THEME.white;
  host.style.fontFamily = THEME.fontBody;
  host.style.fontSize = '11px';
  host.style.boxShadow = `0 8px 20px rgba(0,0,0,0.32), 0 0 0 1px ${THEME.limeGlow}`;
  host.style.backdropFilter = 'blur(8px)';
  host.style.pointerEvents = 'auto';

  const head = document.createElement('div');
  head.style.display = 'flex';
  head.style.alignItems = 'center';
  head.style.justifyContent = 'space-between';
  head.style.marginBottom = '4px';

  const label = document.createElement('div');
  label.textContent = 'FillAI';
  label.style.color = THEME.lime;
  label.style.fontFamily = THEME.fontDisplay;
  label.style.fontSize = '11px';
  label.style.fontWeight = '800';
  label.style.letterSpacing = '0.01em';

  const status = document.createElement('div');
  status.textContent = 'Suggestion';
  status.style.color = THEME.dim;
  status.style.fontSize = '9px';
  status.style.fontWeight = '700';
  status.style.letterSpacing = '0.08em';
  label.style.textTransform = 'uppercase';

  head.appendChild(label);
  head.appendChild(status);

  const preview = document.createElement('div');
  preview.textContent = truncatePreview(value);
  preview.style.color = THEME.white;
  preview.title = value;
  preview.style.marginBottom = '6px';
  preview.style.padding = '5px 6px';
  preview.style.borderRadius = '7px';
  preview.style.background = THEME.blackSoft;
  preview.style.border = `1px solid ${THEME.borderSoft}`;
  preview.style.lineHeight = '1.25';
  preview.style.whiteSpace = 'nowrap';
  preview.style.overflow = 'hidden';
  preview.style.textOverflow = 'ellipsis';

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '6px';

  const accept = document.createElement('button');
  accept.type = 'button';
  accept.textContent = 'Approve';
  accept.style.border = `1px solid ${THEME.limeDark}`;
  accept.style.background = THEME.lime;
  accept.style.color = THEME.black;
  accept.style.borderRadius = '7px';
  accept.style.padding = '4px 8px';
  accept.style.fontFamily = THEME.fontDisplay;
  accept.style.fontSize = '10px';
  accept.style.fontWeight = '700';
  accept.style.cursor = 'pointer';
  accept.style.flex = '1';
  applyButtonMotion(accept, {
    hoverBg: '#d6fb49',
    hoverBorder: `1px solid ${THEME.lime}`,
  });

  const reject = document.createElement('button');
  reject.type = 'button';
  reject.textContent = 'Decline';
  reject.style.border = `1px solid ${THEME.borderSoft}`;
  reject.style.background = 'rgba(255,255,255,0.06)';
  reject.style.color = THEME.white;
  reject.style.borderRadius = '7px';
  reject.style.padding = '4px 8px';
  reject.style.fontFamily = THEME.fontDisplay;
  reject.style.fontSize = '10px';
  reject.style.fontWeight = '700';
  reject.style.cursor = 'pointer';
  reject.style.flex = '1';
  applyButtonMotion(reject, {
    hoverBg: 'rgba(255,255,255,0.12)',
    hoverColor: THEME.white,
    hoverBorder: `1px solid rgba(255,255,255,0.2)`,
  });

  accept.addEventListener('click', event => {
    event.preventDefault();
    autofillField(field, value);
    removeSuggestion(field);
  });

  reject.addEventListener('click', event => {
    event.preventDefault();
    removeSuggestion(field);
  });

  actions.appendChild(accept);
  actions.appendChild(reject);
  host.appendChild(head);
  host.appendChild(preview);
  host.appendChild(actions);

  document.body.appendChild(host);
  animateSuggestionIn(host);
  positionSuggestion(host, field);
  suggestionByField.set(field, { host });
}

export async function runAutofill(profile: UserProfile): Promise<void> {
  removeAllStaleSuggestions();
  const fields = getAllFields();

  for (const field of fields) {
    if (!isEligibleField(field)) {
      continue;
    }

    let result: FillResult;
    try {
      result = await processAnyField(field, profile);
    } catch {
      await wait(FIELD_DELAY_MS);
      continue;
    }

    let action = decideAction(result);
    if (action === 'autofill' && hasExistingValue(field)) {
      action = 'suggest';
    }

    if (DEBUG_AUTOFILL) {
      console.log({ field, result, action });
    }

    if (!isEligibleField(field)) {
      await wait(FIELD_DELAY_MS);
      continue;
    }

    if (action === 'autofill' && result.value) {
      autofillField(field, result.value);
    } else if (action === 'suggest' && result.value) {
      showSuggestion(field, result.value);
    }

    await wait(FIELD_DELAY_MS);
  }
}

export function clearAllSuggestions(): void {
  for (const [field, entry] of suggestionByField.entries()) {
    entry.host.remove();
    suggestionByField.delete(field);
  }
  disableSuggestionTracking();
}

/**
 * Example usage:
 * runAutofill(userProfile);
 */