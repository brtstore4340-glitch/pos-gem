param(
  [string]$RepoRoot = (Get-Location).Path,
  [string]$PkgName = "react-hot-toast",
  [string]$PkgVersion = "2.6.0",
  [switch]$AutoStubLegacyAsLastResort
)

Set-StrictMode -Version Latest

# Prevent native stderr becoming terminating errors (PowerShell 7+)
try { $global:PSNativeCommandUseErrorActionPreference = $false } catch {}

$ErrorActionPreference = "Stop"

function New-Timestamp { (Get-Date -Format "yyyyMMdd-HHmmss") }
function Ensure-Dir([string]$Path) { if (!(Test-Path $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null } }
function Safe-FileName([string]$s) { ($s -replace '[^a-zA-Z0-9\-_\.]+','_') }

$ts = New-Timestamp
$bootDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $bootDir "patchlogs"
$trashRun = Join-Path $bootDir ("trash\fix-build-{0}" -f $ts)
Ensure-Dir $logDir
Ensure-Dir $trashRun

$logFile = Join-Path $logDir ("fix-build-v3-{0}.log" -f $ts)

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

function Quarantine-Dir([string]$path) {
  if (!(Test-Path $path)) { return $null }
  $name = Split-Path $path -Leaf
  $dest = Join-Path $trashRun $name
  if (Test-Path $dest) { $dest = Join-Path $trashRun ("{0}__dup__{1}" -f $name, (New-Timestamp)) }
  try {
    Move-Item -LiteralPath $path -Destination $dest -Force
    Log "Quarantined: $path => $dest"
    return $dest
  } catch {
    Log "WARN: quarantine move failed; deleting instead: $path | $($_.Exception.Message)"
    Remove-Item -LiteralPath $path -Recurse -Force
    Log "Deleted: $path"
    return $null
  }
}

function Tail([string]$file, [int]$n=120) {
  if (!(Test-Path $file)) { return @() }
  @(Get-Content -LiteralPath $file -ErrorAction SilentlyContinue | Select-Object -Last $n)
}
function Head([string]$file, [int]$n=60) {
  if (!(Test-Path $file)) { return @() }
  @(Get-Content -LiteralPath $file -ErrorAction SilentlyContinue | Select-Object -First $n)
}

function Run-Native([string]$Label, [string]$Exe, [string[]]$Args) {
  $outFile = Join-Path $trashRun ("{0}.out.txt" -f (Safe-FileName $Label))
  Log "---- $Label ----"
  Log ("CMD: {0} {1}" -f $Exe, ($Args -join " "))

  $exit = 0
  try {
    & $Exe @Args 2>&1 | Tee-Object -FilePath $outFile | Tee-Object -FilePath $logFile -Append | Out-Host
    $exit = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
  } catch {
    $exit = 999
    ("POWERSHELL_EXCEPTION: " + $_.Exception.Message) | Tee-Object -FilePath $outFile | Tee-Object -FilePath $logFile -Append | Out-Host
  }

  Log "EXITCODE: $exit"
  return [pscustomobject]@{ Ok = ($exit -eq 0); ExitCode=$exit; OutFile=$outFile }
}

function Detect-NpmHelp([string]$outFile) {
  if (!(Test-Path $outFile)) { return $false }
  $patterns = @(
    '^npm <command>$',
    'npm help config',
    'Specify configs in the ini-formatted file:',
    'Configuration fields: npm help'
  )
  foreach ($p in $patterns) {
    if (Select-String -LiteralPath $outFile -Pattern $p -Quiet -ErrorAction SilentlyContinue) { return $true }
  }
  return $false
}

function Detect-MissingImports([string]$outFile) {
  # always return an array
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

function Test-Pkg-Installed([string]$name) {
  (Run-Native "npm ls $name depth0" "npm" @("ls",$name,"--depth=0")).Ok
}

function Ensure-Package() {
  if (Test-Pkg-Installed $PkgName) {
    Log "Dependency installed: $PkgName"
    return $true
  }
  Log "Installing: $PkgName@$PkgVersion (save-exact)"
  (Run-Native "npm install $PkgName@$PkgVersion" "npm" @("install","$PkgName@$PkgVersion","--save-exact","--no-audit","--no-fund")).Ok
}

function Build() {
  $r = Run-Native "npm run build" "npm" @("run","build")
  if ($r.Ok) { return $r }

  if (Detect-NpmHelp $r.OutFile) {
    Log "BUILD DIAG: Output looks like NPM HELP/USAGE, not a Vite build log."
    Log "This usually means: npm args/config are interfering, or npm command isn't running as expected."
  }

  $tail = Tail $r.OutFile 160
  Log "Build output tail (last 160 lines):"
  foreach ($line in $tail) { Log ("BUILD_TAIL: " + $line) }

  $missing = @(Detect-MissingImports $r.OutFile)
  if ($missing.Count -gt 0) {
    Log "Detected missing import(s):"
    foreach ($m in $missing) { Log (" - missing: {0} | from: {1}" -f $m.Module, $m.From) }
  } else {
    Log "No missing-import pattern detected."
  }

  return $r
}

try {
  Log "RepoRoot: $RepoRoot"
  Log "Pkg target: $PkgName@$PkgVersion"
  Log "TrashRun: $trashRun"
  Log "LogFile: $logFile"

  Push-Location $RepoRoot

  # Snapshot key files
  $pkgJson = Join-Path $RepoRoot "package.json"
  if (!(Test-Path $pkgJson)) { throw "Missing package.json at $pkgJson" }
  Backup-File $pkgJson
  $pkgLock = Join-Path $RepoRoot "package-lock.json"
  if (Test-Path $pkgLock) { Backup-File $pkgLock }

  # Option 0: show npm config source (evidence for the 'npm help' output)
  Run-Native "npm config list (short)" "npm" @("config","list","--location=project") | Out-Null
  Run-Native "npm config get registry" "npm" @("config","get","registry") | Out-Null

  # OPTION 1
  Log "===== OPTION 1: Ensure dependency + build ====="
  Ensure-Package | Out-Null
  $b1 = Build
  if ($b1.Ok) { Log "SUCCESS after Option 1"; exit 0 }

  # If npm help/usage is shown, we must fix npm invocation/config before anything else.
  if (Detect-NpmHelp $b1.OutFile) {
    Log "CRITICAL: npm run build did not actually run the build (npm help detected)."
    Log "Next: Option 2 (clean install) then re-test; if still help output -> investigate .npmrc / Volta / shell function alias."
  }

  # OPTION 2
  Log "===== OPTION 2: Quarantine node_modules + clean install + build ====="
  $nm = Join-Path $RepoRoot "node_modules"
  if (Test-Path $nm) { Quarantine-Dir $nm | Out-Null }

  if (Test-Path $pkgLock) {
    Run-Native "npm ci" "npm" @("ci","--no-audit","--no-fund") | Out-Null
  } else {
    Run-Native "npm install" "npm" @("install","--no-audit","--no-fund") | Out-Null
  }

  $b2 = Build
  if ($b2.Ok) { Log "SUCCESS after Option 2"; exit 0 }

  # OPTION 3: diagnostics
  Log "===== OPTION 3: Diagnostics ====="
  Run-Native "where npm" "cmd" @("/c","where npm") | Out-Null
  Run-Native "where node" "cmd" @("/c","where node") | Out-Null
  Run-Native "node -v && npm -v" "cmd" @("/c","node -v && npm -v") | Out-Null

  Run-Native "npm ls $PkgName depth1" "npm" @("ls",$PkgName,"--depth=1") | Out-Null
  Run-Native "node require.resolve($PkgName)" "node" @("-e","try{console.log(require.resolve('$PkgName'))}catch(e){console.error('RESOLVE_FAIL:',e.message);process.exit(2)}") | Out-Null

  # Show first 60 lines too (in case usage output starts earlier)
  Log "Build output HEAD (first 60 lines) Option2:"
  foreach ($line in (Head $b2.OutFile 60)) { Log ("BUILD_HEAD: " + $line) }

  $missing2 = @(Detect-MissingImports $b2.OutFile)
  if ($missing2.Count -gt 0) {
    Log "Missing imports still present after Option2:"
    foreach ($m in $missing2) { Log (" - missing: {0} | from: {1}" -f $m.Module, $m.From) }
  }

  # Option 4 (opt-in)
  if ($AutoStubLegacyAsLastResort) {
    Log "===== OPTION 4 (OPT-IN): Stub legacy page ====="
    $legacyFile = Join-Path $RepoRoot "src\pages\_legacy_oldgit\LoginLegacy.jsx"
    if (!(Test-Path $legacyFile)) { throw "Legacy file not found for stub: $legacyFile" }
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
    if ($b4.Ok) { Log "SUCCESS after Option 4 (behavior change)"; exit 0 }
  }

  throw "Build still failing. Inspect: $trashRun and log: $logFile"
}
catch {
  Log ("ERROR: " + $_.Exception.Message)
  throw
}
finally {
  try { Pop-Location -ErrorAction SilentlyContinue } catch {}
}
