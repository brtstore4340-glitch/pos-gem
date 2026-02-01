<#
  fix-build-react-hot-toast.v4.ps1

  Fixes two things systematically:
  1) Runner bug: previous scripts called npm with missing args -> npm prints usage/help.
     This v4 uses ValueFromRemainingArguments to always pass args correctly.
  2) Original build issue: missing "react-hot-toast" import -> install deterministic + build.

  Flow:
    Option 0: Verify npm actually runs with args (npm --version)
    Option 1: Ensure react-hot-toast@2.6.0 (save-exact) + npm run build
    Option 2: If still failing, quarantine node_modules + reinstall (ci if lock) + build
    Option 3: Diagnostics: npm ls, require.resolve, find importers, scan vite config, show build tail/head
    Option 4 (OPT-IN): stub legacy LoginLegacy.jsx (behavior change) + build

  Safety:
    - Creates backups for package.json/package-lock.json/legacy file (if stub)
    - Writes logs and command outputs to _boot\patchlogs + _boot\trash
#>

param(
  [string]$RepoRoot = (Get-Location).Path,
  [string]$PkgName = "react-hot-toast",
  [string]$PkgVersion = "2.6.0",
  [switch]$AutoStubLegacyAsLastResort
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Prevent native stderr becoming terminating errors (PowerShell 7+)
try { $global:PSNativeCommandUseErrorActionPreference = $false } catch {}

function New-Timestamp { (Get-Date -Format "yyyyMMdd-HHmmss") }
<<<<<<< HEAD
function New-Directory([string]$Path) { if (!(Test-Path $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null } }
function Get-SafeFileName([string]$s) { ($s -replace '[^a-zA-Z0-9\-_\.]+','_') }
=======
function New-Directory([string]$Path) { if (!(Test-Path $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null } }
function Get-SafeFileName([string]$s) { ($s -replace '[^a-zA-Z0-9\-_\.]+','_') }
>>>>>>> main

$ts = New-Timestamp
$bootDir   = Join-Path $RepoRoot "_boot"
$logDir    = Join-Path $bootDir "patchlogs"
$trashRoot = Join-Path $bootDir "trash"
$trashRun  = Join-Path $trashRoot ("fix-build-v4-{0}" -f $ts)

Ensure-Dir $bootDir
Ensure-Dir $logDir
Ensure-Dir $trashRoot
Ensure-Dir $trashRun

$logFile = Join-Path $logDir ("fix-build-v4-{0}.log" -f $ts)

function Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "o"), $msg
  $line | Tee-Object -FilePath $logFile -Append | Out-Host
}

function Backup-File([string]$path) {
  if (Test-Path $path) {
    $bak = "$path.bak.$ts"
    Copy-Item -LiteralPath $path -Destination $bak -Force
    Log "Backup: $bak"
  }
}

<<<<<<< HEAD
function Move-DirectoryToQuarantine([string]$path) {
=======
function Move-DirectoryToQuarantine([string]$path) {
>>>>>>> main
  if (!(Test-Path $path)) { return $null }
  $name = Split-Path $path -Leaf
  $dest = Join-Path $trashRun $name
  if (Test-Path $dest) { $dest = Join-Path $trashRun ("{0}__dup__{1}" -f $name, (New-Timestamp)) }
  Move-Item -LiteralPath $path -Destination $dest -Force
  Log "Quarantined: $path => $dest"
  return $dest
}

function Read-Head([string]$file, [int]$n=60) {
  if (!(Test-Path $file)) { return @() }
  @(Get-Content -LiteralPath $file -ErrorAction SilentlyContinue | Select-Object -First $n)
}
function Read-Tail([string]$file, [int]$n=200) {
  if (!(Test-Path $file)) { return @() }
  @(Get-Content -LiteralPath $file -ErrorAction SilentlyContinue | Select-Object -Last $n)
}

<<<<<<< HEAD
function Get-NpmUsage([string]$outFile) {
=======
function Get-NpmUsage([string]$outFile) {
>>>>>>> main
  if (!(Test-Path $outFile)) { return $false }
  $patterns = @(
    '^npm <command>$',
    '^Usage:$',
    'Specify configs in the ini-formatted file:',
    'Configuration fields: npm help'
  )
  foreach ($p in $patterns) {
    if (Select-String -LiteralPath $outFile -Pattern $p -Quiet -ErrorAction SilentlyContinue) { return $true }
  }
  return $false
}

<<<<<<< HEAD
function Get-MissingImports([string]$outFile) {
=======
function Get-MissingImports([string]$outFile) {
>>>>>>> main
  if (!(Test-Path $outFile)) { return @() }
  $pattern = 'failed to resolve import "([^"]+)" from "([^"]+)"'
  $hits = @()
  $ms = Select-String -LiteralPath $outFile -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue
  foreach ($m in @($ms)) {
    foreach ($g in $m.Matches) {
      $hits += [pscustomobject]@{ Module=$g.Groups[1].Value; From=$g.Groups[2].Value }
    }
  }
  return @($hits)
}

# Robust runner: captures remaining args correctly (no accidental dropping)
<<<<<<< HEAD
function Invoke-Native {
=======
function Invoke-Native {
>>>>>>> main
  param(
    [string]$Label,
    [string]$Exe,
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Rest
  )

  $outFile = Join-Path $trashRun ("{0}.out.txt" -f (Safe-FileName $Label))
  Log "---- $Label ----"
  Log ("CMD: {0} {1}" -f $Exe, ($Rest -join " "))

  $exit = 0
  try {
    & $Exe @Rest 2>&1 | Tee-Object -FilePath $outFile | Tee-Object -FilePath $logFile -Append | Out-Host
    $exit = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
  } catch {
    $exit = 999
    ("POWERSHELL_EXCEPTION: " + $_.Exception.Message) | Tee-Object -FilePath $outFile | Tee-Object -FilePath $logFile -Append | Out-Host
  }

  Log "EXITCODE: $exit"
  return [pscustomobject]@{ Ok=($exit -eq 0); ExitCode=$exit; OutFile=$outFile }
}

<<<<<<< HEAD
function Confirm-NpmIsWorking() {
=======
function Confirm-NpmIsWorking() {
>>>>>>> main
  Log "===== OPTION 0: Verify npm works with args ====="
  $r = Run-Native "npm --version" npm --version
  if (-not $r.Ok -or (Detect-NpmUsage $r.OutFile)) {
    Log "CRITICAL: npm did not accept args correctly (or returned usage)."
    Log "Next actions (evidence-based):"
    Log " - Run in your terminal: `npm --version` and paste output."
    Log " - Run: `where npm` and `where node`."
    throw "npm is not behaving as expected. Stop here to avoid corrupting installs."
  }
  return $true
}

<<<<<<< HEAD
function Confirm-Package() {
=======
function Confirm-Package() {
>>>>>>> main
  Log "===== Ensure dependency: $PkgName@$PkgVersion ====="
  $ls = Run-Native "npm ls $PkgName depth0" npm ls $PkgName --depth=0
  if ($ls.Ok) {
    Log "Dependency already present (per npm ls)."
    return $true
  }

  $ins = Run-Native "npm install $PkgName@$PkgVersion save-exact" npm install "$PkgName@$PkgVersion" --save-exact --no-audit --no-fund
  return $ins.Ok
}

function Build() {
  Log "===== Build ====="
  $b = Run-Native "npm run build" npm run build
  if ($b.Ok) { return $b }

  if (Detect-NpmUsage $b.OutFile) {
    Log "DIAG: Build output looks like npm usage/help, not Vite output."
  }

  $missing = @(Detect-MissingImports $b.OutFile)
  if ($missing.Count -gt 0) {
    Log "Detected missing import(s):"
    foreach ($m in $missing) { Log (" - missing: {0} | from: {1}" -f $m.Module, $m.From) }
  }

  Log "Build HEAD (first 60):"
  foreach ($line in (Read-Head $b.OutFile 60)) { Log ("BUILD_HEAD: " + $line) }

  Log "Build TAIL (last 200):"
  foreach ($line in (Read-Tail $b.OutFile 200)) { Log ("BUILD_TAIL: " + $line) }

  return $b
}

try {
  Log "RepoRoot: $RepoRoot"
  Log "Pkg target: $PkgName@$PkgVersion"
  Log "TrashRun: $trashRun"
  Log "LogFile: $logFile"

  Push-Location $RepoRoot

  # Backups
  $pkgJson = Join-Path $RepoRoot "package.json"
  $pkgLock = Join-Path $RepoRoot "package-lock.json"
  if (!(Test-Path $pkgJson)) { throw "Missing package.json at $pkgJson" }
  Backup-File $pkgJson
  if (Test-Path $pkgLock) { Backup-File $pkgLock }

  # OPTION 0
  Require-Npm-Working | Out-Null

  # OPTION 1
  Log "===== OPTION 1: Install missing dependency + build ====="
  Ensure-Package | Out-Null
  $b1 = Build
  if ($b1.Ok) {
    Log "SUCCESS: Build passed after Option 1."
    exit 0
  }

  # If still missing react-hot-toast, proceed to Option 2/3
  $miss1 = @(Detect-MissingImports $b1.OutFile | Where-Object { $_.Module -eq $PkgName })
  if ($miss1.Count -gt 0) {
    Log "Still missing $PkgName after install attempt."
    Log "Proceeding to Option 2 clean install then diagnostics."
  }

  # OPTION 2
  Log "===== OPTION 2: Clean install + build ====="
  $nm = Join-Path $RepoRoot "node_modules"
  if (Test-Path $nm) { Quarantine-Dir $nm | Out-Null }

  if (Test-Path $pkgLock) {
    Run-Native "npm ci" npm ci --no-audit --no-fund | Out-Null
  } else {
    Run-Native "npm install" npm install --no-audit --no-fund | Out-Null
  }

  # Ensure package again after clean install
  Ensure-Package | Out-Null

  $b2 = Build
  if ($b2.Ok) {
    Log "SUCCESS: Build passed after Option 2."
    exit 0
  }

  # OPTION 3 diagnostics
  Log "===== OPTION 3: Diagnostics (no guessing) ====="
  Run-Native "where npm" cmd /c where npm | Out-Null
  Run-Native "where node" cmd /c where node | Out-Null
  Run-Native "node -v" node -v | Out-Null
  Run-Native "npm -v" npm -v | Out-Null

  Run-Native "npm ls $PkgName depth1" npm ls $PkgName --depth=1 | Out-Null
  Run-Native "node require.resolve($PkgName)" node -e "try{console.log(require.resolve('$PkgName'))}catch(e){console.error('RESOLVE_FAIL:',e.message);process.exit(2)}" | Out-Null

  # Who imports legacy page?
  Run-Native "find importers of LoginLegacy" powershell -NoProfile -Command `
    "Get-ChildItem -Path (Join-Path '$RepoRoot' 'src') -Recurse -File -ErrorAction SilentlyContinue | " +
    "Select-String -Pattern '_legacy_oldgit[\\/].*LoginLegacy' -AllMatches -ErrorAction SilentlyContinue | " +
    "ForEach-Object { '{0}:{1} {2}' -f `$_.Path, `$_.LineNumber, `$_.Line.Trim() }" | Out-Null

  # Vite config scan (if present)
  $viteConfigs = @("vite.config.ts","vite.config.js","vite.config.mjs","vite.config.cjs") | ForEach-Object { Join-Path $RepoRoot $_ } | Where-Object { Test-Path $_ }
  foreach ($vc in $viteConfigs) {
    Run-Native ("scan " + (Split-Path $vc -Leaf)) powershell -NoProfile -Command `
      "Select-String -LiteralPath '$vc' -Pattern 'external','rollupOptions','resolve','alias','react-hot-toast' -AllMatches -ErrorAction SilentlyContinue | " +
      "ForEach-Object { '{0}:{1} {2}' -f `$_.Path, `$_.LineNumber, `$_.Line.Trim() }" | Out-Null
  }

  # OPTION 4 (OPT-IN)
  if ($AutoStubLegacyAsLastResort) {
    Log "===== OPTION 4 (OPT-IN): Stub legacy page (behavior change) ====="
    $legacyFile = Join-Path $RepoRoot "src\pages\_legacy_oldgit\LoginLegacy.jsx"
    if (!(Test-Path $legacyFile)) { throw "Legacy file not found: $legacyFile" }
    Backup-File $legacyFile

    @"
import React from 'react';
export default function LoginLegacy() {
  return (
    <div style={{ padding: 16 }}>
      <h2>Legacy Login Disabled</h2>
      <p>Stubbed to unblock production build. Restore from backup to re-enable.</p>
    </div>
  );
}
"@ | Set-Content -LiteralPath $legacyFile -Encoding UTF8 -NoNewline

    $b4 = Build
    if ($b4.Ok) {
      Log "SUCCESS: Build passed after Option 4."
      exit 0
    }
  }

  throw "Build still failing. Inspect outputs in: $trashRun and log: $logFile"
}
catch {
  Log ("ERROR: " + $_.Exception.Message)
  throw
}
finally {
  try { Pop-Location -ErrorAction SilentlyContinue } catch {}
}
