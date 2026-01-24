[CmdletBinding()]
param(
  [string]$RepoRoot = ".",
  [switch]$DryRun,
  [switch]$Force,
  [switch]$RunEslint
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-SelfSyntax {
  $t=$null; $e=$null
  [System.Management.Automation.Language.Parser]::ParseFile($PSCommandPath,[ref]$t,[ref]$e) | Out-Null
  if ($e -and $e.Count -gt 0) { throw "PowerShell compile/syntax check failed for $PSCommandPath" }
}

function Write-Info([string]$m) { Write-Host "[INFO] $m" }
function Write-Warn([string]$m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }

function Ensure-Dir([string]$p) {
  if ($DryRun) { return }
  New-Item -ItemType Directory -Path $p -Force | Out-Null
}

function Backup-File([string]$path, [string]$backupRoot, [string]$rootAbs) {
  if (!(Test-Path $path)) { return }
  $rel = $path.Substring($rootAbs.Length).TrimStart("\","/")
  $dest = Join-Path $backupRoot $rel
  Ensure-Dir (Split-Path $dest -Parent)
  if ($DryRun) { Write-Info "DryRun: backup $rel -> $dest"; return }
  Copy-Item $path $dest -Force
}

function Write-File([string]$path, [string]$content) {
  Ensure-Dir (Split-Path $path -Parent)
  if ((Test-Path $path) -and (-not $Force)) { throw "File exists (use -Force): $path" }
  if ($DryRun) { Write-Info "DryRun: write $path"; return }
  Set-Content -Path $path -Value $content -Encoding UTF8 -NoNewline
  Write-Info "Wrote: $path"
}

function Get-RelativeImport([string]$fromFile, [string]$toFile) {
  $fromDir = Split-Path (Resolve-Path $fromFile).Path -Parent
  $to = (Resolve-Path $toFile).Path

  $fromUri = New-Object System.Uri(($fromDir.TrimEnd("\") + "\"))
  $toUri = New-Object System.Uri($to)
  $rel = $fromUri.MakeRelativeUri($toUri).ToString().Replace("/", "\")
  $rel = [System.Uri]::UnescapeDataString($rel)

  if (-not $rel.StartsWith(".")) { $rel = ".\" + $rel }
  $rel = $rel.Replace("\", "/")

  # drop extension
  $rel = $rel -replace "\.(jsx|js|tsx|ts)$",""
  return $rel
}

function Score-FirebaseInit([string]$path) {
  $raw = Get-Content $path -Raw -ErrorAction SilentlyContinue
  if (-not $raw) { return 0 }
  $s = 0
  if ($raw -match "initializeApp\s*\(") { $s += 3 }
  if ($raw -match "getFirestore\s*\(") { $s += 3 }
  if ($raw -match "getAuth\s*\(") { $s += 3 }
  if ($raw -match "export\s+(const|let|var)\s+db\b") { $s += 2 }
  if ($raw -match "export\s+(const|let|var)\s+auth\b") { $s += 2 }
  if ($raw -match "export\s*\{\s*db") { $s += 2 }
  if ($raw -match "export\s*\{\s*auth") { $s += 2 }
  return $s
}

Assert-SelfSyntax

$root = (Resolve-Path $RepoRoot).Path
$src = Join-Path $root "src"

if (!(Test-Path $src)) { throw "Missing src/ at $src (run from repo root)" }

$dynamicNav = Join-Path $src "components\nav\DynamicNav.jsx"
if (!(Test-Path $dynamicNav)) { throw "Missing DynamicNav.jsx at $dynamicNav" }

$ts = (Get-Date).ToString("yyyyMMdd_HHmmss")
$backupRoot = Join-Path (Join-Path $root "ai-backups") ("nav_patch_" + $ts)
Ensure-Dir $backupRoot

# Find firebase init module (best effort)
$candidates = Get-ChildItem -Path $src -Recurse -File -Include *.js,*.jsx,*.ts,*.tsx -ErrorAction SilentlyContinue
$best = $null
$bestScore = -1
foreach ($f in $candidates) {
  $score = Score-FirebaseInit $f.FullName
  if ($score -gt $bestScore) { $bestScore = $score; $best = $f.FullName }
}

Write-Info "Best firebase init candidate score=$bestScore file=$best"

# Create/replace Nav.jsx wrapper
$navWrapper = Join-Path $src "components\nav\Nav.jsx"
Backup-File -path $navWrapper -backupRoot $backupRoot -rootAbs $root

$importDbAuth = ""
$note = ""
if ($best -and $bestScore -ge 6) {
  $rel = Get-RelativeImport -fromFile $navWrapper -toFile $best
  $importDbAuth = "import { db, auth } from `"${rel}`";"
  $note = "// Auto-wired db/auth from: $rel"
} else {
  $importDbAuth = "// TODO: wire db/auth (auto-detect failed). Pass via props: <Nav db={db} auth={auth} />"
  $note = "// Auto-detect firebase init failed; wrapper will expect db/auth props."
}

$navContent = @"
import React from "react";
import DynamicNav from "./DynamicNav";
$importDbAuth

$note
const STATIC_MENUS = [
  { id: "home", label: "Home", route: "/", group: "primary", order: 0 },
];

export default function Nav(props) {
  const wiredDb = (typeof db !== "undefined") ? db : props.db;
  const wiredAuth = (typeof auth !== "undefined") ? auth : props.auth;

  if (!wiredDb || !wiredAuth) {
    return (
      <div className="p-3 text-sm">
        Nav wiring missing: provide db/auth or fix firebase import.
      </div>
    );
  }

  return (
    <DynamicNav
      db={wiredDb}
      auth={wiredAuth}
      staticMenus={props.staticMenus ?? STATIC_MENUS}
    />
  );
}
"@

Write-File -path $navWrapper -content $navContent

# Check whether Nav.jsx is referenced somewhere
$navRefs = Select-String -Path (Join-Path $src "**\*.*") -Pattern "components/nav/Nav|./nav/Nav|/nav/Nav" -SimpleMatch -ErrorAction SilentlyContinue
if (-not $navRefs) {
  Write-Warn "Could not find any imports of components/nav/Nav. You may need to update your layout to use Nav.jsx."
  Write-Warn "Search for your current Nav/Sidebar component and swap it to: import Nav from './components/nav/Nav';"
} else {
  Write-Info "Found references to Nav.jsx (good)."
}

Write-Info "Backup saved at: $backupRoot"

if ($RunEslint) {
  Write-Info "Running ESLint: npx eslint . --max-warnings=0"
  if (-not $DryRun) {
    cmd.exe /c "npx eslint . --max-warnings=0"
    if ($LASTEXITCODE -ne 0) { throw "ESLint failed ($LASTEXITCODE)" }
  }
}

Write-Info "DONE."
