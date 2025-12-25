import { useEffect, useRef, useState } from 'react';

export function useScanListener(onScan, onCheckout) {
  const inputRef = useRef(null);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();

    const handleGlobalKeyDown = (e) => {
      if (e.key === 'F12') { e.preventDefault(); onCheckout?.(); }
      if (document.activeElement.tagName !== 'INPUT' && inputRef.current) { inputRef.current.focus(); }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onCheckout]);

  const handleInputKeyDown = (e) => {
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
