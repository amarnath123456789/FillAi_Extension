import { getHeuristicFill } from '../services/heuristics';
import { runAutofill } from '../services/autofillController';
import { UserProfile, defaultProfile } from '../types';
import { classifyField, FieldType } from '../utils/classifier';
import { isFormPage } from '../utils/formDetector';
import { getCache, getContextKey, getSimpleKey, setCache } from '../utils/cache';

// ── Message types ────────────────────────────────────────────────────────────
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
  --energy: 0;
  --fill-progress: 0%;
  --energy-blur-1: 1.6px;
  --energy-blur-2: 3.2px;
  --energy-alpha-1: 0.16;
  --energy-alpha-2: 0.1;
  --energy-scale: 1;
  width: 28px; height: 28px; border-radius: 7px;
  border: 1px solid rgba(200,241,53,0.5);
  background: #c8f135;
  color: #0e0e0e;
  box-shadow: none;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  padding: 0; transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;
  overflow: hidden;
  position: relative;
}
.btn:hover:not(:disabled) { transform: scale(1.1); }
.btn:active:not(:disabled) { transform: scale(0.95); }
.btn.instruction {
  background: #c8f135;
  border-color: rgba(200,241,53,0.7);
}
.btn.generating { 
  background: rgba(200,241,53,0.08); 
  border-color: rgba(200,241,53,0.4); 
  color: #0e0e0e;
  cursor: not-allowed; 
}
.btn.success { 
  background: #c8f135; 
  border-color: #a8d020; 
  box-shadow: 0 0 10px rgba(200,241,53,0.28); 
  color: #0e0e0e; 
}
.btn.error { 
  background: #ef4444;  
  border-color: #dc2626;  
  box-shadow: 0 0 10px rgba(239,68,68,0.35); 
  color: #fff; 
}

.liquid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(214, 246, 85, 0.98) 0%, rgba(200,241,53,0.98) 100%);
  transform: translateY(calc(100% - var(--fill-progress)));
  opacity: 0;
  transition: transform 220ms linear, opacity 180ms ease;
  z-index: 0;
}

.btn.generating .liquid,
.btn.success .liquid {
  opacity: 1;
}

.btn.generating .liquid {
  transition: none;
}

.btn.resetting .liquid {
  transition: transform 220ms ease-out, opacity 180ms ease;
}

.icon-slot {
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
  color: currentColor;
  opacity: 1;
  transform: scale(1);
  transition: color 180ms ease-in-out, filter 220ms ease-in-out, transform 180ms ease, opacity 180ms ease;
  will-change: transform, filter;
}

.btn.instruction .icon-slot {
  color: #edb313;
  transform: scale(1);
  filter: none;
}

.btn.generating .icon-slot {
  animation: bolt-spin-variable 1.4s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
}

.icon-slot.icon-fade-out {
  opacity: 0;
  transform: scale(0.8);
}

.icon-slot.icon-fade-in {
  opacity: 1;
  transform: scale(1);
}

.check-svg { width: 14px; height: 14px; stroke: currentColor; }
.check-path {
  stroke-dasharray: 20;
  stroke-dashoffset: 20;
  animation: draw-check 0.4s ease forwards;
}

@keyframes bolt-spin-variable {
  0%   { transform: rotate(0deg); }
  20%  { transform: rotate(220deg); }
  48%  { transform: rotate(360deg); }
  72%  { transform: rotate(620deg); }
  100% { transform: rotate(720deg); }
}

@keyframes draw-check { to { stroke-dashoffset: 0; } }

@media (prefers-reduced-motion: reduce) {
  .btn,
  .icon-slot,
  .liquid {
    transition-duration: 80ms !important;
  }

  .btn.generating .icon-slot,
  .liquid {
    animation: none !important;
  }
}
`;

const BOLT  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.5 13.5H11L10 22L20 10H13.5L13 2Z" fill="currentColor"/></svg>`;
const CHECK = `<svg class="check-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline class="check-path" points="20 6 9 17 4 12"/></svg>`;
const ERR   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

// ── State ────────────────────────────────────────────────────────────────────
let activeField: HTMLInputElement | HTMLTextAreaElement | null = null;
let btnHost: HTMLDivElement | null = null;
let btnEl: HTMLButtonElement | null = null;
let liquidEl: HTMLSpanElement | null = null;
let iconSlotEl: HTMLSpanElement | null = null;
let statusTimer: ReturnType<typeof setTimeout> | null = null;
let blurTimer: ReturnType<typeof setTimeout> | null = null;
let fieldInputListener: (() => void) | null = null;
let iconSwapTimer: ReturnType<typeof setTimeout> | null = null;
let loadingRaf: number | null = null;
let loadingStartTs = 0;
let loadingCanComplete = false;
let loadingCompleteStartTs = 0;
let loadingCompleteFrom = 0;
let loadingCompleteResolver: (() => void) | null = null;
let loadingCompletePromise: Promise<void> | null = null;
let fillProgress = 0;
let isGenerating = false;
let pageAutofillHost: HTMLDivElement | null = null;
let pageAutofillBtn: HTMLButtonElement | null = null;
let isPageAutofilling = false;
let formDetectionObserver: MutationObserver | null = null;
let formDetectionDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const SIMPLE_CACHE_TYPES: ReadonlySet<FieldType> = new Set([
  'full_name',
  'first_name',
  'last_name',
  'email',
  'phone',
  'linkedin',
]);

type FillMode = 'profile' | 'instruction' | 'ai' | 'cache';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function countWords(text: string): number {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

function getCacheKeyForType(
  type: FieldType,
  profile: UserProfile,
  fieldContext: { label: string; placeholder: string; name: string; id: string }
): string {
  return SIMPLE_CACHE_TYPES.has(type)
    ? getSimpleKey(type, profile)
    : getContextKey(type, fieldContext);
}

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
    if (wrap) {
      const clone = wrap.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('input, textarea, select').forEach((n) => n.remove());
      label = clone.textContent?.trim() ?? '';
    }
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
    const extensionId =
      typeof chrome !== 'undefined' && typeof chrome.runtime?.id === 'string' && chrome.runtime.id.length > 0
        ? chrome.runtime.id
        : null;

    if (!extensionId || !chrome.runtime?.sendMessage) {
      reject(new Error('Extension messaging unavailable in this context'));
      return;
    }

    try {
      chrome.runtime.sendMessage(extensionId, msg, (resp: GenerateResponse) => {
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

function setFillProgress(progress: number) {
  fillProgress = clamp(progress, 0, 1);
  if (!btnEl) return;
  btnEl.style.setProperty('--fill-progress', `${(fillProgress * 100).toFixed(1)}%`);
}

function stopLoadingAnimation() {
  if (loadingRaf != null) {
    cancelAnimationFrame(loadingRaf);
    loadingRaf = null;
  }

  if (loadingCompleteResolver) {
    loadingCompleteResolver();
    loadingCompleteResolver = null;
  }

  loadingCompletePromise = null;
  loadingCanComplete = false;
  loadingCompleteStartTs = 0;
  loadingCompleteFrom = 0;
}

function startLoadingAnimation() {
  stopLoadingAnimation();
  loadingStartTs = performance.now();
  loadingCanComplete = false;
  loadingCompleteStartTs = 0;
  loadingCompleteFrom = 0;
  loadingCompletePromise = new Promise<void>((resolve) => {
    loadingCompleteResolver = resolve;
  });
  setFillProgress(0);

  const tick = (now: number) => {
    if (!btnEl || !isGenerating) {
      stopLoadingAnimation();
      return;
    }

    if (!loadingCanComplete) {
      const elapsed = now - loadingStartTs;
      const inFlight = clamp(elapsed / 1200, 0, 1);
      const target = inFlight * 0.88;
      setFillProgress(target);
      loadingRaf = requestAnimationFrame(tick);
      return;
    }

    if (loadingCompleteStartTs === 0) {
      loadingCompleteStartTs = now;
      loadingCompleteFrom = fillProgress;
    }

    const doneElapsed = now - loadingCompleteStartTs;
    const donePct = clamp(doneElapsed / 320, 0, 1);
    const next = loadingCompleteFrom + (1 - loadingCompleteFrom) * donePct;
    setFillProgress(next);

    if (donePct >= 1) {
      if (loadingCompleteResolver) {
        loadingCompleteResolver();
        loadingCompleteResolver = null;
      }
      loadingRaf = null;
      return;
    }

    loadingRaf = requestAnimationFrame(tick);
  };

  loadingRaf = requestAnimationFrame(tick);
}

function completeLoadingAnimation(): Promise<void> {
  if (!loadingCompletePromise) return Promise.resolve();
  loadingCanComplete = true;
  return loadingCompletePromise;
}

function clearIconSwapTimer() {
  if (iconSwapTimer) {
    clearTimeout(iconSwapTimer);
    iconSwapTimer = null;
  }
}

function clearStatusTimer() {
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
}

function setIcon(svgMarkup: string, animated = false) {
  if (!iconSlotEl) return;

  clearIconSwapTimer();

  if (!animated) {
    iconSlotEl.classList.remove('icon-fade-out', 'icon-fade-in');
    iconSlotEl.innerHTML = svgMarkup;
    return;
  }

  iconSlotEl.classList.remove('icon-fade-in');
  iconSlotEl.classList.add('icon-fade-out');

  iconSwapTimer = setTimeout(() => {
    if (!iconSlotEl) return;
    iconSlotEl.innerHTML = svgMarkup;
    iconSlotEl.classList.remove('icon-fade-out');
    iconSlotEl.classList.add('icon-fade-in');
    iconSwapTimer = setTimeout(() => {
      iconSlotEl?.classList.remove('icon-fade-in');
      iconSwapTimer = null;
    }, 170);
  }, 110);
}

function setEnergy(intensity: number) {
  if (!btnEl) return;
  btnEl.style.setProperty('--energy', clamp(intensity, 0, 0.9).toFixed(3));
  btnEl.style.setProperty('--energy-blur-1', '0px');
  btnEl.style.setProperty('--energy-blur-2', '0px');
  btnEl.style.setProperty('--energy-alpha-1', '0');
  btnEl.style.setProperty('--energy-alpha-2', '0');
  btnEl.style.setProperty('--energy-scale', '1');
}

function resetVisualRuntimes() {
  stopLoadingAnimation();
  clearIconSwapTimer();
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
  setFillProgress(0);
  setEnergy(0);
  btnEl.title = 'FillAI — auto-fill this field';

  liquidEl = document.createElement('span');
  liquidEl.className = 'liquid';

  iconSlotEl = document.createElement('span');
  iconSlotEl.className = 'icon-slot';
  iconSlotEl.innerHTML = BOLT;

  btnEl.append(liquidEl, iconSlotEl);
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
  btnEl.classList.remove('resetting');
  btnEl.className = s !== 'idle' ? `btn ${s}` : 'btn';
  (btnEl as HTMLButtonElement).disabled = s === 'generating';

  if (s === 'generating') {
    setIcon(BOLT);
    startLoadingAnimation();
  } else {
    stopLoadingAnimation();
  }

  if (s === 'success') {
    setFillProgress(1);
    setIcon(CHECK, true);
  } else if (s === 'error') {
    setIcon(ERR, true);
    btnEl.classList.add('resetting');
    setFillProgress(0);
  } else {
    setIcon(BOLT);
    if (s === 'idle') {
      setEnergy(0);
      btnEl.classList.add('resetting');
      setFillProgress(0);
    }
    if (s === 'instruction') {
      btnEl.classList.add('resetting');
      setFillProgress(0);
    }
  }

  if (s === 'idle' || s === 'instruction') {
    btnEl.title = s === 'instruction'
      ? 'FillAI — using your text as instruction'
      : 'FillAI — auto-fill this field';
  } else if (s === 'generating') {
    btnEl.title = 'FillAI — generating';
  } else if (s === 'success') {
    btnEl.title = 'FillAI — completed';
  } else {
    btnEl.title = 'FillAI — failed';
  }
}

function syncInstructionState() {
  if (!activeField || isGenerating) return;
  const words = countWords(activeField.value);
  setEnergy(0);
  setStatus(words > 0 ? 'instruction' : 'idle');
}

function detachField() {
  resetVisualRuntimes();
  clearStatusTimer();
  if (fieldInputListener && activeField) activeField.removeEventListener('input', fieldInputListener);
  fieldInputListener = null;
  btnHost?.remove();
  btnHost = null;
  btnEl = null;
  liquidEl = null;
  iconSlotEl = null;
  activeField = null;
  isGenerating = false;
  fillProgress = 0;
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
  if (!isFormPage()) {
    showToast('No meaningful form detected on this page', 'error');
    return;
  }

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
  if (!isFormPage()) return;

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

  if (formDetectionObserver) {
    formDetectionObserver.disconnect();
    formDetectionObserver = null;
  }
  if (formDetectionDebounceTimer) {
    clearTimeout(formDetectionDebounceTimer);
    formDetectionDebounceTimer = null;
  }
}

function queueTriggerMountCheck(delayMs = 0) {
  setTimeout(() => {
    if (pageAutofillHost) return;
    mountPageAutofillTrigger();
  }, delayMs);
}

function startDynamicFormDetection() {
  if (window.top !== window.self) return;
  if (pageAutofillHost) return;

  queueTriggerMountCheck(300);
  queueTriggerMountCheck(1200);
  queueTriggerMountCheck(3000);

  if (formDetectionObserver || !document.body) return;

  formDetectionObserver = new MutationObserver(() => {
    if (pageAutofillHost) return;
    if (formDetectionDebounceTimer) clearTimeout(formDetectionDebounceTimer);
    formDetectionDebounceTimer = setTimeout(() => {
      formDetectionDebounceTimer = null;
      mountPageAutofillTrigger();
    }, 250);
  });

  formDetectionObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['type', 'disabled', 'style', 'class'],
  });
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
    let mode: FillMode = 'ai';
    let cacheKey: string | null = null;

    const classifierResult = classifyField(ctx);
    const shouldTryHeuristics = classifierResult.type !== 'essay';
    const canUseCache = classifierResult.confidence >= 0.6;

    if (!userInstruction && shouldTryHeuristics) {
      result = getHeuristicFill(profile, ctx);
      if (result) mode = 'profile';
    }

    if (!result) {
      if (canUseCache) {
        cacheKey = getCacheKeyForType(classifierResult.type, profile, {
          label: ctx.label,
          placeholder: ctx.placeholder,
          name: ctx.name,
          id: ctx.id,
        });
        const cached = await getCache(cacheKey);
        if (cached) {
          result = cached;
          mode = 'cache';
        }
      }
    }

    if (!result) {
      mode = userInstruction ? 'instruction' : 'ai';

      const resp = await sendToBackground({
        type: 'FILLAI_GENERATE', profile, fieldContext: ctx,
        userInstruction: userInstruction || undefined,
      });
      if (!resp.success) throw new Error(resp.error ?? 'Generation failed');
      result = resp.text ?? '';

      if (resp.source === 'heuristic') {
        mode = 'profile';
      }

      if (resp.source === 'llm') {
        if (!cacheKey && canUseCache) {
          cacheKey = getCacheKeyForType(classifierResult.type, profile, {
            label: ctx.label,
            placeholder: ctx.placeholder,
            name: ctx.name,
            id: ctx.id,
          });
        }
        if (cacheKey && result) {
          await setCache(cacheKey, result, { bypassMinLength: true });
        }
      }
    }

    if (!result) throw new Error('No response generated.');
    await completeLoadingAnimation();
    fillField(field, result);
    setStatus('success');
    showToast(
      mode === 'profile'     ? '✓ Filled from profile'
        : mode === 'cache'       ? '✓ Filled from cache'
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
  resetVisualRuntimes();
  clearStatusTimer();
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
startDynamicFormDetection();

chrome.runtime.onMessage.addListener((message: RunAutofillRequest, _sender, sendResponse: (response: RunAutofillResponse) => void) => {
  if (!message || message.type !== 'RUN_AUTOFILL') return;

  if (!isFormPage()) {
    sendResponse({ success: false, error: 'No meaningful form detected on this page.' });
    return;
  }

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
