#!/bin/bash

# Debug Session Logger
# Systematically logs debugging sessions following the 4-phase approach

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SESSION_DIR="debug-sessions"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SESSION_FILE="${SESSION_DIR}/debug_session_${TIMESTAMP}.md"
ISSUE_TITLE=""
ENVIRONMENT=""
LOG_LEVEL="INFO"

# Create session directory if it doesn't exist
mkdir -p "$SESSION_DIR"

# Help function
show_help() {
    echo "Debug Session Logger - Systematic 4-Phase Debugging"
    echo ""
    echo "Usage: $0 [OPTIONS] \"Issue Title\""
    echo ""
    echo "Options:"
    echo "  -e, --env ENV         Environment (dev/staging/prod)"
    echo "  -l, --level LEVEL     Log level (DEBUG/INFO/WARN/ERROR)"
    echo "  -s, --session FILE    Resume existing session"
    echo "  -h, --help            Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 \"User login failing\""
    echo "  $0 -e prod \"API timeout errors\""
    echo "  $0 -s debug_session_20240109_143022.md"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -l|--level)
            LOG_LEVEL="$2"
            shift 2
            ;;
        -s|--session)
            SESSION_FILE="$SESSION_DIR/$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -*)
            echo "Unknown option $1"
            show_help
            exit 1
            ;;
        *)
            ISSUE_TITLE="$1"
            shift
            ;;
    esac
done

# Validate issue title
if [[ -z "$ISSUE_TITLE" && ! -f "$SESSION_FILE" ]]; then
    echo -e "${RED}Error: Issue title is required for new sessions${NC}"
    show_help
    exit 1
fi

# Log entry with timestamp
log_entry() {
    local phase="$1"
    local content="$2"
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")

    echo "" >> "$SESSION_FILE"
    echo "### $timestamp - $phase" >> "$SESSION_FILE"
    echo "" >> "$SESSION_FILE"
    echo "$content" >> "$SESSION_FILE"
    echo "" >> "$SESSION_FILE"

    echo -e "${CYAN}[$(date '+%H:%M:%S')] $phase logged${NC}"
}

# Initialize new debug session
initialize_session() {
    echo -e "${YELLOW}🐛 Starting new debug session...${NC}"
    echo -e "${YELLOW}Issue: $ISSUE_TITLE${NC}"
    echo -e "${YELLOW}Environment: ${ENVIRONMENT:-'Not specified'}${NC}"
    echo -e "${YELLOW}Session file: $SESSION_FILE${NC}"
    echo ""

    cat > "$SESSION_FILE" << EOF
# Debug Session: $ISSUE_TITLE

**Started:** $(date "+%Y-%m-%d %H:%M:%S")
**Environment:** ${ENVIRONMENT:-'Not specified'}
**Log Level:** $LOG_LEVEL

## Issue Description

$ISSUE_TITLE

## 4-Phase Debugging Process

### Phase 1: REPRODUCE 🔴
- [ ] Document exact error/behavior
- [ ] Identify reproduction steps
- [ ] Create minimal test case
- [ ] Verify in different environments

### Phase 2: GATHER 🔍
- [ ] Collect error messages
- [ ] Review logs
- [ ] Check system metrics
- [ ] Identify recent changes

### Phase 3: HYPOTHESIZE 💡
- [ ] List possible causes
- [ ] Prioritize by likelihood
- [ ] Define tests for each
- [ ] Consider environmental factors

### Phase 4: TEST ✅
- [ ] Test hypotheses systematically
- [ ] Document results
- [ ] Implement verified fix
- [ ] Validate resolution

## Session Log

EOF

    echo -e "${GREEN}✓ Session initialized: $SESSION_FILE${NC}"
}

# Phase 1: REPRODUCE
reproduce_phase() {
    echo -e "${RED}🔴 REPRODUCE Phase${NC}"
    echo "Document the problem and reproduction steps"
    echo "================================="

    echo -n "Enter the exact error message or unexpected behavior: "
    read error_description

    echo -n "Steps to reproduce (press Enter for each step, empty line to finish): "
    reproduce_steps=""
    while IFS= read -r line && [[ -n "$line" ]]; do
        reproduce_steps="$reproduce_steps- $line\n"
        echo -n "Next step: "
    done

    echo -n "Environment details (OS, browser, version, etc.): "
    read env_details

    echo -n "Does this reproduce consistently? (yes/no): "
    read consistent

    local content="#### REPRODUCE Phase

**Error/Behavior:** $error_description

**Reproduction Steps:**
$reproduce_steps

**Environment Details:** $env_details

**Consistent Reproduction:** $consistent

**Status:** In Progress"

    log_entry "REPRODUCE" "$content"

    echo -e "${GREEN}✓ Reproduction details logged${NC}"
}

# Phase 2: GATHER
gather_phase() {
    echo -e "${BLUE}🔍 GATHER Phase${NC}"
    echo "Collect evidence and information"
    echo "==============================="

    echo -n "Log file paths to check: "
    read log_paths

    echo -n "Error messages found: "
    read error_messages

    echo -n "Recent changes (code, config, data): "
    read recent_changes

    echo -n "System metrics (CPU, memory, etc.): "
    read system_metrics

    echo -n "External factors (time of day, load, etc.): "
    read external_factors

    local content="#### GATHER Phase

**Log Files Checked:** $log_paths

**Error Messages:** $error_messages

**Recent Changes:** $recent_changes

**System Metrics:** $system_metrics

**External Factors:** $external_factors

**Status:** Evidence collected"

    log_entry "GATHER" "$content"

    echo -e "${GREEN}✓ Evidence gathering logged${NC}"
}

# Phase 3: HYPOTHESIZE
hypothesize_phase() {
    echo -e "${YELLOW}💡 HYPOTHESIZE Phase${NC}"
    echo "Generate and prioritize theories"
    echo "==============================="

    echo "Enter hypotheses (press Enter for each, empty line to finish):"

    hypotheses=""
    counter=1
    while IFS= read -r line && [[ -n "$line" ]]; do
        echo -n "Priority (1-5) for '$line': "
        read priority
        hypotheses="$hypotheses$counter. **$line** (Priority: $priority)\n"
        ((counter++))
        echo -n "Next hypothesis: "
    done

    echo -n "Most likely root cause theory: "
    read likely_cause

    local content="#### HYPOTHESIZE Phase

**Possible Causes:**
$hypotheses

**Most Likely Theory:** $likely_cause

**Status:** Hypotheses generated"

    log_entry "HYPOTHESIZE" "$content"

    echo -e "${GREEN}✓ Hypotheses logged${NC}"
}

# Phase 4: TEST
test_phase() {
    echo -e "${GREEN}✅ TEST Phase${NC}"
    echo "Test hypotheses and implement fixes"
    echo "================================="

    echo -n "Hypothesis being tested: "
    read current_hypothesis

    echo -n "Test method/approach: "
    read test_method

    echo -n "Test result (confirmed/refuted/inconclusive): "
    read test_result

    echo -n "Evidence supporting result: "
    read evidence

    if [[ "$test_result" == "confirmed" ]]; then
        echo -n "Fix implemented: "
        read fix_description

        echo -n "Fix validation method: "
        read validation_method

        echo -n "Issue resolved? (yes/no): "
        read resolved
    else
        fix_description="N/A - Hypothesis not confirmed"
        validation_method="N/A"
        resolved="no"
    fi

    local content="#### TEST Phase

**Hypothesis Tested:** $current_hypothesis

**Test Method:** $test_method

**Result:** $test_result

**Evidence:** $evidence

**Fix Implemented:** $fix_description

**Validation:** $validation_method

**Issue Resolved:** $resolved

**Status:** Testing completed"

    log_entry "TEST" "$content"

    if [[ "$resolved" == "yes" ]]; then
        echo -e "${GREEN}🎉 Issue resolved!${NC}"
        close_session "RESOLVED"
    else
        echo -e "${YELLOW}⚠ Continue testing other hypotheses${NC}"
    fi
}

# Close session
close_session() {
    local status="$1"
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")

    echo "" >> "$SESSION_FILE"
    echo "## Session Conclusion" >> "$SESSION_FILE"
    echo "" >> "$SESSION_FILE"
    echo "**Ended:** $timestamp" >> "$SESSION_FILE"
    echo "**Status:** $status" >> "$SESSION_FILE"
    echo "" >> "$SESSION_FILE"

    if [[ "$status" == "RESOLVED" ]]; then
        echo -n "Root cause summary: "
        read root_cause
        echo -n "Solution summary: "
        read solution
        echo -n "Prevention measures: "
        read prevention

        echo "**Root Cause:** $root_cause" >> "$SESSION_FILE"
        echo "**Solution:** $solution" >> "$SESSION_FILE"
        echo "**Prevention:** $prevention" >> "$SESSION_FILE"

        echo -e "${GREEN}✅ Debug session completed successfully!${NC}"
    else
        echo -e "${YELLOW}⏸ Debug session paused. Resume with: $0 -s $(basename "$SESSION_FILE")${NC}"
    fi
}

# Resume existing session
resume_session() {
    if [[ ! -f "$SESSION_FILE" ]]; then
        echo -e "${RED}Error: Session file not found: $SESSION_FILE${NC}"
        exit 1
    fi

    echo -e "${YELLOW}📁 Resuming session: $SESSION_FILE${NC}"
    echo ""
    echo -e "${CYAN}Current session content:${NC}"
    echo "========================"
    cat "$SESSION_FILE"
    echo "========================"
    echo ""
}

# Interactive menu
show_menu() {
    echo ""
    echo -e "${CYAN}Debug Session Menu${NC}"
    echo "=================="
    echo "1. REPRODUCE - Document and reproduce the issue"
    echo "2. GATHER - Collect evidence and information"
    echo "3. HYPOTHESIZE - Generate theories about root cause"
    echo "4. TEST - Test hypotheses and implement fixes"
    echo "5. Add Note - Add general observation or note"
    echo "6. View Session - Display current session content"
    echo "7. Close Session - Mark session as complete/paused"
    echo "8. Exit - Exit without closing session"
    echo ""
    echo -n "Select phase (1-8): "
    read choice

    case $choice in
        1) reproduce_phase ;;
        2) gather_phase ;;
        3) hypothesize_phase ;;
        4) test_phase ;;
        5) add_note ;;
        6) view_session ;;
        7) close_session_menu ;;
        8) exit 0 ;;
        *) echo -e "${RED}Invalid choice${NC}" ;;
    esac
}

# Add general note
add_note() {
    echo -n "Note category (observation/idea/question/other): "
    read category

    echo -n "Note content: "
    read note_content

    local content="#### Note - $category

$note_content"

    log_entry "NOTE" "$content"
}

# View current session
view_session() {
    if [[ -f "$SESSION_FILE" ]]; then
        echo -e "${CYAN}Current Session Content:${NC}"
        echo "========================"
        cat "$SESSION_FILE"
        echo "========================"
    else
        echo -e "${RED}No session file found${NC}"
    fi
}

# Close session menu
close_session_menu() {
    echo ""
    echo "Session Status:"
    echo "1. RESOLVED - Issue fixed and validated"
    echo "2. PAUSED - Temporarily stopping, will resume later"
    echo "3. ABANDONED - Giving up on this approach"
    echo ""
    echo -n "Select status (1-3): "
    read status_choice

    case $status_choice in
        1) close_session "RESOLVED" ;;
        2) close_session "PAUSED" ;;
        3) close_session "ABANDONED" ;;
        *) echo -e "${RED}Invalid choice${NC}"; return ;;
    esac
}

# Main execution
main() {
    echo -e "${CYAN}🔧 Systematic Debug Session Logger${NC}"
    echo -e "${CYAN}====================================${NC}"

    # Check if resuming existing session
    if [[ -f "$SESSION_FILE" ]]; then
        resume_session
    else
        initialize_session
    fi

    # Interactive menu loop
    while true; do
        show_menu
    done
}

# Run the script
main