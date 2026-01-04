import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  updateProfile,
  signOut as fbSignOut,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import {
  listMyIds,
  verifyIdPin,
  setPin as setPinService,
} from "../services/rbacService";

const AuthContext = createContext(null);

const safeLocalGet = (key, fallback = "") => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};
const safeLocalSet = (key, val) => {
  try {
    localStorage.setItem(key, val || "");
  } catch {
    /* ignore */
  }
};

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [session, setSession] = useState(null);
  const [ids, setIds] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [lastIdCode, _setLastIdCode] = useState(() =>
    safeLocalGet("lastIdCode", "")
  );

  const setLastIdCode = useCallback((val) => {
    _setLastIdCode(val || "");
    safeLocalSet("lastIdCode", val || "");
  }, []);

  const loadIds = useCallback(async () => {
    if (!auth.currentUser) {
      setIds([]);
      return [];
    }
    try {
      const list = await listMyIds();
      setIds(list);
      return list;
    } catch (err) {
      console.error("listMyIds failed:", err);
      setIds([]);
      return [];
    }
  }, []);

  const verifyPin = useCallback(async (idCode, pin) => {
    const sessionRes = await verifyIdPin({ idCode, pin });
    if (!sessionRes) {
      throw new Error("Invalid session");
    }
    setSession(sessionRes);
    setLastIdCode(idCode);
    return sessionRes;
  }, [setLastIdCode]);

  const setPin = useCallback(
    async (idCode, currentPin, newPin) => {
      await setPinService({ idCode, currentPin, newPin });
      setSession((prev) =>
        prev ? { ...prev, pinResetRequired: false } : prev
      );
    },
    []
  );

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
    setSession(null);
    setIds([]);
    setLastIdCode("");
  }, [setLastIdCode]);

  const signInWithGoogle = useCallback(async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      return { success: true, data: res.user, error: null };
    } catch (err) {
      if (
        err?.code === "auth/popup-blocked" ||
        err?.code === "auth/operation-not-supported-in-this-environment"
      ) {
        await signInWithRedirect(auth, googleProvider);
        return { success: true, data: null, error: null };
      }
      return {
        success: false,
        data: null,
        error: `${err?.code || "error"}: ${err?.message || String(err)}`,
      };
    }
  }, []);

  const loginEmail = useCallback(async (email, password) => {
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, data: res.user, error: null };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: err?.message || "Login failed",
      };
    }
  }, []);

  const signupEmail = useCallback(async ({ email, password, displayName }) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(res.user, { displayName });
      }
      return { success: true, data: res.user, error: null };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: err?.message || "Signup failed",
      };
    }
  }, []);

  const loginAnonymous = useCallback(async () => {
    try {
      const res = await signInAnonymously(auth);
      return { success: true, data: res.user, error: null };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: err?.message || "Anonymous login failed",
      };
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthLoading(true);
      setFirebaseUser(u || null);
      setSession(null);
      setIds([]);
      try {
        if (u) {
          await loadIds();
        }
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, [loadIds]);

  const value = useMemo(
    () => ({
      firebaseUser,
      session,
      role: session?.role || null,
      allowedMenus: session?.permissions?.allowedMenus || [],
      isAuthed: !!firebaseUser,
      authLoading,
      loading: authLoading,
      ids,
      lastIdCode,
      setLastIdCode,
      loadIds,
      verifyPin,
      setPin,
      signOut,
      logout: signOut,
      signInWithGoogle,
      loginEmail,
      signupEmail,
      loginAnonymous,
      signIn: loginEmail, // backward compatibility
      profile: session,
    }),
    [
      firebaseUser,
      session,
      authLoading,
      ids,
      lastIdCode,
      setLastIdCode,
      loadIds,
      verifyPin,
      setPin,
      signOut,
      signInWithGoogle,
      loginEmail,
      signupEmail,
      loginAnonymous,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
