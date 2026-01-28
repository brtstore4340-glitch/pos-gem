# Rules for {{SKILL_ID}}

## Must
- Be deterministic and reproducible
- Provide commands to verify
- Prefer minimal diffs
- Explain risks and rollback

## Must Not
- Do not invent file paths
- Do not remove security rules without replacement
- Do not bypass lint/test by disabling rules (unless explicitly approved)

## Output Format
- Sectioned: Findings / Fix / Commands / Verification / Notes
