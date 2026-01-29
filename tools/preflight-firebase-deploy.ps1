[CmdletBinding()]
param(
  [string]$RepoRoot = (Resolve-Path ".").Path,
  [switch]$Fix
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function NowIso(){ (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffzzz") }
function Log($lvl,$msg){ Write-Host ("{0} {1,-6} {2}" -f (NowIso), $lvl.ToUpper(), $msg) }
function Ensure-Dir($p){ if(-not (Test-Path -LiteralPath $p)){ New-Item -ItemType Directory -Path $p | Out-Null } }
function P([string]$rel){ Join-Path -Path $RepoRoot -ChildPath $rel }

$stamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
$backupDir = P ("ai-backups\{0}" -f $stamp)

function BackupFile([string]$path){
  if(-not (Test-Path -LiteralPath $path)){ return }
  Ensure-Dir $backupDir
  $rel = (Resolve-Path -LiteralPath $path).Path.Substring($RepoRoot.Length).TrimStart('\','/')
  $dest = Join-Path -Path $backupDir -ChildPath $rel
  Ensure-Dir (Split-Path -Parent $dest)
  Copy-Item -LiteralPath $path -Destination $dest -Force
  Log "BACKUP" "$rel -> $dest"
}

Log "START" "RepoRoot=$RepoRoot  Fix=$Fix"

$criticalFail = $false
$warnCount = 0

# --- 1) Workflow sanity ---
$workflowRels = @(
  ".github\workflows\firebase-preview.yml",
  ".github\workflows\firebase-deploy-live.yml"
)
$workflows = $workflowRels | ForEach-Object { P $_ }

foreach($wf in $workflows){
  if(-not (Test-Path -LiteralPath $wf)){
    Log "WARN" "missing workflow: $wf"
    $warnCount++; continue
  }
  $first = (Get-Content -LiteralPath $wf -TotalCount 1 -ErrorAction SilentlyContinue)
  if($first -eq "System.String[]"){
    Log "ERROR" "workflow corrupted (System.String[]): $wf"
    $criticalFail = $true
  }
}

# --- 2) firebase.json shape sanity ---
$firebaseJson = P "firebase.json"
if(-not (Test-Path -LiteralPath $firebaseJson)){
  Log "ERROR" "firebase.json not found"
  $criticalFail = $true
} else {
  $raw = Get-Content -LiteralPath $firebaseJson -Raw
  try { $cfg = $raw | ConvertFrom-Json -Depth 64 } catch {
    Log "ERROR" "firebase.json invalid JSON: $($_.Exception.Message)"
    $criticalFail = $true
    $cfg = $null
  }

  if($cfg -ne $null){
    if($null -eq $cfg.PSObject.Properties["functions"]){
      Log "WARN" "firebase.json has no 'functions' key"
      $warnCount++
    } else {
      $f = $cfg.functions
      if($f -is [pscustomobject]){
        if($null -ne $f.PSObject.Properties["region"]){
          Log "WARN" "firebase.json functions has 'region' property (often invalid for CLI schema). Prefer array codebases."
          $warnCount++
        }
      } elseif($f -is [System.Collections.IEnumerable] -and -not ($f -is [string])) {
        foreach($item in $f){
          if($item -isnot [pscustomobject] -or $null -eq $item.PSObject.Properties["source"]){
            Log "WARN" "firebase.json functions array item missing 'source'"
            $warnCount++; break
          }
          if($null -ne $item.PSObject.Properties["region"]){
            Log "WARN" "firebase.json functions array item has 'region' (may be invalid for schema)"
            $warnCount++
          }
        }
      } else {
        Log "WARN" "firebase.json functions is unexpected type"
        $warnCount++
      }
    }

    if(-not $raw.EndsWith("`n")){
      Log "WARN" "firebase.json missing newline at EOF"
      $warnCount++
      if($Fix){
        BackupFile $firebaseJson
        Set-Content -LiteralPath $firebaseJson -Value ($raw + "`n") -NoNewline
        Log "INFO" "fixed: firebase.json newline at EOF"
      }
    }
  }
}

# --- 3) functions/index.js syntax check ---
$funcIndex = P "functions\index.js"
if(-not (Test-Path -LiteralPath $funcIndex)){
  Log "ERROR" "functions/index.js not found"
  $criticalFail = $true
} else {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if($null -eq $node){
    Log "ERROR" "node not found in PATH"
    $criticalFail = $true
  } else {
    # Use call operator (&) to avoid Start-Process quoting issues with spaces in paths on Windows
    & $node.Source --check -- $funcIndex 2>$null
    if($LASTEXITCODE -ne 0){
      Log "ERROR" "node --check failed for functions/index.js"
      $criticalFail = $true
    } else {
      Log "INFO" "node --check OK: functions/index.js"
    }
  }
}


# --- 4) .gitignore hygiene ---
$gitignore = P ".gitignore"
$need = "ai-backups/"
if(Test-Path -LiteralPath $gitignore){
  $gi = Get-Content -LiteralPath $gitignore -Raw
  if($gi -notmatch "(?m)^\s*ai-backups/\s*$"){
    Log "WARN" ".gitignore missing ai-backups/"
    $warnCount++
    if($Fix){
      BackupFile $gitignore
      $new = $gi.TrimEnd("`r","`n") + "`n" + $need + "`n"
      Set-Content -LiteralPath $gitignore -Value $new -NoNewline
      Log "INFO" "fixed: .gitignore added ai-backups/"
    }
  }
} else {
  Log "WARN" ".gitignore not found"
  $warnCount++
  if($Fix){
    Set-Content -LiteralPath $gitignore -Value ($need + "`n") -NoNewline
    Log "INFO" "fixed: created .gitignore with ai-backups/"
  }
}

if($criticalFail){
  Log "DONE" "PRECHECK FAILED (critical). Warnings=$warnCount"
  exit 1
}

Log "DONE" "PRECHECK OK. Warnings=$warnCount"
exit 0
