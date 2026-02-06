# Requirements for POS-GEM (Rebuild v2)

## 1) Goal & Success Criteria (1-page definition)
**Primary goal:** Rebuild the POS-GEM system so it is **faster, more stable, easier to extend**, and **architecturally cleaner** than the current version.

**Success criteria (measurable):**
- **Performance:** Core POS flows (search → add to cart → checkout) must complete within defined latency budgets. (Define exact budgets in the NFR section below.)
- **Stability:** No unhandled runtime errors in core flows; error rates and retries tracked.
- **Extensibility:** New feature modules can be added without modifying existing modules (except shared interfaces).
- **Operational readiness:** Reproducible build/deploy with clear runbooks and rollback path.

## 2) Users & Use Cases
### Users
- **Cashier/Staff:** operate POS, scan/search items, take payments, print receipts.
- **Supervisor/Manager:** view reports, manage catalogs, audit transactions.
- **Admin/Owner:** configure store, manage roles, monitor system health.

### Critical use cases
1. **Login & role-based access** (admin/manager/cashier).
2. **Product search & scan** (barcode and keyword).
3. **Cart & checkout** with payment and receipt output.
4. **Orders history / refund flow** (if enabled).
5. **Daily/cashier reports** with filters.
6. **Excel data import** (bulk upload) and update pipelines.

## 3) Architecture Requirements
### 3.1 Modular boundaries (feature-first)
Must preserve **feature-first** structure and clearly separated responsibilities:
- **features/** for user-facing modules (pos, products, orders, reports, settings, auth).
- **services/** for data access + external integration.
- **lib/** for shared utilities and validation.
- **components/ui/** for design system and reusable UI building blocks.

### 3.2 Dependency flow
Dependencies must be **one-way**:
```
core (lib, config) → services → features (UI + hooks) → app shell/router
```
No cross-feature imports except through shared interfaces.

### 3.3 Provider abstraction
All external providers (Firestore/Functions/Storage or alternatives) must be behind **interfaces**, allowing provider swap without business logic changes.

### 3.4 Config as source of truth
Runtime behavior must be driven via **config** (env + config module), not hardcoded in features.

## 4) Data & RAG/ETL Requirements (if applicable)
### 4.1 Excel ingestion pipeline
- Support **.xlsx and .xls** uploads as a first-class flow.
- File ingestion must **inspect file name patterns** to determine target dataset/database automatically.
- Reading/processing cost must be tracked; minimize re-reads and support incremental parsing.
- Admin/Manager can **select which fields/columns** to expose in reports.
- Indexing strategy must ensure report queries are fast and stable.

### 4.2 Data pipeline
- Data import/update must be **reproducible**, with versioned artifacts.
- Delta updates must be deterministic and traceable.

### 4.3 Schema & contracts
- Define data schemas with validation (runtime + typed contract).
- All service outputs must follow documented API contracts.

### 4.4 Traceability
- Each derived output must reference data sources and transformation steps.

## 5) Performance, Reliability, and Scalability
### 5.1 Performance budgets
Define and enforce budgets for:
- Search latency (p95)
- Checkout end-to-end (p95)
- Report generation (p95)

### 5.2 Reliability
- Graceful error handling with user-safe messages.
- Retries and circuit breakers on external calls.
- Offline-safe or degraded modes for read-only when provider is down (if feasible).

### 5.3 Scalability
- Pagination and batching for all bulk operations.
- Cache policies (TTL, invalidation rules) documented.

## 6) Security & Compliance
- Role-based access enforced on both client and server.
- Sensitive actions (refunds, admin changes) must be server-side validated.
- Secrets are never stored in repo; use env/config management.
- Audit logs for critical actions.

## 7) Observability & Operations
### 7.1 Logging & tracing
- Structured logs with correlation ID across UI → services → backend.
- Capture performance metrics and error rates by feature.

### 7.2 Runbooks
Provide runbooks for:
- Deploy
- Rollback
- Reindex/reimport data
- Incident response

### 7.3 Cost monitoring
Track and alert on cost metrics (reads/writes/compute).

## 8) Testing & Quality Gates
### 8.1 Tests
- **Unit tests** for utilities and services.
- **Integration tests** for data import + core flows.
- **E2E tests** for login → checkout → report.

### 8.2 Regression suite
- Golden scenarios (Q&A / flows) must pass on every build.

### 8.3 CI/CD gates
- Lint + typecheck + test + build required before merge.

## 9) UX & UI Standards
- Design system tokens only (no ad-hoc colors).
- Consistent accessibility (keyboard flow, contrast).
- Loading, empty, and error states for every core view.

## 10) Deliverables
1. **Architecture doc** with diagrams and dependency boundaries.
2. **API contracts** with versioned schemas.
3. **Data model** with validation rules.
4. **Runbooks** for ops tasks.
5. **Test suites** + CI pipeline.
6. **Decision log** for major tradeoffs.

## 11) Acceptance Criteria (Minimum)
The rebuild is accepted only when:
- All core flows work with defined performance budgets.
- CI/CD passes required gates.
- Runbooks exist and are verified.
- Modular boundaries are respected (no forbidden imports).
- Provider swap is possible by changing only configuration and adapter layer.
