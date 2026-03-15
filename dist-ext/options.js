const DEFAULT = {
  fullName:'', email:'', phone:'', dob:'', address:'',
  linkedin:'', github:'', portfolio:'', currentRole:'',
  yearsOfExperience:'', education:'', certifications:'',
  bio:'', skills:'', achievements:'', otherDetails:''
};

let profile = {...DEFAULT};
let apiKey = '';
const hasChromeStorage = typeof chrome !== 'undefined' && !!chrome.storage?.local;

async function loadData() {
  if (!hasChromeStorage) return;
  try {
    const r = await chrome.storage.local.get(['quickfill_profile','fillai_api_key']);
    if (r.quickfill_profile) profile = {...DEFAULT, ...r.quickfill_profile};
    if (r.fillai_api_key)    apiKey = r.fillai_api_key;
  } catch(e) {}
  renderFields();
}

function renderFields() {
  document.querySelectorAll('[data-key]').forEach(el => {
    el.value = profile[el.dataset.key] || '';
  });
  document.getElementById('apiKeyInput').value = apiKey;
}

// Live update
document.querySelectorAll('[data-key]').forEach(el => {
  el.addEventListener('input', () => { profile[el.dataset.key] = el.value; });
});
document.getElementById('apiKeyInput').addEventListener('input', e => { apiKey = e.target.value; });

// Save
document.getElementById('saveBtn').addEventListener('click', async () => {
  const btn = document.getElementById('saveBtn');
  const txt = document.getElementById('saveBtnText');
  const errBox = document.getElementById('error-box');
  errBox.style.display = 'none';
  try {
    if (hasChromeStorage) {
      await chrome.storage.local.set({quickfill_profile: profile, fillai_api_key: apiKey.trim()});
    }
    btn.classList.add('saved');
    txt.textContent = 'Saved!';
    showToast('Profile saved successfully', 'success');
    setTimeout(() => { btn.classList.remove('saved'); txt.textContent = 'Save Profile'; }, 2500);
  } catch(e) {
    const msg = e instanceof Error ? e.message : 'Failed to save.';
    errBox.textContent = 'Could not save settings: ' + msg;
    errBox.style.display = 'block';
    showToast('Failed to save', 'error');
  }
});

// Tabs
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const tab = item.dataset.tab;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
  });
});

// Eye toggle
let eyeVisible = false;
document.getElementById('eyeBtn').addEventListener('click', () => {
  eyeVisible = !eyeVisible;
  document.getElementById('apiKeyInput').type = eyeVisible ? 'text' : 'password';
  document.getElementById('eyeIcon').innerHTML = eyeVisible
    ? `<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>`
    : `<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>`;
});

function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = type + ' show';
  setTimeout(() => { t.classList.remove('show'); }, 2700);
}

loadData();