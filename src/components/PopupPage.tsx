export function PopupPage({ onOptionsClick }: { onOptionsClick?: () => void }) {
  const featureBadges = [
    { icon: '⚡', label: 'Auto-fill forms', color: '#a78bfa' },
    { icon: '✨', label: 'AI-powered', color: '#818cf8' },
    { icon: '🔒', label: 'Stored locally', color: '#4ade80' },
    { icon: '🌐', label: 'Any website', color: '#38bdf8' },
  ];

  return (
    <div
      className="relative flex h-full w-full min-h-[440px] flex-col overflow-hidden bg-[#080918] text-white"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="pointer-events-none absolute -top-24 left-1/2 h-60 w-60 -translate-x-1/2 rounded-full bg-violet-600/15 blur-3xl" />

      <header className="relative z-10 flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-[13px] shadow-[0_0_18px_rgba(124,58,237,0.35)]">
            ⚡
          </div>
          <div>
            <p className="text-[13px] font-bold tracking-tight text-white">FillAI</p>
            <p className="text-[11px] text-emerald-400">Active on this page</p>
          </div>
        </div>
        <button
          onClick={onOptionsClick}
          title="Open Settings"
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[12px] font-semibold text-gray-300 transition-colors hover:text-white"
        >
          Settings
        </button>
      </header>

      <main className="relative z-10 flex flex-1 flex-col overflow-y-auto px-4 pb-4 pt-5 custom-scrollbar">
        <section className="rounded-2xl border border-violet-400/20 bg-gradient-to-b from-violet-500/10 to-indigo-500/5 p-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-violet-300/30 bg-violet-400/15 text-[22px]">
          👤
          </div>
          <h2 className="mb-1 text-[15px] font-bold text-white">No profile set up yet</h2>
          <p className="text-[12px] leading-relaxed text-gray-300">Set up once, then fill forms instantly across job, signup, and support pages.</p>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-2">
          {featureBadges.map(({ icon, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2"
            >
              <span className="text-[13px]">{icon}</span>
              <span className="text-[11px] font-semibold" style={{ color }}>{label}</span>
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-violet-300/90">Quick Start</p>
          <ol className="mt-2 space-y-1 text-[12px] text-gray-300">
            <li>1. Open settings and complete your profile.</li>
            <li>2. Focus any text field on a website.</li>
            <li>3. Click the FillAI bolt to autofill instantly.</li>
          </ol>
        </section>

        <button
          onClick={onOptionsClick}
          className="mt-4 w-full rounded-xl border border-violet-300/25 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
        >
          Set Up Profile
        </button>

        <button
          onClick={onOptionsClick}
          className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-[12px] font-semibold text-gray-200 transition hover:bg-white/10"
        >
          Open Full Settings Page
        </button>
      </main>
    </div>
  );
}