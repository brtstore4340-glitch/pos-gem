[CmdletBinding()]
param(
  [string]$RepoRoot = ".",
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Dir([string]$p) {
  if (!(Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
}

function Backup-File([string]$path, [string]$backupRoot, [string]$rootAbs) {
  if (!(Test-Path $path)) { return }
  $rel = $path.Substring($rootAbs.Length).TrimStart("\","/")
  $dest = Join-Path $backupRoot $rel
  Ensure-Dir (Split-Path $dest -Parent)
  Copy-Item $path $dest -Force
}

function Ensure-Import([string]$raw, [string]$importLine) {
  if ($raw -match [regex]::Escape($importLine)) { return $raw }

  $m = [regex]::Match($raw, "(?ms)^(?:\s*import[^\n]*\n)+")
  if ($m.Success) {
    return $raw.Substring(0, $m.Length) + $importLine + "`n" + $raw.Substring($m.Length)
  }

  return $importLine + "`n" + $raw
}

function Patch-RoutesWrapper([string]$raw) {
  if ($raw -match "DynamicNav") { throw "Already patched: DynamicNav found." }
  if ($raw -notmatch "(?s)<Routes\b" -or $raw -notmatch "(?s)</Routes>") { throw "No <Routes>...</Routes> block found." }

  $raw = Ensure-Import $raw 'import DynamicNav from "./components/nav/DynamicNav";'
  $raw = Ensure-Import $raw 'import { db, auth } from "./firebase";'

  $open = "<div className=`"flex min-h-screen`">`n" +
          "  <aside className=`"w-64 shrink-0 border-r`">`n" +
          "    <DynamicNav db={db} auth={auth} />`n" +
          "  </aside>`n" +
          "  <main className=`"flex-1`">`n" +
          "    <Routes"

  $close = "    </Routes>`n" +
           "  </main>`n" +
           "</div>"

  $raw = [regex]::Replace($raw, "(?s)<Routes\b", $open, 1)
  $raw = [regex]::Replace($raw, "(?s)</Routes>", $close, 1)

  return $raw
}

$root = (Resolve-Path $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd_HHmmss")
$logDir = Join-Path $root "ai-logs"
$backupRoot = Join-Path (Join-Path $root "ai-backups") ("wire_dynamic_nav_" + $ts)
Ensure-Dir $logDir
Ensure-Dir $backupRoot

$targets = @(
  (Join-Path $root "src\App.jsx"),
  (Join-Path $root "src\AppAuth.jsx")
)

$patched = $false

foreach ($t in $targets) {
  if (!(Test-Path $t)) { continue }

  $raw = Get-Content $t -Raw
  try {
    $new = Patch-RoutesWrapper $raw
    Backup-File -path $t -backupRoot $backupRoot -rootAbs $root

    if ($DryRun) {
      $preview = Join-Path $logDir ("preview_" + (Split-Path $t -Leaf) + "_" + $ts + ".txt")
      Set-Content -Path $preview -Value $new -Encoding UTF8
      Write-Host "[INFO] DryRun preview written: $preview"
    } else {
      Set-Content -Path $t -Value $new -Encoding UTF8
      Write-Host "[INFO] Patched: $t"
    }

    Write-Host "[INFO] Backup: $backupRoot"
    $patched = $true
    break
  } catch {
    Write-Host ("[WARN] Skip " + $t + " => " + $_.Exception.Message) -ForegroundColor Yellow
  }
}

if (-not $patched) {
  throw "Could not patch App.jsx/AppAuth.jsx. Ensure one contains <Routes>...</Routes>."
}
