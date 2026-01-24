# File: RUN_IN_WRITABLE_WORKSPACE.ps1
# Purpose: Run any PS script inside a writable workspace to avoid "Access denied" creating tools/
# SafeMode: backups + strict + UTF-8 no BOM logs + exit code summary

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

trap {
  Write-Host "[FATAL] $($_.Exception.Message)"
  exit 1
}

function Write-Utf8NoBomFile {
  param([string]$Path, [string]$Content)
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $enc)
}

function Ensure-Dir {
  param([string]$Path)
  if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Path $Path -Force | Out-Null }
}

function Write-Log {
  param([string]$LogFile, [ValidateSet("INFO","PASS","WARN","FAIL")][string]$Level, [string]$Message)
  $ts = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffK")
  $line = "[$ts][$Level] $Message"
  $line | Out-File -FilePath $LogFile -Encoding utf8 -Append
  Write-Host $line
}

param(
  [Parameter(Mandatory=$true)]
  [string]$TargetScript,

  # Any extra arguments for the target script (pass-through)
  [Parameter(ValueFromRemainingArguments=$true)]
  [string[]]$TargetArgs
)

$TargetScript = (Resolve-Path $TargetScript).Path
$SourceDir = Split-Path $TargetScript -Parent
$ScriptName = Split-Path $TargetScript -Leaf

# Writable workspace base
$Base = Join-Path $env:LOCALAPPDATA "THAM_WORKSPACE"
Ensure-Dir $Base

$stamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$WorkDir = Join-Path $Base ("RUN_" + $stamp)

# Prepare workspace + tools/logs
Ensure-Dir $WorkDir
$ToolsDir = Join-Path $WorkDir "tools"
$LogsDir  = Join-Path $ToolsDir "logs"
Ensure-Dir $ToolsDir
Ensure-Dir $LogsDir

$LogFile = Join-Path $LogsDir ("run_workspace_" + $stamp + ".log")

Write-Log $LogFile "INFO" "TargetScript: $TargetScript"
Write-Log $LogFile "INFO" "SourceDir:    $SourceDir"
Write-Log $LogFile "INFO" "WorkDir:      $WorkDir"

# Backup original script (read-only safe)
try {
  $BackupDir = Join-Path $ToolsDir ("backup_" + $stamp)
  Ensure-Dir $BackupDir
  Copy-Item -LiteralPath $TargetScript -Destination (Join-Path $BackupDir $ScriptName) -Force
  (Join-Path $BackupDir $ScriptName) | Out-Null
  (Join-Path $ToolsDir "LAST_BACKUP_DIR.txt") | Out-Null

  # record last backup dir
  $BackupDir | Out-File -FilePath (Join-Path $ToolsDir "LAST_BACKUP_DIR.txt") -Encoding utf8 -Force
  Write-Log $LogFile "PASS" "Backed up target script => $BackupDir"
} catch {
  Write-Log $LogFile "WARN" "Backup skipped/failed: $($_.Exception.Message)"
}

# Copy source directory to workspace (so relative paths inside script still work)
Write-Log $LogFile "INFO" "Copying source folder to workspace..."
try {
  # Copy everything under source dir into WorkDir (robust)
  $items = Get-ChildItem -LiteralPath $SourceDir -Force
  foreach ($it in $items) {
    $dest = Join-Path $WorkDir $it.Name
    if ($it.PSIsContainer) {
      Copy-Item -LiteralPath $it.FullName -Destination $dest -Recurse -Force
    } else {
      Copy-Item -LiteralPath $it.FullName -Destination $dest -Force
    }
  }
  Write-Log $LogFile "PASS" "Copy complete."
} catch {
  Write-Log $LogFile "FAIL" "Copy failed: $($_.Exception.Message)"
  throw
}

# Run inside workspace
$WorkScript = Join-Path $WorkDir $ScriptName
if (-not (Test-Path $WorkScript)) {
  Write-Log $LogFile "FAIL" "WorkScript not found after copy: $WorkScript"
  exit 1
}

Write-Log $LogFile "INFO" "Running in workspace..."
Write-Log $LogFile "INFO" ("Command: pwsh -ExecutionPolicy Bypass -File `"$WorkScript`" " + ($TargetArgs -join " "))

$exitCode = 0
try {
  Push-Location $WorkDir

  # Start-Process to capture proper exit code
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "pwsh"
  $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$WorkScript`" " + ($TargetArgs | ForEach-Object { "`"$_`"" } -join " ")
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  $null = $p.Start()

  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  $p.WaitForExit()
  $exitCode = $p.ExitCode

  # Write outputs to logs
  $outFile = Join-Path $LogsDir ("stdout_" + $stamp + ".log")
  $errFile = Join-Path $LogsDir ("stderr_" + $stamp + ".log")
  Write-Utf8NoBomFile -Path $outFile -Content $stdout
  Write-Utf8NoBomFile -Path $errFile -Content $stderr

  if ($stdout.Trim().Length -gt 0) { Write-Log $LogFile "INFO" "STDOUT saved => $outFile" }
  if ($stderr.Trim().Length -gt 0) { Write-Log $LogFile "WARN" "STDERR saved => $errFile" }

  if ($exitCode -eq 0) {
    Write-Log $LogFile "PASS" "Workspace run completed successfully."
  } else {
    Write-Log $LogFile "FAIL" "Workspace run failed with exit code $exitCode"
  }
}
finally {
  Pop-Location
  Write-Log $LogFile "INFO" "EXIT CODE: $exitCode"
}

Write-Host ""
Write-Host "=== RESULT ==="
Write-Host "WorkDir: $WorkDir"
Write-Host "Logs:    $LogsDir"
Write-Host "Exit:    $exitCode"
exit $exitCode
