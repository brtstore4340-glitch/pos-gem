# Boots POS Admin AI Module v1.5.0

**High-performance AI-powered admin module with 3-AI orchestration, RBAC, and safe-mode patching.**

---

## 🎯 Features

### Core Capabilities

- **3-AI Orchestration**: OpenAI GPT-4, Vertex AI Gemini, and Anthropic Claude co-plan and cross-validate
- **2/3 Quorum Requirement**: Changes only apply when at least 2 AIs agree
- **Dynamic Menu Management**: Create/fix/edit menus with full placement control
- **RBAC**: Role-based access control with server-side enforcement
- **Safe-Mode PowerShell Tool**: Backup, dry-run, rollback, and validation
- **Schema Discovery**: Gemini analyzes Firestore structure for optimal implementation

### Safety & Quality

- ✅ Performance Budget: ≤5KB gz, ≤10ms TTI, ≤2 reads/action
- ✅ WCAG AA Accessibility
- ✅ Least-privilege security rules
- ✅ Complete audit logging (PII-safe)
- ✅ Automated build & test validation

---

## 📁 Project Structure

```
boots-pos-ai-module/
├── functions/                    # Cloud Functions (Node 22)
│   ├── src/
│   │   ├── ai/
│   │   │   ├── orchestrator.ts   # Main AI orchestration logic
│   │   │   └── providers/        # AI provider implementations
│   │   │       ├── openai.ts
│   │   │       ├── vertex.ts
│   │   │       └── anthropic.ts
│   │   ├── schema/
│   │   │   └── snapshot.ts       # Firestore schema capture
│   │   ├── rbac/
│   │   │   └── claims.ts         # RBAC management
│   │   ├── types.ts              # TypeScript types (Zod schemas)
│   │   └── index.ts              # Cloud Functions exports
│   ├── package.json
│   └── tsconfig.json
├── src/                          # React Frontend
│   └── components/
│       └── admin/
│           └── AdminAIModule.tsx # Admin UI component
├── firestore-rules/
│   └── firestore.rules           # Security rules
├── powershell/
│   └── pos-ai-safe.ps1           # Safe-mode patch tool
└── config/
    └── .env.template             # Environment configuration
```

---

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 22+
- Firebase CLI
- PowerShell 7+
- npm or yarn

### 2. Installation

```bash
# Clone the repository
cd boots-pos

# Install Cloud Functions dependencies
cd functions
npm install

# Install frontend dependencies
cd ..
npm install
```

### 3. Configuration

```bash
# Copy environment template
cp config/.env.template config/.env

# Edit .env with your API keys
nano config/.env
```

Required API keys:

- **OpenAI**: https://platform.openai.com/api-keys
- **Anthropic**: https://console.anthropic.com/
- **Google Cloud**: Setup service account with Vertex AI access

### 4. Deploy Cloud Functions

```bash
cd functions

# Set environment variables
firebase functions:config:set \
  openai.key="sk-..." \
  anthropic.key="sk-ant-..." \
  vertex.project="boots-pos-project" \
  vertex.location="asia-southeast1"

# Deploy
npm run deploy
```

### 5. Deploy Security Rules

```bash
firebase deploy --only firestore:rules
```

### 6. Test with Emulator

```bash
# Start Firebase emulators
firebase emulators:start

# In another terminal, run frontend
npm run dev
```

---

## 🎮 Usage

### Admin UI

1. Navigate to `/admin/ai-module`
2. Fill in menu configuration:
   - **Label**: Display name (e.g., "Reports")
   - **Route**: URL path (e.g., "/reports")
   - **Placement**: Where to place in navigation
   - **Access**: Who can see it (roles/users)
3. (Optional) Provide AI specification for implementation
4. Click "Create Menu & Generate"
5. Download the patch plan JSON

### PowerShell Patch Tool

#### Dry Run (Recommended First)

```powershell
.\powershell\pos-ai-safe.ps1 -Apply -DryRun -PlanPath .\downloads\patchplan.json
```

#### Apply Changes

```powershell
.\powershell\pos-ai-safe.ps1 -Apply -PlanPath .\downloads\patchplan.json
```

#### Rollback

```powershell
.\powershell\pos-ai-safe.ps1 -Rollback -BackupId "20250107_143022"
```

---

## 🔐 RBAC Configuration

### Default Roles

- `admin`: Full access
- `sm`: Senior Manager
- `sgm`: Senior General Manager
- `manager`: Basic manager access
- `staff`: Staff access

### Menu Access Control

Each menu has three access levels:

```typescript
{
  "access": {
    "defaultRoles": ["admin"],      // Primary roles
    "allowedRoles": ["sm", "sgm"],  // Additional roles
    "allowedUsers": ["user123"]     // Specific users
  }
}
```

### Assigning Roles

Via Cloud Function:

```javascript
const functions = getFunctions();
const assignRole = httpsCallable(functions, "assignRole");

await assignRole({
  uid: "user123",
  roleId: "admin",
});
```

Via Firestore Console:

```json
// Collection: user_roles, Document: {uid}
{
  "roles": ["admin", "manager"],
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

## 🧪 Testing

### Unit Tests

```bash
cd functions
npm test
```

### E2E Tests

```bash
npm run test:e2e
```

### Emulator Testing

```bash
firebase emulators:start
# Access: http://localhost:4000
```

---

## 📊 Monitoring & Logging

### Cloud Logging

```bash
# View function logs
firebase functions:log

# Filter by function
firebase functions:log --only aiOrchestrator
```

### Audit Trail

All AI orchestrations are logged in `ai_audit` collection:

```typescript
{
  "runId": "run_1704629422000_abc123",
  "prompt": "Create a reports module...",
  "responses": [...],        // All 3 AI responses
  "quorumResult": true,      // Whether 2/3 agreed
  "agreedPlan": {...},       // The agreed implementation
  "performanceMetrics": {...},
  "createdAt": "timestamp"
}
```

### Performance Metrics

Monitor in Firebase Console:

- Function execution time
- Cold start latency
- Memory usage
- Firestore read/write counts

---

## 🏗️ Architecture

### Data Flow

```
User → Admin UI → Cloud Function → [OpenAI, Vertex, Anthropic]
                                         ↓
                                    Orchestrator
                                         ↓
                                   2/3 Quorum?
                                    ↙      ↘
                                  YES      NO
                                   ↓        ↓
                            Generate Plan  Reject
                                   ↓
                            PowerShell JSON
                                   ↓
                            pos-ai-safe.ps1
                                   ↓
                            Apply Changes
```

### Firestore Collections

| Collection              | Purpose                     | Access                                  |
| ----------------------- | --------------------------- | --------------------------------------- |
| `ui_menus`              | Menu configurations         | All authenticated (read), Admin (write) |
| `modules`               | Generated modules           | Admin/SM/SGM (read), Admin (write)      |
| `ai_audit`              | AI orchestration logs       | Admin only                              |
| `ai_schema_suggestions` | Gemini schema analysis      | Admin only                              |
| `user_roles`            | User role assignments       | Self/Admin (read), Admin (write)        |
| `roles`                 | Role definitions            | All authenticated (read), Admin (write) |
| `backups`               | PowerShell backups metadata | Admin only                              |

---

## 🔧 Advanced Configuration

### Custom AI Models

Edit `functions/src/ai/providers/`:

```typescript
// openai.ts
model: "gpt-4-turbo-preview"; // Change to gpt-4o, etc.

// vertex.ts
model: "gemini-1.5-pro"; // Change to gemini-ultra, etc.

// anthropic.ts
model: "claude-sonnet-4-20250514"; // Latest model
```

### Performance Tuning

Edit `functions/src/types.ts`:

```typescript
export const DEFAULT_PERF_BUDGET: PerformanceBudget = {
  maxBundleSizeKB: 5, // Adjust as needed
  maxTTIImpactMs: 10, // Adjust as needed
  maxReadsPerAction: 2, // Adjust as needed
};
```

### Schema Override

Provide custom schema during AI generation:

```typescript
const result = await aiOrchestrator({
  spec: "Create reports module",
  overrideSchema: true,
  customSchema: [
    {
      name: "reports",
      mandatory: true,
      fields: [
        { name: "title", type: "string", required: true },
        { name: "data", type: "object", required: true },
      ],
      indexes: ["title", "createdAt DESC"],
    },
  ],
});
```

---

## 🐛 Troubleshooting

### Issue: AI orchestration fails with "Insufficient successful AI responses"

**Solution**: Check API keys and quotas for all three providers.

```bash
# Test individual providers
firebase functions:log --only aiOrchestrator
```

### Issue: PowerShell script fails with "Anchor not found"

**Solution**: Review the patch plan. The code may have changed since generation.

```powershell
# Run dry-run to see what would happen
.\pos-ai-safe.ps1 -Apply -DryRun -PlanPath .\plan.json
```

### Issue: Menu not appearing for user

**Solution**: Check RBAC claims are synced.

```javascript
const syncClaims = httpsCallable(functions, "syncRBACClaims");
await syncClaims({ uid: "user123" });
```

### Issue: Build validation fails after patch

**Solution**: Rollback and review the generated code.

```powershell
# Check logs for backup ID
Get-Content .\logs\*.log | Select-String "Backup created"

# Rollback
.\pos-ai-safe.ps1 -Rollback -BackupId "20250107_143022"
```

---

## 📝 Changelog

### v1.5.0 (2025-01-07)

- ✨ Initial release
- ✅ 3-AI orchestration with quorum
- ✅ Dynamic menu management
- ✅ RBAC with custom claims
- ✅ Safe-mode PowerShell tool
- ✅ Gemini schema discovery
- ✅ Complete audit logging

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

Proprietary - Boots POS Internal Use Only

---

## 🆘 Support

- **Documentation**: This README
- **Issues**: GitHub Issues (internal repo)
- **Email**: dev-team@boots-pos.local
- **Slack**: #boots-pos-dev

---

## 🎖️ Credits

Built with:

- React 18 + Vite
- Firebase (Auth, Firestore, Functions)
- OpenAI GPT-4
- Google Vertex AI Gemini
- Anthropic Claude
- TypeScript
- Tailwind CSS

**Version**: 1.5.0  
**Last Updated**: 2025-01-07
