import React, { useState, useEffect } from 'react';
import { useProfile } from '../store';

type Section = 'basic' | 'professional' | 'links' | 'security';

export function OptionsPage() {
  const { profile, setProfile } = useProfile();
  const [saved, setSaved]               = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);
  const [tab, setTab]                   = useState<Section>('basic');
  const [apiKey, setApiKey]             = useState('');
  const [showKey, setShowKey]           = useState(false);

  const isExt = typeof chrome !== 'undefined' && !!chrome?.storage?.local;

  useEffect(() => {
    if (!isExt) return;
    chrome.storage.local.get('fillai_api_key')
      .then((r: Record<string, string>) => setApiKey(r.fillai_api_key ?? ''))
      .catch(() => {});
  }, [isExt]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(p => ({ ...p, [name]: value }));
  };

  const onSave = async () => {
    try {
      setSaveError(null);
      if (isExt) {
        await chrome.storage.local.set({ fillai_api_key: apiKey.trim() });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings.';
      setSaveError(msg);
      setSaved(false);
    }
  };

  return (
    <>
      <div className="accent-bar"></div>

      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-logo">
          <div className="topbar-mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L4.5 13.5H11L10 22L20 10H13.5L13 2Z" fill="black"/>
            </svg>
          </div>
          <div>
            <div className="topbar-name">FillAI Settings</div>
            <div className="topbar-sub">Stored locally · never uploaded</div>
          </div>
        </div>
        <button className={`save-btn tappable ${saved ? 'saved' : ''}`} onClick={onSave} id="saveBtn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            {saved ? (
              <path d="M20 6L9 17l-5-5"/>
            ) : (
              <>
                <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
                <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/>
                <path d="M7 3v4a1 1 0 0 0 1 1h7"/>
              </>
            )}
          </svg>
          <span id="saveBtnText">{saved ? 'Saved' : 'Save Profile'}</span>
        </button>
      </div>

      {/* Layout */}
      <div className="layout">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="nav-section-label">Profile</div>
          <div className={`nav-item tappable ${tab === 'basic' ? 'active' : ''}`} onClick={() => setTab('basic')}>
            <div className="nav-dot"></div>Basic Info
          </div>
          <div className={`nav-item tappable ${tab === 'professional' ? 'active' : ''}`} onClick={() => setTab('professional')}>
            <div className="nav-dot"></div>Professional
          </div>
          <div className={`nav-item tappable ${tab === 'links' ? 'active' : ''}`} onClick={() => setTab('links')}>
            <div className="nav-dot"></div>Links
          </div>
          <div className={`nav-item tappable ${tab === 'security' ? 'active' : ''}`} onClick={() => setTab('security')}>
            <div className="nav-dot"></div>Security
          </div>
        </div>

        {/* Main */}
        <div className="main">
          {saveError && <div className="error-box" style={{display: 'block'}}>{saveError}</div>}

          {/* Basic Info */}
          <div className={`tab-pane ${tab === 'basic' ? 'active' : ''}`}>
            <div className="pane-title">Basic Info</div>
            <div className="pane-desc">Personal details used to fill common form fields instantly.</div>

            <div className="card">
              <div className="card-title">Identity</div>
              <div className="field mb-16">
                <div className="field-label">Full Name</div>
                <input className="input" name="fullName" value={profile.fullName} onChange={onChange} type="text" placeholder="John Doe"/>
              </div>
              <div className="grid-3">
                <div className="field">
                  <div className="field-label">Email</div>
                  <input className="input" name="email" value={profile.email} onChange={onChange} type="email" placeholder="john@example.com"/>
                </div>
                <div className="field">
                  <div className="field-label">Phone</div>
                  <input className="input" name="phone" value={profile.phone} onChange={onChange} type="tel" placeholder="+1 (555) 000-0000"/>
                </div>
                <div className="field">
                  <div className="field-label">Date of Birth</div>
                  <input className="input" name="dob" value={profile.dob} onChange={onChange} type="date"/>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Location</div>
              <div className="field">
                <div className="field-label">Address / City</div>
                <input className="input" name="address" value={profile.address} onChange={onChange} type="text" placeholder="San Francisco, CA"/>
              </div>
            </div>
          </div>

          {/* Professional */}
          <div className={`tab-pane ${tab === 'professional' ? 'active' : ''}`}>
            <div className="pane-title">Professional</div>
            <div className="pane-desc">Career details used for job applications and cover letters.</div>

            <div className="card">
              <div className="card-title">Career</div>
              <div className="grid-3 mb-16">
                <div className="field">
                  <div className="field-label">Current Role</div>
                  <input className="input" name="currentRole" value={profile.currentRole} onChange={onChange} type="text" placeholder="Senior Frontend Engineer"/>
                </div>
                <div className="field">
                  <div className="field-label">Years of Experience</div>
                  <input className="input" name="yearsOfExperience" value={profile.yearsOfExperience} onChange={onChange} type="text" placeholder="5 years"/>
                </div>
                <div className="field">
                  <div className="field-label">Education</div>
                  <input className="input" name="education" value={profile.education} onChange={onChange} type="text" placeholder="B.S. Computer Science — MIT"/>
                </div>
              </div>
              <div className="field">
                <div className="field-label">Certifications</div>
                <input className="input" name="certifications" value={profile.certifications} onChange={onChange} type="text" placeholder="AWS Certified, Scrum Master"/>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Content</div>
              <div className="field mb-16">
                <div className="field-label">Skills</div>
                <input className="input" name="skills" value={profile.skills} onChange={onChange} type="text" placeholder="React, TypeScript, Node.js, Tailwind CSS"/>
              </div>
              <div className="field mb-16">
                <div className="field-label">Bio / Professional Summary</div>
                <textarea className="textarea" name="bio" value={profile.bio} onChange={onChange} rows={4} placeholder="Passionate frontend developer with a focus on performance and UX…"></textarea>
              </div>
              <div className="field">
                <div className="field-label">Key Achievements</div>
                <textarea className="textarea" name="achievements" value={profile.achievements} onChange={onChange} rows={4} placeholder="- Led migration to micro-frontends&#10;- Improved Core Web Vitals by 40%"></textarea>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className={`tab-pane ${tab === 'links' ? 'active' : ''}`}>
            <div className="pane-title">Links</div>
            <div className="pane-desc">Online profiles and portfolio links for applications.</div>

            <div className="card">
              <div className="card-title">Profiles</div>
              <div className="field mb-16">
                <div className="field-label">LinkedIn</div>
                <input className="input" name="linkedin" value={profile.linkedin} onChange={onChange} type="url" placeholder="https://linkedin.com/in/johndoe"/>
              </div>
              <div className="grid-2">
                <div className="field">
                  <div className="field-label">GitHub</div>
                  <input className="input" name="github" value={profile.github} onChange={onChange} type="url" placeholder="https://github.com/johndoe"/>
                </div>
                <div className="field">
                  <div className="field-label">Portfolio / Website</div>
                  <input className="input" name="portfolio" value={profile.portfolio} onChange={onChange} type="url" placeholder="https://johndoe.com"/>
                </div>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className={`tab-pane ${tab === 'security' ? 'active' : ''}`}>
            <div className="pane-title">Security</div>
            <div className="pane-desc">Configure your AI API key for intelligent field generation.</div>

            <div className="card">
              <div className="card-title">Gemini API Key</div>
              <div className="field">
                <div className="field-label">API Key</div>
                <div className="input-wrap">
                  <input className="input" type={showKey ? "text" : "password"} value={apiKey} onChange={e => setApiKey(e.target.value)}
                    placeholder="AIzaSy…" autoComplete="off" spellCheck="false"
                    style={{fontFamily: "'Courier New', monospace", letterSpacing: "0.04em"}}/>
                  <button className="eye-btn" type="button" onClick={() => setShowKey(!showKey)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {showKey ? (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </>
                      ) : (
                        <>
                          <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>
                          <circle cx="12" cy="12" r="3"/>
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>
              <div className="info-box" style={{marginTop: "14px"}}>
                Stored only on this device in <code>chrome.storage.local</code> — never sent to our servers.
                <br/><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Get a free Gemini API key →</a>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Privacy</div>
              <div className="info-box">
                Your key and profile are saved to <code>chrome.storage.local</code> on your device only. 
                The background service worker calls Gemini directly for fields not found in your profile. 
                No data passes through any third-party server.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
