#!/usr/bin/env pwsh
# tools/patch-firebase-hosting-serviceaccount.ps1
# هدف: Fix GitHub Actions Firebase Hosting deploy by adding firebaseServiceAccount input,
#      and make Vite base configurable for Firebase vs GitHub Pages.
# Safety: creates backups + deterministic log.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-Indent([string]$line) {
  return ([regex]::Match($line, '^\s*').Value)
}

function Write-Log([string]$msg) {
  $ts = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss.fffK')
  $line = "$ts $msg"
  Add-Content -Path $script:LogPath -Value $line -Encoding utf8
  Write-Host $line
}

function Backup-File([string]$path, [string]$backupDir) {
  if (-not (Test-Path $path)) { return }
  $rel = $path.Replace($script:RepoRoot, '').TrimStart('\','/')
  $dest = Join-Path $backupDir $rel
  $destDir = Split-Path -Parent $dest
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  Copy-Item -Force -Path $path -Destination $dest
  Write-Log "BACKUP  $rel -> $($dest.Replace($script:RepoRoot, '.'))"
}

function Patch-WorkflowFirebaseServiceAccount([string]$path) {
  if (-not (Test-Path $path)) {
    Write-Log "SKIP   missing file: $($path.Replace($script:RepoRoot,'.'))"
    return
  }

  $lines = Get-Content -Path $path -Encoding utf8
  $orig  = ($lines -join "`n")

  # Idempotent: if already present, do nothing.
  if ($orig -match '^\s*firebaseServiceAccount\s*:' ) {
    Write-Log "OK     already has firebaseServiceAccount: $($path.Replace($script:RepoRoot,'.'))"
    return
  }

  $secretExpr = '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
  $changed = $false

  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\s*-\s*uses:\s*FirebaseExtended/action-hosting-deploy@v0\s*$') {
      # Find the next "with:" within this step
      for ($j = $i + 1; $j -lt $lines.Count; $j++) {
        # Step ends when next "- uses:" or "- run:" at same or less indent
        if ($lines[$j] -match '^\s*-\s*(uses|run|name)\s*:' ) {
          break
        }

        if ($lines[$j] -match '^\s*with:\s*$') {
          $withIndent = Get-Indent $lines[$j]
          $kvIndent   = $withIndent + '  '

          # Scan with-block to find insertion point (after repoToken if exists)
          $insertAt = $j + 1
          $hasRepoToken = $false

          for ($k = $j + 1; $k -lt $lines.Count; $k++) {
            $kIndent = Get-Indent $lines[$k]

            # End of with-block: indentation drops back to withIndent (or less) AND line is non-empty.
            if ($lines[$k].Trim().Length -gt 0 -and $kIndent.Length -le $withIndent.Length) {
              break
            }

            if ($lines[$k] -match '^\s*repoToken\s*:') {
              $hasRepoToken = $true
              $insertAt = $k + 1
            }
            if ($lines[$k] -match '^\s*firebaseServiceAccount\s*:') {
              # should not happen because we checked earlier, but keep safe
              return
            }
          }

          $newLine = $kvIndent + 'firebaseServiceAccount: "' + $secretExpr + '"'
          $lines = @($lines[0..($insertAt-1)] + $newLine + $lines[$insertAt..($lines.Count-1)])
          $changed = $true
          Write-Log ("PATCH  added firebaseServiceAccount to: " + $path.Replace($script:RepoRoot,'.'))
          break
        }
      }
    }
  }

  if (-not $changed) {
    Write-Log "WARN   did not find action-hosting-deploy with: block in $($path.Replace($script:RepoRoot,'.'))"
    return
  }

  Set-Content -Path $path -Value ($lines -join "`n") -Encoding utf8
}

function Patch-ViteBaseEnv([string]$path) {
  if (-not (Test-Path $path)) {
    Write-Log "SKIP   missing file: $($path.Replace($script:RepoRoot,'.'))"
    return
  }

  $s = Get-Content -Path $path -Raw -Encoding utf8

  # If already uses VITE_BASE env, no-op
  if ($s -match 'process\.env\.VITE_BASE') {
    Write-Log "OK     vite base already env-driven: $($path.Replace($script:RepoRoot,'.'))"
    return
  }

  # Replace hard-coded base like base: '/pos-gem/' or base:"/pos-gem/"
  $re = [regex]'base\s*:\s*["'']\/pos-gem\/["'']\s*,?'
  if ($re.IsMatch($s)) {
    $s2 = $re.Replace($s, "base: (process.env.VITE_BASE || '/'),")
    Set-Content -Path $path -Value $s2 -Encoding utf8
    Write-Log "PATCH  vite base now uses VITE_BASE env (default '/'): $($path.Replace($script:RepoRoot,'.'))"
    return
  }

  Write-Log "NOTE   vite.config.js has no base '/pos-gem/' match; left unchanged: $($path.Replace($script:RepoRoot,'.'))"
}

# --- Repo root detection (fresh-state safe)
$here = Resolve-Path .
if (Test-Path (Join-Path $here '.git')) { $script:RepoRoot = $here.Path }
elseif (Test-Path (Join-Path $PSScriptRoot '..\.git')) { $script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path }
else { $script:RepoRoot = (Resolve-Path $PSScriptRoot).Path }

$stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
$backupDir = Join-Path $script:RepoRoot "ai-backups/$stamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$script:LogPath = Join-Path $backupDir "patch.log"

Write-Log "START  RepoRoot=$script:RepoRoot"
Write-Log "INFO   BackupDir=$backupDir"

# Files to patch
$wf1 = Join-Path $script:RepoRoot ".github/workflows/firebase-preview.yml"
$wf2 = Join-Path $script:RepoRoot ".github/workflows/firebase-deploy-live.yml"
$vite = Join-Path $script:RepoRoot "vite.config.js"

# Backups first
Backup-File $wf1 $backupDir
Backup-File $wf2 $backupDir
Backup-File $vite $backupDir

# Patch workflows
Patch-WorkflowFirebaseServiceAccount $wf1
Patch-WorkflowFirebaseServiceAccount $wf2

# Patch vite base behavior for Firebase vs GitHub Pages
Patch-ViteBaseEnv $vite

Write-Log "DONE"
Write-Host ""
Write-Host "Next:"
Write-Host "  1) Create GitHub Secret: FIREBASE_SERVICE_ACCOUNT (paste JSON key)"
Write-Host "  2) For GitHub Pages build (if needed): set env VITE_BASE=/pos-gem/ before build"
Write-Host "  3) Commit + push, then re-check PR checks"
