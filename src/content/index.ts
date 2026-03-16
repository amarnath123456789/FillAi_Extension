import { getHeuristicFill } from '../services/heuristics';
import { UserProfile, defaultProfile } from '../types';

// ── Message types ────────────────────────────────────────────────────────────
interface GenerateRequest {
  type: 'FILLAI_GENERATE';
  profile: UserProfile;
  fieldContext: { label: string; placeholder: string; name: string; id: string; type: string };
  userInstruction?: string;
}
interface GenerateResponse { success: boolean; text?: string; error?: string; }

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
  padding: 0; transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
}
.btn:hover:not(:disabled) { transform: scale(1.1); }
.btn:active:not(:disabled) { transform: scale(0.95); }
.btn.instruction {
  background: #ff9800; border-color: #e68a00;
  box-shadow: 0 0 12px rgba(255,152,0,0.4);
}
.btn.generating { background: rgba(200,241,53,0.1); border-color: rgba(200,241,53,0.35); color: #c8f135; cursor: not-allowed; }
.btn.success    { background: rgba(16,185,129,0.12); border-color: rgba(16,185,129,0.4); box-shadow: 0 0 10px rgba(16,185,129,0.25); color: #fff; }
.btn.error      { background: rgba(239,68,68,0.12);  border-color: rgba(239,68,68,0.4);  box-shadow: 0 0 10px rgba(239,68,68,0.25); color: #fff; }
.spinner {
  width: 12px; height: 12px;
  border: 2px solid rgba(200,241,53,0.3); border-top-color: #c8f135;
  border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
`;

const BOLT  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M13 2L4.5 13.5H11L10 22L20 10H13.5L13 2Z" fill="currentColor" stroke-linejoin="round"/></svg>`;
const CHECK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const ERR   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

// ── State ────────────────────────────────────────────────────────────────────
let activeField: HTMLInputElement | HTMLTextAreaElement | null = null;
let btnHost: HTMLDivElement | null = null;
let btnEl: HTMLButtonElement | null = null;
let statusTimer: ReturnType<typeof setTimeout> | null = null;
let blurTimer: ReturnType<typeof setTimeout> | null = null;
let fieldInputListener: (() => void) | null = null;
let isGenerating = false;

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
    background: type === 'success' ? '#c8f135' : 'rgba(69,10,10,0.92)',
    border: `1px solid ${type === 'success' ? '#a8d020' : 'rgba(248,113,113,0.3)'}`,
    backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
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

    if (!userInstruction) {
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
