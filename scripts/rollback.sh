#!/bin/bash

# Courtesy Inspection - Emergency Rollback Script
# Fast rollback to previous stable deployment

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROLLBACK_LOG="/tmp/courtesy-inspection-rollback-$(date +%Y%m%d-%H%M%S).log"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$ROLLBACK_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$ROLLBACK_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$ROLLBACK_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$ROLLBACK_LOG"
    exit 1
}

# Help function
show_help() {
    cat << EOF
Courtesy Inspection Emergency Rollback Script

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment    Target environment (staging|production)
    -f, --force          Force rollback without confirmation
    -r, --restore-db     Restore database from backup
    -i, --info           Show rollback information only
    -v, --verbose        Verbose output
    -h, --help          Show this help message

EXAMPLES:
    $0 -e production                # Rollback production to previous deployment
    $0 -e production -r             # Rollback with database restore
    $0 -e staging -f                # Force rollback staging without confirmation
    $0 -i                           # Show available rollback information

EOF
}

# Default values
ENVIRONMENT=""
FORCE_ROLLBACK=false
RESTORE_DATABASE=false
INFO_ONLY=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -f|--force)
            FORCE_ROLLBACK=true
            shift
            ;;
        -r|--restore-db)
            RESTORE_DATABASE=true
            shift
            ;;
        -i|--info)
            INFO_ONLY=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            ;;
    esac
done

# Function to show available rollback information
show_rollback_info() {
    log "Available rollback information:"
    echo
    
    # Check for staging rollback info
    if [[ -f "/tmp/courtesy-inspection-rollback-info.json" ]]; then
        echo -e "${GREEN}Recent Deployment Info:${NC}"
        cat "/tmp/courtesy-inspection-rollback-info.json" | jq '.'
        echo
    fi
    
    # Check for environment-specific rollback info
    for env in staging production; do
        rollback_file="/tmp/courtesy-inspection-rollback-info-$env.json"
        if [[ -f "$rollback_file" ]]; then
            echo -e "${GREEN}$env Environment:${NC}"
            cat "$rollback_file" | jq '.'
            echo
        fi
    done
    
    # Check for backup files
    echo -e "${GREEN}Available Backups:${NC}"
    for backup_file in /tmp/courtesy-inspection-backup-*.txt; do
        if [[ -f "$backup_file" ]]; then
            env_name=$(basename "$backup_file" .txt | sed 's/courtesy-inspection-backup-//')
            backup_id=$(cat "$backup_file")
            echo "$env_name: $backup_id"
        fi
    done
    
    if [[ "$INFO_ONLY" == "true" ]]; then
        exit 0
    fi
}

# Validate environment parameter
if [[ -z "$ENVIRONMENT" && "$INFO_ONLY" == "false" ]]; then
    log_error "Environment parameter is required. Use -e staging or -e production"
fi

if [[ -n "$ENVIRONMENT" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    log_error "Environment must be either 'staging' or 'production'"
fi

# Set environment-specific variables
if [[ "$ENVIRONMENT" == "production" ]]; then
    RAILWAY_SERVICE="courtesy-inspection-api"
    RAILWAY_ENV="production"
    API_URL="https://api.courtesy-inspection.com"
    RESTORE_DATABASE=true  # Always consider DB restore for production
else
    RAILWAY_SERVICE="courtesy-inspection-api"
    RAILWAY_ENV="staging"
    API_URL="https://staging.courtesy-inspection.railway.app"
fi

# Show info if requested
if [[ "$INFO_ONLY" == "true" ]]; then
    show_rollback_info
fi

log "Starting emergency rollback for $ENVIRONMENT environment"
log "Rollback log: $ROLLBACK_LOG"

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Railway CLI is installed
    if ! command -v railway &> /dev/null; then
        log_error "Railway CLI is not installed. Please install it first."
    fi
    
    # Check if logged into Railway
    if ! railway whoami &> /dev/null; then
        log_error "Not logged into Railway. Please run 'railway login' first."
    fi
    
    # Check if jq is available for JSON processing
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed. Please install it for JSON processing."
    fi
    
    log_success "Prerequisites check passed"
}

# Function to load rollback information
load_rollback_info() {
    log "Loading rollback information..."
    
    # Try to find rollback info file
    ROLLBACK_INFO_FILE=""
    
    # Check for environment-specific file first
    if [[ -f "/tmp/courtesy-inspection-rollback-info-$ENVIRONMENT.json" ]]; then
        ROLLBACK_INFO_FILE="/tmp/courtesy-inspection-rollback-info-$ENVIRONMENT.json"
    elif [[ -f "/tmp/courtesy-inspection-rollback-info.json" ]]; then
        ROLLBACK_INFO_FILE="/tmp/courtesy-inspection-rollback-info.json"
    else
        log_error "No rollback information found. Cannot proceed with rollback."
    fi
    
    # Validate rollback info file
    if ! jq empty "$ROLLBACK_INFO_FILE" 2>/dev/null; then
        log_error "Rollback information file is corrupted: $ROLLBACK_INFO_FILE"
    fi
    
    # Extract rollback information
    ROLLBACK_ENVIRONMENT=$(jq -r '.environment' "$ROLLBACK_INFO_FILE")
    PREVIOUS_DEPLOYMENT=$(jq -r '.pre_deployment.deployment_id' "$ROLLBACK_INFO_FILE")
    PREVIOUS_COMMIT=$(jq -r '.pre_deployment.commit' "$ROLLBACK_INFO_FILE")
    PREVIOUS_COMMIT_SHORT=$(jq -r '.pre_deployment.commit_short' "$ROLLBACK_INFO_FILE")
    BACKUP_ID=$(jq -r '.backup_info.backup_id' "$ROLLBACK_INFO_FILE")
    
    # Validate environment matches
    if [[ "$ROLLBACK_ENVIRONMENT" != "$ENVIRONMENT" ]]; then
        log_warning "Rollback info is for $ROLLBACK_ENVIRONMENT but rolling back $ENVIRONMENT"
    fi
    
    log_success "Rollback information loaded"
    log "Previous deployment: $PREVIOUS_DEPLOYMENT"
    log "Previous commit: $PREVIOUS_COMMIT_SHORT"
    log "Backup ID: $BACKUP_ID"
}

# Function to verify current system state
verify_current_state() {
    log "Verifying current system state..."
    
    # Get current deployment status
    CURRENT_STATUS=$(railway status --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENV" --json)
    CURRENT_DEPLOYMENT=$(echo "$CURRENT_STATUS" | jq -r '.deployment.id')
    CURRENT_STATE=$(echo "$CURRENT_STATUS" | jq -r '.deployment.status')
    
    log "Current deployment: $CURRENT_DEPLOYMENT"
    log "Current state: $CURRENT_STATE"
    
    # Check if system is currently healthy
    if curl -f "$API_URL/api/health" > /dev/null 2>&1; then
        log_warning "System appears to be healthy. Are you sure you want to rollback?"
        if [[ "$FORCE_ROLLBACK" == "false" ]]; then
            read -p "Continue with rollback? (yes/no): " -r
            if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
                log "Rollback cancelled by user"
                exit 0
            fi
        fi
    else
        log "System is unhealthy, proceeding with rollback"
    fi
}

# Function to notify start of rollback
notify_rollback_start() {
    log "Notifying stakeholders of rollback start..."
    
    # Send Slack notification if webhook is configured
    if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"text\": \"🚨 EMERGENCY ROLLBACK INITIATED for Courtesy Inspection $ENVIRONMENT\",
                \"attachments\": [{
                    \"color\": \"warning\",
                    \"fields\": [
                        {\"title\": \"Environment\", \"value\": \"$ENVIRONMENT\", \"short\": true},
                        {\"title\": \"Rolling back to\", \"value\": \"$PREVIOUS_COMMIT_SHORT\", \"short\": true},
                        {\"title\": \"Initiated by\", \"value\": \"$(whoami)\", \"short\": true},
                        {\"title\": \"Restore DB\", \"value\": \"$RESTORE_DATABASE\", \"short\": true}
                    ]
                }]
            }" "$SLACK_WEBHOOK" || log_warning "Failed to send Slack notification"
    fi
    
    log_success "Rollback start notification sent"
}

# Function to restore database
restore_database() {
    if [[ "$RESTORE_DATABASE" == "false" ]]; then
        log "Skipping database restore"
        return
    fi
    
    if [[ "$BACKUP_ID" == "null" || "$BACKUP_ID" == "none" || -z "$BACKUP_ID" ]]; then
        log_warning "No backup ID available, skipping database restore"
        return
    fi
    
    log "Restoring database from backup: $BACKUP_ID"
    
    # Create a new backup before restore (safety measure)
    log "Creating safety backup before restore..."
    SAFETY_BACKUP=$(railway run "npm run db:backup" --service courtesy-inspection-db --environment "$RAILWAY_ENV" | tail -n 1)
    log "Safety backup created: $SAFETY_BACKUP"
    
    # Restore from backup
    railway run "npm run db:restore $BACKUP_ID" --service courtesy-inspection-db --environment "$RAILWAY_ENV"
    
    log_success "Database restored from backup"
}

# Function to rollback deployment
rollback_deployment() {
    log "Rolling back deployment..."
    
    # Use Railway's rollback functionality
    railway rollback --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENV"
    
    log_success "Deployment rollback initiated"
}

# Function to wait for rollback completion
wait_for_rollback() {
    log "Waiting for rollback to complete..."
    
    max_attempts=20
    attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        # Check deployment status
        CURRENT_STATUS=$(railway status --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENV" --json)
        DEPLOYMENT_STATE=$(echo "$CURRENT_STATUS" | jq -r '.deployment.status')
        
        if [[ "$DEPLOYMENT_STATE" == "SUCCESS" ]]; then
            log_success "Rollback deployment completed"
            break
        elif [[ "$DEPLOYMENT_STATE" == "FAILED" ]]; then
            log_error "Rollback deployment failed"
        fi
        
        attempt=$((attempt + 1))
        log "Rollback attempt $attempt/$max_attempts, status: $DEPLOYMENT_STATE"
        sleep 15
    done
    
    if [[ $attempt -eq $max_attempts ]]; then
        log_error "Rollback did not complete within expected time"
    fi
}

# Function to verify rollback success
verify_rollback() {
    log "Verifying rollback success..."
    
    # Wait for service to be ready
    sleep 30
    
    # Health check with retries
    max_attempts=10
    attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -f "$API_URL/api/health" > /dev/null 2>&1; then
            log_success "Health check passed after rollback"
            break
        else
            attempt=$((attempt + 1))
            if [[ $attempt -eq $max_attempts ]]; then
                log_error "Health check failed after rollback"
            fi
            log "Health check attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
            sleep 10
        fi
    done
    
    # Verify system functionality
    log "Testing critical endpoints..."
    
    # Test auth endpoint
    if curl -f "$API_URL/api/auth/health" > /dev/null 2>&1; then
        log_success "Auth endpoint is healthy"
    else
        log_warning "Auth endpoint is not responding"
    fi
    
    # Test database connection
    if curl -f "$API_URL/api/health/database" > /dev/null 2>&1; then
        log_success "Database connection is healthy"
    else
        log_warning "Database connection failed"
    fi
}

# Function to save rollback record
save_rollback_record() {
    log "Saving rollback record..."
    
    ROLLBACK_RECORD="/tmp/courtesy-inspection-rollback-record-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$ROLLBACK_RECORD" << EOF
{
    "rollback_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "initiated_by": "$(whoami)",
    "reason": "Emergency rollback",
    "previous_deployment": "$CURRENT_DEPLOYMENT",
    "rolled_back_to": "$PREVIOUS_DEPLOYMENT",
    "rolled_back_commit": "$PREVIOUS_COMMIT_SHORT",
    "database_restored": $RESTORE_DATABASE,
    "backup_used": "$BACKUP_ID",
    "safety_backup": "${SAFETY_BACKUP:-none}",
    "rollback_log": "$ROLLBACK_LOG"
}
EOF
    
    log_success "Rollback record saved: $ROLLBACK_RECORD"
}

# Function to notify rollback completion
notify_rollback_completion() {
    log "Notifying stakeholders of rollback completion..."
    
    # Send Slack notification if webhook is configured
    if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"text\": \"✅ ROLLBACK COMPLETED for Courtesy Inspection $ENVIRONMENT\",
                \"attachments\": [{
                    \"color\": \"good\",
                    \"fields\": [
                        {\"title\": \"Environment\", \"value\": \"$ENVIRONMENT\", \"short\": true},
                        {\"title\": \"Rolled back to\", \"value\": \"$PREVIOUS_COMMIT_SHORT\", \"short\": true},
                        {\"title\": \"Database restored\", \"value\": \"$RESTORE_DATABASE\", \"short\": true},
                        {\"title\": \"System status\", \"value\": \"Healthy\", \"short\": true}
                    ]
                }]
            }" "$SLACK_WEBHOOK" || log_warning "Failed to send Slack notification"
    fi
    
    log_success "Rollback completion notification sent"
}

# Main rollback function
main() {
    log "=== Courtesy Inspection Emergency Rollback ==="
    log "Environment: $ENVIRONMENT"
    log "Force Rollback: $FORCE_ROLLBACK"
    log "Restore Database: $RESTORE_DATABASE"
    
    # Critical confirmation for production
    if [[ "$ENVIRONMENT" == "production" && "$FORCE_ROLLBACK" == "false" ]]; then
        echo -e "${RED}CRITICAL WARNING: You are about to rollback PRODUCTION.${NC}"
        echo "This will affect live users and may cause data loss."
        echo
        read -p "Are you absolutely sure you want to continue? Type 'ROLLBACK' to confirm: " -r
        if [[ "$REPLY" != "ROLLBACK" ]]; then
            log "Rollback cancelled by user"
            exit 0
        fi
    fi
    
    # Run rollback steps
    check_prerequisites
    load_rollback_info
    verify_current_state
    notify_rollback_start
    restore_database
    rollback_deployment
    wait_for_rollback
    verify_rollback
    save_rollback_record
    notify_rollback_completion
    
    log_success "=== Emergency rollback completed successfully ==="
    log "Environment: $ENVIRONMENT"
    log "Rolled back to: $PREVIOUS_COMMIT_SHORT"
    log "API URL: $API_URL"
    log "Rollback log: $ROLLBACK_LOG"
    
    echo
    echo -e "${GREEN}🔄 Emergency rollback successful!${NC}"
    echo "System has been rolled back to previous stable state"
    echo "Monitor the application at: $API_URL"
    echo "Review rollback log: $ROLLBACK_LOG"
}

# Run main function
main "$@"