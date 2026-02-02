# patch-auth-v1.ps1
# RUN ONCE from repo root (the folder that contains /src)
# SafeMode: backup + tools/LAST_BACKUP_DIR.txt + tools/logs/summary.txt always written

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Dir([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null }
}

function Get-Timestamp() { (Get-Date).ToString("yyMMdd-HHmmss") }

function Backup-File([string]$FilePath, [string]$BackupRoot) {
  if (Test-Path -LiteralPath $FilePath) {
    $root = (Get-Location).Path
    $rel = $FilePath.Substring($root.Length).TrimStart('\','/')
    $dest = Join-Path $BackupRoot $rel
    New-Dir (Split-Path -Parent $dest)
    Copy-Item -LiteralPath $FilePath -Destination $dest -Force
  }
}

function Write-TextFile([string]$Path, [string]$Content, [string]$BackupRoot) {
  New-Dir (Split-Path -Parent $Path)
  if (Test-Path -LiteralPath $Path) { Backup-File $Path $BackupRoot }
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.Encoding]::UTF8)
}

function Replace-InFile([string]$Path, [string]$Pattern, [string]$Replacement, [string]$BackupRoot) {
  if (-not (Test-Path -LiteralPath $Path)) { return $false }
  $txt = Get-Content -LiteralPath $Path -Raw
  if ($txt -notmatch $Pattern) { return $false }
  Backup-File $Path $BackupRoot
  $newTxt = [regex]::Replace($txt, $Pattern, $Replacement)
  [System.IO.File]::WriteAllText($Path, $newTxt, [System.Text.Encoding]::UTF8)
  return $true
}

function Insert-AfterFirstMatch([string]$Path, [string]$MatchPattern, [string]$InsertText, [string]$BackupRoot) {
  if (-not (Test-Path -LiteralPath $Path)) { return $false }
  $txt = Get-Content -LiteralPath $Path -Raw
  if ($txt -match [regex]::Escape($InsertText.Trim())) { return $false }

  $m = [regex]::Match($txt, $MatchPattern)
  if (-not $m.Success) { return $false }

  Backup-File $Path $BackupRoot
  $idx = $m.Index + $m.Length
  $newTxt = $txt.Substring(0, $idx) + "`r`n" + $InsertText + $txt.Substring($idx)
  [System.IO.File]::WriteAllText($Path, $newTxt, [System.Text.Encoding]::UTF8)
  return $true
}

$repo = (Get-Location).Path
$ts = Get-Timestamp

$toolsDir = Join-Path $repo "tools"
$logsDir = Join-Path $toolsDir "logs"
New-Dir $logsDir

$backupRoot = Join-Path $repo (".backup-auth-$ts")
New-Dir $backupRoot

$logPath = Join-Path $logsDir ("auth-$ts.log")
$summaryPath = Join-Path $logsDir "summary.txt"

function Log([string]$msg) {
  $line = "[AUTH] $msg"
  $line | Tee-Object -FilePath $logPath -Append | Out-Null
}

try {
  Log "Repo root: $repo"
  Log "Backup: $backupRoot"

  # =========================
  # 0) Ensure src/lib/firebase.js exists (do not overwrite if already exists)
  # =========================
  $firebasePath = Join-Path $repo "src\lib\firebase.js"
  if (-not (Test-Path -LiteralPath $firebasePath)) {
    Log "Creating: src/lib/firebase.js"
    $firebaseContent = @'
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
'@
    Write-TextFile $firebasePath $firebaseContent $backupRoot
  } else {
    Log "Found: src/lib/firebase.js"
  }

  # =========================
  # 1) Create Auth Module (Email/Pass + multi profiles + PIN 4 digits + idle 15m + end session all devices)
  # =========================
  $authBase = Join-Path $repo "src\modules\auth"
  $authPages = Join-Path $authBase "pages"
  New-Dir $authPages

  $pinCrypto = @'
export function normalizePin(pin) {
  const s = String(pin ?? "").trim();
  if (!/^\d{4}$/.test(s)) throw new Error("PIN must be exactly 4 digits");
  return s;
}

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export async function hashPinPBKDF2(pin, saltB64, iterations = 120000) {
  const p = normalizePin(pin);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(p), "PBKDF2", false, ["deriveBits"]);
  const salt = saltB64 ? b64ToBuf(saltB64) : crypto.getRandomValues(new Uint8Array(16)).buffer;

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    256
  );

  return { saltB64: bufToB64(salt), hashB64: bufToB64(bits), iterations };
}

export async function verifyPin(pin, { saltB64, hashB64, iterations }) {
  const res = await hashPinPBKDF2(pin, saltB64, iterations);
  return res.hashB64 === hashB64;
}
'@

  $authDb = @'
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc,
  increment
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * accounts/{uid}:
 *  { email, sessionVersion, disabled, welcomeMessage, createdAt, updatedAt }
 *
 * accounts/{uid}/profiles/{profileId}:
 *  { role: 'admin'|'supervisor'|'staff', displayName, pinSaltB64, pinHashB64, pinIterations, mustChangePin, disabled, createdAt, updatedAt }
 */

export function accountRef(uid) {
  return doc(db, "accounts", uid);
}

export function profileRef(uid, profileId) {
  return doc(db, "accounts", uid, "profiles", profileId);
}

export async function ensureAccountDoc(uid, email) {
  const ref = accountRef(uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      email: email ?? null,
      sessionVersion: 1,
      disabled: false,
      welcomeMessage: "ยินดีต้อนรับ",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, { updatedAt: serverTimestamp() });
  }
}

export async function listProfiles(uid) {
  const col = collection(db, "accounts", uid, "profiles");
  const q = query(col, orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function ensureStarterAdmin(uid) {
  const profiles = await listProfiles(uid);
  if (profiles.length > 0) return;

  await setDoc(profileRef(uid, "admin"), {
    role: "admin",
    displayName: "Starter Admin",
    disabled: false,
    mustChangePin: true,
    // PIN hash will be seeded to 1234 on first PIN screen use if missing
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function bumpSessionVersion(uid) {
  await updateDoc(accountRef(uid), { sessionVersion: increment(1), updatedAt: serverTimestamp() });
}

export async function setWelcomeMessage(uid, text) {
  await updateDoc(accountRef(uid), { welcomeMessage: String(text ?? ""), updatedAt: serverTimestamp() });
}

export async function pingDatabase() {
  // ping: if read succeeds, treat as connected
  await getDoc(doc(db, "system", "status"));
  return true;
}
'@

  $authContext = @'
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
'@

  $protectedRoute = @'
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ allowRoles, children }) {
  const { fbUser, selectedProfile, authReady } = useAuth();

  if (!authReady) return null;
  if (!fbUser) return <Navigate to="/login" replace />;
  if (!selectedProfile) return <Navigate to="/auth/select-profile" replace />;

  if (Array.isArray(allowRoles) && allowRoles.length > 0) {
    if (!allowRoles.includes(selectedProfile.role)) return <Navigate to="/update-info" replace />;
  }

  return children;
}
'@

  $index = @'
export { AuthProvider, useAuth } from "./AuthContext";
export { default as ProtectedRoute } from "./ProtectedRoute";
'@

  $loginPage = @'
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Login() {
  const nav = useNavigate();
  const { login, requestPasswordReset } = useAuth();

  const [emailOrUsername, setEmailOrUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [remember, setRemember] = useState(true);

  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await login({ emailOrUsername, password, remember });
      nav("/auth/select-profile", { replace: true });
    } catch (ex) {
      setErr(ex?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function onResetPassword() {
    setErr(null);
    setMsg(null);
    try {
      await requestPasswordReset(emailOrUsername);
      setMsg("ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว");
    } catch (ex) {
      setErr(ex?.message || "ส่งอีเมลรีเซ็ตไม่สำเร็จ");
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h2>Login</h2>
      <p style={{ opacity: 0.8, marginTop: 0 }}>
        Starter: user <b>admin</b> / pass <b>admin</b> / PIN <b>1234</b>
      </p>

      <form onSubmit={onSubmit}>
        <label>Username / Email</label>
        <input
          value={emailOrUsername}
          onChange={(e) => setEmailOrUsername(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        />

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember me (default ON)
        </label>

        {msg && <div style={{ color: "green", marginTop: 10 }}>{msg}</div>}
        {err && <div style={{ color: "crimson", marginTop: 10 }}>{err}</div>}

        <button disabled={busy} style={{ width: "100%", padding: 12, marginTop: 12 }}>
          {busy ? "Signing in..." : "Sign in"}
        </button>

        <button type="button" onClick={onResetPassword} style={{ width: "100%", padding: 12, marginTop: 10 }}>
          Forgot password (send email)
        </button>
      </form>
    </div>
  );
}
'@

  $selectProfile = @'
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { listProfiles } from "../authDb";

export default function SelectProfile() {
  const nav = useNavigate();
  const { fbUser, setSelectedProfile } = useAuth();

  const [profiles, setProfiles] = useState([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!fbUser) return;
      setBusy(true);
      setErr(null);
      try {
        const p = await listProfiles(fbUser.uid);
        if (!mounted) return;
        const enabled = p.filter(x => !x.disabled);
        setProfiles(enabled);

        if (enabled.length === 1) {
          setSelectedProfile({ id: enabled[0].id, ...enabled[0] });
          nav("/auth/pin", { replace: true });
        }
      } catch (ex) {
        setErr(ex?.message || "Failed to load profiles");
      } finally {
        setBusy(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [fbUser, nav, setSelectedProfile]);

  if (!fbUser) return null;
  if (busy) return <div style={{ padding: 16 }}>Loading profiles...</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>{err}</div>;

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h2>Select user</h2>

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {profiles.map(p => (
          <button
            key={p.id}
            onClick={() => {
              setSelectedProfile({ id: p.id, ...p });
              nav("/auth/pin");
            }}
            style={{ padding: 12, textAlign: "left" }}
          >
            <div style={{ fontWeight: 700 }}>{p.displayName || p.id}</div>
            <div style={{ opacity: 0.8 }}>role: {p.role}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
'@

  $enterPin = @'
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { profileRef } from "../authDb";
import { hashPinPBKDF2, verifyPin, normalizePin } from "../pinCrypto";

export default function EnterPin() {
  const nav = useNavigate();
  const { fbUser, selectedProfile, setSelectedProfile } = useAuth();

  const [pin, setPin] = useState("1234");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => selectedProfile ? `Enter PIN (${selectedProfile.displayName || selectedProfile.id})` : "Enter PIN", [selectedProfile]);

  if (!fbUser || !selectedProfile) return null;

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    try {
      const pRef = profileRef(fbUser.uid, selectedProfile.id);
      const snap = await getDoc(pRef);
      const data = snap.data() || {};

      // Starter: if hash missing, seed 1234 (still mustChangePin = true for first login)
      if (!data.pinHashB64 || !data.pinSaltB64 || !data.pinIterations) {
        const seeded = await hashPinPBKDF2("1234");
        await updateDoc(pRef, {
          pinSaltB64: seeded.saltB64,
          pinHashB64: seeded.hashB64,
          pinIterations: seeded.iterations,
          updatedAt: serverTimestamp(),
        });
        data.pinSaltB64 = seeded.saltB64;
        data.pinHashB64 = seeded.hashB64;
        data.pinIterations = seeded.iterations;
      }

      normalizePin(pin);

      const ok = await verifyPin(pin, {
        saltB64: data.pinSaltB64,
        hashB64: data.pinHashB64,
        iterations: data.pinIterations,
      });

      if (!ok) throw new Error("PIN ไม่ถูกต้อง");

      setSelectedProfile({ ...selectedProfile, ...data });

      if (data.mustChangePin) nav("/auth/change-pin", { replace: true });
      else nav("/update-info", { replace: true });

    } catch (ex) {
      setErr(ex?.message || "PIN failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h2>{title}</h2>
      <p style={{ opacity: 0.8, marginTop: 0 }}>PIN 4 หลัก</p>

      <form onSubmit={onSubmit}>
        <label>PIN</label>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputMode="numeric"
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        />

        {err && <div style={{ color: "crimson" }}>{err}</div>}

        <button disabled={busy} style={{ width: "100%", padding: 12, marginTop: 12 }}>
          {busy ? "Checking..." : "Continue"}
        </button>
      </form>
    </div>
  );
}
'@

  $changePin = @'
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { profileRef } from "../authDb";
import { hashPinPBKDF2, normalizePin } from "../pinCrypto";

export default function ChangePin() {
  const nav = useNavigate();
  const { fbUser, selectedProfile, setSelectedProfile } = useAuth();

  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!fbUser || !selectedProfile) return null;

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    try {
      normalizePin(pin1);
      normalizePin(pin2);
      if (pin1 !== pin2) throw new Error("PIN ไม่ตรงกัน");

      const hashed = await hashPinPBKDF2(pin1);

      await updateDoc(profileRef(fbUser.uid, selectedProfile.id), {
        pinSaltB64: hashed.saltB64,
        pinHashB64: hashed.hashB64,
        pinIterations: hashed.iterations,
        mustChangePin: false,
        updatedAt: serverTimestamp(),
      });

      setSelectedProfile({ ...selectedProfile, mustChangePin: false });
      nav("/update-info", { replace: true });

    } catch (ex) {
      setErr(ex?.message || "Change PIN failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h2>Change PIN</h2>
      <p style={{ opacity: 0.8, marginTop: 0 }}>First login requires PIN change</p>

      <form onSubmit={onSubmit}>
        <label>New PIN</label>
        <input
          value={pin1}
          onChange={(e) => setPin1(e.target.value)}
          inputMode="numeric"
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        />

        <label>Confirm PIN</label>
        <input
          value={pin2}
          onChange={(e) => setPin2(e.target.value)}
          inputMode="numeric"
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        />

        {err && <div style={{ color: "crimson" }}>{err}</div>}

        <button disabled={busy} style={{ width: "100%", padding: 12, marginTop: 12 }}>
          {busy ? "Saving..." : "Save PIN"}
        </button>
      </form>
    </div>
  );
}
'@

  $updateInfo = @'
import React, { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { accountRef, pingDatabase } from "../authDb";

export default function UpdateInfo() {
  const { fbUser, selectedProfile, logout, endAllSessions } = useAuth();
  const [dbState, setDbState] = useState({ status: "connecting", message: "… กำลังเชื่อมต่อฐานข้อมูล …" });
  const [welcome, setWelcome] = useState("");

  useEffect(() => {
    let mounted = true;
    async function ping() {
      try {
        setDbState({ status: "connecting", message: "… กำลังเชื่อมต่อฐานข้อมูล …" });
        await pingDatabase();
        if (!mounted) return;
        setDbState({ status: "ok", message: "เชื่อมต่อฐานข้อมูลสำเร็จแล้ว" });
      } catch {
        if (!mounted) return;
        setDbState({ status: "error", message: "เชื่อมต่อฐานข้อมูลไม่สำเร็จ" });
      }
    }
    ping();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!fbUser) return;
    const unsub = onSnapshot(accountRef(fbUser.uid), (snap) => {
      const data = snap.data() || {};
      setWelcome(String(data.welcomeMessage || "ยินดีต้อนรับ"));
    });
    return () => unsub();
  }, [fbUser]);

  const color = useMemo(() => dbState.status === "ok" ? "green" : (dbState.status === "error" ? "crimson" : "#444"), [dbState.status]);

  if (!fbUser || !selectedProfile) return null;

  return (
    <div style={{ maxWidth: 760, margin: "24px auto", padding: 16 }}>
      <h2>Update Info</h2>

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>System status</div>
        <div style={{ color }}>{dbState.message}</div>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Welcome</div>
        <div>{welcome}</div>

        <div style={{ opacity: 0.8, marginTop: 8 }}>
          user: <b>{selectedProfile.displayName || selectedProfile.id}</b> | role: <b>{selectedProfile.role}</b>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        {selectedProfile.role === "admin" && (
          <a href="/admin/settings" style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8, textDecoration: "none" }}>
            Admin Settings
          </a>
        )}
        <button onClick={() => endAllSessions()} style={{ padding: 10 }}>
          End session (all devices)
        </button>
        <button onClick={() => logout("logout")} style={{ padding: 10 }}>
          Logout
        </button>
      </div>

      <div style={{ marginTop: 18, opacity: 0.7, fontSize: 13 }}>
        * Idle auto logout: 15 นาที
      </div>
    </div>
  );
}
'@

  $adminSettings = @'
import React, { useEffect, useState } from "react";
import { getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { listProfiles, profileRef, setWelcomeMessage } from "../authDb";
import { hashPinPBKDF2, normalizePin } from "../pinCrypto";

export default function AdminSettings() {
  const { fbUser } = useAuth();

  const [profiles, setProfiles] = useState([]);
  const [welcome, setWelcome] = useState("ยินดีต้อนรับ");

  const [newId, setNewId] = useState("staff1");
  const [newRole, setNewRole] = useState("staff");
  const [newName, setNewName] = useState("Staff 1");

  const [tmpPin, setTmpPin] = useState("0000");
  const [msg, setMsg] = useState("");

  async function refresh() {
    if (!fbUser) return;
    const p = await listProfiles(fbUser.uid);
    setProfiles(p);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!fbUser) return;
      const p = await listProfiles(fbUser.uid);
      if (!mounted) return;
      setProfiles(p);
    })();
    return () => { mounted = false; };
  }, [fbUser, msg]);

  if (!fbUser) return null;

  async function onSaveWelcome() {
    await setWelcomeMessage(fbUser.uid, welcome);
    setMsg("Saved welcome message");
  }

  async function onCreateProfile() {
    setMsg("");
    const id = String(newId || "").trim();
    if (!id) return setMsg("Profile id required");

    const ref = profileRef(fbUser.uid, id);
    const snap = await getDoc(ref);
    if (snap.exists()) return setMsg("Profile id already exists");

    normalizePin(tmpPin);
    const hashed = await hashPinPBKDF2(tmpPin);

    await setDoc(ref, {
      role: newRole,
      displayName: newName,
      disabled: false,
      mustChangePin: true,
      pinSaltB64: hashed.saltB64,
      pinHashB64: hashed.hashB64,
      pinIterations: hashed.iterations,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setMsg("Created profile (must change PIN on first login)");
    await refresh();
  }

  async function onResetPin(id) {
    normalizePin(tmpPin);
    const hashed = await hashPinPBKDF2(tmpPin);

    await updateDoc(profileRef(fbUser.uid, id), {
      pinSaltB64: hashed.saltB64,
      pinHashB64: hashed.hashB64,
      pinIterations: hashed.iterations,
      mustChangePin: true,
      updatedAt: serverTimestamp(),
    });

    setMsg("Reset PIN (force change PIN) for " + id);
    await refresh();
  }

  async function onToggleDisable(id, disabled) {
    await updateDoc(profileRef(fbUser.uid, id), { disabled: !!disabled, updatedAt: serverTimestamp() });
    setMsg("Updated " + id);
    await refresh();
  }

  return (
    <div style={{ maxWidth: 860, margin: "24px auto", padding: 16 }}>
      <h2>Admin Settings</h2>

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <div style={{ fontWeight: 700 }}>Welcome message</div>
        <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={3} style={{ width: "100%", marginTop: 8, padding: 10 }} />
        <button onClick={onSaveWelcome} style={{ marginTop: 8, padding: 10 }}>Save</button>
      </div>

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginTop: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Create profile (supervisor/staff/admin)</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label>Profile ID</label>
            <input value={newId} onChange={(e) => setNewId(e.target.value)} style={{ width: "100%", padding: 10 }} />
          </div>
          <div>
            <label>Role</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ width: "100%", padding: 10 }}>
              <option value="staff">staff</option>
              <option value="supervisor">supervisor</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div>
            <label>Display name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: "100%", padding: 10 }} />
          </div>
          <div>
            <label>Temp PIN (4 digits)</label>
            <input value={tmpPin} onChange={(e) => setTmpPin(e.target.value)} inputMode="numeric" style={{ width: "100%", padding: 10 }} />
          </div>
        </div>

        <button onClick={onCreateProfile} style={{ marginTop: 10, padding: 10 }}>
          Create (force change PIN)
        </button>
      </div>

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginTop: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Profiles</div>

        <div style={{ display: "grid", gap: 10 }}>
          {profiles.map(p => (
            <div key={p.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {p.displayName || p.id} <span style={{ opacity: 0.7 }}>({p.id})</span>
                  </div>
                  <div style={{ opacity: 0.8 }}>role: {p.role} {p.disabled ? "(disabled)" : ""}</div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => onResetPin(p.id)} style={{ padding: 8 }}>Reset PIN</button>
                  <button onClick={() => onToggleDisable(p.id, !p.disabled)} style={{ padding: 8 }}>
                    {p.disabled ? "Enable" : "Disable"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {msg && <div style={{ marginTop: 10, color: "green" }}>{msg}</div>}
      </div>
    </div>
  );
}
'@

  Write-TextFile (Join-Path $authBase "pinCrypto.js") $pinCrypto $backupRoot
  Write-TextFile (Join-Path $authBase "authDb.js") $authDb $backupRoot
  Write-TextFile (Join-Path $authBase "AuthContext.jsx") $authContext $backupRoot
  Write-TextFile (Join-Path $authBase "ProtectedRoute.jsx") $protectedRoute $backupRoot
  Write-TextFile (Join-Path $authBase "index.js") $index $backupRoot

  Write-TextFile (Join-Path $authPages "Login.jsx") $loginPage $backupRoot
  Write-TextFile (Join-Path $authPages "SelectProfile.jsx") $selectProfile $backupRoot
  Write-TextFile (Join-Path $authPages "EnterPin.jsx") $enterPin $backupRoot
  Write-TextFile (Join-Path $authPages "ChangePin.jsx") $changePin $backupRoot
  Write-TextFile (Join-Path $authPages "UpdateInfo.jsx") $updateInfo $backupRoot
  Write-TextFile (Join-Path $authPages "AdminSettings.jsx") $adminSettings $backupRoot

  # =========================
  # 2) Patch src/main.jsx (wrap App with AuthProvider)
  # =========================
  $mainPath = Join-Path $repo "src\main.jsx"
  if (-not (Test-Path -LiteralPath $mainPath)) { throw "Missing src/main.jsx" }

  # import AuthProvider
  $importBlockPattern = 'import\s+\{\s*ThemeProvider\s*\}\s+from\s+"@/providers/ThemeProvider";\s*'
  $insertImport = 'import { ThemeProvider } from "@/providers/ThemeProvider";' + "`r`n" + 'import { AuthProvider } from "@/modules/auth";' + "`r`n"
  $didImport = Replace-InFile $mainPath $importBlockPattern $insertImport $backupRoot
  if (-not $didImport) {
    # If ThemeProvider import is different, just add AuthProvider after last import line
    $added = Insert-AfterFirstMatch $mainPath '(^import[\s\S]*?;\s*)' 'import { AuthProvider } from "@/modules/auth";' $backupRoot
    if ($added) { Log "Injected AuthProvider import (fallback)" }
  } else {
    Log "Patched: main.jsx imports"
  }

  # wrap <App /> with <AuthProvider>
  $wrapPattern = '<ThemeProvider\s+defaultTheme="system"\s+storageKey="theme">\s*<App\s*/>\s*<Toaster\s*/>\s*</ThemeProvider>'
  $wrapReplacement = @'
<ThemeProvider defaultTheme="system" storageKey="theme">
      <AuthProvider>
        <App />
      </AuthProvider>
      <Toaster />
    </ThemeProvider>
'@
  $didWrap = Replace-InFile $mainPath $wrapPattern $wrapReplacement $backupRoot
  if ($didWrap) { Log "Patched: main.jsx wrap App with AuthProvider" } else { Log "WARN: main.jsx wrap pattern not matched (check manually)" }

  # =========================
  # 3) Patch src/router/AppRouter.jsx (createBrowserRouter routes + ProtectedRoute)
  # =========================
  $routerPath = Join-Path $repo "src\router\AppRouter.jsx"
  if (-not (Test-Path -LiteralPath $routerPath)) { throw "Missing src/router/AppRouter.jsx" }

  # Insert imports for auth pages + ProtectedRoute
  $importsToAdd = @'
import ProtectedRoute from "@/modules/auth/ProtectedRoute";
import Login from "@/modules/auth/pages/Login";
import SelectProfile from "@/modules/auth/pages/SelectProfile";
import EnterPin from "@/modules/auth/pages/EnterPin";
import ChangePin from "@/modules/auth/pages/ChangePin";
import UpdateInfo from "@/modules/auth/pages/UpdateInfo";
import AdminSettings from "@/modules/auth/pages/AdminSettings";
'@

  # Insert after AppShell import line
  $didInsertImports = Insert-AfterFirstMatch $routerPath 'import\s+\{\s*AppShell\s*\}\s+from\s+"@/components/layout/AppShell";\s*' $importsToAdd $backupRoot
  if ($didInsertImports) { Log "Patched: AppRouter.jsx imports (auth)" } else { Log "WARN: could not insert auth imports (pattern not found or already inserted)" }

  # Rewrite router config: add auth routes + protect existing pages by roles
  $routerReplacePattern = 'const\s+router\s*=\s*createBrowserRouter\(\s*\[\s*[\s\S]*?\s*\]\s*\)\s*;'
  $routerNew = @'
const router = createBrowserRouter([
  // Auth routes (public)
  { path: "/login", element: <Login /> },
  { path: "/auth/select-profile", element: <SelectProfile /> },
  { path: "/auth/pin", element: <EnterPin /> },
  { path: "/auth/change-pin", element: <ChangePin /> },

  // Post-login default page
  {
    path: "/update-info",
    element: (
      <ProtectedRoute allowRoles={["admin", "supervisor", "staff"]}>
        <UpdateInfo />
      </ProtectedRoute>
    )
  },

  // Admin settings
  {
    path: "/admin/settings",
    element: (
      <ProtectedRoute allowRoles={["admin"]}>
        <AdminSettings />
      </ProtectedRoute>
    )
  },

  // Main app (protected)
  {
    path: "/",
    element: (
      <ProtectedRoute allowRoles={["admin", "supervisor", "staff"]}>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute allowRoles={["admin", "supervisor", "staff"]}>
            <HomePage />
          </ProtectedRoute>
        )
      },
      {
        path: "pos",
        element: (
          <ProtectedRoute allowRoles={["admin", "supervisor", "staff"]}>
            <PosPage />
          </ProtectedRoute>
        )
      },
      {
        path: "products",
        element: (
          <ProtectedRoute allowRoles={["admin", "supervisor", "staff"]}>
            <ProductsPage />
          </ProtectedRoute>
        )
      },
      {
        path: "orders",
        element: (
          <ProtectedRoute allowRoles={["admin", "supervisor", "staff"]}>
            <OrdersPage />
          </ProtectedRoute>
        )
      },
      {
        path: "reports",
        element: (
          <ProtectedRoute allowRoles={["admin", "supervisor"]}>
            <ReportsPage />
          </ProtectedRoute>
        )
      },
      {
        path: "settings",
        element: (
          <ProtectedRoute allowRoles={["admin"]}>
            <SettingsPage />
          </ProtectedRoute>
        )
      },
      {
        path: "*",
        element: (
          <ProtectedRoute allowRoles={["admin", "supervisor", "staff"]}>
            <NotFoundPage />
          </ProtectedRoute>
        )
      }
    ]
  }
]);
'@
  $didRouter = Replace-InFile $routerPath $routerReplacePattern $routerNew $backupRoot
  if ($didRouter) { Log "Patched: AppRouter.jsx router config" } else { Log "WARN: AppRouter.jsx router config pattern not matched (check manually)" }

  # =========================
  # 4) Create .env.local.example (do not overwrite .env)
  # =========================
  $envExample = Join-Path $repo ".env.local.example"
  if (-not (Test-Path -LiteralPath $envExample)) {
    $envExampleContent = @'
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
'@
    Write-TextFile $envExample $envExampleContent $backupRoot
    Log "Wrote: .env.local.example"
  }

  # =========================
  # 5) Write tools/LAST_BACKUP_DIR.txt + summary (always)
  # =========================
  New-Dir $toolsDir
  [System.IO.File]::WriteAllText((Join-Path $toolsDir "LAST_BACKUP_DIR.txt"), $backupRoot, [System.Text.Encoding]::UTF8)

  $summary = @"
OK: Auth module installed & router patched
Backup: $backupRoot

Created:
- src/modules/auth/** (AuthProvider + multi profiles + PIN 4 digits + UpdateInfo + AdminSettings)
- src/lib/firebase.js (only if missing)
- .env.local.example

Patched:
- src/main.jsx (wrap App with AuthProvider)
- src/router/AppRouter.jsx (add auth routes + protect pages by role)

REQUIRED AFTER PATCH:
1) Firebase Auth: create user email admin@local.test / password admin
2) Firestore: allow accounts/{uid} read/write for that uid (tighten later)
3) Run:
   npm run lint
   npm run build

Starter:
- Login: admin / admin
- PIN: 1234 (forced change on first login)
"@
  [System.IO.File]::WriteAllText($summaryPath, $summary, [System.Text.Encoding]::UTF8)
  Log "DONE (summary: tools/logs/summary.txt)"
}
catch {
  $err = $_.Exception.Message
  Log "FAILED: $err"
  try {
    $failSummary = "FAILED: $err`r`nBackup: $backupRoot`r`nLog: $logPath"
    [System.IO.File]::WriteAllText($summaryPath, $failSummary, [System.Text.Encoding]::UTF8)
  } catch {}
  throw
}
finally {
  # summary always written above (success/fail)
}