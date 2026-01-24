# =============================================================================
# FILE: install-java17.ps1
# PURPOSE: Install Java 17 (Microsoft OpenJDK) + configure JAVA_HOME and PATH
# USAGE:
#   powershell -ExecutionPolicy Bypass -File .\install-java17.ps1 -Scope User
#   powershell -ExecutionPolicy Bypass -File .\install-java17.ps1 -Scope Machine
#   powershell -ExecutionPolicy Bypass -File .\install-java17.ps1 -DryRun
# =============================================================================

[CmdletBinding()]
param(
  [ValidateSet("User","Machine")]
  [string]$Scope = "User",

  [switch]$DryRun,

  [switch]$ForceReinstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info([string]$m) { Write-Host "[INFO] $m" }
function Write-Warn([string]$m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err ([string]$m) { Write-Host "[ERR ] $m" -ForegroundColor Red }

function Test-Java {
  try {
    $p = Start-Process -FilePath "java" -ArgumentList @("-version") -NoNewWindow -PassThru -Wait -ErrorAction Stop
    return ($p.ExitCode -eq 0)
  } catch {
    return $false
  }
}

function Get-JavaExePath {
  try {
    $cmd = Get-Command java -ErrorAction Stop
    return $cmd.Source
  } catch {
    return $null
  }
}

function Find-JdkRoots {
  $candidates = @()

  $pathsToScan = @(
    "C:\Program Files\Microsoft",
    "C:\Program Files\Eclipse Adoptium",
    "C:\Program Files\Java"
  )

  foreach ($base in $pathsToScan) {
    if (Test-Path $base) {
      $found = Get-ChildItem -Path $base -Recurse -Filter "java.exe" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match "\\bin\\java\.exe$" } |
        Select-Object -First 50
      foreach ($f in $found) {
        # JDK root = ...\bin\java.exe -> parent of bin
        $jdkRoot = Split-Path (Split-Path $f.FullName -Parent) -Parent
        if ($jdkRoot -and (Test-Path (Join-Path $jdkRoot "bin\java.exe"))) {
          $candidates += $jdkRoot
        }
      }
    }
  }

  # Uniq
  $candidates | Sort-Object -Unique
}

function Ensure-EnvVar([string]$name, [string]$value, [string]$scope) {
  if ($DryRun) {
    Write-Info "DryRun: would set $name=$value ($scope)"
    return
  }
  [Environment]::SetEnvironmentVariable($name, $value, $scope)
  # Update current process
  if ($scope -eq "User" -or $scope -eq "Machine") {
    Set-Item -Path "Env:$name" -Value $value
  }
}

function Ensure-PathContains([string]$needle, [string]$scope) {
  $current = [Environment]::GetEnvironmentVariable("Path", $scope)
  if ([string]::IsNullOrWhiteSpace($current)) { $current = "" }

  $parts = $current.Split(";") | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  $exists = $parts | Where-Object { $_.TrimEnd("\") -ieq $needle.TrimEnd("\") } | Select-Object -First 1

  if ($exists) {
    Write-Info "PATH already contains: $needle ($scope)"
    return
  }

  $newPath = if ($current.Trim().Length -eq 0) { $needle } else { "$current;$needle" }

  if ($DryRun) {
    Write-Info "DryRun: would append to PATH ($scope): $needle"
  } else {
    [Environment]::SetEnvironmentVariable("Path", $newPath, $scope)
  }

  # Update current process PATH immediately
  if (-not $DryRun) {
    $env:Path = $env:Path + ";" + $needle
  }
}

function Require-AdminIfMachineScope {
  if ($Scope -ne "Machine") { return }
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  $isAdmin = $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) {
    throw "Scope=Machine requires running PowerShell as Administrator."
  }
}

function Install-OpenJdk17 {
  Require-AdminIfMachineScope

  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw "winget not found. Install App Installer from Microsoft Store or use an alternative Java 17 installer."
  }

  if ($DryRun) {
    Write-Info "DryRun: would run winget install Microsoft.OpenJDK.17"
    return
  }

  $args = @("install", "--id", "Microsoft.OpenJDK.17", "-e", "--accept-package-agreements", "--accept-source-agreements")
  if ($ForceReinstall) { $args += @("--force") }

  Write-Info "Running: winget $($args -join ' ')"
  $p = Start-Process -FilePath $winget.Source -ArgumentList $args -Wait -PassThru -NoNewWindow
  if ($p.ExitCode -ne 0) {
    throw "winget install failed with exit code $($p.ExitCode)."
  }
}

# ----------------- Main -----------------
Write-Info "Target Scope: $Scope"
Write-Info "DryRun: $DryRun"
Write-Info "Checking existing Java..."

if (Test-Java) {
  Write-Info "Java is already available."
  & java -version
  exit 0
}

Write-Warn "Java not found on PATH. Installing Java 17 (Microsoft OpenJDK)..."
Install-OpenJdk17

Write-Info "Re-checking java on PATH..."
Start-Sleep -Seconds 2

$javaExe = Get-JavaExePath
if (-not $javaExe) {
  Write-Warn "java.exe still not discoverable via PATH. Searching common install locations..."
  $roots = Find-JdkRoots
  if ($roots.Count -eq 0) {
    throw "Could not locate JDK installation. Please install Java 17 manually, then rerun."
  }

  # Prefer Microsoft OpenJDK if present
  $preferred = $roots | Where-Object { $_ -like "*\Microsoft\jdk-17*" } | Select-Object -First 1
  $jdkRoot = if ($preferred) { $preferred } else { $roots[0] }

  Write-Info "Found JDK root: $jdkRoot"
  Ensure-EnvVar -name "JAVA_HOME" -value $jdkRoot -scope $Scope
  Ensure-PathContains -needle (Join-Path $jdkRoot "bin") -scope $Scope
} else {
  # Derive JAVA_HOME from java.exe path: ...\bin\java.exe => parent of bin
  $binDir = Split-Path $javaExe -Parent
  $jdkRoot = Split-Path $binDir -Parent
  Write-Info "java.exe found at: $javaExe"
  Write-Info "Derived JAVA_HOME: $jdkRoot"
  Ensure-EnvVar -name "JAVA_HOME" -value $jdkRoot -scope $Scope
  Ensure-PathContains -needle $binDir -scope $Scope
}

Write-Info "Verifying..."
if (Test-Java) {
  Write-Info "SUCCESS: Java is ready."
  & java -version
  Write-Info "JAVA_HOME=$env:JAVA_HOME"
  exit 0
}

throw "Java still not runnable. Please close/reopen terminal and run: java -version"
