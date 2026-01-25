#!/bin/bash
# Automated maintenance orchestrator script

set -e

echo "🔧 Starting Automated Maintenance $(date)"
echo "=================================================="

# Source environment if available
if [ -f ".env" ]; then
    source .env
fi

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to send notification
send_notification() {
    local message="$1"
    local severity="$2"

    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🔧 Maintenance: $message\"}" \
            "$SLACK_WEBHOOK" > /dev/null 2>&1 || true
    fi

    log "$message"
}

# Main automation phases
log "🔍 Analyzing dependencies..."
if python scripts/maintenance_automation.py --analyze-dependencies; then
    log "✅ Dependency analysis completed"
else
    send_notification "Dependency analysis failed" "warning"
fi

log "🔒 Running security scan..."  
if python scripts/maintenance_automation.py --security-scan; then
    log "✅ Security scan completed"
else
    send_notification "Security scan failed" "warning"
fi

log "📦 Checking for automated updates..."
UPDATE_RESULT=$(python scripts/maintenance_automation.py --auto-update 2>&1)
if [ $? -eq 0 ]; then
    if echo "$UPDATE_RESULT" | grep -q "updated"; then
        send_notification "Dependencies updated successfully" "info"
    else
        log "✅ No dependency updates needed"
    fi
else
    send_notification "Dependency update failed: $UPDATE_RESULT" "error"
fi

# Conditional backup (weekly on Sundays)
BACKUP_DAY=$(date +%u)  # 1-7 (Monday-Sunday)
if [ "$BACKUP_DAY" = "7" ] || [ "$FORCE_BACKUP" = "true" ]; then
    log "💾 Creating weekly backup..."
    if python scripts/maintenance_automation.py --backup; then
        send_notification "Weekly backup completed successfully" "info"
    else
        send_notification "Backup failed" "error"
    fi
fi

# Health check
log "🏥 Running health check..."
if python scripts/maintenance_automation.py --health-check; then
    log "✅ Health check passed"
else
    send_notification "Health check failed" "error"
fi

# Cleanup
log "🧹 Cleaning up temporary files..."
find /tmp -name "*backup*" -mtime +7 -delete 2>/dev/null || true
find . -name "*.pyc" -delete 2>/dev/null || true
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

log "🎯 Automated maintenance completed!"

# Generate report if configured
if [ -n "$ADMIN_EMAIL" ]; then
    python scripts/maintenance_automation.py --generate-report --email "$ADMIN_EMAIL"
fi