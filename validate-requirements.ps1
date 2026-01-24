#Requires -Version 7.0
<#
.SYNOPSIS
    Boots POS AI Module - Requirements Validation Script
    
.DESCRIPTION
    Validates that the project meets all requirements from SETUP_SUMMARY_FOR_HANDOFF.md
    Checks:
    - Prerequisites (Java, Node.js, npm)
    - Dependencies installation
    - Directory structure
    - Environment variables
    - Code files existence
    - Configuration files
    
.PARAMETER RepoPath
    Path to Boots POS repository
    
.PARAMETER Detailed
    Show detailed output for each check
    
.PARAMETER FixIssues
    Attempt to fix issues automatically (WIP)
    
.EXAMPLE
    .\validate-requirements.ps1 -RepoPath "D:\01 Main Work\Boots\Boots-POS Gemini"
    
.EXAMPLE
    .\validate-requirements.ps1 -RepoPath "D:\01 Main Work\Boots\Boots-POS Gemini" -Detailed
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$RepoPath = "D:\01 Main Work\Boots\Boots-POS Gemini",
    
    [switch]$Detailed,
    [switch]$FixIssues
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

# ===== Configuration =====
$script:TotalChecks = 0
$script:PassedChecks = 0
$script:FailedChecks = 0
$script:WarningChecks = 0
$script:Issues = @()

# ===== Color Functions =====
function Write-CheckHeader {
    param([string]$Message)
    Write-Host "`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║ $($Message.PadRight(57)) ║" -ForegroundColor Cyan
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
}

function Write-Check {
    param(
        [string]$Name,
        [string]$Status,
        [string]$Message = ""
    )
    
    $script:TotalChecks++
    
    $icon = switch ($Status) {
        'PASS' { '✓'; $script:PassedChecks++; $color = 'Green' }
        'FAIL' { '✗'; $script:FailedChecks++; $color = 'Red' }
        'WARN' { '⚠'; $script:WarningChecks++; $color = 'Yellow' }
        'INFO' { 'ℹ'; $color = 'Cyan' }
        default { '?'; $color = 'Gray' }
    }
    
    $statusText = "[$icon] $Name"
    Write-Host "  $statusText" -ForegroundColor $color -NoNewline
    
    if ($Message) {
        Write-Host " - $Message" -ForegroundColor Gray
    } else {
        Write-Host ""
    }
    
    if ($Status -eq 'FAIL' -or $Status -eq 'WARN') {
        $script:Issues += [PSCustomObject]@{
            Category = $script:CurrentCategory
            Check = $Name
            Status = $Status
            Message = $Message
        }
    }
}

function Test-CommandExists {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# ===== Validation Functions =====

function Test-Prerequisites {
    $script:CurrentCategory = "Prerequisites"
    Write-CheckHeader "Checking Prerequisites"
    
    # Node.js
    if (Test-CommandExists "node") {
        $nodeVersion = node --version
        Write-Check "Node.js" "PASS" "Version: $nodeVersion"
        
        if ($Detailed) {
            $nodePath = (Get-Command node).Source
            Write-Host "    Path: $nodePath" -ForegroundColor DarkGray
        }
    } else {
        Write-Check "Node.js" "FAIL" "Not installed"
    }
    
    # npm
    if (Test-CommandExists "npm") {
        $npmVersion = npm --version
        Write-Check "npm" "PASS" "Version: $npmVersion"
    } else {
        Write-Check "npm" "FAIL" "Not installed"
    }
    
    # Java
    if (Test-CommandExists "java") {
        try {
            $javaVersion = (java -version 2>&1) | Select-Object -First 1
            Write-Check "Java" "PASS" "$javaVersion"
        } catch {
            Write-Check "Java" "WARN" "Installed but version check failed"
        }
    } else {
        Write-Check "Java" "FAIL" "Not installed (required for Firebase Emulator)"
    }
    
    # Firebase CLI
    if (Test-CommandExists "firebase") {
        $firebaseVersion = firebase --version
        Write-Check "Firebase CLI" "PASS" "Version: $firebaseVersion"
    } else {
        Write-Check "Firebase CLI" "WARN" "Not installed (optional but recommended)"
    }
    
    # Git
    if (Test-CommandExists "git") {
        $gitVersion = git --version
        Write-Check "Git" "PASS" "$gitVersion"
    } else {
        Write-Check "Git" "INFO" "Not installed (optional)"
    }
    
    # PowerShell Version
    $psVersion = $PSVersionTable.PSVersion
    if ($psVersion.Major -ge 7) {
        Write-Check "PowerShell" "PASS" "Version: $psVersion"
    } else {
        Write-Check "PowerShell" "WARN" "Version $psVersion (recommend 7+)"
    }
}

function Test-RepositoryStructure {
    $script:CurrentCategory = "Repository Structure"
    Write-CheckHeader "Checking Repository Structure"
    
    # Check repo exists
    if (-not (Test-Path $RepoPath)) {
        Write-Check "Repository Path" "FAIL" "Path not found: $RepoPath"
        return
    }
    Write-Check "Repository Path" "PASS" $RepoPath
    
    # Check main directories
    $requiredDirs = @(
        @{ Path = "functions"; Required = $true },
        @{ Path = "functions/src"; Required = $true },
        @{ Path = "src"; Required = $true }
    )
    
    foreach ($dir in $requiredDirs) {
        $fullPath = Join-Path $RepoPath $dir.Path
        if (Test-Path $fullPath) {
            Write-Check "Directory: $($dir.Path)" "PASS"
        } else {
            $status = if ($dir.Required) { "FAIL" } else { "WARN" }
            Write-Check "Directory: $($dir.Path)" $status "Not found"
        }
    }
    
    # Check index.js
    $indexJs = Join-Path $RepoPath "functions/src/index.js"
    if (Test-Path $indexJs) {
        Write-Check "index.js" "PASS" "JavaScript project confirmed"
        
        if ($Detailed) {
            $lines = (Get-Content $indexJs).Count
            Write-Host "    Lines: $lines" -ForegroundColor DarkGray
        }
    } else {
        Write-Check "index.js" "FAIL" "Not found at functions/src/index.js"
    }
}

function Test-Dependencies {
    $script:CurrentCategory = "Dependencies"
    Write-CheckHeader "Checking Dependencies"
    
    $packageJsonPath = Join-Path $RepoPath "functions/package.json"
    
    if (-not (Test-Path $packageJsonPath)) {
        Write-Check "package.json" "FAIL" "Not found"
        return
    }
    
    Write-Check "package.json" "PASS" "Found"
    
    try {
        $packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
        
        $requiredDeps = @(
            "@anthropic-ai/sdk",
            "@google-cloud/vertexai",
            "openai",
            "zod"
        )
        
        foreach ($dep in $requiredDeps) {
            $installed = $packageJson.dependencies.PSObject.Properties.Name -contains $dep
            
            if ($installed) {
                $version = $packageJson.dependencies.$dep
                Write-Check "Dependency: $dep" "PASS" "Version: $version"
            } else {
                Write-Check "Dependency: $dep" "FAIL" "Not installed"
            }
        }
        
        # Check node_modules
        $nodeModulesPath = Join-Path $RepoPath "functions/node_modules"
        if (Test-Path $nodeModulesPath) {
            Write-Check "node_modules" "PASS" "Exists"
            
            if ($Detailed) {
                $modulesCount = (Get-ChildItem $nodeModulesPath -Directory).Count
                Write-Host "    Modules: $modulesCount" -ForegroundColor DarkGray
            }
        } else {
            Write-Check "node_modules" "WARN" "Not found - run 'npm install'"
        }
        
    } catch {
        Write-Check "package.json parsing" "FAIL" $_.Exception.Message
    }
}

function Test-AIModuleStructure {
    $script:CurrentCategory = "AI Module Structure"
    Write-CheckHeader "Checking AI Module Structure"
    
    $functionsPath = Join-Path $RepoPath "functions/src"
    
    $requiredFiles = @(
        @{ Path = "ai/orchestrator.js"; Required = $true },
        @{ Path = "ai/providers/openai.js"; Required = $true },
        @{ Path = "ai/providers/vertex.js"; Required = $true },
        @{ Path = "ai/providers/anthropic.js"; Required = $true },
        @{ Path = "schema/snapshot.js"; Required = $false },
        @{ Path = "rbac/claims.js"; Required = $false }
    )
    
    foreach ($file in $requiredFiles) {
        $fullPath = Join-Path $functionsPath $file.Path
        
        if (Test-Path $fullPath) {
            Write-Check "File: $($file.Path)" "PASS"
            
            if ($Detailed) {
                $lines = (Get-Content $fullPath).Count
                $size = (Get-Item $fullPath).Length
                Write-Host "    Size: $size bytes, Lines: $lines" -ForegroundColor DarkGray
            }
        } else {
            $status = if ($file.Required) { "FAIL" } else { "WARN" }
            Write-Check "File: $($file.Path)" $status "Not found"
        }
    }
    
    # Check if index.js has AI exports
    $indexJs = Join-Path $RepoPath "functions/src/index.js"
    if (Test-Path $indexJs) {
        $content = Get-Content $indexJs -Raw
        
        $exports = @(
            "aiOrchestrator",
            "healthCheck"
        )
        
        foreach ($export in $exports) {
            if ($content -match "exports\.$export") {
                Write-Check "Export: $export" "PASS" "Found in index.js"
            } else {
                Write-Check "Export: $export" "WARN" "Not found in index.js"
            }
        }
    }
}

function Test-EnvironmentVariables {
    $script:CurrentCategory = "Environment Variables"
    Write-CheckHeader "Checking Environment Variables"
    
    # Check .env file
    $envPath = Join-Path $RepoPath ".env"
    if (Test-Path $envPath) {
        Write-Check ".env file" "PASS" "Exists"
        
        $envContent = Get-Content $envPath -Raw
        
        $requiredVars = @(
            "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY",
            "VERTEX_PROJECT",
            "VERTEX_LOCATION"
        )
        
        foreach ($var in $requiredVars) {
            if ($envContent -match $var) {
                Write-Check "Variable: $var" "PASS" "Defined in .env"
            } else {
                Write-Check "Variable: $var" "FAIL" "Not found in .env"
            }
        }
        
        # Check for placeholder values
        if ($envContent -match "your-.*-key-here") {
            Write-Check "API Keys" "WARN" "Contains placeholder values"
        }
        
    } else {
        Write-Check ".env file" "FAIL" "Not found"
    }
    
    # Check .env.local
    $envLocalPath = Join-Path $RepoPath ".env.local"
    if (Test-Path $envLocalPath) {
        Write-Check ".env.local file" "PASS" "Exists"
        
        if ($Detailed) {
            $lines = (Get-Content $envLocalPath).Count
            Write-Host "    Lines: $lines" -ForegroundColor DarkGray
        }
    } else {
        Write-Check ".env.local file" "WARN" "Not found (optional but recommended for local dev)"
    }
    
    # Check .gitignore
    $gitignorePath = Join-Path $RepoPath ".gitignore"
    if (Test-Path $gitignorePath) {
        $gitignoreContent = Get-Content $gitignorePath -Raw
        
        if ($gitignoreContent -match "\.env\.local") {
            Write-Check ".gitignore" "PASS" ".env.local is ignored"
        } else {
            Write-Check ".gitignore" "WARN" ".env.local not in .gitignore (security risk)"
        }
    }
}

function Test-FrontendIntegration {
    $script:CurrentCategory = "Frontend Integration"
    Write-CheckHeader "Checking Frontend Integration"
    
    $srcPath = Join-Path $RepoPath "src"
    
    # Check App.tsx or App.jsx
    $appFiles = @("App.tsx", "App.jsx", "App.js")
    $appFound = $false
    
    foreach ($file in $appFiles) {
        $appPath = Join-Path $srcPath $file
        if (Test-Path $appPath) {
            Write-Check "App file" "PASS" "Found: $file"
            $appFound = $true
            
            $content = Get-Content $appPath -Raw
            
            # Check for AI Module route
            if ($content -match "/admin/ai-module") {
                Write-Check "AI Module route" "PASS" "Route defined"
            } else {
                Write-Check "AI Module route" "WARN" "Route not found in $file"
            }
            
            break
        }
    }
    
    if (-not $appFound) {
        Write-Check "App file" "WARN" "Not found (App.tsx/jsx/js)"
    }
    
    # Check for AdminAIModule component
    $componentPath = Join-Path $srcPath "components/admin/AdminAIModule.tsx"
    $componentPathJsx = Join-Path $srcPath "components/admin/AdminAIModule.jsx"
    
    if ((Test-Path $componentPath) -or (Test-Path $componentPathJsx)) {
        Write-Check "AdminAIModule component" "PASS"
    } else {
        Write-Check "AdminAIModule component" "WARN" "Not found"
    }
}

function Test-FirebaseConfiguration {
    $script:CurrentCategory = "Firebase Configuration"
    Write-CheckHeader "Checking Firebase Configuration"
    
    # Check firebase.json
    $firebaseJsonPath = Join-Path $RepoPath "firebase.json"
    if (Test-Path $firebaseJsonPath) {
        Write-Check "firebase.json" "PASS" "Exists"
        
        try {
            $firebaseJson = Get-Content $firebaseJsonPath -Raw | ConvertFrom-Json
            
            if ($firebaseJson.functions) {
                Write-Check "Functions config" "PASS" "Defined"
            } else {
                Write-Check "Functions config" "WARN" "Not found in firebase.json"
            }
            
            if ($firebaseJson.firestore) {
                Write-Check "Firestore config" "PASS" "Defined"
            } else {
                Write-Check "Firestore config" "WARN" "Not found in firebase.json"
            }
            
        } catch {
            Write-Check "firebase.json parsing" "FAIL" $_.Exception.Message
        }
    } else {
        Write-Check "firebase.json" "WARN" "Not found"
    }
    
    # Check firestore.rules
    $rulesPath = Join-Path $RepoPath "firestore.rules"
    if (Test-Path $rulesPath) {
        Write-Check "firestore.rules" "PASS" "Exists"
        
        $rulesContent = Get-Content $rulesPath -Raw
        
        # Check for AI Module rules
        $aiCollections = @("ui_menus", "ai_audit", "modules")
        foreach ($collection in $aiCollections) {
            if ($rulesContent -match $collection) {
                Write-Check "Rules: $collection" "PASS" "Defined"
            } else {
                Write-Check "Rules: $collection" "WARN" "Not found in rules"
            }
        }
        
    } else {
        Write-Check "firestore.rules" "WARN" "Not found"
    }
    
    # Check firestore.indexes.json
    $indexesPath = Join-Path $RepoPath "firestore.indexes.json"
    if (Test-Path $indexesPath) {
        Write-Check "firestore.indexes.json" "PASS" "Exists"
    } else {
        Write-Check "firestore.indexes.json" "WARN" "Not found"
    }
}

function Test-PowerShellTool {
    $script:CurrentCategory = "PowerShell Tool"
    Write-CheckHeader "Checking PowerShell Tool"
    
    $scriptPath = Join-Path $RepoPath "scripts/powershell/pos-ai-safe.ps1"
    
    if (Test-Path $scriptPath) {
        Write-Check "pos-ai-safe.ps1" "PASS" "Found"
        
        if ($Detailed) {
            $lines = (Get-Content $scriptPath).Count
            $size = (Get-Item $scriptPath).Length
            Write-Host "    Size: $size bytes, Lines: $lines" -ForegroundColor DarkGray
        }
        
        # Check script parameters
        $scriptContent = Get-Content $scriptPath -Raw
        
        $expectedParams = @("Apply", "DryRun", "Rollback", "PlanPath")
        foreach ($param in $expectedParams) {
            if ($scriptContent -match "\[\w*\]`$$param") {
                Write-Check "Parameter: $param" "PASS" "Defined"
            } else {
                Write-Check "Parameter: $param" "WARN" "Not found"
            }
        }
        
    } else {
        Write-Check "pos-ai-safe.ps1" "WARN" "Not found at scripts/powershell/"
    }
}

function Test-Documentation {
    $script:CurrentCategory = "Documentation"
    Write-CheckHeader "Checking Documentation"
    
    $docs = @(
        @{ Name = "README.md"; Required = $false },
        @{ Name = "CHANGELOG.md"; Required = $false },
        @{ Name = "DEPLOYMENT.md"; Required = $false }
    )
    
    foreach ($doc in $docs) {
        $docPath = Join-Path $RepoPath $doc.Name
        if (Test-Path $docPath) {
            Write-Check $doc.Name "PASS" "Exists"
        } else {
            $status = if ($doc.Required) { "FAIL" } else { "INFO" }
            Write-Check $doc.Name $status "Not found"
        }
    }
}

function Show-Summary {
    Write-Host "`n"
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║                     VALIDATION SUMMARY                    ║" -ForegroundColor Cyan
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    
    $passPercent = if ($TotalChecks -gt 0) { 
        [math]::Round(($PassedChecks / $TotalChecks) * 100, 1) 
    } else { 0 }
    
    Write-Host "`n  Total Checks: $TotalChecks" -ForegroundColor White
    Write-Host "  ✓ Passed:     $PassedChecks ($passPercent%)" -ForegroundColor Green
    Write-Host "  ✗ Failed:     $FailedChecks" -ForegroundColor Red
    Write-Host "  ⚠ Warnings:   $WarningChecks" -ForegroundColor Yellow
    
    # Status determination
    $status = if ($FailedChecks -eq 0 -and $WarningChecks -eq 0) {
        "✓ EXCELLENT - All requirements met!"
        $color = 'Green'
    } elseif ($FailedChecks -eq 0) {
        "⚠ GOOD - No failures but some warnings"
        $color = 'Yellow'
    } elseif ($FailedChecks -le 3) {
        "⚠ NEEDS WORK - Some critical issues"
        $color = 'Yellow'
    } else {
        "✗ NOT READY - Multiple critical issues"
        $color = 'Red'
    }
    
    Write-Host "`n  Status: $status" -ForegroundColor $color
    
    # Show issues if any
    if ($Issues.Count -gt 0) {
        Write-Host "`n"
        Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Yellow
        Write-Host "║                     ISSUES FOUND                          ║" -ForegroundColor Yellow
        Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Yellow
        
        $groupedIssues = $Issues | Group-Object -Property Category
        
        foreach ($group in $groupedIssues) {
            Write-Host "`n  $($group.Name):" -ForegroundColor Cyan
            foreach ($issue in $group.Group) {
                $icon = if ($issue.Status -eq 'FAIL') { '✗' } else { '⚠' }
                $color = if ($issue.Status -eq 'FAIL') { 'Red' } else { 'Yellow' }
                Write-Host "    $icon $($issue.Check)" -ForegroundColor $color
                if ($issue.Message) {
                    Write-Host "      → $($issue.Message)" -ForegroundColor Gray
                }
            }
        }
    }
    
    # Recommendations
    if ($FailedChecks -gt 0 -or $WarningChecks -gt 0) {
        Write-Host "`n"
        Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
        Write-Host "║                    RECOMMENDATIONS                        ║" -ForegroundColor Cyan
        Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
        
        # Prioritized recommendations
        if ($Issues | Where-Object { $_.Check -eq "Java" -and $_.Status -eq "FAIL" }) {
            Write-Host "`n  1. Install Java 17:" -ForegroundColor Yellow
            Write-Host "     winget install Microsoft.OpenJDK.17" -ForegroundColor White
        }
        
        if ($Issues | Where-Object { $_.Category -eq "Dependencies" -and $_.Status -eq "FAIL" }) {
            Write-Host "`n  2. Install missing dependencies:" -ForegroundColor Yellow
            Write-Host "     cd functions" -ForegroundColor White
            Write-Host "     npm install @anthropic-ai/sdk @google-cloud/vertexai openai zod" -ForegroundColor White
        }
        
        if ($Issues | Where-Object { $_.Category -eq "AI Module Structure" }) {
            Write-Host "`n  3. Create AI Module structure:" -ForegroundColor Yellow
            Write-Host "     Follow JAVASCRIPT_INTEGRATION.md" -ForegroundColor White
        }
        
        if ($Issues | Where-Object { $_.Check -match "Variable:" }) {
            Write-Host "`n  4. Add environment variables:" -ForegroundColor Yellow
            Write-Host "     Copy from env-snippet-to-add.txt to .env" -ForegroundColor White
        }
    }
}

# ===== Main Execution =====
Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     Boots POS AI Module - Requirements Validation v1.0       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Host "`nRepository: $RepoPath" -ForegroundColor White
Write-Host "Detailed Mode: $Detailed" -ForegroundColor White
Write-Host ""

# Run all checks
Test-Prerequisites
Test-RepositoryStructure
Test-Dependencies
Test-AIModuleStructure
Test-EnvironmentVariables
Test-FrontendIntegration
Test-FirebaseConfiguration
Test-PowerShellTool
Test-Documentation

# Show summary
Show-Summary

Write-Host "`n"

# Exit code based on results
if ($FailedChecks -eq 0) {
    exit 0
} else {
    exit 1
}
