# Security Baseline

## Principles
- Default deny in Firestore rules (planned)
- Role-based access: admin/manager/cashier
- Store scoping: user must belong to storeId for reads/writes
- Sensitive ops via Cloud Functions (refunds, admin updates)

## Client
- Never trust client totals; recompute server-side when backend exists
