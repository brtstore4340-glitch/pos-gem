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
