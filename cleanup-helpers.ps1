<#
  cleanup-helpers.ps1
  Purpose:
    Remove or quarantine old helper scripts / patch logs / trash runs / timestamped .bak files.

  Safety model:
    - Default: REPORT-ONLY (no changes)
    - -Execute: move to quarantine folder for rollback
    - -Execute -Purge: permanently delete (danger)

  Targets (conservative, based on known helper artifacts in this repo):
    - Root helper scripts:
        patch-*.ps1
        fix-build-react-hot-toast*.ps1
        cleanup-patch-artifacts.ps1
        cleanup-helpers.ps1 (optional flag to include itself)
    - _boot\patchlogs\:
        patch-*.log
        fix-build-*.log
        cleanup-*.log
    - _boot\trash\:
        fix-build-*
        cleanup-*
    - Timestamped backups:
        *.bak.YYYYMMDD-HHMMSS   (e.g. package.json.bak.20260131-000039)

  Optional:
    - -IncludeOldRepos: include _boot\oldrepo-* older than -Days
    - -IncludeSelf: allow moving/deleting cleanup-helpers.ps1 itself
#>

param(
  [string]$RepoRoot = (Get-Location).Path,
  [int]$Days = 7,
  [switch]$Execute,
  [switch]$Purge,
  [switch]$IncludeOldRepos,
  [switch]$IncludeSelf
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Timestamp { (Get-Date -Format "yyyyMMdd-HHmmss") }
function Ensure-Dir([string]$Path) { if (!(Test-Path $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null } }
function Get-RelativePath([string]$Base, [string]$Full) {
  $baseFull = (Resolve-Path $Base).Path.TrimEnd('\')
  $fullPath = (Resolve-Path $Full).Path
  if ($fullPath.Length -le $baseFull.Length) { return $fullPath }
  return $fullPath.Substring($baseFull.Length).TrimStart('\')
}

$ts = New-Timestamp
$bootDir   = Join-Path $RepoRoot "_boot"
$logDir    = Join-Path $bootDir "patchlogs"
$trashRoot = Join-Path $bootDir "trash"
$runTrash  = Join-Path $trashRoot ("cleanup-helpers-{0}" -f $ts)
$manifestDir = Join-Path $trashRoot "_manifests"

Ensure-Dir $bootDir
Ensure-Dir $logDir
Ensure-Dir $trashRoot
Ensure-Dir $manifestDir

$runLog = Join-Path $logDir ("cleanup-helpers-{0}.log" -f $ts)

function Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "o"), $msg
  $line | Tee-Object -FilePath $runLog -Append | Out-Host
}

function Is-Old([datetime]$t, [datetime]$cutoff) { return ($t -lt $cutoff) }

function Safe-Move([string]$Source, [string]$DestRoot, [string]$Rel) {
  $dest = Join-Path $DestRoot $Rel
  $destDir = Split-Path $dest -Parent
  Ensure-Dir $destDir
  if (Test-Path $dest) { $dest = "$dest.__dup__$(New-Timestamp)" }
  Move-Item -LiteralPath $Source -Destination $dest -Force
  return $dest
}

$cutoff = (Get-Date).AddDays(-$Days)

Log "RepoRoot: $RepoRoot"
Log "CutoffDays: $Days (cutoff: $($cutoff.ToString('o')))"
Log "Mode: $([string]::Join(' ', @(
  if($Execute){"EXECUTE"} else {"REPORT-ONLY"},
  if($Execute -and $Purge){"PURGE"} else { if($Execute){"QUARANTINE"} else {"NO-CHANGES"} },
  if($IncludeOldRepos){"IncludeOldRepos"} else {"NoOldRepos"},
  if($IncludeSelf){"IncludeSelf"} else {"NoSelf"}
)))"
Log "LogFile: $runLog"

$candidates = New-Object System.Collections.Generic.List[object]

# -----------------------
# 1) Root helper scripts (older than cutoff)
# -----------------------
$rootScriptPatterns = @(
  "patch-*.ps1",
  "fix-build-react-hot-toast*.ps1",
  "cleanup-patch-artifacts.ps1",
  "patch-add-react-hot-toast.ps1",
  "patch-eslint-ignores.ps1"
)

foreach ($pat in $rootScriptPatterns) {
  Get-ChildItem -LiteralPath $RepoRoot -File -Filter $pat -ErrorAction SilentlyContinue |
    Where-Object { Is-Old $_.LastWriteTime $cutoff } |
    ForEach-Object {
      if (-not $IncludeSelf -and $_.Name -ieq "cleanup-helpers.ps1") { return }
      $candidates.Add([pscustomobject]@{
        Kind="HelperScript"
        Path=$_.FullName
        LastWriteTime=$_.LastWriteTime
        SizeBytes=$_.Length
      }) | Out-Null
    }
}

# (Optional) include cleanup-helpers.ps1 itself if old and user allows
if ($IncludeSelf) {
  $self = Join-Path $RepoRoot "cleanup-helpers.ps1"
  if (Test-Path $self) {
    $it = Get-Item -LiteralPath $self
    if (Is-Old $it.LastWriteTime $cutoff) {
      $candidates.Add([pscustomobject]@{
        Kind="HelperScript"
        Path=$it.FullName
        LastWriteTime=$it.LastWriteTime
        SizeBytes=$it.Length
      }) | Out-Null
    }
  }
}

# -----------------------
# 2) patchlogs (older than cutoff)
# -----------------------
$logPatterns = @("patch-*.log","fix-build-*.log","cleanup-*.log")
foreach ($pat in $logPatterns) {
  Get-ChildItem -LiteralPath $logDir -File -Filter $pat -ErrorAction SilentlyContinue |
    Where-Object { Is-Old $_.LastWriteTime $cutoff } |
    ForEach-Object {
      $candidates.Add([pscustomobject]@{
        Kind="PatchLog"
        Path=$_.FullName
        LastWriteTime=$_.LastWriteTime
        SizeBytes=$_.Length
      }) | Out-Null
    }
}

# -----------------------
# 3) trash runs (older than cutoff)
# -----------------------
Get-ChildItem -LiteralPath $trashRoot -Directory -ErrorAction SilentlyContinue |
  Where-Object {
    ($_.Name -like "fix-build-*"-or $_.Name -like "cleanup-*") -and
    (Is-Old $_.LastWriteTime $cutoff) -and
    ($_.Name -ne (Split-Path $runTrash -Leaf)) -and
    ($_.Name -ne "_manifests")
  } |
  ForEach-Object {
    $candidates.Add([pscustomobject]@{
      Kind="TrashRunDir"
      Path=$_.FullName
      LastWriteTime=$_.LastWriteTime
      SizeBytes=$null
    }) | Out-Null
  }

# -----------------------
# 4) timestamped backups (*.bak.YYYYMMDD-HHMMSS) (older than cutoff)
#    Limit scope to repo root (safe) + _boot (to catch things like eslint backups stored there)
# -----------------------
$bakRegex = '\.bak\.\d{8}-\d{6}$'
$bakSearchRoots = @($RepoRoot, $bootDir)

foreach ($root in $bakSearchRoots) {
  Get-ChildItem -LiteralPath $root -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object {
      $_.FullName -match $bakRegex -and
      Is-Old $_.LastWriteTime $cutoff
    } |
    ForEach-Object {
      $candidates.Add([pscustomobject]@{
        Kind="BackupFile"
        Path=$_.FullName
        LastWriteTime=$_.LastWriteTime
        SizeBytes=$_.Length
      }) | Out-Null
    }
}

# -----------------------
# 5) optional oldrepo snapshots
# -----------------------
if ($IncludeOldRepos) {
  Get-ChildItem -LiteralPath $bootDir -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "oldrepo-*" -and Is-Old $_.LastWriteTime $cutoff } |
    ForEach-Object {
      $candidates.Add([pscustomobject]@{
        Kind="OldRepoSnapshotDir"
        Path=$_.FullName
        LastWriteTime=$_.LastWriteTime
        SizeBytes=$null
      }) | Out-Null
    }
}

# -----------------------
# Report / Execute
# -----------------------
if ($candidates.Count -eq 0) {
  Log "No candidates found. Nothing to do."
  exit 0
}

# Manifest
$manifest = Join-Path $manifestDir ("cleanup-helpers-manifest-{0}.csv" -f $ts)
$candidates | Sort-Object Kind, LastWriteTime | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $manifest
Log "Candidates: $($candidates.Count)"
Log "Manifest: $manifest"

Log "Listing candidates (top 200):"
$candidates | Sort-Object LastWriteTime | Select-Object -First 200 | ForEach-Object {
  Log (" - {0} | {1} | {2}" -f $_.Kind, $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss"), $_.Path)
}

if (-not $Execute) {
  Log "REPORT-ONLY complete. Re-run with -Execute to quarantine, or -Execute -Purge to delete permanently."
  exit 0
}

if ($Purge) {
  Log "PURGE enabled: permanently deleting candidates."
  foreach ($c in ($candidates | Sort-Object Kind, LastWriteTime)) {
    if (!(Test-Path -LiteralPath $c.Path)) { Log ("SKIP missing: {0}" -f $c.Path); continue }
    try {
      $item = Get-Item -LiteralPath $c.Path -Force
      if ($item.PSIsContainer) {
        Remove-Item -LiteralPath $c.Path -Recurse -Force
      } else {
        Remove-Item -LiteralPath $c.Path -Force
      }
      Log ("DELETED: {0} | {1}" -f $c.Kind, $c.Path)
    } catch {
      Log ("ERROR deleting: {0} | {1}" -f $c.Kind, $_.Exception.Message)
      throw
    }
  }
  Log "PURGE complete."
  exit 0
}

# Quarantine move (rollback-friendly)
Ensure-Dir $runTrash
Log "Quarantine folder: $runTrash"

foreach ($c in ($candidates | Sort-Object Kind, LastWriteTime)) {
  if (!(Test-Path -LiteralPath $c.Path)) { Log ("SKIP missing: {0}" -f $c.Path); continue }
  # Do not move anything already inside the current run quarantine
  if ($c.Path -like "$runTrash*") { Log ("SKIP already in quarantine: {0}" -f $c.Path); continue }

  try {
    $rel = Get-RelativePath -Base $RepoRoot -Full $c.Path
    $dest = Safe-Move -Source $c.Path -DestRoot $runTrash -Rel $rel
    Log ("MOVED: {0} | {1} => {2}" -f $c.Kind, $c.Path, $dest)
  } catch {
    Log ("ERROR moving: {0} | {1}" -f $c.Kind, $_.Exception.Message)
    throw
  }
}

Log "QUARANTINE complete."
Log "Rollback: move items back from $runTrash using manifest: $manifest"
