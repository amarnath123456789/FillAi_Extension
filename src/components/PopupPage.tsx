import { useMemo } from 'react';
import { useProfile } from '../store';
import { Bolt, Brain, CheckCircle2, Globe, Loader2, Lock, UserRound, Zap } from 'lucide-react';

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
    const done = REQUIRED_FIELDS.filter(({ key }) => profile[key].trim().length > 0).length;
    const total = REQUIRED_FIELDS.length;
    return {
      done,
      total,
      percent: Math.round((done / total) * 100),
      nextMissing: REQUIRED_FIELDS.find(({ key }) => profile[key].trim().length === 0)?.label,
    };
  }, [profile]);

  const canAutofillWell = completion.done >= 3;

  const featureBadges = [
    { icon: Bolt, label: 'Smart field detection', color: '#a78bfa' },
    { icon: Brain, label: 'Profile + AI fallback', color: '#818cf8' },
    { icon: Lock, label: 'Data stays local', color: '#4ade80' },
    { icon: Globe, label: 'Works on most sites', color: '#38bdf8' },
  ];

  return (
    <div className="h-full w-full bg-[#070516] p-3 text-white" style={{ fontFamily: 'Inter, system-ui, sans-serif', textRendering: 'optimizeLegibility' }}>
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-violet-300/20 bg-[#080918] shadow-[0_18px_45px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-56 w-56 rounded-full bg-indigo-600/20 blur-3xl" />

      <header className="relative z-10 flex items-center justify-between border-b border-white/10 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-[14px] shadow-[0_0_22px_rgba(124,58,237,0.4)]">
            <Zap size={16} className="text-white" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-[15px] font-bold tracking-tight text-white">FillAI</p>
            <p className={`text-[12px] ${canAutofillWell ? 'text-emerald-400' : 'text-amber-300'}`}>
              {canAutofillWell ? 'Ready to autofill' : 'Needs a bit more setup'}
            </p>
          </div>
        </div>
        <button
          onClick={onOptionsClick}
          title="Open Settings"
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[13px] font-semibold text-gray-200 transition-colors hover:bg-white/10 hover:text-white"
        >
          Settings
        </button>
      </header>

      <main className="relative z-10 flex flex-1 flex-col overflow-y-auto px-5 pb-5 pt-5 custom-scrollbar">
        <section className="rounded-2xl border border-violet-400/30 bg-gradient-to-b from-violet-500/15 to-indigo-500/10 p-5 text-center shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-300/40 bg-violet-400/20 text-[24px]">
            {isLoading ? (
              <Loader2 size={24} className="animate-spin text-violet-200" strokeWidth={2.25} />
            ) : canAutofillWell ? (
              <CheckCircle2 size={26} className="text-emerald-300" strokeWidth={2.25} />
            ) : (
              <UserRound size={24} className="text-violet-100" strokeWidth={2.25} />
            )}
          </div>
          <h2 className="mb-1.5 text-[20px] font-bold text-white">
            {isLoading ? 'Loading profile...' : canAutofillWell ? 'Profile looks good' : 'Finish your profile setup'}
          </h2>
          <p className="text-[14px] leading-relaxed text-gray-200">
            {isLoading
              ? 'Checking your saved profile data.'
              : canAutofillWell
                ? 'You can now autofill most forms with high accuracy.'
                : `Add ${completion.nextMissing ?? 'a few details'} to improve fill quality.`}
          </p>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-left">
            <div className="flex items-center justify-between text-[12px] font-semibold text-gray-200">
              <span>Profile completion</span>
              <span>{completion.done}/{completion.total}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                style={{ width: `${completion.percent}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] text-gray-300">{completion.percent}% ready</p>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-2.5">
          {featureBadges.map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
            >
              <Icon size={14} style={{ color }} strokeWidth={2.25} />
              <span className="text-[12px] font-semibold" style={{ color }}>{label}</span>
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3.5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-violet-300/90">How It Works</p>
          <ol className="mt-2 space-y-1.5 text-[13px] text-gray-200">
            <li>1. Save your profile details once.</li>
            <li>2. Focus any text field on a website.</li>
            <li>3. Click the FillAI bolt for instant fill.</li>
          </ol>
        </section>

        <button
          onClick={onOptionsClick}
          className="mt-4 w-full rounded-xl border border-violet-300/30 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-[15px] font-semibold text-white shadow-[0_0_22px_rgba(124,58,237,0.35)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
        >
          {canAutofillWell ? 'Edit Profile' : 'Complete Profile'}
        </button>

        <button
          onClick={onOptionsClick}
          className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-[14px] font-semibold text-gray-100 transition hover:bg-white/10"
        >
          Open Full Settings Page
        </button>
      </main>
      </div>
    </div>
  );
}