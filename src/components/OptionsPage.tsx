import React, { useState, useEffect } from 'react';
import { useProfile } from '../store';
import { Save, CheckCircle2, Eye, EyeOff, Zap } from 'lucide-react';

type Section = 'basic' | 'professional' | 'links' | 'security';

const TABS: { id: Section; label: string }[] = [
  { id: 'basic',        label: 'Basic Info'   },
  { id: 'professional', label: 'Professional' },
  { id: 'links',        label: 'Links'        },
  { id: 'security',     label: 'Security'     },
];

function Label({ text }: { text: string }) {
  return (
    <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.08em] text-gray-400">
      {text}
    </label>
  );
}

function Inp(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-xl px-3.5 py-3 text-[14px] text-white dark-input ${props.className ?? ''}`} />;
}

function Txt(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full rounded-xl px-3.5 py-3 text-[14px] text-white dark-input resize-y ${props.className ?? ''}`} />;
}

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
    <div className="min-h-screen w-full" style={{ background: 'linear-gradient(160deg, #0e0c26 0%, #080618 100%)' }}>

      {/* Top accent line */}
      <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.8) 30%, rgba(99,102,241,0.8) 70%, transparent)' }} />

      {/* Sticky header */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6"
        style={{ background: 'rgba(10,8,28,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 0 16px rgba(124,58,237,0.5)' }}>
            <Zap size={15} className="text-white" fill="white" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold leading-none tracking-tight text-white">FillAI Settings</h1>
            <p className="mt-1 text-[12px] text-gray-400">Profile stored locally · never uploaded</p>
          </div>
        </div>
        <button onClick={onSave}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold transition-all duration-200"
          style={saved
            ? { background: 'linear-gradient(135deg,#059669,#10b981)', color: 'white', boxShadow: '0 0 16px rgba(16,185,129,0.4)' }
            : { background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'white', boxShadow: '0 0 16px rgba(124,58,237,0.35)' }
          }>
          {saved ? <><CheckCircle2 size={14} /> Saved</> : <><Save size={14} /> Save Profile</>}
        </button>
      </div>

      {/* Content */}
      <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-10 xl:px-14">

        {/* Tabs */}
        <div className="mb-6 flex w-full gap-1 overflow-x-auto rounded-xl p-1.5 sm:mb-8"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2.5 text-[13px] font-semibold transition-all duration-150 sm:px-4 ${tab === t.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              style={tab === t.id ? { background: 'linear-gradient(135deg,rgba(99,102,241,0.3),rgba(124,58,237,0.2))', border: '1px solid rgba(139,92,246,0.4)', boxShadow: '0 0 10px rgba(124,58,237,0.2)' } : { border: '1px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="space-y-6 rounded-2xl p-4 sm:p-6 lg:p-8"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>

          {saveError && (
            <div
              className="rounded-xl px-3 py-2 text-[12px]"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}
            >
              Could not save settings: {saveError}
            </div>
          )}

          {tab === 'basic' && <>
            <div className="grid grid-cols-1 gap-4">
              <div><Label text="Full Name" /><Inp name="fullName" value={profile.fullName} onChange={onChange} placeholder="John Doe" /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div><Label text="Email" /><Inp type="email" name="email" value={profile.email} onChange={onChange} placeholder="john@example.com" /></div>
              <div><Label text="Phone" /><Inp type="tel" name="phone" value={profile.phone} onChange={onChange} placeholder="+1 (555) 000-0000" /></div>
              <div><Label text="Date of Birth" /><Inp type="date" name="dob" value={profile.dob} onChange={onChange} className="text-gray-300" /></div>
              <div><Label text="Location" /><Inp name="address" value={profile.address} onChange={onChange} placeholder="San Francisco, CA" /></div>
            </div>
          </>}

          {tab === 'professional' && <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div><Label text="Current Role" /><Inp name="currentRole" value={profile.currentRole} onChange={onChange} placeholder="Senior Frontend Engineer" /></div>
              <div><Label text="Years of Experience" /><Inp name="yearsOfExperience" value={profile.yearsOfExperience} onChange={onChange} placeholder="5 years" /></div>
              <div><Label text="Education" /><Inp name="education" value={profile.education} onChange={onChange} placeholder="B.S. Computer Science — MIT, 2019" /></div>
              <div><Label text="Certifications" /><Inp name="certifications" value={profile.certifications} onChange={onChange} placeholder="AWS Certified, Scrum Master" /></div>
            </div>
            <div><Label text="Skills" /><Inp name="skills" value={profile.skills} onChange={onChange} placeholder="React, TypeScript, Node.js, Tailwind CSS" /></div>
            <div><Label text="Bio / Professional Summary" /><Txt name="bio" value={profile.bio} onChange={onChange} rows={4} placeholder="Passionate frontend developer with a focus on performance and UX…" /></div>
            <div><Label text="Key Achievements" /><Txt name="achievements" value={profile.achievements} onChange={onChange} rows={4} placeholder={"- Led migration to micro-frontends\n- Improved Core Web Vitals by 40%"} /></div>
          </>}

          {tab === 'links' && <>
            <div><Label text="LinkedIn" /><Inp type="url" name="linkedin" value={profile.linkedin} onChange={onChange} placeholder="https://linkedin.com/in/johndoe" /></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div><Label text="GitHub" /><Inp type="url" name="github" value={profile.github} onChange={onChange} placeholder="https://github.com/johndoe" /></div>
              <div><Label text="Portfolio / Website" /><Inp type="url" name="portfolio" value={profile.portfolio} onChange={onChange} placeholder="https://johndoe.com" /></div>
            </div>
          </>}

          {tab === 'security' && <>
            {isExt ? <>
              <div>
                <Label text="Gemini API Key" />
                <div className="relative">
                  <Inp type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)}
                    className="pr-10 font-mono" placeholder="AIzaSy…" autoComplete="off" spellCheck={false} />
                  <button type="button" onClick={() => setShowKey(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-[12px] text-gray-500 mt-2">
                  Stored only on this device.{' '}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 underline underline-offset-2">
                    Get a free key →
                  </a>
                </p>
              </div>
              <div className="p-4 rounded-xl text-[12px] text-gray-400 leading-relaxed"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                Your key is saved to <code className="text-violet-400">chrome.storage.local</code> and used by the
                background service worker to call Gemini for fields that aren't in your profile.
              </div>
            </> : (
              <div className="p-4 rounded-xl text-[13px] text-gray-400 space-y-2"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-white font-semibold">Dev mode</p>
                <p>API key loaded from <code className="text-violet-400">.env</code> as <code className="text-violet-400">VITE_GEMINI_API_KEY</code>.</p>
                <p>In the built extension, users enter their key here and it is saved to <code className="text-violet-400">chrome.storage.local</code>.</p>
              </div>
            )}
          </>}

        </div>
      </div>
    </div>
  );
}
