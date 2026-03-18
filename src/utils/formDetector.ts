const FIELD_SELECTOR = [
  'input[type="text"]',
  'input[type="email"]',
  'input[type="tel"]',
  'input[type="number"]',
  'textarea',
  'select',
].join(',');

const KEYWORDS = [
  'apply',
  'application',
  'register',
  'registration',
  'sign up',
  'signup',
  'create account',
  'login',
  'log in',
  'contact',
  'submit',
  'form',
  'details',
  'personal details',
  'information',
  'profile',
  'account',
  'checkout',
  'billing',
  'shipping',
  'address',
  'payment',
  'phone',
  'email',
  'message',
  'enquiry',
  'enroll',
  'enrollment',
  'subscribe',
  'request',
];

const MAX_TEXT_SCAN = 2000;

function shouldDebug(): boolean {
  try {
    return localStorage.getItem('fillai:formDetectorDebug') === '1';
  } catch {
    return false;
  }
}

function isHiddenByStyle(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return true;
  }

  if (el.getClientRects().length === 0) {
    return true;
  }

  return false;
}

function isEligibleField(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (!el.isConnected) return false;

  if (el instanceof HTMLInputElement && el.type.toLowerCase() === 'hidden') {
    return false;
  }

  if ('disabled' in el && Boolean(el.disabled)) {
    return false;
  }

  return !isHiddenByStyle(el);
}

function getTotalFields(): number {
  const fields = Array.from(document.querySelectorAll(FIELD_SELECTOR));
  return fields.filter(isEligibleField).length;
}

function hasKeywordSignal(): boolean {
  const pageText = (document.body?.innerText ?? document.body?.textContent ?? '')
    .slice(0, MAX_TEXT_SCAN)
    .toLowerCase();

  return KEYWORDS.some(keyword => pageText.includes(keyword));
}

export function isFormPage(): boolean {
  const totalFields = getTotalFields();
  if (totalFields <= 1) {
    if (shouldDebug()) {
      console.log('[FillAI][FormDetector]', {
        totalFields,
        hasForm: Boolean(document.querySelector('form')),
        keywordMatch: false,
        score: 0,
      });
    }
    return false;
  }

  const hasForm = Boolean(document.querySelector('form'));
  const keywordMatch = hasKeywordSignal();

  let score = 0;
  if (totalFields >= 3) score += 2;
  if (hasForm && totalFields >= 2) score += 2;
  if (keywordMatch && totalFields >= 2) score += 1;

  if (shouldDebug()) {
    console.log('[FillAI][FormDetector]', {
      totalFields,
      hasForm,
      keywordMatch,
      score,
    });
  }

  return score >= 3;
}
