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
    $rel = $Source
    $leaf = Split-Path -Leaf $Source
    $dest = Join-Path $BackupDir $leaf
    Copy-Item -LiteralPath $Source -Destination $dest -Force
    Write-Log $LogFile "BACKUP: '$Source' -> '$dest'"
  }
}
function Ensure-Git([string]$LogFile) {
  try { $null = Get-Command git -ErrorAction Stop; return }
  catch { throw "git not found in PATH. Install Git or add it to PATH." }
}
function Read-Text([string]$Path) { Get-Content -LiteralPath $Path -Raw }
function Write-Utf8([string]$Path, [string]$Text) {
  New-Dir (Split-Path -Parent $Path)
  Set-Content -LiteralPath $Path -Value $Text -Encoding UTF8
}
function Find-FirstFile([string]$Dir, [string[]]$Patterns) {
  foreach ($pat in $Patterns) {
    $hit = Get-ChildItem -LiteralPath $Dir -File -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match $pat } |
      Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  return $null
}
function Resolve-RelImportExists([string]$BaseFile, [string]$RelPath, [string]$RepoRoot) {
  $baseDir = Split-Path -Parent $BaseFile
  $candidate = Join-Path $baseDir $RelPath
  $candidate = [System.IO.Path]::GetFullPath($candidate)

  # If import has extension, check directly
  if (Test-Path -LiteralPath $candidate) { return $true }

  # Try common extensions
  $exts = @(".js",".jsx",".ts",".tsx")
  foreach ($e in $exts) {
    if (Test-Path -LiteralPath ($candidate + $e)) { return $true }
  }
  # Try index files
  foreach ($e in $exts) {
    if (Test-Path -LiteralPath (Join-Path $candidate ("index" + $e))) { return $true }
  }
  return $false
}
function Log-MissingRelativeImports([string]$FilePath, [string]$RepoRoot, [string]$LogFile) {
  $txt = Read-Text $FilePath
  $matches = [regex]::Matches($txt, "from\s+['""](\.\/[^'""]+|\.\.\/[^'""]+)['""]")
  foreach ($m in $matches) {
    $rel = $m.Groups[1].Value
    if (-not (Resolve-RelImportExists -BaseFile $FilePath -RelPath $rel -RepoRoot $RepoRoot)) {
      Write-Log $LogFile ("MISSING_IMPORT: {0} -> {1}" -f $FilePath, $rel)
    }
  }
}

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")

$workDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $workDir "logs"
$bakDir  = Join-Path $workDir ("backup-" + $ts)
$oldDir  = Join-Path $workDir ("oldrepo-" + $ts)

New-Dir $workDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("restore-pages-and-announcement-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"
Write-Log $logFile ("INFO: OldRepoUrl={0}, OldBranch={1}" -f $OldRepoUrl, $OldBranch)

Ensure-Git $logFile

# Clone old repo (shallow)
# GIT_CLONE_SAFE_V1
Write-Log $logFile ("RUN: git clone --depth 1 --branch {0} {1} {2}" -f $OldBranch, $OldRepoUrl, $oldDir)

if (Test-Path -LiteralPath $oldDir) {
  Write-Log $logFile ("SKIP: old repo dir already exists: {0}" -f $oldDir)
} else {
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    # --quiet prevents stderr progress from becoming a PowerShell NativeCommandError
    $cloneOut = & git clone --quiet --depth 1 --branch $OldBranch $OldRepoUrl $oldDir 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prevEap
  }

  foreach ($line in $cloneOut) { Write-Log $logFile ("GIT: " + $line) }

  if ($exitCode -ne 0) {
    throw ("git clone failed with exit code {0}. See log: {1}" -f $exitCode, $logFile)
  }
  if (-not (Test-Path -LiteralPath $oldDir)) {
    throw ("git clone reported success but folder missing: {0}" -f $oldDir)
  }
  Write-Log $logFile "OK: git clone completed"
}

$oldPages = Join-Path $oldDir "src\pages"
if (-not (Test-Path -LiteralPath $oldPages)) { throw "Old repo missing src/pages: $oldPages" }

$curSrc   = Join-Path $RepoRoot "src"
$curPages = Join-Path $curSrc  "pages"
if (-not (Test-Path -LiteralPath $curPages)) { throw "Current repo missing src/pages: $curPages" }

# Pick old page files by name heuristics
$oldLogin = Find-FirstFile $oldPages @("(?i)^login\.(jsx|tsx|js|ts)$","(?i)login","(?i)sign.*in","(?i)auth")
$oldPin   = Find-FirstFile $oldPages @("(?i)^pin\.(jsx|tsx|js|ts)$","(?i)pin")
$oldIndex = Find-FirstFile $oldPages @("(?i)^index\.(jsx|tsx|js|ts)$","(?i)dashboard","(?i)home","(?i)index")

Write-Log $logFile ("INFO: oldLogin={0}" -f $oldLogin)
Write-Log $logFile ("INFO: oldPin  ={0}" -f $oldPin)
Write-Log $logFile ("INFO: oldIndex={0}" -f $oldIndex)

if (-not $oldLogin -or -not $oldPin -or -not $oldIndex) {
  Write-Log $logFile "FATAL: Could not find one or more old pages by heuristic. Open _boot/oldrepo-*/src/pages and tell exact filenames."
  throw "Missing old page match (login/pin/index)"
}

# Backup existing pages we will overwrite/create
$targetsToBackup = @(
  Join-Path $curPages "Login.jsx",
  Join-Path $curPages "Pin.jsx",
  Join-Path $curPages "Index.jsx",
  Join-Path $curPages "Dashboard.jsx",
  Join-Path $curPages "Home.jsx"
)
foreach ($t in $targetsToBackup) { Backup-File $t $bakDir $logFile }

# Copy old pages into legacy folder (UTF-8 write to avoid Thai mojibake)
$legacyDir = Join-Path $curPages "_legacy_oldgit"
New-Dir $legacyDir

$loginLegacyPath = Join-Path $legacyDir "LoginLegacy.jsx"
$pinLegacyPath   = Join-Path $legacyDir "PinLegacy.jsx"
$indexLegacyPath = Join-Path $legacyDir "IndexLegacy.jsx"

Write-Utf8 $loginLegacyPath (Read-Text $oldLogin)
Write-Utf8 $pinLegacyPath   (Read-Text $oldPin)
Write-Utf8 $indexLegacyPath (Read-Text $oldIndex)

Write-Log $logFile "OK: Copied old git pages into src/pages/_legacy_oldgit (UTF-8)"

# Create wrappers to keep current routing stable + mount AnnouncementDashboard on Index
$loginWrapper = @'
import LoginLegacy from "./_legacy_oldgit/LoginLegacy";
export default function LoginPage() {
  return <LoginLegacy />;
}
'@
$pinWrapper = @'
import PinLegacy from "./_legacy_oldgit/PinLegacy";
export default function PinPage() {
  return <PinLegacy />;
}
'@
$indexWrapper = @'
import IndexLegacy from "./_legacy_oldgit/IndexLegacy";
import AnnouncementDashboard from "../modules/announcement/AnnouncementDashboard";

export default function IndexPage() {
  return (
    <div className="min-h-screen">
      <IndexLegacy />
      <div className="mx-auto max-w-6xl px-4 pb-10">
        <AnnouncementDashboard />
      </div>
    </div>
  );
}
'@
Write-Utf8 (Join-Path $curPages "Login.jsx") $loginWrapper
Write-Utf8 (Join-Path $curPages "Pin.jsx")   $pinWrapper
Write-Utf8 (Join-Path $curPages "Index.jsx") $indexWrapper

# Add common aliases (many routers use Dashboard/Home names)
$aliasDashboard = @'
import IndexPage from "./Index";
export default IndexPage;
'@
Write-Utf8 (Join-Path $curPages "Dashboard.jsx") $aliasDashboard
Write-Utf8 (Join-Path $curPages "Home.jsx")      $aliasDashboard

Write-Log $logFile "OK: Wrote wrappers Login.jsx, Pin.jsx, Index.jsx + aliases Dashboard.jsx/Home.jsx"

# ---- Add Announcement module per spec (glassmorphism + minimal, Firestore-ready) ----
$modDir = Join-Path $curSrc "modules\announcement"
New-Dir $modDir

$announcementData = @'
import { getApps, getApp } from "firebase/app";
import { getFirestore, collection, query, orderBy, limit, onSnapshot, doc, getDoc } from "firebase/firestore";

function getDbOrNull() {
  try {
    const app = getApps().length ? getApp() : null;
    if (!app) return null;
    return getFirestore(app);
  } catch {
    return null;
  }
}

export function subscribeAnnouncements({ collectionName = "announcements", max = 10 }, onData, onError) {
  const db = getDbOrNull();
  if (!db) {
    onData({ items: [], source: "no-app" });
    return () => {};
  }

  const q = query(collection(db, collectionName), orderBy("date", "desc"), limit(max));
  const unsub = onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData({ items, source: "firestore" });
    },
    (err) => onError?.(err)
  );
  return unsub;
}

export async function checkConnection({ probeDocPath = "system/health" } = {}) {
  const db = getDbOrNull();
  if (!db) return { ok: false, reason: "no-app" };

  try {
    const parts = probeDocPath.split("/");
    if (parts.length !== 2) return { ok: false, reason: "bad-probeDocPath" };
    const ref = doc(db, parts[0], parts[1]);
    await getDoc(ref);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || "error" };
  }
}
'@

$preloader = @'
export default function PreloaderSeedStyle({ label = "Loading..." }) {
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
'@

$systemStatus = @'
import { Monitor, Wifi, WifiOff, Database } from "lucide-react";

export default function SystemStatusWidget({
  version = "unknown",
  lastUpdate = "unknown",
  dbLastUpdate = "unknown",
  connected = false,
}) {
  return (
    <div className="rounded-3xl border border-white/40 bg-white/45 p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-sky-500/15 p-3">
            <Monitor className="h-6 w-6 text-sky-700" />
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-800">System Status</div>
            <div className="text-sm text-slate-600">เธชเธ–เธฒเธเธฐเธฃเธฐเธเธเนเธฅเธฐเธเนเธญเธกเธนเธฅเน€เธงเธญเธฃเนเธเธฑเธ</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={"inline-flex items-center gap-2 rounded-full px-3 py-1 " + (connected ? "bg-emerald-500/15 text-emerald-700" : "bg-rose-500/15 text-rose-700")}>
            {connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
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
'@

$announcementBoard = @'
export default function AnnouncementBoard({ items = [] }) {
  return (
    <div className="mt-5 rounded-3xl border border-white/40 bg-white/45 p-5 shadow-sm backdrop-blur">
      <div className="text-lg font-semibold text-slate-800">Announcements</div>
      <div className="text-sm text-slate-600">เธเธฃเธฐเธเธฒเธจเธเนเธฒเธงเธชเธฒเธฃเธฅเนเธฒเธชเธธเธ”</div>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/40 bg-white/50 p-4 text-sm text-slate-600">
            เธขเธฑเธเนเธกเนเธกเธตเธเธฃเธฐเธเธฒเธจ
          </div>
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
'@

$announcementDashboard = @'
import { useEffect, useMemo, useState } from "react";
import SystemStatusWidget from "./SystemStatusWidget";
import AnnouncementBoard from "./AnnouncementBoard";
import PreloaderSeedStyle from "./PreloaderSeedStyle";
import { subscribeAnnouncements, checkConnection } from "./data";

export default function AnnouncementDashboard() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [items, setItems] = useState([]);

  const version = useMemo(() => import.meta.env.VITE_APP_VERSION || "unknown", []);
  const lastUpdate = useMemo(() => import.meta.env.VITE_LAST_UPDATE_DATE || "unknown", []);
  const dbLastUpdate = useMemo(() => import.meta.env.VITE_DB_LAST_UPDATE || "configurable", []);

  useEffect(() => {
    let alive = true;

    // Connection check (interval)
    const run = async () => {
      const res = await checkConnection({ probeDocPath: import.meta.env.VITE_HEALTH_DOC || "system/health" });
      if (!alive) return;
      setConnected(!!res.ok);
    };
    run();
    const t = setInterval(run, 20000);

    // Announcements subscription
    const unsub = subscribeAnnouncements(
      { collectionName: import.meta.env.VITE_ANNOUNCEMENTS_COLLECTION || "announcements", max: 10 },
      ({ items }) => {
        if (!alive) return;
        setItems(items);
        setLoading(false);
      },
      () => {
        if (!alive) return;
        setLoading(false);
      }
    );

    return () => {
      alive = false;
      clearInterval(t);
      try { unsub?.(); } catch {}
    };
  }, []);

  return (
    <div className="mt-6">
      <SystemStatusWidget
        version={version}
        lastUpdate={lastUpdate}
        dbLastUpdate={dbLastUpdate}
        connected={connected}
      />

      {loading ? <PreloaderSeedStyle label="Loading announcements..." /> : <AnnouncementBoard items={items} />}
    </div>
  );
}
'@

Write-Utf8 (Join-Path $modDir "data.js") $announcementData
Write-Utf8 (Join-Path $modDir "PreloaderSeedStyle.jsx") $preloader
Write-Utf8 (Join-Path $modDir "SystemStatusWidget.jsx") $systemStatus
Write-Utf8 (Join-Path $modDir "AnnouncementBoard.jsx") $announcementBoard
Write-Utf8 (Join-Path $modDir "AnnouncementDashboard.jsx") $announcementDashboard

Write-Log $logFile "OK: Wrote src/modules/announcement/*"

# ---- Patch fonts: add Noto Sans Thai import into a likely global css file ----
$cssCandidates = @(
  Join-Path $curSrc "index.css",
  Join-Path $curSrc "main.css",
  Join-Path $curSrc "App.css",
  Join-Path $curSrc "styles\globals.css"
)
$cssTarget = $cssCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if ($cssTarget) {
  Backup-File $cssTarget $bakDir $logFile
  $css = Read-Text $cssTarget
  if ($css -notmatch "Noto Sans Thai") {
    $fontBlock = "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;700&display=swap');`n`n:root{ font-family: 'Noto Sans Thai', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }`n`n"
    Write-Utf8 $cssTarget ($fontBlock + $css)
    Write-Log $logFile ("PATCH: Added Noto Sans Thai to {0}" -f $cssTarget)
  } else {
    Write-Log $logFile ("OK: Noto Sans Thai already present in {0}" -f $cssTarget)
  }
} else {
  Write-Log $logFile "WARN: No global CSS file found to patch fonts (index.css/main.css/App.css)."
}

# ---- Log missing imports for legacy pages (most common build-break) ----
Log-MissingRelativeImports $loginLegacyPath $RepoRoot $logFile
Log-MissingRelativeImports $pinLegacyPath   $RepoRoot $logFile
Log-MissingRelativeImports $indexLegacyPath $RepoRoot $logFile

Write-Log $logFile "END"
Write-Host ""
Write-Host "DONE. Log: $logFile"
Write-Host "Backups: $bakDir"
Write-Host "Old repo cloned to: $oldDir"

