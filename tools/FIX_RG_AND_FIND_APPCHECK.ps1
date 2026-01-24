# === SCRIPT GENERATOR (do not paste long code into console directly) ===
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoPath = "D:\01 Main Work\Boots\Boots-POS Gemini"
$OutPath  = Join-Path $RepoPath "tools\FIX_RG_AND_FIND_APPCHECK.ps1"
$OutDir   = Split-Path -Parent $OutPath
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

@'
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

trap {
  Write-Host "[FATAL] $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

function New-DirSafe([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path -Force | Out-Null }
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $enc)
}

function Backup-Path([string]$SourcePath, [string]$BackupDir) {
  if (-not (Test-Path -LiteralPath $SourcePath)) { return }
  $leaf = Split-Path -Leaf $SourcePath
  $dst  = Join-Path $BackupDir $leaf
  Copy-Item -LiteralPath $SourcePath -Destination $dst -Recurse -Force
}

function Get-RepoRoot([string]$StartDir) {
  $d = Resolve-Path -LiteralPath $StartDir
  while ($true) {
    if (Test-Path -LiteralPath (Join-Path $d "package.json")) { return $d.Path }
    $p = Split-Path -Parent $d.Path
    if ($p -eq $d.Path) { throw "Cannot find repo root (no package.json). StartDir=$StartDir" }
    $d = $p
  }
}

function Get-CommandPath([string]$Name) {
  try {
    $cmd = Get-Command $Name -ErrorAction Stop
    return $cmd.Source
  } catch { return $null }
}

function Install-RipGrep([string]$LogPath) {
  $rgPath = Get-CommandPath "rg"
  if ($rgPath) {
    Add-Content -LiteralPath $LogPath -Value "[INFO] rg already exists: $rgPath"
    return $true
  }

  $winget = Get-CommandPath "winget"
  $choco  = Get-CommandPath "choco"
  $scoop  = Get-CommandPath "scoop"

  if ($winget) {
    Add-Content -LiteralPath $LogPath -Value "[INFO] Installing ripgrep via winget..."
    try {
      & winget install --id BurntSushi.ripgrep -e --source winget --accept-package-agreements --accept-source-agreements | Out-Host
      Start-Sleep -Milliseconds 600
    } catch {
      Add-Content -LiteralPath $LogPath -Value "[WARN] winget install failed: $($_.Exception.Message)"
    }
  }
  elseif ($choco) {
    Add-Content -LiteralPath $LogPath -Value "[INFO] Installing ripgrep via choco..."
    try {
      & choco install ripgrep -y | Out-Host
      Start-Sleep -Milliseconds 600
    } catch {
      Add-Content -LiteralPath $LogPath -Value "[WARN] choco install failed: $($_.Exception.Message)"
    }
  }
  elseif ($scoop) {
    Add-Content -LiteralPath $LogPath -Value "[INFO] Installing ripgrep via scoop..."
    try {
      & scoop install ripgrep | Out-Host
      Start-Sleep -Milliseconds 600
    } catch {
      Add-Content -LiteralPath $LogPath -Value "[WARN] scoop install failed: $($_.Exception.Message)"
    }
  }
  else {
    Add-Content -LiteralPath $LogPath -Value "[WARN] No winget/choco/scoop found. Will fallback to Select-String."
  }

  $rgPath2 = Get-CommandPath "rg"
  if ($rgPath2) {
    Add-Content -LiteralPath $LogPath -Value "[PASS] rg installed: $rgPath2"
    return $true
  }

  Add-Content -LiteralPath $LogPath -Value "[WARN] rg still not available after install attempts."
  return $false
}

function Find-AppCheckHits([string]$Root, [string]$LogPath) {
  $pattern = "VITE_ENABLE_APPCHECK|App Check is disabled"
  $rgPath = Get-CommandPath "rg"

  Add-Content -LiteralPath $LogPath -Value "[INFO] Searching pattern: $pattern"
  Add-Content -LiteralPath $LogPath -Value "[INFO] Root: $Root"

  if ($rgPath) {
    Add-Content -LiteralPath $LogPath -Value "[INFO] Using rg..."
    # Exclude heavy dirs
    $args = @(
      "--hidden",
      "--no-ignore-vcs",
      "--line-number",
      "--with-filename",
      "--ignore-case",
      "--glob", "!node_modules/**",
      "--glob", "!.git/**",
      "--glob", "!dist/**",
      "--glob", "!build/**",
      "--glob", "!.firebase/**",
      "--glob", "!.vite/**",
      "--glob", "!tools/backup_*/**",
      "--glob", "!tools/logs/**",
      $pattern,
      "."
    )

    Push-Location $Root
    try {
      $out = & rg @args 2>&1
      $code = $LASTEXITCODE
      Pop-Location

      Add-Content -LiteralPath $LogPath -Value "[INFO] rg exit=$code"
      if ($out) {
        Add-Content -LiteralPath $LogPath -Value "[HITS-BEGIN]"
        Add-Content -LiteralPath $LogPath -Value ($out -join "`n")
        Add-Content -LiteralPath $LogPath -Value "[HITS-END]"
      } else {
        Add-Content -LiteralPath $LogPath -Value "[INFO] No matches found."
      }
      return
    } catch {
      Pop-Location
      Add-Content -LiteralPath $LogPath -Value "[WARN] rg failed, fallback to Select-String: $($_.Exception.Message)"
    }
  }

  Add-Content -LiteralPath $LogPath -Value "[INFO] Using Select-String fallback..."
  $files = Get-ChildItem -LiteralPath $Root -Recurse -File -Force |
    Where-Object {
      $_.FullName -notmatch "\\node_modules\\" -and
      $_.FullName -notmatch "\\\.git\\" -and
      $_.FullName -notmatch "\\dist\\" -and
      $_.FullName -notmatch "\\build\\" -and
      $_.FullName -notmatch "\\\.firebase\\" -and
      $_.FullName -notmatch "\\\.vite\\" -and
      $_.FullName -notmatch "\\tools\\backup_" -and
      $_.FullName -notmatch "\\tools\\logs\\"
    }

  $hits = @()
  foreach ($f in $files) {
    try {
      $m = Select-String -LiteralPath $f.FullName -Pattern $pattern -CaseSensitive:$false -ErrorAction SilentlyContinue
      if ($m) { $hits += $m }
    } catch { }
  }

  if ($hits.Count -gt 0) {
    Add-Content -LiteralPath $LogPath -Value "[HITS-BEGIN]"
    foreach ($h in $hits) {
      Add-Content -LiteralPath $LogPath -Value ("{0}:{1}:{2}" -f $h.Path, $h.LineNumber, $h.Line.Trim())
    }
    Add-Content -LiteralPath $LogPath -Value "[HITS-END]"
  } else {
    Add-Content -LiteralPath $LogPath -Value "[INFO] No matches found."
  }
}

# ---------------- MAIN ----------------
param(
  [string]$RepoPath = ""
)

if ([string]::IsNullOrWhiteSpace($RepoPath)) {
  $RepoPath = Get-Location | Select-Object -ExpandProperty Path
}

$root = Get-RepoRoot -StartDir $RepoPath

$toolsDir = Join-Path $root "tools"
$logsDir  = Join-Path $toolsDir "logs"
New-DirSafe $toolsDir
New-DirSafe $logsDir

$ts = (Get-Date).ToString("yyyyMMdd_HHmmss")
$logPath = Join-Path $logsDir "fix_rg_find_appcheck_$ts.log"
$backupDir = Join-Path $toolsDir ("backup_fix_rg_" + $ts)
New-DirSafe $backupDir

Write-Utf8NoBom -Path (Join-Path $toolsDir "LAST_BACKUP_DIR.txt") -Content ($backupDir + "`n")

Add-Content -LiteralPath $logPath -Value "[INFO] RepoRoot: $root"
Add-Content -LiteralPath $logPath -Value "[INFO] BackupDir: $backupDir"

# backup env files (safe)
Get-ChildItem -LiteralPath $root -Force -File -Filter ".env*" -ErrorAction SilentlyContinue | ForEach-Object {
  Backup-Path -SourcePath $_.FullName -BackupDir $backupDir
  Add-Content -LiteralPath $logPath -Value "[INFO] Backed up: $($_.Name)"
}

$ok = Install-RipGrep -LogPath $logPath
Add-Content -LiteralPath $logPath -Value ("[INFO] rg available: " + $ok)

Find-AppCheckHits -Root $root -LogPath $logPath

Add-Content -LiteralPath $logPath -Value "[DONE] ExitCode=0"
Write-Host "[OK] Done. Log: $logPath"
exit 0
'@ | Set-Content -LiteralPath $OutPath -Encoding utf8

Write-Host "[OK] Wrote: $OutPath"
Write-Host "[NEXT] Run:"
Write-Host ("pwsh -ExecutionPolicy Bypass -File `"{0}`" -RepoPath `"{1}`"" -f $OutPath, $RepoPath)
