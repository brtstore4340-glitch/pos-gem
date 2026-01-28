# SKILL: firebase-secure

## Purpose
Implement Firebase Auth/Firestore/Functions securely (env, rules, safe writes).

## When to Use
- When the task matches: Firebase Secure Implementation

## Inputs
- Task: (string) what to do
- Context: (logs, stack traces, file paths, snippets)
- Constraints: (must keep behavior, must pass lint/build, security limits)

## Outputs
- Fix plan + exact edits (file-by-file)
- Commands to verify (PowerShell preferred)
- Risk notes + rollback steps

## Tooling
- Primary: PowerShell, Node.js (npm), Git
- Secondary: Python (optional)

## Procedure (Gold Standard)
1) Reproduce / confirm error (command + expected output)
2) Identify root cause (single sentence + evidence)
3) Apply minimal patch (small diff)
4) Verify (lint/build/test)
5) Cleanup (remove unused imports, format, docs)
6) Provide PR-ready summary

## Guardrails
- Avoid broad refactors unless necessary
- Never disable lint/test as “fix” without explicit approval
- Keep changes localized; prefer small commits

## Acceptance Criteria
- npm run lint passes
- npm run build passes
- Feature still works (smoke test)
