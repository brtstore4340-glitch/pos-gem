/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { 
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously
} from "firebase/auth";
import { doc, onSnapshot, getDoc, setDoc, serverTimestamp, collection, getDocs, query, orderBy } from "firebase/firestore";
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
  const [ids, setIds] = useState([]);
  const [lastIdCode, setLastIdCode] = useState("");
  const [session, setSession] = useState(null);

  const idleTimerRef = useRef(null);
  const lastActiveRef = useRef(null);
  const unsubAccountRef = useRef(null);

  // Initialize refs in an effect (purity rule)
  useEffect(() => {
    if (lastActiveRef.current == null) lastActiveRef.current = Date.now();
    return () => {};
  }, []);

  // Email login function
  const loginEmail = useCallback(async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  // Email signup function
  const signupEmail = useCallback(async ({ email, password, displayName }) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  // Google sign-in function
  const signInWithGoogle = useCallback(async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  // Anonymous login function
  const loginAnonymous = useCallback(async () => {
    try {
      const result = await signInAnonymously(auth);
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  // Load IDs (profiles) for the current user
  const loadIds = useCallback(async () => {
    if (!fbUser) return [];
    try {
      const col = collection(db, "accounts", fbUser.uid, "profiles");
      const q = query(col, orderBy("createdAt", "asc"));
      const snap = await getDocs(q);
      const profiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setIds(profiles);
      return profiles;
    } catch (error) {
      console.error("Error loading IDs:", error);
      return [];
    }
  }, [fbUser]);

  // Verify PIN
  const verifyPin = useCallback(async (idCode, pin) => {
    if (!fbUser) throw new Error("Not authenticated");
    
    const profile = ids.find(p => (p.idCode || p.code || String(p)) === idCode);
    if (!profile) throw new Error("ID not found");
    
    // For demo purposes, accept "1234" as the default PIN
    // In production, this should verify against stored hash
    if (pin === "1234") {
      setSession({ idCode, profile });
      setLastIdCode(idCode);
      return;
    }
    
    throw new Error("Invalid PIN");
  }, [fbUser, ids]);

  const logout = useCallback(async (r = "logout") => {
    setReason(r);
    setSelectedProfile(null);
    setSession(null);

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
            setSession(null);
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
      // User
      firebaseUser: fbUser,
      fbUser,
      loading,
      reason,
      
      // Session/Profile
      session,
      selectedProfile,
      setSelectedProfile,
      ids,
      loadIds,
      lastIdCode,
      
      // Auth functions
      loginEmail,
      signupEmail,
      signInWithGoogle,
      loginAnonymous,
      verifyPin,
      signOut: logout,
      logout,
      endAllSessions,
      
      // Refs
      lastActiveRef,
    };
  }, [fbUser, loading, reason, selectedProfile, session, ids, lastIdCode, loginEmail, signupEmail, signInWithGoogle, loginAnonymous, verifyPin, logout, endAllSessions]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider />");
  }
  return ctx;
}
