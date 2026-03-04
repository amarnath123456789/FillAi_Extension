import React, { useState } from 'react';
import { OptionsPage } from './components/OptionsPage';
import { PopupPage } from './components/PopupPage';
import { TestPage } from './components/TestPage';
import { LayoutTemplate, Info, Sparkles } from 'lucide-react';

type ViewMode = 'popup' | 'options';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('popup');

  return (
    <div className="flex h-screen w-full bg-black overflow-hidden font-sans text-white">
      {/* Left Pane: The "Web Page" */}
      <div className="flex-1 relative border-r border-white/10 shadow-2xl z-10 flex flex-col bg-[#050505]">
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

      {/* Right Pane: Extension Simulator UI */}
      <div className="w-[450px] bg-[#050505] flex flex-col shrink-0">
        <div className="p-4 border-b border-white/10 bg-[#0a0a0a] flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <LayoutTemplate size={18} className="text-purple-500" />
            Extension Simulator
          </h2>
          <div className="flex bg-[#141414] p-1 rounded-lg border border-white/5">
            <button 
              onClick={() => setViewMode('popup')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'popup' ? 'bg-[#222] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Popup
            </button>
            <button 
              onClick={() => setViewMode('options')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'options' ? 'bg-[#222] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Options
            </button>
          </div>
        </div>
        
        <div className="flex-1 p-6 overflow-hidden flex flex-col items-center justify-start relative">
          {/* Subtle background glow for the right pane */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none"></div>

          <div className="mb-6 w-full bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex gap-3 shrink-0 relative z-10">
            <Info className="text-purple-400 shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-purple-200">
              <p className="font-medium mb-1 text-purple-100">How to test this MVP:</p>
              <ol className="list-decimal pl-4 space-y-1 opacity-90">
                <li>Go to <strong>Options</strong> and fill out your profile.</li>
                <li>Click on any text field in the dummy webpage on the left.</li>
                <li>Click the <Sparkles size={12} className="inline text-purple-400" /> icon that appears inside the field.</li>
              </ol>
            </div>
          </div>

          {viewMode === 'popup' ? (
            <div className="w-full flex justify-center mt-4 relative z-10">
              <PopupPage onOptionsClick={() => setViewMode('options')} />
            </div>
          ) : (
            <div className="w-full h-full overflow-hidden relative z-10">
              <OptionsPage />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
