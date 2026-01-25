# State 1.0 / 1.1 Blueprint (Thin Client, Fat Server)

## Scope

- Focus on root app (`src/`, `functions/`). Treat `pos-gem/` as legacy duplicate to archive later.
- Firebase Hosting serves `dist/`; Cloud Functions is the source of truth for cart, pricing, RBAC.

## Backend (Cloud Functions)

- Runtime: Node 20, CJS; entry [`functions/index.js`](../functions/index.js:1).
- Add [`functions/package.json`](../functions/package.json:1) with `firebase-admin`, `firebase-functions`.
- Region: `asia-southeast1` for all callables/triggers.
- Shared constants: [`shared/constants.js`](../shared/constants.js:1).

### Callable APIs (v1)

1. **scanItem**
   - Request: `{ sku: string }
   - Auth: required; verify `context.auth.uid` + role check against `users/{uid}.role`.
   - Response: `{ id, sku, name, price, vatRate?, promoMethod?, promoDealQty?, promoDealPrice?, isActive }

2. **calculateOrder**
   - Request: `{ items: [{ sku, qty, price?, promoMethod?, promoDealQty?, promoDealPrice?, manualDiscountPercent? }], billDiscountPercent?: number, coupons?: [{ code, couponValue }], allowance?: number, topup?: number }
   - Auth: required.
   - Logic: delegate to cart service for promo → manual item discount → bill discount → coupons → allowance → topup; return VAT breakdown.
   - Response: `{ items: [{ sku, qty, calculatedTotal, badgeText?, promoDiscount, manualDiscountAmount }], summary: { totalItems, subtotal, vatTotal, grandTotal, discountBreakdown } }`

3. **Planned next** (stub contracts for State 1.2): `voidBill`, `applyDiscount`, `saveInvoice`, `getDailyReport`. All enforce RBAC via `users/{uid}.role` (e.g., cashier, supervisor, admin).

### Data Model (Firestore)

- `products` (source of truth for price/promo flags; indexed by `sku`, `barcode`, `keywords`).
- `invoices` (immutable sales; `status: paid|void`; store computed summary + line items snapshot).
- `users` (authz: role, store, permissions flags like `canVoid`, `maxDiscountPct`).
- `settings` (e.g., VAT rate, store metadata).
- `stockLedger` (optional for future: movement records per SKU).

### Security (high level rules outline)

- Allow public read of `products` only if `isActive == true` and `ProductStatus` starts with `0`; writes restricted to admins.
- `invoices`: read limited to authenticated users; write via Functions only; client direct writes denied.
- `users`: read/write restricted to admin; cashier can read own profile only.
- Callable functions: reject if unauthenticated; check `users/{uid}` role before privileged ops (void/discount/report).

## Frontend (Thin Client)

- Keyboard-first: hidden scanner input kept focused; hotkeys `F12` checkout, `Esc` cancel modal, `Ctrl+/` search. Use [`useScanListener`](../src/hooks/useScanListener.js:1) as focus lock; add debounce/submit on Enter.
- Optimistic UI: render line add/remove immediately; confirm with Functions; rollback on rejection with toast and state revert.
- Service layer: route all pricing/cart ops through `src/services/posService` wrappers that call Functions (not Firestore direct). Keep Firestore reads for search/lookup only if allowed by rules.

### Migration plan (cart logic to server)

- Move promotion & totals from [`src/services/promotionEngine.js`](../src/services/promotionEngine.js:1) and [`src/hooks/useCart.js`](../src/hooks/useCart.js:1) into `functions/src/services/cartService.js`.
- Frontend `useCart` becomes a thin state holder + optimistic pending markers; totals sourced from Function response.
- `posService.scanItem` should call callable `scanItem`; remove direct Firestore reads for price/stock to honor “client not source of truth”.

## CI/CD (outline)

- `.github/workflows/hosting.yml`: build React (npm ci, npm run build) → deploy hosting only.
- `.github/workflows/functions.yml`: npm ci in `functions/` → lint/test → `firebase deploy --only functions --project $PROJECT_ID --force`.
- Use env/secrets: `FIREBASE_SERVICE_ACCOUNT`, `PROJECT_ID`, `REGION=asia-southeast1`.

## Next milestones

- State 1.2: finalize Firestore schema + security rules + indexes; implement calculateOrder server logic parity with client promo rules.
- State 1.3: POS UI flows (keyboard map, focus lock, optimistic rollback patterns), modal/receipt/report UX.
