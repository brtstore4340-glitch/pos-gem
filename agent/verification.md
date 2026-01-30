# Verification Contract – Boots-POS Gemini

A fix is considered DONE only if:

- npm run lint
  - exits with code 0 OR
  - known warnings are documented and accepted

- npm run build
  - exits with code 0

- npm run guard:build
  - used as final confirmation

If any step fails:
- The agent must stop
- Report failure + logs
- Propose next action (do NOT guess)

