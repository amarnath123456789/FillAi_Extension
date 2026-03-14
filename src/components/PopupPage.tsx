export function PopupPage({ onOptionsClick }: { onOptionsClick?: () => void }) {
  return (
    <div
      className="flex flex-col bg-[#080918] text-white"
      style={{ width: 380, height: 520, display: 'flex', flexDirection: 'column', backgroundColor: '#080918', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
            ⚡
          </div>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>FillAI</span>
          <span style={{ color: '#4ade80', fontSize: 11 }}>● Active</span>
        </div>
        <button
          onClick={onOptionsClick}
          title="Open Settings"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 15, padding: '3px 5px', borderRadius: 6, lineHeight: 1, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#d1d5db')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
        >
          ⚙
        </button>
      </div>

      {/* Hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px', textAlign: 'center', gap: 0 }}>
        {/* Avatar */}
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 12 }}>
          👤
        </div>

        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 5px' }}>
          No profile set up yet
        </h2>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 20px' }}>
          Set up once, fill any form instantly
        </p>

        {/* Feature badges grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, width: '100%', marginBottom: 18 }}>
          {[
            { icon: '⚡', label: 'Auto-fill forms',  color: '#a78bfa' },
            { icon: '✨', label: 'AI-powered',        color: '#818cf8' },
            { icon: '🔒', label: 'Stored locally',   color: '#4ade80' },
            { icon: '🌐', label: 'Any website',       color: '#38bdf8' },
          ].map(({ icon, label, color }) => (
            <div
              key={label}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span style={{ fontSize: 13 }}>{icon}</span>
              <span style={{ fontSize: 11, color, fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onOptionsClick}
          style={{ width: '100%', padding: '9px 0', borderRadius: 9, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 18px rgba(124,58,237,0.35)', transition: 'opacity 0.15s, box-shadow 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.boxShadow = '0 0 24px rgba(124,58,237,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = '0 0 18px rgba(124,58,237,0.35)'; }}
        >
          Set Up Profile →
        </button>
      </div>
    </div>
  );
}