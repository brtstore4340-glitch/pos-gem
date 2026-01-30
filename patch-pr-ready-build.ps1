# patch-pr-ready-build.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Stamp { Get-Date -Format "yyyyMMdd_HHmmss" }
function Log([string]$m) { Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m) }

$root = Get-Location
$stamp = Stamp
$logPath = Join-Path $root ("patch-log_{0}.txt" -f $stamp)

$BASE = "/pos-gem/"

function Backup-File([string]$path, [string]$bkDir) {
  if (Test-Path $path) {
    $name = Split-Path $path -Leaf
    Copy-Item $path (Join-Path $bkDir "$name.bak") -Force
  }
}

function Patch-MainJsx([string]$mainPath) {
  if (!(Test-Path $mainPath)) { return }

  $s = Get-Content -Raw -Encoding UTF8 $mainPath
  $usesReactDot = $s.Contains("React.")
  $hasReactImport =
    $s.Contains('import React from "react"') -or
    $s.Contains("import React from 'react'") -or
    $s.Contains('import * as React from "react"') -or
    $s.Contains("import * as React from 'react'")

  if ($usesReactDot -and -not $hasReactImport) {
    $s2 = "import React from `"react`";`r`n" + $s
    Set-Content -Path $mainPath -Value $s2 -Encoding UTF8
    Log "Patched: $mainPath (added import React)"
  } else {
    Log "Skip: $mainPath (no React.* without import)"
  }
}

function Patch-ViteBase([string]$vitePath, [string]$base) {
  if (!(Test-Path $vitePath)) { return }

  $s = Get-Content -Raw -Encoding UTF8 $vitePath

  # Replace existing base: '...'
  $basePattern = "(?m)\bbase\s*:\s*(['`"])[^'`"]*\1\s*,?"
  if ($s -match $basePattern) {
    $s2 = [regex]::Replace($s, $basePattern, ("base: '{0}'," -f $base), 1)
    if ($s2 -ne $s) {
      Set-Content -Path $vitePath -Value $s2 -Encoding UTF8
      Log "Patched: $vitePath (updated base -> $base)"
    } else {
      Log "Skip: $vitePath (base matched but unchanged)"
    }
    return
  }

  # Insert base into defineConfig({ ... })
  $insertPattern = "defineConfig\s*\(\s*\{"
  if ($s -match $insertPattern) {
    $s2 = [regex]::Replace($s, $insertPattern, ("defineConfig({`r`n  base: '{0}'," -f $base), 1)
    Set-Content -Path $vitePath -Value $s2 -Encoding UTF8
    Log "Patched: $vitePath (inserted base -> $base)"
    return
  }

  Log "WARN: $vitePath (could not confidently insert base; please set base: '$base' manually)"
}

function Patch-PackageJson([string]$pkgPath, [string]$base) {
  if (!(Test-Path $pkgPath)) { return }

  $raw = Get-Content -Raw -Encoding UTF8 $pkgPath
  $json = $raw | ConvertFrom-Json

  if (-not $json.scripts) {
    $json | Add-Member -MemberType NoteProperty -Name scripts -Value ([pscustomobject]@{}) -Force
  }

  # Add/overwrite deterministic scripts (safe)
  $json.scripts.'dev:strict'    = "vite --host 127.0.0.1 --port 5173 --strictPort"
  $json.scripts.'build:ghpages' = "vite build --base=$base"
  $json.scripts.'preview:ghpages' = "vite preview --host 127.0.0.1 --port 4173"

  $out = $json | ConvertTo-Json -Depth 50
  Set-Content -Path $pkgPath -Value $out -Encoding UTF8
  Log "Patched: $pkgPath (scripts dev:strict, build:ghpages, preview:ghpages)"
}

Start-Transcript -Path $logPath | Out-Null
try {
  $bkDir = Join-Path $root ("ai-backups\patch_{0}" -f $stamp)
  New-Item -ItemType Directory -Force -Path $bkDir | Out-Null
  Log "Backup dir: $bkDir"

  # Candidate project roots: repo root + nested .\pos-gem\ (if exists)
  $projRoots = @($root.Path)
  $nested = Join-Path $root "pos-gem"
  if (Test-Path $nested) { $projRoots += $nested }

  foreach ($dir in $projRoots) {
    Log "---- Project root candidate: $dir"

    $main = Join-Path $dir "src\main.jsx"
    $vite = Join-Path $dir "vite.config.js"
    $pkg  = Join-Path $dir "package.json"

    Backup-File $main $bkDir
    Backup-File $vite $bkDir
    Backup-File $pkg  $bkDir

    Patch-MainJsx $main
    Patch-ViteBase $vite $BASE
    Patch-PackageJson $pkg $BASE
  }

  Log "Patch complete."
}
catch {
  Log ("ERROR: " + $_.Exception.Message)
  throw
}
finally {
  Stop-Transcript | Out-Null
  Log "Log saved: $logPath"
}
