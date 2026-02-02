[CmdletBinding()]
param(
    [string]$RepoRoot = (Get-Location).Path,
    [int]$MaxFixIterations = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Dir([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Write-Log([string]$LogFile, [string]$Message) {
    $ts = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffK")
    "$ts $Message" | Tee-Object -FilePath $LogFile -Append
}

function Backup-File([string]$Source, [string]$BackupDir, [string]$LogFile, [string]$RepoRootForRel) {
    if (Test-Path -LiteralPath $Source) {
        $rel = $Source.Replace($RepoRootForRel, "").TrimStart("\", "/")
        $safe = ($rel -replace '[\\/:*?"<>|]', '_')
        $dest = Join-Path $BackupDir ($safe + ".bak")
        Copy-Item -LiteralPath $Source -Destination $dest -Force
        Write-Log $LogFile "BACKUP: '$Source' -> '$dest'"
    }
    else {
        Write-Log $LogFile "WARN: Missing file: $Source"
    }
}

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")

$bootDir = Join-Path $RepoRoot "_boot"
$logDir = Join-Path $bootDir "logs"
$bakDir = Join-Path $bootDir ("backup-" + $ts)
New-Dir $bootDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("fix-build-deps-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"

$pkgPath = Join-Path $RepoRoot "package.json"
$lockPath = Join-Path $RepoRoot "package-lock.json"
Backup-File $pkgPath $bakDir $logFile $RepoRoot
Backup-File $lockPath $bakDir $logFile $RepoRoot

# Check Node/npm versions
Write-Log $logFile "Node version: $(node -v)"
Write-Log $logFile "npm version: $(npm -v)"

for ($i = 1; $i -le $MaxFixIterations; $i++) {
    Write-Log $logFile "STEP: Build attempt $i/$MaxFixIterations"

    # Run build and capture output
    $buildOutput = cmd /c "npx vite build 2>&1"
    $buildOutput | ForEach-Object { Write-Log $logFile "BUILD: $_" }
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-Log $logFile "OK: Build succeeded"
        Write-Host ""
        Write-Host "SUCCESS: Build completed successfully" -ForegroundColor Green
        Write-Host "Log: $logFile"
        Write-Host "Backups: $bakDir"
        exit 0
    }

    # Look for missing dependency errors
    $missingDep = $buildOutput | Where-Object { $_ -match 'Could not resolve dependency["'']([^"'']+)["'']' } | Select-Object -First 1
    if ($missingDep) {
        $dep = $matches[1]
        Write-Log $logFile "DETECTED: missing dependency '$dep'"
        Write-Host "Installing missing dependency: $dep" -ForegroundColor Yellow

        $installOutput = cmd /c "npm install --save $dep 2>&1"
        $installOutput | ForEach-Object { Write-Log $logFile "NPM: $_" }

        if ($LASTEXITCODE -ne 0) {
            Write-Log $logFile "FATAL: npm install failed for $dep"
            break
        }
        Write-Log $logFile "SUCCESS: Installed $dep"
        continue
    }

    # Look for import errors
    $importError = $buildOutput | Where-Object { $_ -match 'failed to resolve import["'']([^"'']+)["'']' } | Select-Object -First 1
    if ($importError) {
        $dep = $matches[1]
        Write-Log $logFile "DETECTED: missing import '$dep'"
        Write-Host "Installing missing package: $dep" -ForegroundColor Yellow

        $installOutput = cmd /c "npm install --save $dep 2>&1"
        $installOutput | ForEach-Object { Write-Log $logFile "NPM: $_" }

        if ($LASTEXITCODE -ne 0) {
            Write-Log $logFile "FATAL: npm install failed for $dep"
            break
        }
        Write-Log $logFile "SUCCESS: Installed $dep"
        continue
    }

    # Look for "Cannot find package" errors
    $pkgError = $buildOutput | Where-Object { $_ -match 'Cannot find package["'']([^"'']+)["'']' } | Select-Object -First 1
    if ($pkgError) {
        $dep = $matches[1]
        Write-Log $logFile "DETECTED: missing package '$dep'"
        Write-Host "Installing missing package: $dep" -ForegroundColor Yellow

        $installOutput = cmd /c "npm install --save $dep 2>&1"
        $installOutput | ForEach-Object { Write-Log $logFile "NPM: $_" }

        if ($LASTEXITCODE -ne 0) {
            Write-Log $logFile "FATAL: npm install failed for $dep"
            break
        }
        Write-Log $logFile "SUCCESS: Installed $dep"
        continue
    }

    Write-Log $logFile "WARN: Build failed but no missing dependency detected"
    Write-Host "Build failed. See log for details." -ForegroundColor Red
}

Write-Log $logFile "END"
Write-Host ""
Write-Host "FAILED: Build still failing after $MaxFixIterations iterations" -ForegroundColor Red
Write-Host "Check log: $logFile"
throw "Build failed. See log for details: $logFile"
