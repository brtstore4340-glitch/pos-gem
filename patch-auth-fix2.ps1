# patch-auth-fix2.ps1
# RUN ONCE from repo root
# Fixes:
# - AuthContext lint: react-hooks/purity (Date.now in render) + react-hooks/immutability (logout before declared)
# - Build: missing firebase dependency (auto npm install firebase if not present)
# SafeMode: backup + tools/LAST_BACKUP_DIR.txt + tools/logs/summary.txt

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Dir([string]$Path) { if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null } }
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

function Write-AllText([string]$Path, [string]$Text) { [System.IO.File]::WriteAllText($Path, $Text, [System.Text.Encoding]::UTF8) }

$repo = (Get-Location).Path
$ts = Get-Timestamp

$toolsDir = Join-Path $repo "tools"
$logsDir  = Join-Path $toolsDir "logs"
New-Dir $logsDir

$backupRoot = Join-Path $repo (".backup-authfix2-$ts")
New-Dir $backupRoot

$logPath = Join-Path $logsDir ("authfix2-$ts.log")
$summaryPath = Join-Path $logsDir "summary.txt"

function Log([string]$msg) {
  $line = "[AUTHFIX2] $msg"
  $line | Tee-Object -FilePath $logPath -Append | Out-Null
}

try {
  Log "Repo root: $repo"
  Log "Backup: $backupRoot"

  # 1) Ensure firebase dependency exists (fix Vite resolve firebase/auth)
  $firebasePkg = Join-Path $repo "node_modules\firebase\package.json"
  if (-not (Test-Path -LiteralPath $firebasePkg)) {
    Log "firebase not found in node_modules -> installing (npm install firebase)"
    & npm install firebase | Tee-Object -FilePath $logPath -Append | Out-Null
  } else {
    Log "firebase already present in node_modules"
  }

  # 2) Rewrite AuthContext.jsx to satisfy react-hooks/purity + immutability
  $ctxPath = Join-Path $repo "src\modules\auth\AuthContext.jsx"
  if (-not (Test-Path -LiteralPath $ctxPath)) { throw "Missing $ctxPath" }
  Backup-File $ctxPath $backupRoot

  $ctxContent = @'
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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

  // refs must be initialized with pure values (react-hooks/purity)
  const lastActiveRef = useRef(0);
  const idleTimerRef = useRef(null);
  const unsubAccountRef = useRef(null);
  const lastSessionVersionRef = useRef(null);

  const logout = useCallback(async (r = "logout") => {
    setReason(r);
    setSelectedProfile(null);
    try { await signOut(auth); } catch (_e) { void _e; }
  }, []);

  const login = useCallback(async ({ emailOrUsername, password, remember = true }) => {
    const raw = String(emailOrUsername ?? "").trim();
    const email = raw.toLowerCase() === "admin" ? "admin@local.test" : raw;

    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, email, String(password ?? ""));
    return cred.user;
  }, []);

  const endAllSessions = useCallback(async () => {
    if (!auth.currentUser) return;
    await bumpSessionVersion(auth.currentUser.uid);
  }, []);

  const requestPasswordReset = useCallback(async (emailOrUsername) => {
    const raw = String(emailOrUsername ?? "").trim();
    const email = raw.toLowerCase() === "admin" ? "admin@local.test" : raw;
    await sendPasswordResetEmail(auth, email);
    return true;
  }, []);

  // remember me default ON
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch((_e) => { void _e; });
  }, []);

  // initialize lastActiveRef safely (impure Date.now moved into effect)
  useEffect(() => {
    lastActiveRef.current = Date.now();
  }, []);

  // Firebase auth state
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

          if (data?.disabled) {
            void logout("disabled");
          }
        });
      }

      setAuthReady(true);
    });

    return () => {
      unsub();
      if (unsubAccountRef.current) { unsubAccountRef.current(); unsubAccountRef.current = null; }
    };
  }, [logout]);

  // idle logout
  useEffect(() => {
    function touch() { lastActiveRef.current = Date.now(); }
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    idleTimerRef.current = setInterval(() => {
      if (fbUser && (Date.now() - lastActiveRef.current) > IDLE_MS) {
        void logout("idle");
      }
    }, 5000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      if (idleTimerRef.current) { clearInterval(idleTimerRef.current); idleTimerRef.current = null; }
    };
  }, [fbUser, logout]);

  // end session all devices: watch sessionVersion changes
  useEffect(() => {
    if (!fbUser || !account) return;

    const v = account.sessionVersion ?? null;
    if (lastSessionVersionRef.current === null) {
      lastSessionVersionRef.current = v;
      return;
    }

    if (v !== null && lastSessionVersionRef.current !== v) {
      void logout("end_session");
    }
  }, [account, fbUser, logout]);

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
  }), [fbUser, account, selectedProfile, authReady, reason, login, logout, endAllSessions, requestPasswordReset]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
'@

  Write-AllText $ctxPath $ctxContent
  Log "Patched: src/modules/auth/AuthContext.jsx (purity + immutability)"

  # 3) LAST_BACKUP_DIR + summary
  New-Dir $toolsDir
  Write-AllText (Join-Path $toolsDir "LAST_BACKUP_DIR.txt") $backupRoot

  $summary = @"
OK: Auth FIX2 applied
Backup: $backupRoot

Done:
- npm install firebase (if missing)
- Rewrote src/modules/auth/AuthContext.jsx to satisfy lint rules:
  - react-hooks/purity
  - react-hooks/immutability

Next:
npm run lint
npm run build
"@
  Write-AllText $summaryPath $summary
  Log "DONE (summary: tools/logs/summary.txt)"
}
catch {
  $err = $_.Exception.Message
  Log "FAILED: $err"
  try {
    Write-AllText $summaryPath ("FAILED: $err`r`nBackup: $backupRoot`r`nLog: $logPath")
  } catch {}
  throw
}
