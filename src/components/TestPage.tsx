import React, { useState, useRef, useEffect } from 'react';
import { generateFieldResponse } from '../services/llm';
import { getHeuristicFill } from '../services/heuristics';
import { useProfile } from '../store';
import { Loader2, Check, AlertCircle } from 'lucide-react';

function BoltIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="bolt-lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <path d="M13 2L4.5 13.5H11L10 22L20 10H13.5L13 2Z"
        fill="url(#bolt-lg)" strokeLinejoin="round" />
    </svg>
  );
}

type FillStatus = 'idle' | 'generating' | 'success' | 'error';

export function TestPage() {
  const { profile } = useProfile();
  const [activeField, setActiveField] = useState<HTMLElement | null>(null);
  const [buttonPos, setButtonPos] = useState({ top: 0, left: 0 });
  const [fillStatus, setFillStatus] = useState<FillStatus>('idle');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [hasInstruction, setHasInstruction] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isGeneratingRef = useRef(fillStatus === 'generating');

  useEffect(() => {
    isGeneratingRef.current = fillStatus === 'generating';
  }, [fillStatus]);

  // Track whether the active field already has text (instruction mode)
  useEffect(() => {
    if (!activeField) { setHasInstruction(false); return; }
    const checkValue = () => {
      const val = (activeField instanceof HTMLInputElement || activeField instanceof HTMLTextAreaElement)
        ? activeField.value.trim()
        : '';
      setHasInstruction(val.length > 0);
    };
    checkValue();
    activeField.addEventListener('input', checkValue);
    return () => activeField.removeEventListener('input', checkValue);
  }, [activeField]);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Simulate content script detecting focus
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && ((target as HTMLInputElement).type === 'text' || (target as HTMLInputElement).type === 'date'))) {
        setActiveField(target);
        updateButtonPosition(target);
        setFillStatus('idle'); // Reset status when focusing a new field
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      if (isGeneratingRef.current) return;
      
      const related = e.relatedTarget as HTMLElement;
      if (related && related.id === 'quickfill-btn') return;

      setTimeout(() => {
        if (document.activeElement !== activeField && document.activeElement?.id !== 'quickfill-btn') {
          setActiveField(null);
        }
      }, 150);
    };

    const updateButtonPosition = (target: HTMLElement) => {
      const container = containerRef.current;
      if (!container) return;
      
      const targetRect = target.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      setButtonPos({
        top: targetRect.top - containerRect.top + container.scrollTop + 8,
        left: targetRect.right - containerRect.left + container.scrollLeft - 36, // Position inside the right edge
      });
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('focusin', handleFocusIn);
      container.addEventListener('focusout', handleFocusOut);
      
      // Handle resize/scroll
      const handleScroll = () => {
        if (activeField) updateButtonPosition(activeField);
      };
      container.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
      
      // Handle textarea resizing
      let resizeObserver: ResizeObserver | null = null;
      if (activeField) {
        resizeObserver = new ResizeObserver(() => {
          updateButtonPosition(activeField);
        });
        resizeObserver.observe(activeField);
      }
      
      return () => {
        container.removeEventListener('focusin', handleFocusIn);
        container.removeEventListener('focusout', handleFocusOut);
        container.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleScroll);
        if (resizeObserver) resizeObserver.disconnect();
      };
    }
  }, [activeField]);

  const handleFillClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeField) return;

    setFillStatus('generating');

    try {
      // Extract label
      let label = '';
      const id = activeField.id;
      if (id) {
        const labelEl = document.querySelector(`label[for="${id}"]`);
        if (labelEl) label = labelEl.textContent || '';
      }
      if (!label) {
        const wrapperLabel = activeField.closest('label');
        if (wrapperLabel) label = wrapperLabel.textContent?.replace(activeField.textContent || '', '') || '';
      }

      // Capture whatever the user has already typed — this becomes their instruction
      const userInstruction = (activeField instanceof HTMLInputElement || activeField instanceof HTMLTextAreaElement)
        ? activeField.value.trim()
        : '';

      const tagName = activeField.tagName.toLowerCase();
      const fieldType = tagName === 'textarea'
        ? 'textarea'
        : (activeField as HTMLInputElement).type || 'text';

      const context = {
        label: label.trim(),
        placeholder: activeField.getAttribute('placeholder') || '',
        name: activeField.getAttribute('name') || '',
        id: activeField.id || '',
        type: fieldType,
      };

      let response: string | null = null;
      let fillMode: 'profile' | 'instruction' | 'ai' = 'ai';

      if (userInstruction) {
        // User typed something — treat it as a style/content instruction, go straight to LLM
        fillMode = 'instruction';
        response = await generateFieldResponse(profile, context, { userInstruction });
      } else {
        // No existing text: try fast heuristic match first
        response = getHeuristicFill(profile, context);
        if (response) {
          fillMode = 'profile';
        } else {
          fillMode = 'ai';
          response = await generateFieldResponse(profile, context);
        }
      }

      if (!response) throw new Error('Could not generate a response for this field.');

      // Write the value back into the DOM field
      if (activeField instanceof HTMLInputElement || activeField instanceof HTMLTextAreaElement) {
        const proto = activeField instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(activeField, response);
        } else {
          activeField.value = response;
        }
        activeField.dispatchEvent(new Event('input', { bubbles: true }));
        activeField.dispatchEvent(new Event('change', { bubbles: true }));
      }

      setFillStatus('success');
      const toastText =
        fillMode === 'profile'     ? 'Filled from profile' :
        fillMode === 'instruction' ? 'Filled with your instruction' :
                                     'Filled using AI';
      showToast(toastText, 'success');

      setTimeout(() => { if (!isGeneratingRef.current) setFillStatus('idle'); }, 2000);

    } catch (error) {
      console.error(error);
      setFillStatus('error');
      showToast(error instanceof Error ? error.message : 'An error occurred', 'error');
      setTimeout(() => { if (!isGeneratingRef.current) setFillStatus('idle'); }, 3000);
    } finally {
      activeField.focus();
    }
  };

  const getButtonContent = () => {
    switch (fillStatus) {
      case 'generating':
        return <Loader2 size={13} className="animate-spin text-violet-400" />;
      case 'success':
        return <Check size={13} className="text-emerald-400" />;
      case 'error':
        return <AlertCircle size={13} className="text-red-400" />;
      default:
        return <BoltIcon size={14} />;
    }
  };

  const getButtonStyle = (): React.CSSProperties => {
    switch (fillStatus) {
      case 'success':
        return {
          background: 'rgba(16,185,129,0.12)',
          border: '1px solid rgba(16,185,129,0.4)',
          boxShadow: '0 0 10px rgba(16,185,129,0.25)',
        };
      case 'error':
        return {
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.4)',
          boxShadow: '0 0 10px rgba(239,68,68,0.25)',
        };
      case 'generating':
        return {
          background: 'rgba(139,92,246,0.1)',
          border: '1px solid rgba(139,92,246,0.35)',
          boxShadow: '0 0 8px rgba(124,58,237,0.2)',
        };
      default:
        // Instruction mode: user has text in the field — show amber/warm glow to indicate it
        if (hasInstruction) {
          return {
            background: 'rgba(251,146,60,0.1)',
            border: '1px solid rgba(251,146,60,0.5)',
            boxShadow: '0 0 12px rgba(251,146,60,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
            backdropFilter: 'blur(8px)',
          };
        }
        return {
          background: 'rgba(10,8,24,0.7)',
          border: '1px solid rgba(139,92,246,0.45)',
          boxShadow: '0 0 10px rgba(124,58,237,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(8px)',
        };
    }
  };

  return (
    <div ref={containerRef} className="relative h-full overflow-y-auto bg-[#050505] p-8 custom-scrollbar">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 border ${
            toastMessage.type === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
          }`}>
            {toastMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            {toastMessage.text}
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto glass-card p-8">
        <div className="mb-8 border-b border-white/10 pb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Acme Corp Job Application</h1>
          <p className="text-gray-400">Please fill out the form below to apply for the Senior Frontend Engineer position.</p>
        </div>

        <form className="space-y-6" onSubmit={e => e.preventDefault()}>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-300 mb-1">First Name</label>
              <input type="text" id="firstName" name="firstName" className="w-full p-3 rounded-lg dark-input" />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-300 mb-1">Last Name</label>
              <input type="text" id="lastName" name="lastName" className="w-full p-3 rounded-lg dark-input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="dob" className="block text-sm font-medium text-gray-300 mb-1">Date of Birth</label>
              <input type="date" id="dob" name="dob" className="w-full p-3 rounded-lg dark-input text-gray-300" />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-1">Phone Number</label>
              <input type="text" id="phone" name="phone" className="w-full p-3 rounded-lg dark-input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="education" className="block text-sm font-medium text-gray-300 mb-1">Highest Education</label>
              <input type="text" id="education" name="education" placeholder="e.g., B.S. Computer Science" className="w-full p-3 rounded-lg dark-input" />
            </div>
            <div>
              <label htmlFor="certifications" className="block text-sm font-medium text-gray-300 mb-1">Certifications</label>
              <input type="text" id="certifications" name="certifications" placeholder="e.g., AWS Certified" className="w-full p-3 rounded-lg dark-input" />
            </div>
          </div>

          <div>
            <label htmlFor="portfolio" className="block text-sm font-medium text-gray-300 mb-1">Portfolio / Personal Website</label>
            <input type="text" id="portfolio" name="portfolio" placeholder="https://" className="w-full p-3 rounded-lg dark-input" />
          </div>

          <div>
            <label htmlFor="about" className="block text-sm font-medium text-gray-300 mb-1">Tell us about yourself</label>
            <p className="text-xs text-gray-500 mb-2">Briefly describe your background and what you're currently working on.</p>
            <textarea id="about" name="about" rows={4} className="w-full p-3 rounded-lg dark-input resize-y" />
          </div>

          <div>
            <label htmlFor="why" className="block text-sm font-medium text-gray-300 mb-1">Why do you want to work at Acme Corp?</label>
            <textarea id="why" name="why" rows={4} placeholder="What excites you about our mission?" className="w-full p-3 rounded-lg dark-input resize-y" />
          </div>

          <div>
            <label htmlFor="challenge" className="block text-sm font-medium text-gray-300 mb-1">Describe a difficult technical challenge you've overcome</label>
            <textarea id="challenge" name="challenge" rows={5} className="w-full p-3 rounded-lg dark-input resize-y" />
          </div>

          <div className="pt-4">
            <button type="button" className="purple-btn px-6 py-3 rounded-lg font-medium w-full sm:w-auto">
              Submit Application
            </button>
          </div>
        </form>
      </div>

      {/* Simulated Content Script Injectable Button */}
      {activeField && (
        <button
          id="quickfill-btn"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={handleFillClick}
          disabled={fillStatus === 'generating'}
          style={{ top: buttonPos.top, left: buttonPos.left, ...getButtonStyle() }}
          className="absolute z-50 p-1.5 rounded-lg transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110 active:scale-95"
          title={hasInstruction ? 'FillAI — using your text as instruction' : 'FillAI — auto-fill this field'}
        >
          {getButtonContent()}
        </button>
      )}
    </div>
  );
}
