<# 
BOOTSTRAP: Architecture Baseline + Agent Ops docs
Target: D:\01 Main Work\Boots\Boots-POS Gemini

Run:
  Set-ExecutionPolicy -Scope Process Bypass -Force
  cd "D:\01 Main Work\Boots\Boots-POS Gemini"
  .\bootstrap-arch.ps1
#>

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "[ARCH] $msg" }
function Ensure-Dir($path) { if (-not (Test-Path -LiteralPath $path)) { New-Item -ItemType Directory -Path $path | Out-Null } }
function Backup-IfExists($path) {
  if (Test-Path -LiteralPath $path) {
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    Copy-Item -LiteralPath $path -Destination "$path.bak.$ts" -Force
    Write-Step "Backup: $path -> $path.bak.$ts"
  }
}
function Write-TextFile($path, $content) {
  Backup-IfExists $path
  $dir = Split-Path -Parent $path
  if ($dir -and $dir -ne ".") { Ensure-Dir $dir }
  Set-Content -LiteralPath $path -Value $content -Encoding UTF8
  Write-Step "Wrote: $path"
}

$root = (Get-Location).Path
Write-Step "Repo root: $root"

Ensure-Dir "$root\docs"
Ensure-Dir "$root\docs\adr"
Ensure-Dir "$root\docs\runbooks"
Ensure-Dir "$root\docs\agents"
Ensure-Dir "$root\src\features"
Ensure-Dir "$root\src\services"
Ensure-Dir "$root\src\stores"
Ensure-Dir "$root\src\lib"

# --- TEAM / AGENT OPS (how to work)
$agentOps = @'
# Agent Operating Playbook (Boots POS)

## Roles
- System Architect: architecture, module boundaries, contracts, security
- Tailwind Design System: tokens, UI patterns, components, accessibility
- Module Builder: implement features using contracts + DS components
- Bug Fix: repro → isolate → root cause → patch → regression guard

## Workflow (always)
1) Intake (what/why/constraints)
2) Plan (contracts + data + UI)
3) Implement
4) Review (build/lint + DS consistency)
5) Ship (notes + verification)

## Definition of Done (global)
- `npm run build` PASS
- No duplicated UI tokens (use semantic tokens)
- Error handling + loading/empty states
- Notes: What/Why/How + risk + verify commands
'@

# --- ARCHITECTURE baseline (POS-friendly)
$architecture = @'
# Architecture (Boots POS Gemini)

## Stack
- Frontend: React + Vite
- UI: Tailwind Design System (semantic tokens + CVA components)
- Data: (planned) Firebase (Auth + Firestore + Storage + Functions)
- State: local state + feature stores (to be chosen when modules land)

## Module Boundaries (feature-first)
- `src/features/auth` (login, roles, session)
- `src/features/pos` (cart, scan, checkout, receipt)
- `src/features/products` (catalog, search, pricing, stock)
- `src/features/orders` (order history, refunds, status)
- `src/features/reports` (daily report, cashier report)
- `src/features/settings` (store profile, devices, printers)
Shared:
- `src/components/ui` (Design System)
- `src/services` (API/Firebase gateways)
- `src/lib` (utils, validations)
- `src/stores` (app-wide stores)

## Principles
- Feature ownership: UI + logic + service adapter per feature
- Services are adapters: no UI imports in services
- Design tokens only: no hardcoded colors in components
- Typed contracts (later if migrate to TS)
'@

# --- MODULE MAP
$moduleMap = @'
# Module Map

## src/features
- auth/
  - pages/Login
  - components/
  - hooks/
  - services/authService
- pos/
  - pages/PosUI
  - components/Cart, ProductLookup, ReceiptModal
  - hooks/useCart, useScanListener
  - services/posService
- products/
  - pages/Products
  - services/productService
- orders/
  - pages/Orders
  - services/orderService
- reports/
  - pages/DailyReport
  - services/reportService
- settings/
  - pages/Settings
  - services/settingsService
'@

# --- DATA MODEL (draft; refine when Firebase added)
$dataModel = @'
# Data Model (Draft)

## Firestore Collections (planned)
- stores/{storeId}
  - name, address, timezone, settings
- users/{userId}
  - role, storeIds[], isActive
- products/{productId}
  - sku, name, category, price, is_active, barcode[], images[]
- orders/{orderId}
  - storeId, cashierId, items[], totals, payment, status, createdAt
- reports/{reportId}
  - storeId, type(daily/cashier), aggregates, createdAt

## Notes
- Use server timestamps
- Index by storeId + createdAt for orders/reports
'@

# --- API CONTRACTS (frontend contracts, even if local for now)
$apiContracts = @'
# API Contracts (Draft)

## productService
- listProducts({ storeId, q, category, limit, cursor })
- getProductByBarcode(barcode)
- upsertProduct(product)

## posService
- addToCart(productId, qty)
- checkout({ paymentMethod, receivedAmount? })
- printReceipt(orderId)

## reportService
- getDailyReport({ storeId, date })
'@

# --- SECURITY (baseline)
$security = @'
# Security Baseline

## Principles
- Default deny in Firestore rules (planned)
- Role-based access: admin/manager/cashier
- Store scoping: user must belong to storeId for reads/writes
- Sensitive ops via Cloud Functions (refunds, admin updates)

## Client
- Never trust client totals; recompute server-side when backend exists
'@

# --- ADR template
$adr000 = @'
# ADR-000: Adopt Feature-First Architecture

## Status
Accepted

## Context
We need modular, scalable POS app with clear boundaries.

## Decision
Use `src/features/<feature>` as main unit of ownership.

## Consequences
- Easier incremental builds
- Services become stable adapters
- Requires discipline on shared code
'@

# --- Runbook: verify
$runVerify = @'
# Runbook: Verify Build

## Commands
- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`

## Expected
- No Tailwind token errors (border-border etc.)
- App loads with theme toggle
'@

Write-TextFile "$root\docs\agents\AGENT_PLAYBOOK.md" $agentOps
Write-TextFile "$root\docs\ARCHITECTURE.md" $architecture
Write-TextFile "$root\docs\MODULE_MAP.md" $moduleMap
Write-TextFile "$root\docs\DATA_MODEL.md" $dataModel
Write-TextFile "$root\docs\API_CONTRACTS.md" $apiContracts
Write-TextFile "$root\docs\SECURITY.md" $security
Write-TextFile "$root\docs\adr\ADR-000-feature-first.md" $adr000
Write-TextFile "$root\docs\runbooks\VERIFY_BUILD.md" $runVerify

Write-Step "DONE ✅ Architecture baseline created."
Write-Host ""
Write-Host "Next step suggested:"
Write-Host "  - Create module skeletons (features/auth, pos, products, orders, reports, settings)"
