# 🚀 Quick Start Guide

**OS Support:** This guide includes commands for **PowerShell 7+ (Windows/Mac/Linux)** and **Bash (macOS/Linux)**. Choose the section matching your shell.

Get the Boots POS AI Module running in 10 minutes!

---

## 1️⃣ Prerequisites Check

```bash
node --version    # Should be 22+
npm --version     # Should be 10+
pwsh --version    # Should be 7+ (for PowerShell tool)
```

Not installed? Get them:
- **Node.js 22**: https://nodejs.org/
- **PowerShell 7**: https://github.com/PowerShell/PowerShell

---

## 2️⃣ Get API Keys

You need 3 API keys:

1. **OpenAI**: https://platform.openai.com/api-keys
   - Create account → API Keys → Create new key
   - Copy: `sk-...`

2. **Anthropic**: https://console.anthropic.com/
   - Create account → API Keys → Create key
   - Copy: `sk-ant-...`

3. **Google Cloud / Vertex AI**:
   - Go to: https://console.cloud.google.com/
   - Create project → Enable Vertex AI API
   - Create Service Account → Download JSON key

---

## 3️⃣ Install & Configure

```bash
# Clone or navigate to project
cd boots-pos-ai-module

# Install dependencies
npm install
cd functions && npm install && cd ..

# Copy environment template
# PowerShell (Windows/Mac/Linux):
Copy-Item -Path "config/.env.template" -Destination "config/.env"
# Bash (macOS/Linux):
# cp config/.env.template config/.env

# Edit config/.env with your preferred editor:
# Windows/PowerShell: notepad config/.env
# macOS: nano config/.env  OR  open -e config/.env
# Linux: nano config/.env  OR  vim config/.env
```

In `.env`, set:
```env
OPENAI_API_KEY=sk-your-key
ANTHROPIC_API_KEY=sk-ant-your-key
VERTEX_PROJECT=your-gcp-project-id
VERTEX_LOCATION=asia-southeast1
```

---

## 4️⃣ Test with Firebase Emulator

```bash
# Start emulators
firebase emulators:start

# Should see:
# ✔  All emulators ready!
# ┌────────────┬────────────────┬─────────────────────────────────┐
# │ Emulator   │ Host:Port      │ View in Emulator Suite          │
# ├────────────┼────────────────┼─────────────────────────────────┤
# │ Auth       │ 127.0.0.1:9099 │ http://127.0.0.1:4000/auth      │
# │ Functions  │ 127.0.0.1:5001 │ http://127.0.0.1:4000/functions │
# │ Firestore  │ 127.0.0.1:8080 │ http://127.0.0.1:4000/firestore │
# └────────────┴────────────────┴─────────────────────────────────┘
```

In another terminal:
```bash
# Run frontend
npm run dev

# Access: http://localhost:5173
```

---

## 5️⃣ Create Your First AI Menu

1. Navigate to: `http://localhost:5173/admin/ai-module`
2. Fill in:
   - **Label**: "Reports"
   - **Route**: "/reports"
   - **Placement**: "Append End"
   - **Spec**: "Create a sales reports page with a table showing daily sales"
3. Click **"Create Menu & Generate"**
4. Wait 20-45 seconds for AI orchestration
5. Click **"Download PowerShell Patch Plan"**

---

## 6️⃣ Apply Changes with PowerShell

**PowerShell 7+ (all platforms):**
```powershell
# Dry run first (recommended)
.\powershell\pos-ai-safe.ps1 -Apply -DryRun -PlanPath .\downloads\patchplan.json

# Review output, then apply
.\powershell\pos-ai-safe.ps1 -Apply -PlanPath .\downloads\patchplan.json

# Backup created: 20250107_143022
# To rollback: .\pos-ai-safe.ps1 -Rollback -BackupId "20250107_143022"
```

---

## 7️⃣ Verify It Works

Refresh your browser - you should see:
- New "Reports" menu item in navigation
- Clicking it shows the new reports page
- All working! 🎉

---

## 🆘 Troubleshooting

### "API key not found"
- Check `.env` file has correct keys
- Restart emulator after changing .env

### "Quorum not met"
- One or more AI providers failed
- Check API key validity
- Check internet connection
- View logs: `firebase functions:log`

### PowerShell tool fails
- Ensure PowerShell 7+ installed
- Run as Administrator if needed
- Check file paths are correct

### Menu doesn't appear
- Check RBAC - is user admin?
- Sync claims:
```javascript
const sync = httpsCallable(functions, 'syncRBACClaims');
await sync({ uid: 'your-uid' });
```

---

## 📚 Next Steps

- Read full [README.md](README.md)
- Review [DEPLOYMENT.md](DEPLOYMENT.md) for production
- Check [CHANGELOG.md](CHANGELOG.md) for updates
- Explore example plans in `config/`

---

## 💡 Pro Tips

1. **Always dry-run first**: `.\pos-ai-safe.ps1 -Apply -DryRun`
2. **Keep backups**: PowerShell tool auto-creates them
3. **Monitor logs**: `firebase functions:log --only aiOrchestrator`
4. **Test in emulator**: Before deploying to production
5. **Use clear specs**: Better specs = better AI results

---

**That's it! You're now running the AI Module! 🚀**

Questions? Check the [README.md](README.md) or contact dev-team@boots-pos.local
