import React, { useState, useRef, useEffect } from 'react';
import { generateFieldResponse } from '../services/llm';
import { getHeuristicFill } from '../services/heuristics';
import { useProfile } from '../store';
import { Sparkles, Loader2, Check, AlertCircle } from 'lucide-react';

type FillStatus = 'idle' | 'generating' | 'success' | 'error';

export function TestPage() {
  const { profile } = useProfile();
  const [activeField, setActiveField] = useState<HTMLElement | null>(null);
  const [buttonPos, setButtonPos] = useState({ top: 0, left: 0 });
  const [fillStatus, setFillStatus] = useState<FillStatus>('idle');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const isGeneratingRef = useRef(fillStatus === 'generating');

  useEffect(() => {
    isGeneratingRef.current = fillStatus === 'generating';
  }, [fillStatus]);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Simulate content script detecting focus
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text' || (target as HTMLInputElement).type === 'date')) {
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
      // Extract context
      let label = '';
      const id = activeField.id;
      if (id) {
        const labelEl = document.querySelector(`label[for="${id}"]`);
        if (labelEl) label = labelEl.textContent || '';
      }
      if (!label) {
        // Try to find closest preceding text or wrapper label
        const wrapperLabel = activeField.closest('label');
        if (wrapperLabel) label = wrapperLabel.textContent?.replace(activeField.textContent || '', '') || '';
      }

      const context = {
        label: label.trim(),
        placeholder: activeField.getAttribute('placeholder') || '',
        name: activeField.getAttribute('name') || '',
        id: activeField.id || '',
      };

      // 1. Try heuristics first for straightforward fields
      let response = getHeuristicFill(profile, context);
      const usedHeuristics = !!response;

      // 2. If no heuristic match, use LLM
      if (!response) {
        response = await generateFieldResponse(profile, context);
      }
      
      if (!response) {
        throw new Error("Could not generate a response for this field.");
      }
      
      // Fill the field
      if (activeField instanceof HTMLInputElement || activeField instanceof HTMLTextAreaElement) {
        // Use native setter to ensure React registers the change if it were a real React form
        const prototype = activeField instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(activeField, response);
        } else {
          activeField.value = response;
        }
        
        // Trigger change event for React/frameworks
        activeField.dispatchEvent(new Event('input', { bubbles: true }));
        activeField.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      setFillStatus('success');
      showToast(usedHeuristics ? 'Filled using profile data' : 'Filled using AI', 'success');
      
      setTimeout(() => {
        if (isGeneratingRef.current === false) {
          setFillStatus('idle');
        }
      }, 2000);
      
    } catch (error) {
      console.error(error);
      setFillStatus('error');
      showToast(error instanceof Error ? error.message : 'An error occurred', 'error');
      
      setTimeout(() => {
        if (isGeneratingRef.current === false) {
          setFillStatus('idle');
        }
      }, 3000);
    } finally {
      activeField.focus(); // Ensure focus remains
    }
  };

  const getButtonContent = () => {
    switch (fillStatus) {
      case 'generating':
        return <Loader2 size={16} className="animate-spin" />;
      case 'success':
        return <Check size={16} className="text-white" />;
      case 'error':
        return <AlertCircle size={16} className="text-white" />;
      default:
        return <Sparkles size={16} className="group-hover:scale-110 transition-transform" />;
    }
  };

  const getButtonColor = () => {
    switch (fillStatus) {
      case 'success':
        return 'bg-green-500 hover:bg-green-600';
      case 'error':
        return 'bg-red-500 hover:bg-red-600';
      default:
        return 'bg-purple-600 hover:bg-purple-700';
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
          style={{ top: buttonPos.top, left: buttonPos.left }}
          className={`absolute z-50 text-white p-1.5 rounded-md shadow-md transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed group ${getButtonColor()}`}
          title="QuickFill with AI"
        >
          {getButtonContent()}
        </button>
      )}
    </div>
  );
}
