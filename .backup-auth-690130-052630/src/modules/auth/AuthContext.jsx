import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from "firebase/auth";
import { onSnapshot } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { accountRef, ensureAccountDoc, ensureStarterAdmin, bumpSessionVersion } from "./authDb";

const AuthCtx = createContext(null);

const IDLE_MS = 15 * 60 * 1000;

export function AuthProvider({ children }) {
  const [fbUser, setFbUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [reason, setReason] = useState(null);

  const lastActiveRef = useRef(Date.now());
  const idleTimerRef = useRef(null);
  const unsubAccountRef = useRef(null);
  const lastSessionVersionRef = useRef(null);

  // remember me default ON
  useEffect(() => { setPersistence(auth, browserLocalPersistence).catch(() => {}); }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFbUser(u || null);
      setAccount(null);
      setSelectedProfile(null);
      setReason(null);

      if (unsubAccountRef.current) { unsubAccountRef.current(); unsubAccountRef.current = null; }
      lastSessionVersionRef.current = null;

      if (u) {
        await ensureAccountDoc(u.uid, u.email || null);
        await ensureStarterAdmin(u.uid);

        unsubAccountRef.current = onSnapshot(accountRef(u.uid), (snap) => {
          const data = snap.data() || null;
          setAccount(data);

          // account disabled => force logout
          if (data?.disabled) {
            logout("disabled");
          }
        });
      }

      setAuthReady(true);
    });

    return () => {
      unsub();
      if (unsubAccountRef.current) unsubAccountRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // idle logout
  useEffect(() => {
    function touch() { lastActiveRef.current = Date.now(); }
    const events = ["mousemove","mousedown","keydown","touchstart","scroll"];
    events.forEach(e => window.addEventListener(e, touch, { passive: true }));

    idleTimerRef.current = setInterval(() => {
      if (fbUser && (Date.now() - lastActiveRef.current) > IDLE_MS) {
        logout("idle");
      }
    }, 5000);

    return () => {
      events.forEach(e => window.removeEventListener(e, touch));
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    };
  }, [fbUser]);

  // end session all devices (watch sessionVersion)
  useEffect(() => {
    if (!fbUser || !account) return;
    const v = account.sessionVersion ?? null;
    if (lastSessionVersionRef.current === null) { lastSessionVersionRef.current = v; return; }
    if (v !== null && lastSessionVersionRef.current !== v) logout("end_session");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.sessionVersion, fbUser?.uid]);

  async function login({ emailOrUsername, password, remember = true }) {
    const raw = String(emailOrUsername ?? "").trim();
    const email = raw.toLowerCase() === "admin" ? "admin@local.test" : raw;

    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, email, String(password ?? ""));
    return cred.user;
  }

  async function logout(r = "logout") {
    setReason(r);
    setSelectedProfile(null);
    try { await signOut(auth); } catch {}
  }

  async function endAllSessions() {
    if (!fbUser) return;
    await bumpSessionVersion(fbUser.uid);
  }

  async function requestPasswordReset(emailOrUsername) {
    const raw = String(emailOrUsername ?? "").trim();
    const email = raw.toLowerCase() === "admin" ? "admin@local.test" : raw;
    await sendPasswordResetEmail(auth, email);
    return true;
  }

  const value = useMemo(() => ({
    fbUser,
    account,
    selectedProfile,
    setSelectedProfile,
    authReady,
    reason,
    login,
    logout,
    endAllSessions,
    requestPasswordReset,
  }), [fbUser, account, selectedProfile, authReady, reason]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}