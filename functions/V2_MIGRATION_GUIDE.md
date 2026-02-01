# V2 Migration Guide (staged, low-risk)

## Current status
This codebase uses v1-style chaining (functions.region(), functions.runWith(), functions.https.*).
After upgrading firebase-functions, keep v1 code working by importing:

  const functions = require("firebase-functions/v1");

This unblocks deploy with minimal behavior change.

## Next step (optional): migrate to v2/2nd-gen one function at a time
- Use modular imports from firebase-functions/v2/*
- Replace callable signature from (data, context) to (request) where request.data / request.auth are used
- Set region globally via setGlobalOptions({ region: "..." }) or per function options

Do NOT bulk-refactor without tests; migrate one function, deploy, verify, repeat.
