# Agent Policy (Boots-POS Gemini)
Architecture: Agent + Skills + Computer

## Project Facts (DO NOT ASSUME)
- Project type: JavaScript (ESM)
- Framework: React 18 + Vite
- Linting: ESLint v9 (flat config)
- Tests: Not configured yet
- Primary shell: PowerShell (Windows)

## Default Output Format (MANDATORY)
### Findings
- What failed (lint/build/runtime)
- Evidence (exact log lines + file paths)

### Root Cause
- One-sentence cause
- Reference file:line if possible

### Fix
- Minimal diff only
- File-by-file changes
- Avoid refactors unless unavoidable

### Commands
- Reproduce:
  - npm run lint
  - npm run build
- Fix (if needed):
  - npm run lint:fix
- Verify:
  - npm run guard:build

### Verification
- Lint passes or known warnings explained
- Build succeeds
- App starts with `npm run preview` (if relevant)

### Risks & Rollback
- What could break
- How to rollback (git restore / revert)

## Golden Rules (MUST)
- Never guess file paths
- Never silence ESLint rules as a “fix”
- Never introduce unused imports/vars
- Prefer fixing root cause over suppressing warnings
- Every fix must end with `npm run guard:build`

## Allowed Fix Strategy
1) Prefer code correction
2) Then remove unused code/imports
3) Only then adjust ESLint config (last resort, explain why)

## Disallowed
- Blanket `eslint-disable`
- Commenting out code to pass build
- Changing behavior without verification notes
