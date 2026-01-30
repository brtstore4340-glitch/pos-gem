[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Dir([string]$Path) { if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null } }
function Write-Log([string]$LogFile, [string]$Message) {
  $ts = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffK")
  "$ts $Message" | Tee-Object -FilePath $LogFile -Append
}
function Backup-File([string]$Source, [string]$BackupDir, [string]$LogFile, [string]$RepoRootForRel) {
  if (Test-Path -LiteralPath $Source) {
    $rel = $Source.Replace($RepoRootForRel, "").TrimStart("\","/")
    $safe = ($rel -replace '[\\/:*?"<>|]', '_')
    $dest = Join-Path $BackupDir ($safe + ".bak")
    Copy-Item -LiteralPath $Source -Destination $dest -Force
    Write-Log $LogFile "BACKUP: '$Source' -> '$dest'"
  } else {
    throw "Missing file: $Source"
  }
}

function Detect-Encoding([byte[]]$Bytes) {
  # Returns: name + bomLen
  if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) { return @{ name="utf8-bom"; bom=3 } }
  if ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xFE) { return @{ name="utf16le"; bom=2 } }
  if ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFE -and $Bytes[1] -eq 0xFF) { return @{ name="utf16be"; bom=2 } }
  if ($Bytes.Length -ge 4 -and $Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xFE -and $Bytes[2] -eq 0x00 -and $Bytes[3] -eq 0x00) { return @{ name="utf32le"; bom=4 } }
  if ($Bytes.Length -ge 4 -and $Bytes[0] -eq 0x00 -and $Bytes[1] -eq 0x00 -and $Bytes[2] -eq 0xFE -and $Bytes[3] -eq 0xFF) { return @{ name="utf32be"; bom=4 } }
  return @{ name="unknown"; bom=0 }
}

function Decode-Bytes([byte[]]$Bytes, [hashtable]$EncInfo) {
  $bom = [int]$EncInfo.bom
  $name = [string]$EncInfo.name
  $payload = if ($bom -gt 0) { $Bytes[$bom..($Bytes.Length-1)] } else { $Bytes }

  switch ($name) {
    "utf16le" { return [System.Text.Encoding]::Unicode.GetString($payload) }
    "utf16be" { return [System.Text.Encoding]::BigEndianUnicode.GetString($payload) }
    "utf32le" { return [System.Text.Encoding]::UTF32.GetString($payload) }
    "utf32be" { return ([System.Text.Encoding]::GetEncoding(12001)).GetString($payload) } # UTF-32 BE
    "utf8-bom" { return [System.Text.Encoding]::UTF8.GetString($payload) }
    default {
      # try UTF-8 strict-ish; if garbage, still return with replacement to allow manual fix
      try { return [System.Text.Encoding]::UTF8.GetString($payload) }
      catch { return [System.Text.Encoding]::UTF8.GetString($payload) }
    }
  }
}

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
$bootDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $bootDir "logs"
$bakDir  = Join-Path $bootDir ("backup-" + $ts)
New-Dir $bootDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("fix-volta-manifest-encoding-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"

$pkgPath = Join-Path $RepoRoot "package.json"
Backup-File $pkgPath $bakDir $logFile $RepoRoot

$bytes = [System.IO.File]::ReadAllBytes($pkgPath)
Write-Log $logFile ("INFO: package.json bytes={0}" -f $bytes.Length)

$enc = Detect-Encoding $bytes
Write-Log $logFile ("INFO: detectedEncoding={0} bomLen={1}" -f $enc.name, $enc.bom)

# Quick NUL-byte sniff (often means UTF-16 or corrupt)
$nulCount = 0
for ($i=0; $i -lt [Math]::Min($bytes.Length, 4096); $i++) { if ($bytes[$i] -eq 0) { $nulCount++ } }
Write-Log $logFile ("INFO: nulBytesInFirst4KB={0}" -f $nulCount)

$text = Decode-Bytes $bytes $enc

# Validate JSON using PowerShell (no node/volta)
try {
  $null = $text | ConvertFrom-Json -ErrorAction Stop
  Write-Log $logFile "OK: ConvertFrom-Json validated JSON content"
} catch {
  Write-Log $logFile ("FATAL: JSON invalid after decode: {0}" -f $_.Exception.Message)
  throw "package.json content invalid JSON; open backup and fix manually"
}

# Write UTF-8 *NO BOM* to satisfy most toolchains
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
# ensure trailing newline
if (-not $text.EndsWith("`n")) { $text = $text + "`n" }
[System.IO.File]::WriteAllText($pkgPath, $text, $utf8NoBom)
Write-Log $logFile "PATCH: Wrote package.json as UTF-8 (no BOM)"

Write-Log $logFile "END"
Write-Host ""
Write-Host "DONE. Log: $logFile"
Write-Host "Backups: $bakDir"
