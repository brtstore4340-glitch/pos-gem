$RepoRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $RepoRoot "scripts\powershell"
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

@'
[CmdletBinding()]
param(
  [string]$RepoRoot=".",
  [int]$Top=15
)

Set-StrictMode -Version Latest
$ErrorActionPreference="Stop"

function Score([string]$s) {
  $score = 0
  if ($s -match "<nav\b") { $score += 4 }
  if ($s -match "NavLink|<NavLink\b") { $score += 4 }
  if ($s -match "Link|<Link\b") { $score += 2 }
  if ($s -match "sidebar|SideBar|drawer|Drawer") { $score += 3 }
  if ($s -match "menuItems|menus|navigation|navItems") { $score += 3 }
  if ($s -match "Routes\b|<Routes\b|<Route\b|createBrowserRouter") { $score += 2 }
  if ($s -match "layout|Layout|Shell|AppShell") { $score += 2 }
  if ($s -match "react-router-dom") { $score += 1 }
  return $score
}

$root = (Resolve-Path $RepoRoot).Path
$src = Join-Path $root "src"
if (!(Test-Path $src)) { throw "Missing src/ at $src" }

$files = Get-ChildItem $src -Recurse -File -Include *.js,*.jsx,*.ts,*.tsx -ErrorAction SilentlyContinue

$candidates = foreach ($f in $files) {
  $raw = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
  if (-not $raw) { continue }
  $sc = Score $raw
  if ($sc -ge 6) {
    [pscustomobject]@{
      Score = $sc
      File  = $f.FullName.Substring($root.Length).TrimStart("\","/")
      Lines = ($raw -split "`n").Count
    }
  }
}

$candidates |
  Sort-Object Score -Descending |
  Select-Object -First $Top |
  Format-Table -AutoSize
'@ | Set-Content -Path (Join-Path $outputDir "find-nav-target.ps1") -Encoding UTF8
# End of find-nav-target.ps1