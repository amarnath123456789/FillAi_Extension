const FIELDS = ['fullName', 'email', 'phone', 'currentRole', 'skills'];
const LABELS = { fullName: 'Full Name', email: 'Email', phone: 'Phone', currentRole: 'Current Role', skills: 'Skills' };

function openOptions() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
}

// Ripple effect factory
function createRipple(e) {
  const btn = e.currentTarget;
  const existing = btn.querySelector('.ripple');
  if (existing) existing.remove();
  const circle = document.createElement('span');
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  circle.className = 'ripple';
  circle.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size/2}px;top:${e.clientY - rect.top - size/2}px`;
  btn.appendChild(circle);
  setTimeout(() => circle.remove(), 600);
}

function addRipple(el) {
  el.addEventListener('click', createRipple);
}

document.querySelectorAll('.tappable').forEach(el => {
  addRipple(el);
  el.addEventListener('mousedown', () => el.classList.add('pressed'));
  el.addEventListener('mouseup',   () => el.classList.remove('pressed'));
  el.addEventListener('mouseleave',() => el.classList.remove('pressed'));
});

document.getElementById('settingsBtn').addEventListener('click', openOptions);
document.getElementById('ghostBtn').addEventListener('click', openOptions);
document.getElementById('primaryBtn').addEventListener('click', openOptions);

// Staggered entrance animation
function animateIn() {
  const els = document.querySelectorAll('[data-stagger]');
  els.forEach((el, i) => {
    el.style.animationDelay = `${i * 55}ms`;
    el.classList.add('stagger-in');
  });
}

async function init() {
  let profile = {};
  try {
    const r = await chrome.storage.local.get('quickfill_profile');
    profile = r.quickfill_profile || {};
  } catch(e) {}

  const done  = FIELDS.filter(k => (profile[k] || '').trim().length > 0).length;
  const total = FIELDS.length;
  const pct   = Math.round(done / total * 100);
  const ready = done >= 3;
  const next  = FIELDS.find(k => !(profile[k] || '').trim());

  // Status pill
  const statusEl = document.getElementById('statusText');
  statusEl.textContent  = ready ? '● Ready' : '● Setup needed';
  statusEl.className    = 'status-pill ' + (ready ? 'ready' : 'setup');

  // Hero state
  const heroCard  = document.getElementById('heroCard');
  const heroIcon  = document.getElementById('heroIcon');
  const heroTitle = document.getElementById('heroTitle');
  const heroDesc  = document.getElementById('heroDesc');

  if (ready) {
    heroCard.classList.add('is-ready');
    heroIcon.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    heroTitle.textContent = 'Profile looks good';
    heroDesc.textContent  = 'Autofill is active and ready to go.';
  } else {
    heroIcon.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>`;
    heroTitle.textContent = 'Finish your setup';
    heroDesc.textContent  = `Add ${next ? LABELS[next] : 'details'} to improve fill quality.`;
  }

  // Progress
  document.getElementById('progCount').textContent = `${done}/${total}`;
  document.getElementById('progPct').textContent   = `${pct}%`;
  document.getElementById('primaryBtn').textContent = ready ? 'Edit Profile' : 'Complete Profile';

  setTimeout(() => {
    document.getElementById('progFill').style.width = pct + '%';
  }, 300);

  animateIn();
}

if (typeof chrome !== 'undefined' && chrome.storage) {
  init();
} else {
  // Dev preview
  document.getElementById('statusText').textContent = '● Ready';
  document.getElementById('statusText').className   = 'status-pill ready';
  document.getElementById('heroCard').classList.add('is-ready');
  document.getElementById('heroIcon').innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  document.getElementById('heroTitle').textContent = 'Profile looks good';
  document.getElementById('heroDesc').textContent  = 'Autofill is active and ready to go.';
  document.getElementById('progCount').textContent = '4/5';
  document.getElementById('progPct').textContent   = '80%';
  document.getElementById('primaryBtn').textContent = 'Edit Profile';
  setTimeout(() => { document.getElementById('progFill').style.width = '80%'; }, 300);
  animateIn();
}