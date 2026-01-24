Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

trap {
  try {
    $msg = $_.Exception.Message
    Write-Host "[FATAL] $msg" -ForegroundColor Red
  } catch {}
  exit 1
}

function New-DirIfMissing {
  param([Parameter(Mandatory=$true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Write-Log {
  param(
    [Parameter(Mandatory=$true)][string]$LogPath,
    [Parameter(Mandatory=$true)][string]$Level,
    [Parameter(Mandatory=$true)][string]$Message
  )
  $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
  $line = "[$ts][$Level] $Message"
  Add-Content -LiteralPath $LogPath -Value $line -Encoding utf8
}

function Backup-FileIfExists {
  param(
    [Parameter(Mandatory=$true)][string]$TargetPath,
    [Parameter(Mandatory=$true)][string]$BackupDir,
    [Parameter(Mandatory=$true)][string]$LogPath
  )

  if (Test-Path -LiteralPath $TargetPath) {
    $name = Split-Path -Leaf $TargetPath
    $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $bakPath = Join-Path $BackupDir ("{0}.bak_{1}" -f $name, $stamp)

    Copy-Item -LiteralPath $TargetPath -Destination $bakPath -Force
    Write-Log -LogPath $LogPath -Level "PASS" -Message "Backup created: $bakPath"
    return $bakPath
  } else {
    Write-Log -LogPath $LogPath -Level "INFO" -Message "No existing target file to backup: $TargetPath"
    return $null
  }
}

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content,
    [Parameter(Mandatory=$true)][string]$LogPath
  )

  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }

  if ($PSVersionTable.PSVersion.Major -ge 7) {
    Set-Content -LiteralPath $Path -Value $Content -Encoding utf8NoBOM -Force
  } else {
    # Windows PowerShell 5.1: best-effort UTF8 (may include BOM)
    Set-Content -LiteralPath $Path -Value $Content -Encoding utf8 -Force
  }

  Write-Log -LogPath $LogPath -Level "PASS" -Message "Wrote file (UTF-8): $Path"
}

# -------------------------
# MAIN
# -------------------------
$root = (Get-Location).Path

$toolsDir = Join-Path $root "tools"
$logsDir  = Join-Path $toolsDir "logs"
New-DirIfMissing -Path $toolsDir
New-DirIfMissing -Path $logsDir

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logPath = Join-Path $logsDir ("create_modernloader_amini_{0}.log" -f $stamp)

Write-Log -LogPath $logPath -Level "INFO" -Message "START: CREATE ModernLoader AMINI"
Write-Log -LogPath $logPath -Level "INFO" -Message ("PWD: {0}" -f $root)
Write-Log -LogPath $logPath -Level "INFO" -Message ("PowerShell: {0}" -f $PSVersionTable.PSVersion.ToString())

$backupDir = Join-Path $toolsDir ("backup_modernloader_{0}" -f $stamp)
New-DirIfMissing -Path $backupDir

$lastBackupTxt = Join-Path $toolsDir "LAST_BACKUP_DIR.txt"
try {
  Set-Content -LiteralPath $lastBackupTxt -Value $backupDir -Encoding utf8 -Force
  Write-Log -LogPath $logPath -Level "PASS" -Message "Updated LAST_BACKUP_DIR.txt => $backupDir"
} catch {
  Write-Log -LogPath $logPath -Level "WARN" -Message "Failed to update LAST_BACKUP_DIR.txt: $($_.Exception.Message)"
}

# Target file
$FilePath = Join-Path $root "ModernLoader.html"

# Backup existing file
$bak = Backup-FileIfExists -TargetPath $FilePath -BackupDir $backupDir -LogPath $logPath | Out-Null

# HTML content (Loader AMINI)
# NOTE: ใช้ SVG ที่คุม opacity ได้แน่น + ring blur/glass card + Tailwind CDN
$HtmlContent = @'
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Modern Loading - AMINI</title>

  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500&display=swap" rel="stylesheet">

  <style>
    :root { color-scheme: dark; }
    body { font-family: "Kanit", sans-serif; }
    /* เพิ่มความนุ่มของ loader */
    .glow {
      filter: drop-shadow(0 0 12px rgba(255,255,255,0.18));
    }
  </style>
</head>

<body class="bg-slate-950 min-h-screen flex items-center justify-center overflow-hidden">

  <!-- Background soft gradient -->
  <div class="absolute inset-0">
    <div class="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-indigo-500/20 blur-3xl"></div>
    <div class="absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full bg-cyan-400/15 blur-3xl"></div>
  </div>

  <!-- Card -->
  <div class="relative z-10 w-[340px] sm:w-[380px] p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl">
    <div class="flex flex-col items-center justify-center">

      <!-- Loader -->
      <div class="glow">
        <svg class="w-16 h-16 animate-spin text-white" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="loading">
          <!-- 8 bars around the circle -->
          <g transform="translate(50,50)">
            <g transform="rotate(0)">
              <rect x="-6" y="-44" width="12" height="24" rx="6" fill="currentColor" opacity="1.0"></rect>
            </g>
            <g transform="rotate(45)">
              <rect x="-6" y="-44" width="12" height="24" rx="6" fill="currentColor" opacity="0.85"></rect>
            </g>
            <g transform="rotate(90)">
              <rect x="-6" y="-44" width="12" height="24" rx="6" fill="currentColor" opacity="0.70"></rect>
            </g>
            <g transform="rotate(135)">
              <rect x="-6" y="-44" width="12" height="24" rx="6" fill="currentColor" opacity="0.55"></rect>
            </g>
            <g transform="rotate(180)">
              <rect x="-6" y="-44" width="12" height="24" rx="6" fill="currentColor" opacity="0.40"></rect>
            </g>
            <g transform="rotate(225)">
              <rect x="-6" y="-44" width="12" height="24" rx="6" fill="currentColor" opacity="0.30"></rect>
            </g>
            <g transform="rotate(270)">
              <rect x="-6" y="-44" width="12" height="24" rx="6" fill="currentColor" opacity="0.22"></rect>
            </g>
            <g transform="rotate(315)">
              <rect x="-6" y="-44" width="12" height="24" rx="6" fill="currentColor" opacity="0.16"></rect>
            </g>
          </g>
        </svg>
      </div>

      <!-- Text -->
      <p class="mt-6 text-base sm:text-lg font-light tracking-[0.2em] text-slate-200 animate-pulse select-none">
        โปรดรอสักครู่
      </p>

      <!-- Sub text -->
      <p class="mt-3 text-xs sm:text-sm text-slate-400/90 select-none">
        กำลังโหลดข้อมูลให้พี่เอก...
      </p>

    </div>
  </div>

</body>
</html>
'@

# Write file
Write-Utf8NoBom -Path $FilePath -Content $HtmlContent -LogPath $logPath

# Final
Write-Log -LogPath $logPath -Level "PASS" -Message "DONE: ModernLoader AMINI created successfully"
Write-Host "✅ สร้างไฟล์ ModernLoader.html เรียบร้อยแล้ว" -ForegroundColor Green
Write-Host "📄 Path: $FilePath" -ForegroundColor Cyan
Write-Host "🧾 Log:  $logPath" -ForegroundColor Yellow

exit 0
