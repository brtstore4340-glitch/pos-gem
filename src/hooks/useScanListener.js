import { useEffect, useRef, useState } from 'react';

export function useScanListener(onScan, onCheckout, onSearchToggle, options = {}) {
  const inputRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const enabled = options?.enabled !== false;

  // Auto-focus logic
  useEffect(() => {
    if (!enabled) return;
    const focusInput = () => {
        if (inputRef.current) inputRef.current.focus();
    };
    
    // Initial focus
    focusInput();

    const handleGlobalKeyDown = (e) => {
      // F12 Checkout Shortcut
      if (e.key === 'F12') {
          e.preventDefault();
          if (onCheckout) onCheckout();
          return;
      }
      
      // Ctrl+/ Search Toggle (Product Lookup Modal)
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
          e.preventDefault();
          if (onSearchToggle) onSearchToggle();
          return;
      }
      
      // Escape key can be handled by individual modals
      // but we can provide global blur if needed
      if (e.key === 'Escape') {
          // Let modals handle their own Escape first
          // If not handled, refocus scanner input
          if (document.activeElement.tagName !== 'INPUT' &&
              document.activeElement.tagName !== 'TEXTAREA') {
              focusInput();
          }
      }
      
      // Keep focus on hidden input if not typing elsewhere
      if (document.activeElement.tagName !== 'INPUT' &&
          document.activeElement.tagName !== 'TEXTAREA' &&
          inputRef.current) {
          inputRef.current.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    // Also re-focus on click anywhere
    window.addEventListener('click', focusInput);

    return () => {
        window.removeEventListener('keydown', handleGlobalKeyDown);
        window.removeEventListener('click', focusInput);
    };
  }, [enabled, onCheckout, onSearchToggle]);

  const handleInputKeyDown = (e) => {
    if (!enabled) return;
    if (e.key === 'Enter') {
      const value = e.target.value.trim();
      if (value) {
        onScan(value);
        setInputValue(''); // Clear after scan
      }
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  return { inputRef, inputValue, setInputValue, handleInputKeyDown, handleInputChange };
}
