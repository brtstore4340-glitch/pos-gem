Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repo = "D:\01 Main Work\Boots\Boots-POS Gemini"
$Target = "D:\01 Main Work\Boots\Boots-POS Gemini\tools\FIX_FIND_APPCHECK_NO_RG.ps1"
if (-not (Test-Path -LiteralPath $Target)) { throw "Target script not found: $Target" }

$pwshExe = "C:\Program Files\PowerShell\7\pwsh.exe"

if (Test-Path -LiteralPath $pwshExe) {
  Write-Host "[INFO] Using PowerShell 7: $pwshExe"
  & $pwshExe -NoProfile -ExecutionPolicy Bypass -File $Target -RepoPath $Repo
} else {
  Write-Host "[WARN] pwsh.exe not found, fallback to Windows PowerShell"
  powershell -NoProfile -ExecutionPolicy Bypass -File $Target -RepoPath $Repo
}

# show latest log
$logGlob = Join-Path $Repo "tools\logs\fix_appcheck_find_*.log"
Get-ChildItem $logGlob -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Desc |
  Select-Object -First 1 |
  ForEach-Object {
    "
===== LAST LOG =====
"
    Get-Content $_.FullName -Raw
  }