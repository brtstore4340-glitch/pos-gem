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
