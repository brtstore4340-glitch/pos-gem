import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { signInWithGoogle, logout, onAuthChange, handleRedirectResult } from '../services/authService';
import { listMyIds, verifyIdPin, setPin as setPinRemote } from '../services/rbacService';

const AuthContext = createContext(null);

const LAST_ID_KEY = 'pos:lastIdCode';

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [ids, setIds] = useState([]);
  const [lastIdCode, setLastIdCode] = useState(() => localStorage.getItem(LAST_ID_KEY) || '');

  useEffect(() => {
    let unsubscribe = () => {};
    let active = true;

    const initAuth = async () => {
      try {
        const result = await handleRedirectResult();
        if (result.error) {
          console.error('Redirect result error:', result.error);
        }
      } catch (error) {
        console.error('Redirect result error:', error?.message || error);
      }

      if (!active) return;

      unsubscribe = onAuthChange((user) => {
        setFirebaseUser(user || null);
        setAuthLoading(false);
        if (!user) {
          setSession(null);
          setIds([]);
        }
      });
    };

    initAuth();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    return signInWithGoogle();
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setSession(null);
    setIds([]);
  }, []);

  const loadIds = useCallback(async () => {
    if (!firebaseUser) return [];
    const data = await listMyIds();
    setIds(data);
    return data;
  }, [firebaseUser]);

  const handleVerifyPin = useCallback(async (idCode, pin) => {
    const sessionData = await verifyIdPin({ idCode, pin });
    setSession(sessionData);
    if (idCode) {
      setLastIdCode(idCode);
      localStorage.setItem(LAST_ID_KEY, idCode);
    }
    return sessionData;
  }, []);

  const handleSetPin = useCallback(async (idCode, currentPin, newPin) => {
    const res = await setPinRemote({ idCode, currentPin, newPin });
    setSession((prev) => prev ? { ...prev, pinResetRequired: false } : prev);
    return res;
  }, []);

  const value = useMemo(() => ({
    firebaseUser,
    authLoading,
    session,
    ids,
    lastIdCode,
    setLastIdCode,
    signInWithGoogle: handleGoogleSignIn,
    signOut: handleLogout,
    loadIds,
    verifyPin: handleVerifyPin,
    setPin: handleSetPin
  }), [firebaseUser, authLoading, session, ids, lastIdCode, handleGoogleSignIn, handleLogout, loadIds, handleVerifyPin, handleSetPin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
