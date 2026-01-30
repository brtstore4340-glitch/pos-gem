[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [string]$OldRepoUrl = "https://github.com/brtstore4340-glitch/pos-gem.git",
  [string]$OldBranch  = "main"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Dir([string]$Path) { if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null } }
function Write-Log([string]$LogFile, [string]$Message) {
  $ts = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffK")
  "$ts $Message" | Tee-Object -FilePath $LogFile -Append
}
function Backup-File([string]$Source, [string]$BackupDir, [string]$LogFile) {
  if (Test-Path -LiteralPath $Source) {
    $rel = $Source.Replace((Get-Location).Path, "").TrimStart("\","/")
    $safe = ($rel -replace '[\\/:*?"<>|]', '_')
    $dest = Join-Path $BackupDir ($safe + ".bak")
    Copy-Item -LiteralPath $Source -Destination $dest -Force
    Write-Log $LogFile "BACKUP: '$Source' -> '$dest'"
  }
}
function Ensure-Git() { $null = Get-Command git -ErrorAction Stop }
function Read-Text([string]$Path) { Get-Content -LiteralPath $Path -Raw }
function Write-Utf8([string]$Path, [string]$Text) { New-Dir (Split-Path -Parent $Path); Set-Content -LiteralPath $Path -Value $Text -Encoding UTF8 }
function Find-OldRepoDir([string]$BootDir) {
  $dirs = Get-ChildItem -LiteralPath $BootDir -Directory -Filter "oldrepo-*" -ErrorAction SilentlyContinue | Sort-Object Name -Descending
  if ($dirs.Count -gt 0) { return $dirs[0].FullName }
  return $null
}
function Find-FirstByName([string]$Dir, [string[]]$NameCandidates) {
  foreach ($n in $NameCandidates) {
    $p = Join-Path $Dir $n
    if (Test-Path -LiteralPath $p) { return $p }
  }
  return $null
}
function Find-AnyPinLike([string]$Dir) {
  $hits = Get-ChildItem -LiteralPath $Dir -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '(?i)pin' } |
    Select-Object -First 1
  return $hits?.FullName
}

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
$bootDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $bootDir "logs"
$bakDir  = Join-Path $bootDir ("backup-" + $ts)
New-Dir $bootDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("restore-v2-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"
Write-Log $logFile ("INFO: OldRepoUrl={0}, OldBranch={1}" -f $OldRepoUrl, $OldBranch)

Ensure-Git

# Reuse existing oldrepo-* if present, else clone
$oldDir = Find-OldRepoDir $bootDir
if (-not $oldDir) {
  $oldDir = Join-Path $bootDir ("oldrepo-" + $ts)
  Write-Log $logFile ("RUN: git clone --quiet --depth 1 --branch {0} {1} {2}" -f $OldBranch, $OldRepoUrl, $oldDir)
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $out = & git clone --quiet --depth 1 --branch $OldBranch $OldRepoUrl $oldDir 2>&1
    $exit = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prevEap
  }
  foreach ($l in $out) { Write-Log $logFile ("GIT: " + $l) }
  if ($exit -ne 0) { throw "git clone failed (exit=$exit). See log: $logFile" }
  Write-Log $logFile "OK: git clone completed"
} else {
  Write-Log $logFile ("SKIP: reuse old repo dir: {0}" -f $oldDir)
}

$oldPages = Join-Path $oldDir "src\pages"
if (-not (Test-Path -LiteralPath $oldPages)) { throw "Old repo missing src/pages: $oldPages" }

# Old file mapping (explicit known names from your log)
$oldLogin = Find-FirstByName $oldPages @("LoginPage.jsx","Login.jsx","login.jsx","login.tsx","LoginPage.tsx")
$oldIndex = Find-FirstByName $oldPages @("DashboardPage.jsx","Dashboard.jsx","HomePage.jsx","IndexPage.jsx","Index.jsx")

# Pin is optional; try common names then fallback to any *pin*
$oldPin = Find-FirstByName $oldPages @("PinPage.jsx","Pin.jsx","VerifyPinPage.jsx","PinVerifyPage.jsx","PinPage.tsx")
if (-not $oldPin) { $oldPin = Find-AnyPinLike $oldPages }

Write-Log $logFile ("INFO: oldLogin={0}" -f $oldLogin)
Write-Log $logFile ("INFO: oldIndex={0}" -f $oldIndex)
Write-Log $logFile ("INFO: oldPin  ={0}" -f $oldPin)

if (-not $oldLogin -or -not $oldIndex) {
  Write-Log $logFile "FATAL: Missing oldLogin or oldIndex. List files in _boot/oldrepo-*/src/pages and confirm names."
  throw "Missing oldLogin/oldIndex"
}

$curSrc   = Join-Path $RepoRoot "src"
$curPages = Join-Path $curSrc  "pages"
if (-not (Test-Path -LiteralPath $curPages)) { throw "Current repo missing src/pages: $curPages" }

# Backup current targets (we overwrite these to force routing to pick up legacy)
$targets = @(
  Join-Path $curPages "LoginPage.jsx",
  Join-Path $curPages "DashboardPage.jsx",
  Join-Path $curPages "PinPage.jsx",
  Join-Path $curPages "Login.jsx",
  Join-Path $curPages "Index.jsx",
  Join-Path $curPages "Home.jsx",
  Join-Path $curPages "Dashboard.jsx"
)
foreach ($t in $targets) { Backup-File $t $bakDir $logFile }

# Copy old git pages into legacy folder (UTF-8)
$legacyDir = Join-Path $curPages "_legacy_oldgit"
New-Dir $legacyDir
$loginLegacyPath = Join-Path $legacyDir "LoginLegacy.jsx"
$indexLegacyPath = Join-Path $legacyDir "DashboardLegacy.jsx"
$pinLegacyPath   = Join-Path $legacyDir "PinLegacy.jsx"

Write-Utf8 $loginLegacyPath (Read-Text $oldLogin)
Write-Utf8 $indexLegacyPath (Read-Text $oldIndex)
Write-Log $logFile "OK: Copied Login/Dashboard into src/pages/_legacy_oldgit"

if ($oldPin) {
  Write-Utf8 $pinLegacyPath (Read-Text $oldPin)
  Write-Log $logFile "OK: Copied Pin into src/pages/_legacy_oldgit"
} else {
  Write-Log $logFile "WARN: No pin page found in old repo. Skipping Pin restore (login/index will still be restored)."
}

# Create wrappers (force stable entry points that your router likely imports)
$loginWrapper = @'
import LoginLegacy from "./_legacy_oldgit/LoginLegacy";
export default function LoginPage() { return <LoginLegacy />; }
'@
$dashWrapper = @'
import DashboardLegacy from "./_legacy_oldgit/DashboardLegacy";
import AnnouncementDashboard from "../modules/announcement/AnnouncementDashboard";

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      <DashboardLegacy />
      <div className="mx-auto max-w-6xl px-4 pb-10">
        <AnnouncementDashboard />
      </div>
    </div>
  );
}
'@
Write-Utf8 (Join-Path $curPages "LoginPage.jsx") $loginWrapper
Write-Utf8 (Join-Path $curPages "DashboardPage.jsx") $dashWrapper

if (Test-Path -LiteralPath $pinLegacyPath) {
  $pinWrapper = @'
import PinLegacy from "./_legacy_oldgit/PinLegacy";
export default function PinPage() { return <PinLegacy />; }
'@
  Write-Utf8 (Join-Path $curPages "PinPage.jsx") $pinWrapper
}

# Aliases (catch routers that import other names)
$aliasLogin = @'import LoginPage from "./LoginPage"; export default LoginPage;'@
$aliasDash  = @'import DashboardPage from "./DashboardPage"; export default DashboardPage;'@
Write-Utf8 (Join-Path $curPages "Login.jsx") $aliasLogin
Write-Utf8 (Join-Path $curPages "Index.jsx") $aliasDash
Write-Utf8 (Join-Path $curPages "Home.jsx") $aliasDash
Write-Utf8 (Join-Path $curPages "Dashboard.jsx") $aliasDash

Write-Log $logFile "OK: Wrote wrappers + aliases (LoginPage/DashboardPage + Login/Index/Home/Dashboard)"

# ---- Announcement module (same as before, minimal + Firestore-ready) ----
$modDir = Join-Path $curSrc "modules\announcement"
New-Dir $modDir

$announcementDashboard = @'
import { useEffect, useMemo, useState } from "react";
import { getApps, getApp } from "firebase/app";
import { getFirestore, collection, query, orderBy, limit, onSnapshot, doc, getDoc } from "firebase/firestore";
import { Monitor, Wifi, WifiOff, Database } from "lucide-react";

function getDbOrNull() {
  try {
    const app = getApps().length ? getApp() : null;
    if (!app) return null;
    return getFirestore(app);
  } catch { return null; }
}

function PreloaderSeedStyle({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="flex items-center gap-3 rounded-2xl border border-white/40 bg-white/50 px-5 py-3 shadow-sm backdrop-blur">
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:-0.2s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:-0.1s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500" />
        </div>
        <span className="text-sm text-slate-700">{label}</span>
      </div>
    </div>
  );
}

function SystemStatusWidget({ version, lastUpdate, dbLastUpdate, connected }) {
  return (
    <div className="rounded-3xl border border-white/40 bg-white/45 p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-sky-500/15 p-3">
            <Monitor className="h-6 w-6 text-sky-700" />
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-800">System Status</div>
            <div className="text-sm text-slate-600">สถานะระบบและข้อมูลเวอร์ชัน</div>
          </div>
        </div>
        <span className={"inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm " + (connected ? "bg-emerald-500/15 text-emerald-700" : "bg-rose-500/15 text-rose-700")}>
          {connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/40 bg-white/50 p-4">
          <div className="text-xs text-slate-600">Web App Version</div>
          <div className="mt-1 font-medium text-slate-800">{version}</div>
        </div>
        <div className="rounded-2xl border border-white/40 bg-white/50 p-4">
          <div className="text-xs text-slate-600">Last Update Date</div>
          <div className="mt-1 font-medium text-slate-800">{lastUpdate}</div>
        </div>
        <div className="rounded-2xl border border-white/40 bg-white/50 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Database className="h-4 w-4" /> Database Last Update
          </div>
          <div className="mt-1 font-medium text-slate-800">{dbLastUpdate}</div>
        </div>
      </div>
    </div>
  );
}

function AnnouncementBoard({ items }) {
  return (
    <div className="mt-5 rounded-3xl border border-white/40 bg-white/45 p-5 shadow-sm backdrop-blur">
      <div className="text-lg font-semibold text-slate-800">Announcements</div>
      <div className="text-sm text-slate-600">ประกาศข่าวสารล่าสุด</div>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/40 bg-white/50 p-4 text-sm text-slate-600">ยังไม่มีประกาศ</div>
        ) : (
          items.map((a) => (
            <div key={a.id} className="rounded-2xl border border-white/40 bg-white/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-800">{a.title || "Untitled"}</div>
                  <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{a.detail || ""}</div>
                </div>
                <div className="shrink-0 text-xs text-slate-500">
                  {a.date?.toDate ? a.date.toDate().toLocaleString() : (a.date || "")}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function AnnouncementDashboard() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [items, setItems] = useState([]);

  const version = useMemo(() => import.meta.env.VITE_APP_VERSION || "unknown", []);
  const lastUpdate = useMemo(() => import.meta.env.VITE_LAST_UPDATE_DATE || "unknown", []);
  const dbLastUpdate = useMemo(() => import.meta.env.VITE_DB_LAST_UPDATE || "configurable", []);

  useEffect(() => {
    let alive = true;

    const runConn = async () => {
      const db = getDbOrNull();
      if (!db) { if (alive) setConnected(false); return; }
      try {
        const p = (import.meta.env.VITE_HEALTH_DOC || "system/health").split("/");
        const ref = doc(db, p[0], p[1]);
        await getDoc(ref);
        if (alive) setConnected(true);
      } catch { if (alive) setConnected(false); }
    };

    runConn();
    const t = setInterval(runConn, 20000);

    const db = getDbOrNull();
    if (!db) { setLoading(false); return () => clearInterval(t); }

    const qy = query(collection(db, import.meta.env.VITE_ANNOUNCEMENTS_COLLECTION || "announcements"), orderBy("date", "desc"), limit(10));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        if (!alive) return;
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => { if (alive) setLoading(false); }
    );

    return () => {
      alive = false;
      clearInterval(t);
      try { unsub(); } catch {}
    };
  }, []);

  return (
    <div className="mt-6">
      <SystemStatusWidget version={version} lastUpdate={lastUpdate} dbLastUpdate={dbLastUpdate} connected={connected} />
      {loading ? <PreloaderSeedStyle label="Loading announcements..." /> : <AnnouncementBoard items={items} />}
    </div>
  );
}
'@
Write-Utf8 (Join-Path $modDir "AnnouncementDashboard.jsx") $announcementDashboard
Write-Log $logFile "OK: Wrote src/modules/announcement/AnnouncementDashboard.jsx"

Write-Log $logFile "END"
Write-Host ""
Write-Host "DONE. Log: $logFile"
Write-Host "Backups: $bakDir"
Write-Host "Old repo dir: $oldDir"
