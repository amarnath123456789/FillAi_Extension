import React, { useState } from 'react';
import { OptionsPage } from './components/OptionsPage';
import { PopupPage } from './components/PopupPage';
import { TestPage } from './components/TestPage';
import { ProfileProvider } from './store';
import { LayoutTemplate } from 'lucide-react';

type ViewMode = 'popup' | 'options';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('popup');

  return (
    <ProfileProvider>
    <div className="flex h-screen w-full flex-col bg-black font-sans text-white lg:flex-row">
      {/* Left Pane: The "Web Page" */}
      <div className="relative z-10 flex min-h-[46vh] flex-1 flex-col border-b border-white/10 bg-[#050505] shadow-2xl lg:min-h-0 lg:border-b-0 lg:border-r">
        <div className="bg-[#0a0a0a] border-b border-white/10 p-3 flex items-center gap-3 z-20 shrink-0">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <div className="bg-[#141414] border border-white/5 rounded-md px-3 py-1 text-xs text-gray-400 flex-1 text-center font-mono">
            https://acmecorp.com/careers/apply
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <TestPage />
        </div>
      </div>

      {/* Right Pane: Extension Simulator */}
      <div
        className="relative flex h-[54vh] w-full shrink-0 flex-col lg:h-full lg:w-[460px]"
        style={{ background: 'linear-gradient(180deg, #07061a 0%, #050412 100%)' }}
      >
        {/* Deep ambient glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-violet-900/20 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-60 h-60 rounded-full bg-indigo-900/15 blur-[80px] pointer-events-none" />
        {/* Side border shine */}
        <div className="absolute top-0 left-0 bottom-0 w-px bg-gradient-to-b from-transparent via-violet-600/20 to-transparent pointer-events-none" />

        {/* Top bar */}
        <div
          className="px-5 py-3 shrink-0 flex items-center justify-between relative z-10"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.015)' }}
        >
          <div className="flex items-center gap-2">
            <LayoutTemplate size={13} className="text-violet-500" />
            <span className="text-[12px] font-semibold text-gray-400 tracking-wide">Extension Preview</span>
          </div>
          <div
            className="flex p-0.5 rounded-lg gap-0.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {(['popup', 'options'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-md capitalize transition-all duration-200 ${
                  viewMode === mode
                    ? 'text-white'
                    : 'text-gray-600 hover:text-gray-400'
                }`}
                style={viewMode === mode ? {
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(124,58,237,0.2))',
                  boxShadow: '0 0 10px rgba(124,58,237,0.2)',
                } : {}}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className={`relative z-10 flex-1 ${viewMode === 'options' ? 'overflow-y-auto' : 'flex items-center justify-center overflow-hidden px-4 py-6 lg:px-6 lg:py-8'}`}>
          {viewMode === 'popup' ? (
            <PopupPage onOptionsClick={() => setViewMode('options')} />
          ) : (
            <OptionsPage />
          )}
        </div>
      </div>
    </div>
  </ProfileProvider>
  );
}
