# SKILL: {{SKILL_ID}}

## Purpose
Describe what this skill does in 1-2 sentences.

## When to Use
- Conditions that trigger this skill

## Inputs
- Task: (string) what to do
- Context: (paths/logs/snippets) relevant artifacts
- Constraints: (time, tools, policies)

## Outputs
- Primary output (patch plan, code changes, checklist, report, etc.)
- Secondary output (commands to run, verification steps)

## Tooling
- Allowed: bash/pwsh, node, python
- Optional: lint/build/test runners

## Procedure (Gold Standard)
1) Intake & reproduce
2) Root cause
3) Minimal safe fix
4) Verification
5) Cleanup & documentation

## Guardrails
- What NOT to do (avoid risky refactors, do not change behavior without tests, etc.)

## Acceptance Criteria
- Build passes
- Lint passes
- Tests pass (if any)
- No new warnings introduced
