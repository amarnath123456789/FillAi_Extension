import { getHeuristicFill } from '../services/heuristics';
import { runAutofill } from '../services/autofillController';
import { UserProfile, defaultProfile } from '../types';
import { classifyField } from '../utils/classifier';

// ── Message types ────────────────────────────────────────────────────────────
interface GenerateRequest {
  type: 'FILLAI_GENERATE';
  profile: UserProfile;
  fieldContext: { label: string; placeholder: string; name: string; id: string; type: string };
  userInstruction?: string;
}
interface GenerateResponse { success: boolean; text?: string; error?: string; }

interface RunAutofillRequest {
  type: 'RUN_AUTOFILL';
}

interface RunAutofillResponse {
  success: boolean;
  error?: string;
}

// ── Styles injected into shadow root (fully isolated from the page) ──────────
const SHADOW_CSS = `
:host { all: initial; }
.btn {
  width: 28px; height: 28px; border-radius: 7px;
  border: 1px solid rgba(200,241,53,0.5);
  background: #c8f135;
  color: #0e0e0e;
  box-shadow: 0 0 10px rgba(200,241,53,0.3);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  padding: 0; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}
.btn:hover:not(:disabled) { transform: scale(1.1); }
.btn:active:not(:disabled) { transform: scale(0.95); }
.btn.instruction {
  background: #ff9800; border-color: #e68a00;
  box-shadow: 0 0 12px rgba(255,152,0,0.4);
}
.btn.generating { 
  background: rgba(200,241,53,0.05); 
  border-color: rgba(200,241,53,0.4); 
  color: #c8f135; 
  cursor: not-allowed; 
}
.btn.success { 
  background: #c8f135; 
  border-color: #a8d020; 
  box-shadow: 0 0 15px rgba(200,241,53,0.5); 
  color: #0e0e0e; 
}
.btn.error { 
  background: #ef4444;  
  border-color: #dc2626;  
  box-shadow: 0 0 12px rgba(239,68,68,0.4); 
  color: #fff; 
}

/* Spinner & Success Animation */
.spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(200,241,53,0.2);
  border-top-color: #c8f135;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.check-svg { width: 14px; height: 14px; stroke: currentColor; }
.check-path {
  stroke-dasharray: 20;
  stroke-dashoffset: 20;
  animation: draw-check 0.4s ease forwards;
}

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes draw-check { to { stroke-dashoffset: 0; } }
`;

const BOLT  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.5 13.5H11L10 22L20 10H13.5L13 2Z" fill="currentColor"/></svg>`;
const CHECK = `<svg class="check-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline class="check-path" points="20 6 9 17 4 12"/></svg>`;
const ERR   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

// ── State ────────────────────────────────────────────────────────────────────
let activeField: HTMLInputElement | HTMLTextAreaElement | null = null;
let btnHost: HTMLDivElement | null = null;
let btnEl: HTMLButtonElement | null = null;
let statusTimer: ReturnType<typeof setTimeout> | null = null;
let blurTimer: ReturnType<typeof setTimeout> | null = null;
let fieldInputListener: (() => void) | null = null;
let isGenerating = false;
let pageAutofillHost: HTMLDivElement | null = null;
let pageAutofillBtn: HTMLButtonElement | null = null;
let isPageAutofilling = false;

// ── Field eligibility ────────────────────────────────────────────────────────
function isEligible(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) {
    const t = el.type.toLowerCase();
    return ['text', 'email', 'tel', 'url', 'search', 'date', 'number'].includes(t)
      && !el.readOnly && !el.disabled;
  }
  return false;
}

// ── Storage ──────────────────────────────────────────────────────────────────
async function getProfile(): Promise<UserProfile> {
  try {
    const r = await chrome.storage.local.get('quickfill_profile');
    if (r.quickfill_profile) return { ...defaultProfile, ...r.quickfill_profile };
  } catch { /* ignore */ }
  return defaultProfile;
}

// ── Field context extraction ─────────────────────────────────────────────────
function extractContext(field: HTMLInputElement | HTMLTextAreaElement) {
  let label = '';
  if (field.id) {
    try {
      const el = document.querySelector<HTMLLabelElement>(`label[for="${field.id.replace(/"/g, '\\"')}"]`);
      if (el) label = el.textContent?.trim() ?? '';
    } catch { /* ignore */ }
  }
  if (!label) {
    const wrap = field.closest('label');
    if (wrap) label = (wrap.textContent ?? '').replace(field.value, '').trim();
  }
  if (!label) label = field.getAttribute('aria-label')?.trim() ?? '';
  if (!label) {
    const lblId = field.getAttribute('aria-labelledby');
    if (lblId) label = document.getElementById(lblId)?.textContent?.trim() ?? '';
  }
  if (!label) label = field.previousElementSibling?.textContent?.trim() ?? '';
  return {
    label,
    placeholder: field.placeholder ?? '',
    name: field.name ?? '',
    id: field.id ?? '',
    type: field instanceof HTMLTextAreaElement ? 'textarea' : field.type,
  };
}

// ── Fill a field (React-compatible native setter) ────────────────────────────
function fillField(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(field, value); else field.value = value;
  field.dispatchEvent(new Event('input',  { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
}

// ── Background messaging ─────────────────────────────────────────────────────
function sendToBackground(msg: GenerateRequest): Promise<GenerateResponse> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(msg, (resp: GenerateResponse) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message ?? 'Extension error'));
        } else {
          resolve(resp);
        }
      });
    } catch (e) { reject(e); }
  });
}

// ── Toast notification ────────────────────────────────────────────────────────
function showToast(msg: string, type: 'success' | 'error') {
  const ID = 'fillai-cs-toast';
  document.getElementById(ID)?.remove();
  const el = document.createElement('div');
  el.id = ID;
  el.textContent = msg;
  Object.assign(el.style, {
    position: 'fixed', bottom: '24px', right: '24px', zIndex: '2147483647',
    padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '600',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color:      type === 'success' ? '#0e0e0e'           : '#f87171',
    background: type === 'success' ? '#c8f135'           : 'rgba(69,10,10,0.92)',
    border:     `1px solid ${type === 'success' ? '#a8d020' : 'rgba(248,113,113,0.3)'}`,
    backdropFilter: 'blur(8px)', boxShadow: type === 'success' ? '0 4px 24px rgba(200,241,53,0.3)' : '0 4px 24px rgba(0,0,0,0.4)',
    transition: 'opacity 0.3s ease',
  });
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2700);
}

// ── Button lifecycle ──────────────────────────────────────────────────────────
function mountBtn() {
  if (btnHost) btnHost.remove();
  btnHost = document.createElement('div');
  Object.assign(btnHost.style, { position: 'fixed', zIndex: '2147483647', width: '28px', height: '28px' });
  const shadow = btnHost.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = SHADOW_CSS;
  shadow.appendChild(style);
  btnEl = document.createElement('button');
  btnEl.className = 'btn';
  btnEl.title = 'FillAI — auto-fill this field';
  btnEl.innerHTML = BOLT;
  btnEl.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
  btnEl.addEventListener('click', handleClick);
  shadow.appendChild(btnEl);
  document.body.appendChild(btnHost);
}

function positionBtn(field: Element) {
  if (!btnHost) return;
  const r = field.getBoundingClientRect();
  btnHost.style.top  = `${r.top  + 6}px`;
  btnHost.style.left = `${r.right - 34}px`;
}

function setStatus(s: 'idle' | 'instruction' | 'generating' | 'success' | 'error') {
  if (!btnEl) return;
  btnEl.className = s !== 'idle' ? `btn ${s}` : 'btn';
  (btnEl as HTMLButtonElement).disabled = s === 'generating';
  btnEl.innerHTML = s === 'generating' ? '<div class="spinner"></div>'
    : s === 'success' ? CHECK
    : s === 'error'   ? ERR
    : BOLT;
  if (s === 'idle' || s === 'instruction') {
    btnEl.title = s === 'instruction'
      ? 'FillAI — using your text as instruction'
      : 'FillAI — auto-fill this field';
  }
}

function syncInstructionState() {
  if (!activeField || isGenerating) return;
  setStatus(activeField.value.trim().length > 0 ? 'instruction' : 'idle');
}

function detachField() {
  if (fieldInputListener && activeField) activeField.removeEventListener('input', fieldInputListener);
  fieldInputListener = null;
  btnHost?.remove();
  btnHost = null; btnEl = null; activeField = null; isGenerating = false;
}

function setPageAutofillBtnState(state: 'idle' | 'running') {
  if (!pageAutofillBtn) return;
  if (state === 'running') {
    pageAutofillBtn.disabled = true;
    pageAutofillBtn.textContent = 'Autofilling…';
    pageAutofillBtn.style.opacity = '0.7';
    pageAutofillBtn.style.cursor = 'not-allowed';
    return;
  }

  pageAutofillBtn.disabled = false;
  pageAutofillBtn.textContent = 'Autofill';
  pageAutofillBtn.style.opacity = '1';
  pageAutofillBtn.style.cursor = 'pointer';
}

async function runPageAutofill() {
  if (isPageAutofilling) return;
  isPageAutofilling = true;
  setPageAutofillBtnState('running');

  try {
    console.log('[Trigger] Running autofill...');
    const profile = await getProfile();
    await runAutofill(profile);
    console.log('[Trigger] Completed');
    showToast('✓ Autofill completed', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Autofill failed';
    console.error('[Trigger] Autofill failed:', message);
    showToast(message, 'error');
  } finally {
    isPageAutofilling = false;
    setPageAutofillBtnState('idle');
  }
}

function mountPageAutofillTrigger() {
  if (window.top !== window.self) return;
  if (pageAutofillHost) return;

  pageAutofillHost = document.createElement('div');
  Object.assign(pageAutofillHost.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '2147483646',
  });

  pageAutofillBtn = document.createElement('button');
  pageAutofillBtn.type = 'button';
  pageAutofillBtn.textContent = 'Autofill';
  Object.assign(pageAutofillBtn.style, {
    borderRadius: '999px',
    border: '1px solid #a8d020',
    background: '#c8f135',
    color: '#0e0e0e',
    fontFamily: "'Syne', 'Inter', system-ui, -apple-system, sans-serif",
    fontSize: '12px',
    fontWeight: '800',
    letterSpacing: '0.01em',
    padding: '8px 14px',
    boxShadow: '0 6px 20px rgba(200,241,53,0.35)',
    cursor: 'pointer',
    transform: 'translateY(0) scale(1)',
    transition: 'transform 140ms ease, box-shadow 140ms ease, filter 140ms ease, opacity 140ms ease',
  });

  pageAutofillBtn.addEventListener('mouseenter', () => {
    if (!pageAutofillBtn || pageAutofillBtn.disabled) return;
    pageAutofillBtn.style.transform = 'translateY(-1px) scale(1.01)';
    pageAutofillBtn.style.boxShadow = '0 9px 24px rgba(200,241,53,0.42)';
    pageAutofillBtn.style.filter = 'brightness(1.03)';
  });

  pageAutofillBtn.addEventListener('mouseleave', () => {
    if (!pageAutofillBtn) return;
    pageAutofillBtn.style.transform = 'translateY(0) scale(1)';
    pageAutofillBtn.style.boxShadow = '0 6px 20px rgba(200,241,53,0.35)';
    pageAutofillBtn.style.filter = 'none';
  });

  pageAutofillBtn.addEventListener('mousedown', () => {
    if (!pageAutofillBtn || pageAutofillBtn.disabled) return;
    pageAutofillBtn.style.transform = 'translateY(0) scale(0.97)';
  });

  pageAutofillBtn.addEventListener('mouseup', () => {
    if (!pageAutofillBtn || pageAutofillBtn.disabled) return;
    pageAutofillBtn.style.transform = 'translateY(-1px) scale(1.01)';
  });

  pageAutofillBtn.addEventListener('click', () => {
    void runPageAutofill();
  });

  pageAutofillHost.appendChild(pageAutofillBtn);
  document.body.appendChild(pageAutofillHost);
}

// ── Fill click handler ────────────────────────────────────────────────────────
async function handleClick(e: MouseEvent) {
  e.preventDefault(); e.stopPropagation();
  if (!activeField || isGenerating) return;
  isGenerating = true;
  if (statusTimer) clearTimeout(statusTimer);
  setStatus('generating');

  const field = activeField;
  const profile = await getProfile();
  const ctx = extractContext(field);
  const userInstruction = field.value.trim();

  try {
    let result: string | null = null;
    let mode: 'profile' | 'instruction' | 'ai' = 'ai';

    const classifierResult = classifyField(ctx);
    const shouldTryHeuristics = classifierResult.type !== 'essay';

    if (!userInstruction && shouldTryHeuristics) {
      result = getHeuristicFill(profile, ctx);
      if (result) mode = 'profile';
    }

    if (!result) {
      mode = userInstruction ? 'instruction' : 'ai';

      const resp = await sendToBackground({
        type: 'FILLAI_GENERATE', profile, fieldContext: ctx,
        userInstruction: userInstruction || undefined,
      });
      if (!resp.success) throw new Error(resp.error ?? 'Generation failed');
      result = resp.text ?? '';
    }

    if (!result) throw new Error('No response generated.');
    fillField(field, result);
    setStatus('success');
    showToast(
      mode === 'profile'     ? '✓ Filled from profile'
        : mode === 'instruction' ? '✓ Filled with your instruction'
        : '✓ Filled with AI',
      'success'
    );
    statusTimer = setTimeout(() => { isGenerating = false; syncInstructionState(); }, 2000);
  } catch (err) {
    setStatus('error');
    showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    statusTimer = setTimeout(() => { isGenerating = false; syncInstructionState(); }, 3000);
  } finally {
    field.focus();
  }
}

// ── Global DOM listeners ──────────────────────────────────────────────────────
document.addEventListener('focusin', (e: FocusEvent) => {
  if (!isEligible(e.target)) return;
  if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
  if (e.target === activeField) { positionBtn(e.target); return; }

  // New field focused — clean up previous
  if (fieldInputListener && activeField) activeField.removeEventListener('input', fieldInputListener);
  if (btnHost) btnHost.remove();
  activeField = e.target;
  isGenerating = false;
  mountBtn();
  positionBtn(e.target);
  syncInstructionState();
  fieldInputListener = () => syncInstructionState();
  activeField.addEventListener('input', fieldInputListener);
}, true);

document.addEventListener('focusout', (e: FocusEvent) => {
  if (e.target !== activeField) return;
  if (blurTimer) clearTimeout(blurTimer);
  // Delay so a click on the FillAI button (mousedown: preventDefault) keeps things alive
  blurTimer = setTimeout(() => { detachField(); }, 200);
}, true);

window.addEventListener('scroll', () => { if (activeField && btnHost) positionBtn(activeField); }, true);
window.addEventListener('resize', () => { if (activeField && btnHost) positionBtn(activeField); });

mountPageAutofillTrigger();

chrome.runtime.onMessage.addListener((message: RunAutofillRequest, _sender, sendResponse: (response: RunAutofillResponse) => void) => {
  if (!message || message.type !== 'RUN_AUTOFILL') return;

  console.log('[Trigger] Message received');

  (async () => {
    try {
      console.log('[Trigger] Running autofill...');
      const profile = await getProfile();
      await runAutofill(profile);
      console.log('[Trigger] Completed');
      sendResponse({ success: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Autofill failed';
      console.error('[Trigger] Autofill failed:', errorMessage);
      sendResponse({ success: false, error: errorMessage });
    }
  })();

  return true;
});
