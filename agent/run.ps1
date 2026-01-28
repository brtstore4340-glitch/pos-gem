param(
  [Parameter(Mandatory=$true)][string]$Skill,
  [Parameter(Mandatory=$true)][string]$Task,
  [string]$ContextPath = ".",
  [string]$OutPath = "agent/out",
  [switch]$List
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path $ContextPath
$registryPath = Join-Path $PSScriptRoot "registry.json"
$policyPath   = Join-Path $root "agent/policy.md"

if (!(Test-Path $registryPath)) { throw "Missing registry.json at $registryPath" }
$registry = Get-Content $registryPath -Raw | ConvertFrom-Json

if ($List) {
  $registry.skills | ForEach-Object { "{0}  -  {1}" -f $_.id, $_.name } | Write-Output
  exit 0
}

$skillObj = $registry.skills | Where-Object { $_.id -eq $Skill } | Select-Object -First 1
if (-not $skillObj) { throw "Skill not found: $Skill. Use -List to view available skills." }

$skillFile = Join-Path $root $skillObj.entry
if (!(Test-Path $skillFile)) { throw "Skill entry file not found: $skillFile" }

if (!(Test-Path $policyPath)) {
  Write-Warning "Policy not found at agent/policy.md. Create it to enforce standard outputs."
}

New-Item -ItemType Directory -Force -Path $OutPath | Out-Null
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$out = Join-Path $OutPath "$($Skill)-$ts.md"

$ctxFolder = Join-Path $root "agent/context"
$ctxNote = if (Test-Path $ctxFolder) { $ctxFolder } else { "(missing) Create agent/context/" }

@"
# Agent Run Packet (Boots-POS Gemini)

- Architecture: $($registry.core_architecture)
- Skill: $($skillObj.id) / $($skillObj.name)
- Task: $Task
- RepoRoot: $root
- Policy: agent/policy.md
- Context Folder: $ctxNote
- SkillSpec: $($skillObj.entry)
- Verification Contract: agent/verification.md

## Mandatory Order of Operations
1) Read agent/policy.md
2) Read skill spec: $($skillObj.entry)
3) Read rules: skills/$Skill/rules.md
4) Read checklist: skills/$Skill/checklist.md
5) Use evidence from agent/context/

## Required Deliverables
- Findings + Root Cause (with evidence)
- Minimal patch (file-by-file)
- Commands to reproduce + verify
- Risks + rollback

"@ | Set-Content -Encoding UTF8 $out

Write-Output "Wrote run packet: $out"
Write-Output "Open policy: $policyPath"
Write-Output "Open skill spec: $skillFile"


