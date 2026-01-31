<#
  fix-build-react-hot-toast.v2.ps1
  Systematic build fix runner for Vite/Rollup failures (incl. missing imports like "react-hot-toast")
  Key fix vs v1:
    - Prevent native stderr from becoming terminating errors (NativeCommandError) that stop the script.
    - Always capture build output to file, summarize last lines + detect missing-import pattern.
  Options:
    1) Ensure react-hot-toast installed (exact) + build
    2) Quarantine node_modules + clean install (ci if lock) + build
    3) Diagnostics (npm ls, resolve, who imports legacy, vite config scan) + print paths to outputs
    4) OPT-IN: stub legacy LoginLegacy.jsx to unblock build (behavior change)
#>

param(
  [string]$RepoRoot = (Get-Location).Path,
  [string]$PkgName = "react-hot-toast",
  [string]$PkgVersion = "2.6.0",
  [switch]$AutoStubLegacyAsLastResort
)

Set-StrictMode -Version Latest

# IMPORTANT: avoid PowerShell stopping on native stderr (NativeCommandError)
# Works on PowerShell 7+ where this preference exists.
try {
  if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -Scope Global -ErrorAction SilentlyContinue) {
    $global:PSNativeCommandUseErrorActionPreference = $false
  }
} catch {}

$ErrorActionPreference = "Stop"

function New-Timestamp { (Get-Date -Format "yyyyMMdd-HHmmss") }
function Ensure-Dir([string]$Path) { if (!(Test-Path $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null } }
function Safe-FileName([string]$s) { return ($s -replace '[^a-zA-Z0-9\-_\.]+','_') }

$ts = New-Timestamp
$bootDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $bootDir "patchlogs"
$trashRun = Join-Path $bootDir ("trash\fix-build-{0}" -f $ts)
Ensure-Dir $logDir
Ensure-Dir $trashRun

$logFile = Join-Path $logDir ("fix-build-v2-{0}.log" -f $ts)

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
    Log "WARN: move quarantine failed; deleting instead: $path | $($_.Exception.Message)"
    Remove-Item -LiteralPath $path -Recurse -Force
    Log "Deleted: $path"
    return $null
  }
}

function Run-Native {
  param(
    [string]$Label,
    [string]$Exe,
    [string[]]$Args = @()
  )
  $outFile = Join-Path $trashRun ("{0}.out.txt" -f (Safe-FileName $Label))
  Log "---- $Label ----"
  Log ("CMD: {0} {1}" -f $Exe, ($Args -join " "))

  try {
    & $Exe @Args 2>&1 | Tee-Object -FilePath $outFile | Tee-Object -FilePath $logFile -Append | Out-Host
    $exit = $LASTEXITCODE
  } catch {
    # Catch ONLY PowerShell invocation exceptions, not npm failures (exit code handles those)
    $exit = 999
    ("POWERSHELL_EXCEPTION: " + $_.Exception.Message) | Tee-Object -FilePath $outFile | Tee-Object -FilePath $logFile -Append | Out-Host
  }

  if ($null -eq $exit) { $exit = 0 }
  Log "EXITCODE: $exit"
  return [pscustomobject]@{ Ok = ($exit -eq 0); ExitCode = $exit; OutFile = $outFile }
}

function Tail-File([string]$path, [int]$lines = 120) {
  if (!(Test-Path $path)) { return @() }
  return (Get-Content -LiteralPath $path -ErrorAction SilentlyContinue | Select-Object -Last $lines)
}

function Detect-MissingImports([string]$buildOutFile) {
  # Pattern from Vite/Rollup: failed to resolve import "X" from "Y"
  $pattern = 'failed to resolve import "([^"]+)" from "([^"]+)"'
  $hits = @()
  if (Test-Path $buildOutFile) {
    $matches = Select-String -LiteralPath $buildOutFile -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue
    foreach ($m in $matches) {
      foreach ($g in $m.Matches) {
        $hits += [pscustomobject]@{ Module = $g.Groups[1].Value; From = $g.Groups[2].Value }
      }
    }
  }
  return $hits
}

function Test-Pkg-Installed([string]$name) {
  $r = Run-Native -Label "npm ls $name (depth=0)" -Exe "npm" -Args @("ls", $name, "--depth=0")
  return $r.Ok
}

function Ensure-ReactHotToast() {
  $installed = Test-Pkg-Installed $PkgName
  if ($installed) {
    Log "Dependency appears installed: $PkgName"
    return $true
  }
  Log "Missing dependency detected: $PkgName -> installing $PkgName@$PkgVersion (save-exact)"
  $r = Run-Native -Label "npm install $PkgName@$PkgVersion --save-exact" -Exe "npm" -Args @("install", "$PkgName@$PkgVersion", "--save-exact", "--no-audit", "--no-fund")
  return $r.Ok
}

function Build() {
  $r = Run-Native -Label "npm run build" -Exe "npm" -Args @("run","build")
  if ($r.Ok) { return $r }

  Log "Build failed. Showing last 120 lines from: $($r.OutFile)"
  $tail = Tail-File -path $r.OutFile -lines 120
  foreach ($line in $tail) { Log ("BUILD_TAIL: " + $line) }

  $missing = Detect-MissingImports -buildOutFile $r.OutFile
  if ($missing.Count -gt 0) {
    Log "Detected missing import(s):"
    foreach ($m in $missing) { Log (" - missing: {0} | from: {1}" -f $m.Module, $m.From) }
  } else {
    Log "No 'failed to resolve import' pattern detected in build output."
  }
  return $r
}

try {
  Log "RepoRoot: $RepoRoot"
  Log "Pkg target: $PkgName@$PkgVersion"
  Log "TrashRun: $trashRun"
  Log "LogFile: $logFile"

  Push-Location $RepoRoot

  # Backups
  $pkgJson = Join-Path $RepoRoot "package.json"
  if (!(Test-Path $pkgJson)) { throw "Missing package.json at $pkgJson" }
  Backup-File $pkgJson

  $pkgLock = Join-Path $RepoRoot "package-lock.json"
  if (Test-Path $pkgLock) { Backup-File $pkgLock }

  # Quick context: legacy file
  $legacyFile = Join-Path $RepoRoot "src\pages\_legacy_oldgit\LoginLegacy.jsx"
  if (Test-Path $legacyFile) {
    Log "Legacy file exists: $legacyFile"
    $hit = Select-String -LiteralPath $legacyFile -Pattern $PkgName -SimpleMatch -ErrorAction SilentlyContinue
    if ($hit) { Log "Legacy file references $PkgName (as expected from the earlier error)." }
  } else {
    Log "NOTE: legacy file not found at expected path: $legacyFile"
  }

  # ==============
  # OPTION 1
  # ==============
  Log "===== OPTION 1: Ensure $PkgName and build ====="
  $ok1 = Ensure-ReactHotToast
  if (-not $ok1) {
    Log "Option 1 install step failed (npm install). Proceeding to Option 2."
  }

  $b1 = Build
  if ($b1.Ok) {
    Log "SUCCESS: Build passed after Option 1."
    exit 0
  }

  # If build still says missing react-hot-toast, stop and report (it means wrong root/workspace)
  $missing1 = Detect-MissingImports -buildOutFile $b1.OutFile | Where-Object { $_.Module -eq $PkgName }
  if ($missing1.Count -gt 0) {
    Log "CRITICAL: Still missing $PkgName after install attempt."
    Log "Most likely causes (evidence-based):"
    Log " - npm install ran in a different package root than Vite build (workspace/monorepo or wrong folder)."
    Log " - multiple package.json exist; build uses another root."
    Log "Proceeding to Option 3 diagnostics to confirm."
  }

  # ==============
  # OPTION 2
  # ==============
  Log "===== OPTION 2: Quarantine node_modules + clean install + build ====="
  $nodeModules = Join-Path $RepoRoot "node_modules"
  if (Test-Path $nodeModules) { Quarantine-Dir $nodeModules | Out-Null }

  if (Test-Path $pkgLock) {
    Run-Native -Label "npm ci" -Exe "npm" -Args @("ci","--no-audit","--no-fund") | Out-Null
  } else {
    Run-Native -Label "npm install" -Exe "npm" -Args @("install","--no-audit","--no-fund") | Out-Null
  }

  $b2 = Build
  if ($b2.Ok) {
    Log "SUCCESS: Build passed after Option 2."
    exit 0
  }

  # ==============
  # OPTION 3
  # ==============
  Log "===== OPTION 3: Diagnostics (no guessing) ====="
  Run-Native -Label "node -v / npm -v" -Exe "cmd" -Args @("/c","node -v && npm -v") | Out-Null

  Run-Native -Label "npm ls (depth=1)" -Exe "npm" -Args @("ls","--depth=1") | Out-Null
  Run-Native -Label "npm ls $PkgName (depth=1)" -Exe "npm" -Args @("ls",$PkgName,"--depth=1") | Out-Null

  # require.resolve check
  Run-Native -Label "node require.resolve($PkgName)" -Exe "node" -Args @("-e", "try{console.log(require.resolve('$PkgName'))}catch(e){console.error('RESOLVE_FAIL:',e.message);process.exit(2)}") | Out-Null

  # Who imports LoginLegacy? (why build even touches it)
  Run-Native -Label "find importers of LoginLegacy in src" -Exe "powershell" -Args @(
    "-NoProfile","-Command",
    "Get-ChildItem -Path (Join-Path '$RepoRoot' 'src') -Recurse -File -ErrorAction SilentlyContinue | " +
    "Where-Object { `$_.FullName -notmatch [regex]::Escape('\src\pages\_legacy_oldgit\') } | " +
    "Select-String -Pattern '_legacy_oldgit[\\/].*LoginLegacy' -AllMatches -ErrorAction SilentlyContinue | " +
    "ForEach-Object { '{0}:{1} {2}' -f `$_.Path, `$_.LineNumber, `$_.Line.Trim() }"
  ) | Out-Null

  # Vite config scan
  $viteConfigs = @("vite.config.ts","vite.config.js","vite.config.mjs","vite.config.cjs") | ForEach-Object { Join-Path $RepoRoot $_ } | Where-Object { Test-Path $_ }
  if ($viteConfigs.Count -gt 0) {
    foreach ($vc in $viteConfigs) {
      Run-Native -Label ("scan vite config " + (Split-Path $vc -Leaf)) -Exe "powershell" -Args @(
        "-NoProfile","-Command",
        "Select-String -LiteralPath '$vc' -Pattern 'external','rollupOptions','resolve','alias','react-hot-toast' -AllMatches -ErrorAction SilentlyContinue | " +
        "ForEach-Object { '{0}:{1} {2}' -f `$_.Path, `$_.LineNumber, `$_.Line.Trim() }"
      ) | Out-Null
    }
  } else {
    Log "No vite.config.* found at root."
  }

  Log "BUILD OUTPUT FILES:"
  Log " - Option1 build out: $($b1.OutFile)"
  Log " - Option2 build out: $($b2.OutFile)"
  Log "NEXT DECISION:"
  Log " - If npm ls/require.resolve FAIL => install is not happening at the build root (workspace/wrong folder)."
  Log " - If they PASS but build fails => read build out file tail; it is a different root cause now (not guessing)."
  Log " - If legacy is not needed in prod => Option 4 can stub it (behavior change)."

  # ==============
  # OPTION 4 (OPT-IN)
  # ==============
  if ($AutoStubLegacyAsLastResort) {
    Log "===== OPTION 4 (OPT-IN): Stub legacy LoginLegacy.jsx ====="
    if (!(Test-Path $legacyFile)) { throw "Option 4 requested but legacy file not found: $legacyFile" }
    Backup-File $legacyFile

    $stub = @"
import React from 'react';

export default function LoginLegacy() {
  return (
    <div style={{ padding: 16 }}>
      <h2>Legacy Login Disabled</h2>
      <p>This file was stubbed to unblock production build. Restore from backup to re-enable.</p>
    </div>
  );
}
"@
    Set-Content -LiteralPath $legacyFile -Value $stub -Encoding UTF8 -NoNewline
    Log "Stubbed: $legacyFile"

    $b4 = Build
    if ($b4.Ok) {
      Log "SUCCESS: Build passed after Option 4 (behavior change)."
      exit 0
    }

    Log "FAIL: Build still failing after Option 4. Root cause is elsewhere; inspect build output: $($b4.OutFile)"
    throw "Build still failing after Option 4."
  }

  throw "Build still failing. Inspect build output tails in: $trashRun (and log: $logFile)"
}
catch {
  Log ("ERROR: " + $_.Exception.Message)
  throw
}
finally {
  try { Pop-Location -ErrorAction SilentlyContinue } catch {}
}
