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

function Test-Java {
  try { & java -version | Out-Null; return $true } catch { return $false }
}

function Get-JavaExePath {
  try { (Get-Command java -ErrorAction Stop).Source } catch { $null }
}

function Find-JdkRoots {
  $bases = @("C:\Program Files\Microsoft","C:\Program Files\Eclipse Adoptium","C:\Program Files\Java")
  $roots = @()
  foreach ($b in $bases) {
    if (Test-Path $b) {
      $found = Get-ChildItem -Path $b -Recurse -Filter "java.exe" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match "\\bin\\java\.exe$" } | Select-Object -First 50
      foreach ($f in $found) {
        $jdkRoot = Split-Path (Split-Path $f.FullName -Parent) -Parent
        if ($jdkRoot -and (Test-Path (Join-Path $jdkRoot "bin\java.exe"))) { $roots += $jdkRoot }
      }
    }
  }
  $roots | Sort-Object -Unique
}

function Ensure-EnvVar([string]$name, [string]$value, [string]$scope) {
  if ($DryRun) { Write-Info "DryRun: set $name=$value ($scope)"; return }
  [Environment]::SetEnvironmentVariable($name, $value, $scope)
  Set-Item -Path "Env:$name" -Value $value
}

function Ensure-PathContains([string]$needle, [string]$scope) {
  $current = [Environment]::GetEnvironmentVariable("Path", $scope)
  if ([string]::IsNullOrWhiteSpace($current)) { $current = "" }
  $parts = $current.Split(";") | Where-Object { $_ }
  $exists = $parts | Where-Object { $_.TrimEnd("\") -ieq $needle.TrimEnd("\") } | Select-Object -First 1
  if ($exists) { Write-Info "PATH already contains: $needle ($scope)"; return }
  $newPath = if ($current.Trim().Length -eq 0) { $needle } else { "$current;$needle" }
  if ($DryRun) { Write-Info "DryRun: append PATH ($scope): $needle" }
  else { [Environment]::SetEnvironmentVariable("Path", $newPath, $scope) }
  if (-not $DryRun) { $env:Path = $env:Path + ";" + $needle }
}

function Require-AdminIfMachineScope {
  if ($Scope -ne "Machine") { return }
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Scope=Machine requires PowerShell as Administrator."
  }
}

function Install-OpenJdk17 {
  Require-AdminIfMachineScope
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) { throw "winget not found. Install App Installer then retry." }
  if ($DryRun) { Write-Info "DryRun: winget install Microsoft.OpenJDK.17"; return }
  $args = @("install","--id","Microsoft.OpenJDK.17","-e","--accept-package-agreements","--accept-source-agreements")
  if ($ForceReinstall) { $args += "--force" }
  Write-Info "Running: winget $($args -join ' ')"
  $p = Start-Process -FilePath $winget.Source -ArgumentList $args -Wait -PassThru -NoNewWindow
  if ($p.ExitCode -ne 0) { throw "winget install failed (exit $($p.ExitCode))." }
}

Write-Info "Scope=$Scope DryRun=$DryRun"
if (Test-Java) {
  Write-Info "Java already available."
  & java -version
  exit 0
}

Write-Warn "Java not found on PATH. Installing Microsoft OpenJDK 17..."
Install-OpenJdk17
Start-Sleep -Seconds 2

$javaExe = Get-JavaExePath
if (-not $javaExe) {
  Write-Warn "java.exe still not on PATH. Searching common locations..."
  $roots = Find-JdkRoots
  if ($roots.Count -eq 0) { throw "Could not locate JDK after install. Reopen terminal and retry." }
  $preferred = $roots | Where-Object { $_ -like "*\Microsoft\jdk-17*" } | Select-Object -First 1
  $jdkRoot = if ($preferred) { $preferred } else { $roots[0] }
  Write-Info "Found JDK root: $jdkRoot"
  Ensure-EnvVar -name "JAVA_HOME" -value $jdkRoot -scope $Scope
  Ensure-PathContains -needle (Join-Path $jdkRoot "bin") -scope $Scope
} else {
  $binDir = Split-Path $javaExe -Parent
  $jdkRoot = Split-Path $binDir -Parent
  Write-Info "java.exe: $javaExe"
  Ensure-EnvVar -name "JAVA_HOME" -value $jdkRoot -scope $Scope
  Ensure-PathContains -needle $binDir -scope $Scope
}

Write-Info "Verifying..."
if (Test-Java) {
  Write-Info "SUCCESS"
  & java -version
  Write-Info "JAVA_HOME=$env:JAVA_HOME"
  exit 0
}

throw "Java still not runnable. Close & reopen PowerShell, then run: java -version"
