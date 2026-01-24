# File: RUN_IN_WRITABLE_WORKSPACE_V2.ps1
# Purpose: Run a target PS script inside a guaranteed-writable workspace (auto-detect)
# SafeMode: strict + try/catch + backup + UTF-8 no BOM + tools/logs + exit code summary

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

function Test-WritableDir {
  param([string]$DirPath)
  try {
    if (-not $DirPath) { return $false }
    Ensure-Dir $DirPath
    $probe = Join-Path $DirPath (".__write_test_" + [guid]::NewGuid().ToString("N") + ".tmp")
    "ok" | Out-File -FilePath $probe -Encoding utf8 -Force
    Remove-Item -LiteralPath $probe -Force -ErrorAction SilentlyContinue
    return $true
  } catch {
    return $false
  }
}

function Pick-WorkspaceBase {
  # Try multiple places (most reliable first)
  $candidates = @()

  if ($env:TEMP)        { $candidates += (Join-Path $env:TEMP "THAM_WORKSPACE") }
  if ($env:TMP)         { $candidates += (Join-Path $env:TMP  "THAM_WORKSPACE") }
  if ($env:LOCALAPPDATA){ $candidates += (Join-Path $env:LOCALAPPDATA "THAM_WORKSPACE") }
  if ($env:USERPROFILE) { $candidates += (Join-Path $env:USERPROFILE "Desktop\THAM_WORKSPACE") }
  $candidates += "D:\Temp\THAM_WORKSPACE"
  $candidates += "C:\Temp\THAM_WORKSPACE"

  foreach ($c in $candidates | Select-Object -Unique) {
    if (Test-WritableDir $c) { return $c }
  }

  throw "No writable workspace base found. Try creating D:\Temp manually or run PowerShell as normal user."
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

  [Parameter(ValueFromRemainingArguments=$true)]
  [string[]]$TargetArgs
)

$TargetScript = (Resolve-Path $TargetScript).Path
$SourceDir = Split-Path $TargetScript -Parent
$ScriptName = Split-Path $TargetScript -Leaf

$Base = Pick-WorkspaceBase
$stamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$WorkDir = Join-Path $Base ("RUN_" + $stamp)

Ensure-Dir $WorkDir

# tools/logs inside workspace
$ToolsDir = Join-Path $WorkDir "tools"
$LogsDir  = Join-Path $ToolsDir "logs"
Ensure-Dir $ToolsDir
Ensure-Dir $LogsDir

$LogFile = Join-Path $LogsDir ("run_workspace_v2_" + $stamp + ".log")

Write-Log $LogFile "INFO" "TargetScript: $TargetScript"
Write-Log $LogFile "INFO" "SourceDir:    $SourceDir"
Write-Log $LogFile "INFO" "WorkspaceBase:$Base"
Write-Log $LogFile "INFO" "WorkDir:      $WorkDir"

# Backup original script into workspace
try {
  $BackupDir = Join-Path $ToolsDir ("backup_" + $stamp)
  Ensure-Dir $BackupDir
  Copy-Item -LiteralPath $TargetScript -Destination (Join-Path $BackupDir $ScriptName) -Force
  $BackupDir | Out-File -FilePath (Join-Path $ToolsDir "LAST_BACKUP_DIR.txt") -Encoding utf8 -Force
  Write-Log $LogFile "PASS" "Backup target script => $BackupDir"
} catch {
  Write-Log $LogFile "WARN" "Backup failed (non-fatal): $($_.Exception.Message)"
}

# Copy whole folder where script lives into workspace (keeps relative paths)
Write-Log $LogFile "INFO" "Copying source folder to workspace..."
try {
  $items = Get-ChildItem -LiteralPath $SourceDir -Force -ErrorAction Stop
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

$WorkScript = Join-Path $WorkDir $ScriptName
if (-not (Test-Path $WorkScript)) {
  Write-Log $LogFile "FAIL" "WorkScript not found after copy: $WorkScript"
  exit 1
}

# Run inside workspace and capture logs safely
Write-Log $LogFile "INFO" "Running script inside workspace..."
Write-Log $LogFile "INFO" ("Command: pwsh -NoProfile -ExecutionPolicy Bypass -File `"$WorkScript`" " + ($TargetArgs -join " "))

$exitCode = 0
try {
  Push-Location $WorkDir

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

# Safe listing logs (avoid access denied bombs)
Write-Host ""
Write-Host "=== RECENT LOGS (workspace only) ==="
Get-ChildItem -LiteralPath $LogsDir -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Desc |
  Select-Object -First 20 |
  ForEach-Object { "{0}  {1}" -f $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss"), $_.FullName }

exit $exitCode
