/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

/**
 * AuthContext
 * - Avoid impure calls during render (no Date.now() in render phase)
 * - Ensure functions referenced in effects are declared via useCallback
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [fbUser, setFbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);

  const idleTimerRef = useRef(null);
  const lastActiveRef = useRef(null);
  const unsubAccountRef = useRef(null);

  // Initialize refs in an effect (purity rule)
  useEffect(() => {
    if (lastActiveRef.current == null) lastActiveRef.current = Date.now();
    return () => {};
  }, []);

  const logout = useCallback(async (r = "logout") => {
    setReason(r);
    setSelectedProfile(null);

    // cleanup listeners/timers
    try {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    } catch (_e) { void _e; }
    idleTimerRef.current = null;

    try {
      if (typeof unsubAccountRef.current === "function") unsubAccountRef.current();
    } catch (_e) { void _e; }
    unsubAccountRef.current = null;

    try {
      await signOut(auth);
    } catch (_e) {
      // ignore signOut failures; still clear local state
      void _e;
    } finally {
      setFbUser(null);
    }
  }, []);

  const endAllSessions = useCallback(async () => {
    // Placeholder: implement if you store session docs/tokens in Firestore
    // For now, do a normal logout with a distinct reason.
    await logout("endAllSessions");
  }, [logout]);

  // Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setFbUser(u ?? null);
      setLoading(false);
    });
    return () => {
      try { unsub(); } catch (_e) { void _e; }
    };
  }, []);

  // Optional: account disabled watcher (Firestore)
  useEffect(() => {
    // cleanup old watcher
    try {
      if (typeof unsubAccountRef.current === "function") unsubAccountRef.current();
    } catch (_e) { void _e; }
    unsubAccountRef.current = null;

    if (!fbUser) return () => {};

    try {
      const ref = doc(db, "accounts", fbUser.uid);
      const unsub = onSnapshot(
        ref,
        (snap) => {
          const data = snap?.data?.();
          if (data?.disabled) {
            void setReason("disabled");
setSelectedProfile(null);
try { void signOut(auth); } catch (_e) { void _e; }
          }
        },
        (_err) => {
          // non-fatal
          void _err;
        }
      );
      unsubAccountRef.current = unsub;
    } catch (_e) {
      // If Firestore not configured, do nothing
      void _e;
    }

    return () => {
      try {
        if (typeof unsubAccountRef.current === "function") unsubAccountRef.current();
      } catch (_e) { void _e; }
      unsubAccountRef.current = null;
    };
  }, [fbUser, logout]);

  // Basic activity tracking (optional)
  useEffect(() => {
    const markActive = () => {
      lastActiveRef.current = Date.now();
    };

    window.addEventListener("mousemove", markActive, { passive: true });
    window.addEventListener("keydown", markActive, { passive: true });
    window.addEventListener("touchstart", markActive, { passive: true });

    return () => {
      window.removeEventListener("mousemove", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("touchstart", markActive);
    };
  }, []);

  const value = useMemo(() => {
    return {
      fbUser,
      loading,
      reason,
      selectedProfile,
      setSelectedProfile,
      logout,
      endAllSessions,
      lastActiveRef,
    };
  }, [fbUser, loading, reason, selectedProfile, logout, endAllSessions]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider />");
  }
  return ctx;
}
