# Checklist for ci-cd-review

## Before
- [ ] Collect error output (full)
- [ ] Confirm environment (node/npm versions)
- [ ] Identify module boundaries

## Fix
- [ ] Minimal diff
- [ ] No unused vars/imports
- [ ] Follow project conventions

## Verify
- [ ] npm run lint
- [ ] npm run build
- [ ] run relevant deploy (if needed)
- [ ] smoke test key flows

## Deliver
- [ ] Summary + risks + rollback
