import * as React from "react";

/**
 * Real keyboard-wedge scan listener (barcode scanners that type keys fast).
 *
 * Behavior:
 * - Buffers keystrokes.
 * - If Enter is pressed, emits the buffer as a scan code.
 * - Also emits on inactivity gap (default 50ms) if buffer looks like a scan.
 *
 * Also exposes: window.__emitScan(code) for debugging.
 *
 * Options:
 * - minLength: minimum length to treat as scan (default 6)
 * - endKeys: keys that finalize scan (default Enter, Tab)
 * - gapMs: inactivity gap that finalizes scan (default 50)
 */
export function useScanListener(onScan, opts = {}) {
  const {
    minLength = 6,
    endKeys = ["Enter", "Tab"],
    gapMs = 50
  } = opts;

  const bufferRef = React.useRef("");
  const timerRef = React.useRef(null);

  const flush = React.useCallback(() => {
    const code = bufferRef.current;
    bufferRef.current = "";
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (code && code.length >= minLength) onScan?.(code);
  }, [minLength, onScan]);

  React.useEffect(() => {
    function onKeyDown(e) {
      // Ignore if user is typing in input/textarea or contenteditable
      const el = e.target;
      const tag = el?.tagName?.toLowerCase();
      const isEditable = el?.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
      if (isEditable) return;

      if (endKeys.includes(e.key)) {
        if (bufferRef.current.length) {
          e.preventDefault();
          flush();
        }
        return;
      }

      // only accept printable characters
      if (e.key.length !== 1) return;

      bufferRef.current += e.key;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // Inactivity flush
        flush();
      }, gapMs);
    }

    window.addEventListener("keydown", onKeyDown, { capture: true });

    // Debug helper
    window.__emitScan = (code) => onScan?.(String(code));

    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      if (window.__emitScan) delete window.__emitScan;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [endKeys, gapMs, flush, onScan]);
}
