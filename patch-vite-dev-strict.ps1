# patch-vite-dev-strict.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Stamp { Get-Date -Format "yyyyMMdd_HHmmss" }
function Log([string]$m) { Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m) }

$root = Get-Location
$stamp = Stamp
$logPath = Join-Path $root ("patch-log_{0}.txt" -f $stamp)

Start-Transcript -Path $logPath | Out-Null
try {
  $pkg = Join-Path $root "package.json"
  if (!(Test-Path $pkg)) { throw "Missing package.json at repo root." }

  $bkDir = Join-Path $root ("ai-backups\patch_{0}" -f $stamp)
  New-Item -ItemType Directory -Force -Path $bkDir | Out-Null
  Copy-Item $pkg (Join-Path $bkDir "package.json.bak") -Force
  Log "Backup: $bkDir\package.json.bak"

  $raw = Get-Content -Raw -Encoding UTF8 $pkg

  # Minimal text patch: insert dev:strict into "scripts" if not present
  if ($raw -match '"dev:strict"\s*:') {
    Log "dev:strict already exists. No change."
    return
  }

  if ($raw -notmatch '"scripts"\s*:\s*\{') {
    throw "package.json has no scripts block. Patch aborted."
  }

  $insertLine = '    "dev:strict": "vite --host 127.0.0.1 --port 5173 --strictPort",'

  # Insert right after `"scripts": {`
  $patched = [regex]::Replace(
    $raw,
    '"scripts"\s*:\s*\{',
    { param($m) $m.Value + "`r`n" + $insertLine },
    1
  )

  Set-Content -Path $pkg -Value $patched -Encoding UTF8
  Log "Added npm script: dev:strict"
}
catch {
  Log ("ERROR: " + $_.Exception.Message)
  throw
}
finally {
  Stop-Transcript | Out-Null
  Log "Log saved: $logPath"
}
