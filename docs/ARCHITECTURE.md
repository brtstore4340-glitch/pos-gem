# Architecture (Boots POS Gemini)

## Stack
- Frontend: React + Vite
- UI: Tailwind Design System (semantic tokens + CVA components)
- Data: (planned) Firebase (Auth + Firestore + Storage + Functions)
- State: local state + feature stores (to be chosen when modules land)

## Module Boundaries (feature-first)
- `src/features/auth` (login, roles, session)
- `src/features/pos` (cart, scan, checkout, receipt)
- `src/features/products` (catalog, search, pricing, stock)
- `src/features/orders` (order history, refunds, status)
- `src/features/reports` (daily report, cashier report)
- `src/features/settings` (store profile, devices, printers)
Shared:
- `src/components/ui` (Design System)
- `src/services` (API/Firebase gateways)
- `src/lib` (utils, validations)
- `src/stores` (app-wide stores)

## Principles
- Feature ownership: UI + logic + service adapter per feature
- Services are adapters: no UI imports in services
- Design tokens only: no hardcoded colors in components
- Typed contracts (later if migrate to TS)
