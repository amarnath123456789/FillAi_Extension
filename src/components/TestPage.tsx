import React, { useState, useRef, useEffect } from 'react';
import { generateFieldResponse } from '../services/llm';
import { getHeuristicFill } from '../services/heuristics';
import { useProfile } from '../store';

function BoltIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M13 2L4.5 13.5H11L10 22L20 10H13.5L13 2Z"
        fill="currentColor" strokeLinejoin="round" />
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
        return <span>Loading</span>;
      case 'success':
        return <span>OK</span>;
      case 'error':
        return <span>Error</span>;
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
          background: 'rgba(200,241,53,0.1)',
          border: '1px solid rgba(200,241,53,0.35)',
          boxShadow: '0 0 8px rgba(200,241,53,0.2)',
          color: '#c8f135',
        };
      default:
        // Instruction mode: user has text in the field
        if (hasInstruction) {
          return {
            background: '#ff9800', // orange
            color: '#0e0e0e',
            border: '1px solid #e68a00',
            boxShadow: '0 0 12px rgba(255,152,0,0.4)',
          };
        }
        return {
          background: '#c8f135', // lime
          color: '#0e0e0e',      // black
          border: '1px solid rgba(200,241,53,0.5)',
          boxShadow: '0 0 10px rgba(200,241,53,0.3)',
        };
    }
  };

  return (
    <div ref={containerRef} className="custom-scrollbar" style={{ position: 'relative', height: '100%', overflowY: 'auto', padding: '64px', background: 'var(--black)' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 50,
          background: toastMessage.type === 'success' ? 'var(--lime, #c8f135)' : 'rgba(239,68,68,0.1)',
          border: '1px solid',
          borderColor: toastMessage.type === 'success' ? 'var(--lime-dk, #a8d020)' : 'rgba(239,68,68,0.2)',
          color: toastMessage.type === 'success' ? 'var(--black, #0e0e0e)' : '#ef4444',
          padding: '8px 16px', borderRadius: '999px', fontSize: '14px', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: '0 4px 12px rgba(200,241,53,0.2)'
        }}>
          {toastMessage.type === 'success' ? <span>✓</span> : <span>Error</span>}
          {toastMessage.text}
        </div>
      )}

      <div className="card" style={{ padding: '40px', maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 800, color: 'var(--white)', marginBottom: '8px', letterSpacing: '-0.5px' }}>Acme Corp Job Application</h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.5' }}>Please fill out the form below to apply for the Senior Frontend Engineer position.</p>
        </div>

        <form onSubmit={e => e.preventDefault()}>
          <div className="grid-3 mb-16" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="field">
              <label htmlFor="firstName" className="field-label">First Name</label>
              <input type="text" id="firstName" name="firstName" className="input" />
            </div>
            <div className="field">
              <label htmlFor="lastName" className="field-label">Last Name</label>
              <input type="text" id="lastName" name="lastName" className="input" />
            </div>
          </div>

          <div className="grid-3 mb-16" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="field">
              <label htmlFor="dob" className="field-label">Date of Birth</label>
              <input type="date" id="dob" name="dob" className="input" />
            </div>
            <div className="field">
              <label htmlFor="phone" className="field-label">Phone Number</label>
              <input type="text" id="phone" name="phone" className="input" />
            </div>
          </div>

          <div className="grid-3 mb-16" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="field">
              <label htmlFor="education" className="field-label">Highest Education</label>
              <input type="text" id="education" name="education" placeholder="e.g., B.S. Computer Science" className="input" />
            </div>
            <div className="field">
              <label htmlFor="certifications" className="field-label">Certifications</label>
              <input type="text" id="certifications" name="certifications" placeholder="e.g., AWS Certified" className="input" />
            </div>
          </div>

          <div className="field mb-16">
            <label htmlFor="portfolio" className="field-label">Portfolio / Personal Website</label>
            <input type="text" id="portfolio" name="portfolio" placeholder="https://" className="input" />
          </div>

          <div className="field mb-16">
            <label htmlFor="about" className="field-label">Tell us about yourself</label>
            <p style={{ fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>Briefly describe your background and what you're currently working on.</p>
            <textarea id="about" name="about" rows={4} className="textarea" style={{ width: '100%', resize: 'vertical' }} />
          </div>

          <div className="field mb-16">
            <label htmlFor="why" className="field-label">Why do you want to work at Acme Corp?</label>
            <textarea id="why" name="why" rows={4} placeholder="What excites you about our mission?" className="textarea" style={{ width: '100%', resize: 'vertical' }} />
          </div>

          <div className="field mb-24">
            <label htmlFor="challenge" className="field-label">Describe a difficult technical challenge you've overcome</label>
            <textarea id="challenge" name="challenge" rows={5} className="textarea" style={{ width: '100%', resize: 'vertical' }} />
          </div>

          <div style={{ paddingTop: '16px' }}>
            <button type="button" className="save-btn" style={{ width: '100%' }}>
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
          style={{ 
            position: 'absolute', zIndex: 50, padding: '6px', borderRadius: '8px', 
            transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: fillStatus === 'generating' ? 'not-allowed' : 'pointer',
            opacity: fillStatus === 'generating' ? 0.5 : 1,
            top: buttonPos.top, left: buttonPos.left, ...getButtonStyle() 
          }}
          title={hasInstruction ? 'FillAI — using your text as instruction' : 'FillAI — auto-fill this field'}
        >
          {getButtonContent()}
        </button>
      )}
    </div>
  );
}
