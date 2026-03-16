import { useMemo } from 'react';
import { useProfile } from '../store';

const REQUIRED_FIELDS = [
  { key: 'fullName', label: 'Full Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'currentRole', label: 'Current Role' },
  { key: 'skills', label: 'Skills' },
] as const;

export function PopupPage({ onOptionsClick }: { onOptionsClick?: () => void }) {
  const { profile, isLoading } = useProfile();

  const completion = useMemo(() => {
    const done = REQUIRED_FIELDS.filter(({ key }) => profile[key] && profile[key].trim().length > 0).length;
    const total = REQUIRED_FIELDS.length;
    return {
      done,
      total,
      percent: Math.round((done / total) * 100),
      nextMissing: REQUIRED_FIELDS.find(({ key }) => !profile[key] || profile[key].trim().length === 0)?.label,
    };
  }, [profile]);

  const canAutofillWell = completion.done >= 3;

  return (
    <div className="shell-popup">
      <div className="header-popup">
        <div className="header-left">
          <div className="logo-mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L4.5 13.5H11L10 22L20 10H13.5L13 2Z" fill="black"/>
            </svg>
          </div>
          <div className="logo-text-wrap">
            <div className="logo-name">FillAI</div>
            <div className={`status-pill ${isLoading ? 'setup' : canAutofillWell ? 'ready' : 'setup'}`}>
              ● {isLoading ? 'Checking…' : canAutofillWell ? 'Ready' : 'Setup required'}
            </div>
          </div>
        </div>
        <button className="icon-btn tappable" onClick={onOptionsClick} title="Settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>

      <div className="body-popup">
        <div className={`hero-card ${canAutofillWell ? 'is-ready' : ''} stagger-1`} data-stagger>
          <div className="hero-top">
            <div className="hero-icon-wrap">
              {canAutofillWell ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>
                </svg>
              )}
            </div>
            <span className="hero-label">Autofill</span>
          </div>
          <div className="hero-title">{isLoading ? 'Loading…' : canAutofillWell ? 'Ready to fill' : 'Setup profile'}</div>
          <div className="hero-desc">
            {isLoading
              ? 'Checking your saved profile data.'
              : canAutofillWell
                ? 'Your profile is ready to autofill forms instantly.'
                : `Add ${completion.nextMissing ?? 'details'} to improve fill quality.`}
          </div>

          <div className="prog-row">
            <span className="prog-label">Profile completion</span>
            <span className="prog-nums"><span>{completion.done}</span>/{completion.total}</span>
          </div>
          <div className="prog-track">
            <div className="prog-fill" style={{ width: `${completion.percent}%` }}></div>
          </div>
          <div className="prog-sub">{completion.percent}% ready</div>
        </div>

        <div className="feat-grid stagger-2" data-stagger>
          <div className="feat-pill tappable">
            <div className="feat-dot" style={{ background: '#c8f135' }}></div>
            <span style={{ color: '#c8f135' }}>Smart detection</span>
          </div>
          <div className="feat-pill tappable">
            <div className="feat-dot" style={{ background: '#818cf8' }}></div>
            <span style={{ color: '#818cf8' }}>AI fallback</span>
          </div>
          <div className="feat-pill tappable">
            <div className="feat-dot" style={{ background: '#4ade80' }}></div>
            <span style={{ color: '#4ade80' }}>Stays local</span>
          </div>
          <div className="feat-pill tappable">
            <div className="feat-dot" style={{ background: '#38bdf8' }}></div>
            <span style={{ color: '#38bdf8' }}>Most sites</span>
          </div>
        </div>

        <div className="how-card stagger-3" data-stagger>
          <div className="how-header">How It Works</div>
          <div className="how-steps">
            <div className="how-step">
              <div className="step-num">1</div>
              <div className="step-text"><b>Save</b> your profile details once.</div>
            </div>
            <div className="how-step">
              <div className="step-num">2</div>
              <div className="step-text"><b>Focus</b> any text field on any site.</div>
            </div>
            <div className="how-step">
              <div className="step-num">3</div>
              <div className="step-text"><b>Click</b> the FillAI bolt for instant fill.</div>
            </div>
          </div>
        </div>

        <div className="stagger-4" data-stagger>
          <button className="btn-primary tappable" onClick={onOptionsClick}>
            {canAutofillWell ? 'Edit Profile' : 'Complete Profile'}
          </button>
          <button className="btn-ghost tappable" onClick={onOptionsClick}>
            Open Full Settings
          </button>
        </div>
      </div>
    </div>
  );
}