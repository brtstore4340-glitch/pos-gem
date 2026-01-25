# =============================================================================

# RUN THIS IN REPO ROOT (PowerShell script will auto-detect via $PSScriptRoot)

# Creates:

# .\@PRD.md

# .\scripts\powershell\validate-ps.ps1

# Then validates PowerShell syntax before you run anything else.

# =============================================================================

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
New-Item -ItemType Directory -Path ".\scripts\powershell" -Force | Out-Null

@'

# Boots POS v1.5.0 – Dynamic Firestore Menus Integration PRD (@PRD.md)

## 1) Summary

Implement dynamic navigation menus backed by Firestore collection `ui_menus` (SSOT). The client will:

- Read `ui_menus` with **pagination** (`limit + startAfter`)
- Apply **RBAC filtering** using Firebase Auth **custom claims roles**
- Apply **placement rules** (`append_end | before_ref | after_ref | at_index`) and `group` (`primary|secondary|admin`)
- Merge dynamic menus with existing static menus
- Maintain performance budgets (<= 2 reads/action, minimal UI impact)

This PRD covers the step required to make "menus created in Firestore" actually appear in the UI.

## 2) Goals (Must)

- Display Firestore-driven menus in nav (merged with current static items)
- Efficient Firestore I/O:
  - paginated read (`limit`, `startAfter`)
  - compact payload mapping (use only needed fields)
- Enforce RBAC twice:
  - client filters menus based on claims + allowedUsers
  - server-side security rules enforce writes (admin only)
- Provide PowerShell-first run instructions
- Add ESLint and run lint with `--max-warnings=0` (requested “--eslint” requirement)

## 3) Non-Goals (Won’t for this step)

- No AI Orchestrator UI generation flow in this PRD
- No schema discovery UI
- No menu admin CRUD UI (covered elsewhere)

## 4) User Stories

- As an admin, when I create a new `ui_menus/{menuId}` document, the menu appears in the nav in the correct group and position.
- As a non-admin user, I cannot see menus I am not allowed to access.
- As an engineer, I can verify correctness via emulator + lint + build.

## 5) Data Model (SSOT)

Collection: `ui_menus/{menuId}`

Fields used by client (compact):

- label (string)
- route (string)
- enabled (boolean)
- order (number)
- placement: { mode, refId, index, group }
- access: { defaultRoles, allowedRoles, allowedUsers }

## 6) Security & RBAC

### Client-side filtering

- Read roles from `getIdTokenResult(true).claims.roles` (no extra Firestore read).
- A menu is allowed if:
  - `allowedUsers` includes uid, OR
  - any of user roles is in `defaultRoles ∪ allowedRoles`

### Firestore Rules (minimum for this step)

- `ui_menus`: read = authenticated users; write = admin only

## 7) Performance / Quality Bars

- <= 2 Firestore reads per nav-load action:
  - 1 read for ui_menus (first page)
  - 0 extra reads for roles (claims only)
- ESLint enforced with `--max-warnings=0`
- No client-side secrets
- No large bundles added (menu loader code is small; no heavy deps)

## 8) Implementation Plan (PowerShell-first)

### 8.1 Add ESLint (required “--eslint”)

Run in repo root:

```powershell
# Navigate to repo root (auto-detected or from $env:REPO_ROOT if set)
# For portable scripts: Set-Location (Split-Path -Parent $PSScriptRoot)

# Install ESLint tooling (adjust versions as your repo policy)
npm i -D eslint eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y

# Create config if none exists:
# If you already have eslint config, skip init and just ensure scripts exist.
npx eslint --init
```
