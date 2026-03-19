import React, { useEffect, useRef, useState } from 'react';
import { useProfile } from '../store';
import { clearCache } from '../utils/cache';

type Section = 'basic' | 'professional' | 'links' | 'model';

type ModelLoadPhase = 'idle' | 'loading' | 'ready' | 'error';

type FillAiModelOption = {
  id: string;
  name: string;
  sizeLabel: string;
  recommendedFor: string;
};

type ModelLoadStatus = {
  selectedModel: string;
  activeModel: string | null;
  phase: ModelLoadPhase;
  progress: number;
  message: string;
  error: string | null;
};

type ModelListResponse = {
  success: boolean;
  error?: string;
  models?: FillAiModelOption[];
};

type ModelStatusResponse = {
  success: boolean;
  error?: string;
  status?: ModelLoadStatus;
};

export function OptionsPage() {
  const { profile, setProfile } = useProfile();
  const [saved, setSaved]               = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);
  const [tab, setTab]                   = useState<Section>('basic');
  const [models, setModels]             = useState<FillAiModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [modelStatus, setModelStatus]   = useState<ModelLoadStatus | null>(null);
  const [isModelLoadingAction, setIsModelLoadingAction] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const modelStatusPollRef = useRef<number | null>(null);

  const extensionRuntimeId =
    typeof chrome !== 'undefined' && typeof chrome.runtime?.id === 'string' && chrome.runtime.id.length > 0
      ? chrome.runtime.id
      : null;
  const isExtensionRuntime = !!extensionRuntimeId && !!chrome.runtime?.sendMessage;

  const stopModelStatusPolling = () => {
    if (modelStatusPollRef.current !== null) {
      window.clearInterval(modelStatusPollRef.current);
      modelStatusPollRef.current = null;
    }
  };

  const sendMessage = async <T extends { success: boolean; error?: string }>(
    payload: Record<string, unknown>
  ): Promise<T> => {
    if (!isExtensionRuntime) {
      throw new Error('Model controls are only available inside the extension runtime.');
    }

    return new Promise<T>((resolve, reject) => {
      chrome.runtime.sendMessage(extensionRuntimeId, payload, (response: T) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  };

  const syncModelStatus = async () => {
    const statusResponse = await sendMessage<ModelStatusResponse>({ type: 'FILLAI_MODEL_STATUS' });
    if (!statusResponse.success || !statusResponse.status) {
      throw new Error(statusResponse.error || 'Failed to fetch model status.');
    }

    setModelStatus(statusResponse.status);
    setSelectedModelId(statusResponse.status.selectedModel);
    return statusResponse.status;
  };

  const startModelStatusPolling = () => {
    if (modelStatusPollRef.current !== null) return;

    modelStatusPollRef.current = window.setInterval(async () => {
      try {
        const status = await syncModelStatus();
        if (status.phase === 'ready' || status.phase === 'error' || status.phase === 'idle') {
          stopModelStatusPolling();
          setIsModelLoadingAction(false);
        }
      } catch {
        stopModelStatusPolling();
        setIsModelLoadingAction(false);
      }
    }, 800);
  };

  const loadModelMetadata = async () => {
    if (!isExtensionRuntime) return;

    const listResponse = await sendMessage<ModelListResponse>({ type: 'FILLAI_MODEL_LIST' });
    if (!listResponse.success) {
      throw new Error(listResponse.error || 'Failed to load model list.');
    }
    setModels(listResponse.models || []);

    const status = await syncModelStatus();
    if (status.phase === 'loading') {
      setIsModelLoadingAction(true);
      startModelStatusPolling();
    }
  };

  useEffect(() => {
    loadModelMetadata().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to initialize model settings.';
      setSaveError(msg);
    });

    return () => {
      stopModelStatusPolling();
    };
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(p => ({ ...p, [name]: value }));
  };

  const onSave = async () => {
    try {
      setSaveError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings.';
      setSaveError(msg);
      setSaved(false);
    }
  };

  const onLoadSelectedModel = async () => {
    if (!selectedModelId) return;

    try {
      setSaveError(null);
      setIsModelLoadingAction(true);

      const setResponse = await sendMessage<ModelStatusResponse>({
        type: 'FILLAI_MODEL_SET',
        modelId: selectedModelId,
      });
      if (!setResponse.success) {
        throw new Error(setResponse.error || 'Failed to set model.');
      }
      if (setResponse.status) {
        setModelStatus(setResponse.status);
      }

      const loadResponse = await sendMessage<ModelStatusResponse>({
        type: 'FILLAI_MODEL_LOAD',
      });
      if (!loadResponse.success) {
        throw new Error(loadResponse.error || 'Failed to start model loading.');
      }

      if (loadResponse.status) {
        setModelStatus(loadResponse.status);
        setSelectedModelId(loadResponse.status.selectedModel);
        if (loadResponse.status.phase === 'loading') {
          startModelStatusPolling();
        } else {
          setIsModelLoadingAction(false);
        }
      } else {
        startModelStatusPolling();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load model.';
      setSaveError(msg);
      setIsModelLoadingAction(false);
      stopModelStatusPolling();
    }
  };

  const onClearCache = async () => {
    try {
      setSaveError(null);
      setIsClearingCache(true);
      await clearCache();
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to clear cache.';
      setSaveError(msg);
    } finally {
      setIsClearingCache(false);
    }
  };

  const modelProgressPct = Math.round((modelStatus?.progress || 0) * 100);
  const isModelReady = modelStatus?.phase === 'ready';

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
          <div className={`nav-item tappable ${tab === 'model' ? 'active' : ''}`} onClick={() => setTab('model')}>
            <div className="nav-dot"></div>Model
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

          {/* Model */}
          <div className={`tab-pane ${tab === 'model' ? 'active' : ''}`}>
            <div className="pane-title">Model</div>
            <div className="pane-desc">Choose and load a local WebLLM model for FillAI generation.</div>

            <div className="card">
              <div className="card-title">Model Runtime</div>
              <div className="field mb-16">
                <div className="field-label">Select Model (256M - 1B)</div>
                <select
                  className="input model-select"
                  value={selectedModelId}
                  onChange={(event) => setSelectedModelId(event.target.value)}
                  disabled={!isExtensionRuntime || isModelLoadingAction}
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} · {model.sizeLabel}
                    </option>
                  ))}
                </select>
                {selectedModelId && (
                  <div className="model-help-text">
                    {models.find((model) => model.id === selectedModelId)?.recommendedFor || 'Local inference model'}
                  </div>
                )}
              </div>

              <button
                className="btn-primary"
                onClick={onLoadSelectedModel}
                disabled={!isExtensionRuntime || !selectedModelId || isModelLoadingAction}
              >
                {isModelLoadingAction ? 'Loading Model…' : 'Load Selected Model'}
              </button>

              {modelStatus && (
                <div className="model-status-wrap">
                  <div className="prog-row">
                    <div className="prog-label">Status</div>
                    <div className="prog-nums"><span>{modelProgressPct}%</span></div>
                  </div>
                  <div className="prog-track">
                    <div className="prog-fill" style={{ width: `${modelProgressPct}%` }}></div>
                  </div>
                  <div className={`model-status-line ${modelStatus.phase}`}>
                    {modelStatus.error || modelStatus.message}
                  </div>
                  <div className="model-active-line">
                    Selected: {modelStatus.selectedModel}
                    {isModelReady && modelStatus.activeModel ? ` · Active: ${modelStatus.activeModel}` : ''}
                  </div>
                </div>
              )}

              {!isExtensionRuntime && (
                <div className="info-box" style={{ marginTop: '14px' }}>
                  Model controls are available in the extension options page, not in Vite standalone preview.
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-title">Privacy</div>
              <div className="info-box">
                Your profile is saved to <code>chrome.storage.local</code> on your device only.
                FillAI generates responses using a local model in your browser runtime.
                No data passes through any third-party server.
              </div>
            </div>

            <div className="card model-debug-card">
              <div className="card-title">Debug</div>
              <div className="model-help-text">Hidden maintenance utility for local response cache only.</div>
              <button className="btn-ghost model-debug-btn" onClick={onClearCache} disabled={isClearingCache}>
                {isClearingCache ? 'Clearing Cache…' : 'Clear Response Cache'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
