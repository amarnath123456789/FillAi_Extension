const DEFAULT = {
  fullName:'', email:'', phone:'', dob:'', address:'',
  linkedin:'', github:'', portfolio:'', currentRole:'',
  yearsOfExperience:'', education:'', certifications:'',
  bio:'', skills:'', achievements:'', otherDetails:''
};

let profile = { ...DEFAULT };
let apiKey   = '';
const hasChromeStorage = typeof chrome !== 'undefined' && !!chrome?.storage?.local;

/* ── Ripple ── */
function createRipple(e) {
  const btn = e.currentTarget;
  const old = btn.querySelector('.ripple');
  if (old) old.remove();
  const c = document.createElement('span');
  const r = btn.getBoundingClientRect();
  const s = Math.max(r.width, r.height) * 2;
  c.className = 'ripple';
  c.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX-r.left-s/2}px;top:${e.clientY-r.top-s/2}px`;
  btn.appendChild(c);
  setTimeout(() => c.remove(), 600);
}

document.querySelectorAll('.tappable').forEach(el => {
  el.addEventListener('click', createRipple);
  el.addEventListener('mousedown',  () => el.classList.add('pressed'));
  el.addEventListener('mouseup',    () => el.classList.remove('pressed'));
  el.addEventListener('mouseleave', () => el.classList.remove('pressed'));
});

/* ── Load ── */
async function loadData() {
  if (!hasChromeStorage) { renderFields(); return; }
  try {
    const r = await chrome.storage.local.get(['quickfill_profile', 'fillai_api_key']);
    if (r.quickfill_profile) profile = { ...DEFAULT, ...r.quickfill_profile };
    if (r.fillai_api_key)    apiKey  = r.fillai_api_key;
  } catch(e) {}
  renderFields();
}

function renderFields() {
  document.querySelectorAll('[data-key]').forEach(el => {
    el.value = profile[el.dataset.key] || '';
  });
  document.getElementById('apiKeyInput').value = apiKey;
}

/* ── Live sync ── */
document.querySelectorAll('[data-key]').forEach(el => {
  el.addEventListener('input', () => { profile[el.dataset.key] = el.value; });
});
document.getElementById('apiKeyInput').addEventListener('input', e => { apiKey = e.target.value; });

/* ── Save ── */
document.getElementById('saveBtn').addEventListener('click', async () => {
  const btn     = document.getElementById('saveBtn');
  const label   = document.getElementById('saveBtnText');
  const errBox  = document.getElementById('errorBox');
  errBox.style.display = 'none';

  btn.classList.add('saving');
  try {
    if (hasChromeStorage) {
      await chrome.storage.local.set({ quickfill_profile: profile, fillai_api_key: apiKey.trim() });
    }
    btn.classList.remove('saving');
    btn.classList.add('saved');
    label.textContent = 'Saved!';
    showToast('Profile saved ✓', 'success');
    setTimeout(() => {
      btn.classList.remove('saved');
      label.textContent = 'Save Profile';
    }, 2500);
  } catch(e) {
    btn.classList.remove('saving');
    errBox.textContent = 'Could not save: ' + (e?.message || 'Unknown error');
    errBox.style.display = 'block';
    showToast('Save failed', 'error');
  }
});

/* ── Tabs ── */
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const tab = item.dataset.tab;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
  });
});

/* ── Eye toggle ── */
let eyeOn = false;
document.getElementById('eyeBtn').addEventListener('click', () => {
  eyeOn = !eyeOn;
  document.getElementById('apiKeyInput').type = eyeOn ? 'text' : 'password';
  document.getElementById('eyeIcon').innerHTML = eyeOn
    ? `<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>`
    : `<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>`;
});

/* ── Toast ── */
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

loadData();