const FIELDS = ['fullName','email','phone','currentRole','skills'];
const LABELS = {fullName:'Full Name',email:'Email',phone:'Phone',currentRole:'Current Role',skills:'Skills'};

function openOptions() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
}

document.getElementById('settingsBtn').addEventListener('click', openOptions);
document.getElementById('ghostBtn').addEventListener('click', openOptions);
document.getElementById('primaryBtn').addEventListener('click', openOptions);

async function init() {
  let profile = {};
  try {
    const r = await chrome.storage.local.get('quickfill_profile');
    profile = r.quickfill_profile || {};
  } catch(e) {}

  const done  = FIELDS.filter(k => (profile[k]||'').trim().length > 0).length;
  const total = FIELDS.length;
  const pct   = Math.round(done / total * 100);
  const ready = done >= 3;
  const next  = FIELDS.find(k => !(profile[k]||'').trim());

  document.getElementById('statusText').textContent = ready ? 'Ready to autofill' : 'Needs a bit more setup';
  document.getElementById('statusText').className = 'logo-status ' + (ready ? 'ready' : 'setup');

  const icon = document.getElementById('heroIcon');
  const svg  = document.getElementById('heroSvg');
  icon.className = 'hero-icon ' + (ready ? 'ready' : 'setup');
  if (ready) {
    svg.setAttribute('stroke','#34d399');
    svg.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
  } else {
    svg.setAttribute('stroke','#a78bfa');
    svg.innerHTML = '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>';
  }

  document.getElementById('heroTitle').textContent = ready ? 'Profile looks good' : 'Finish your profile setup';
  document.getElementById('heroDesc').textContent  = ready
    ? 'You can now autofill most forms with high accuracy.'
    : `Add ${next ? LABELS[next] : 'a few details'} to improve fill quality.`;

  document.getElementById('progCount').textContent = `${done}/${total}`;
  document.getElementById('progPct').textContent   = `${pct}% ready`;
  setTimeout(() => { document.getElementById('progFill').style.width = pct + '%'; }, 80);
  document.getElementById('primaryBtn').textContent = ready ? 'Edit Profile' : 'Complete Profile';
}

if (typeof chrome !== 'undefined' && chrome.storage) {
  init();
} else {
  document.getElementById('statusText').textContent = 'Ready to autofill';
  document.getElementById('statusText').className = 'logo-status ready';
  document.getElementById('heroIcon').className = 'hero-icon ready';
  const s = document.getElementById('heroSvg');
  s.setAttribute('stroke','#34d399');
  s.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
  document.getElementById('heroTitle').textContent = 'Profile looks good';
  document.getElementById('heroDesc').textContent  = 'You can now autofill most forms with high accuracy.';
  document.getElementById('progCount').textContent = '4/5';
  document.getElementById('progPct').textContent   = '80% ready';
  setTimeout(() => { document.getElementById('progFill').style.width = '80%'; }, 80);
  document.getElementById('primaryBtn').textContent = 'Edit Profile';
}