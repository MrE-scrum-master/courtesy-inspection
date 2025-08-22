#!/bin/bash

# Courtesy Inspection - Database Backup Script
# Automated backup with rotation and validation

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_LOG="/tmp/courtesy-inspection-backup-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="/tmp/courtesy-inspection-backups"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$BACKUP_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$BACKUP_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$BACKUP_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$BACKUP_LOG"
    exit 1
}

# Help function
show_help() {
    cat << EOF
Courtesy Inspection Database Backup Script

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment    Target environment (staging|production|local)
    -t, --type          Backup type (full|schema|data)
    -r, --retention     Retention days (default: 30)
    -c, --compress      Compress backup files
    -v, --verify        Verify backup integrity
    -s, --size-limit    Maximum backup size in MB (default: 1000)
    --dry-run           Show what would be backed up without doing it
    -h, --help          Show this help message

EXAMPLES:
    $0 -e production                # Full backup of production
    $0 -e staging -t schema         # Schema-only backup of staging
    $0 -e production -c -v          # Compressed, verified production backup
    $0 --dry-run -e production      # Preview production backup

EOF
}

# Default values
ENVIRONMENT=""
BACKUP_TYPE="full"
RETENTION_DAYS=30
COMPRESS_BACKUP=false
VERIFY_BACKUP=false
SIZE_LIMIT_MB=1000
DRY_RUN=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -t|--type)
            BACKUP_TYPE="$2"
            shift 2
            ;;
        -r|--retention)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        -c|--compress)
            COMPRESS_BACKUP=true
            shift
            ;;
        -v|--verify)
            VERIFY_BACKUP=true
            shift
            ;;
        -s|--size-limit)
            SIZE_LIMIT_MB="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
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

# Validate parameters
if [[ -z "$ENVIRONMENT" ]]; then
    log_error "Environment parameter is required. Use -e staging, -e production, or -e local"
fi

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "local" ]]; then
    log_error "Environment must be 'staging', 'production', or 'local'"
fi

if [[ "$BACKUP_TYPE" != "full" && "$BACKUP_TYPE" != "schema" && "$BACKUP_TYPE" != "data" ]]; then
    log_error "Backup type must be 'full', 'schema', or 'data'"
fi

# Set environment-specific variables
case $ENVIRONMENT in
    production)
        RAILWAY_SERVICE="courtesy-inspection-db"
        RAILWAY_ENV="production"
        DATABASE_NAME="courtesy_inspection"
        ;;
    staging)
        RAILWAY_SERVICE="courtesy-inspection-db"
        RAILWAY_ENV="staging"
        DATABASE_NAME="courtesy_inspection_staging"
        ;;
    local)
        DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/courtesy_inspection}"
        DATABASE_NAME="courtesy_inspection"
        ;;
esac

log "Starting backup for $ENVIRONMENT environment"
log "Backup type: $BACKUP_TYPE"
log "Backup log: $BACKUP_LOG"

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if [[ "$ENVIRONMENT" != "local" ]]; then
        # Check if Railway CLI is installed
        if ! command -v railway &> /dev/null; then
            log_error "Railway CLI is not installed. Please install it first."
        fi
        
        # Check if logged into Railway
        if ! railway whoami &> /dev/null; then
            log_error "Not logged into Railway. Please run 'railway login' first."
        fi
    else
        # Check if pg_dump is available for local backups
        if ! command -v pg_dump &> /dev/null; then
            log_error "pg_dump is not installed. Please install PostgreSQL client tools."
        fi
    fi
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    log_success "Prerequisites check passed"
}

# Function to get database connection info
get_database_info() {
    log "Getting database information..."
    
    if [[ "$ENVIRONMENT" != "local" ]]; then
        # Get database URL from Railway
        DATABASE_URL=$(railway variables get DATABASE_URL --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENV")
        if [[ -z "$DATABASE_URL" ]]; then
            log_error "Could not retrieve database URL from Railway"
        fi
    fi
    
    # Parse database URL
    if [[ "$DATABASE_URL" =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASSWORD="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
    else
        log_error "Could not parse database URL"
    fi
    
    log_success "Database information retrieved"
    log "Host: $DB_HOST"
    log "Port: $DB_PORT"
    log "Database: $DB_NAME"
}

# Function to check database size
check_database_size() {
    log "Checking database size..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would check database size"
        return
    fi
    
    # Get database size
    SIZE_QUERY="SELECT pg_size_pretty(pg_database_size('$DB_NAME')) as size, pg_database_size('$DB_NAME') as size_bytes;"
    
    if [[ "$ENVIRONMENT" == "local" ]]; then
        SIZE_RESULT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$SIZE_QUERY" 2>/dev/null || echo "Unknown")
    else
        SIZE_RESULT=$(railway run "psql \$DATABASE_URL -t -c \"$SIZE_QUERY\"" --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENV" 2>/dev/null || echo "Unknown")
    fi
    
    if [[ "$SIZE_RESULT" != "Unknown" ]]; then
        SIZE_PRETTY=$(echo "$SIZE_RESULT" | awk '{print $1}')
        SIZE_BYTES=$(echo "$SIZE_RESULT" | awk '{print $2}')
        SIZE_MB=$((SIZE_BYTES / 1024 / 1024))
        
        log "Database size: $SIZE_PRETTY ($SIZE_MB MB)"
        
        # Check if size exceeds limit
        if [[ $SIZE_MB -gt $SIZE_LIMIT_MB ]]; then
            log_warning "Database size ($SIZE_MB MB) exceeds limit ($SIZE_LIMIT_MB MB)"
            read -p "Continue with backup? (yes/no): " -r
            if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
                log "Backup cancelled by user"
                exit 0
            fi
        fi
    else
        log_warning "Could not determine database size"
    fi
}

# Function to create backup filename
create_backup_filename() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local extension="sql"
    
    if [[ "$COMPRESS_BACKUP" == "true" ]]; then
        extension="sql.gz"
    fi
    
    BACKUP_FILENAME="courtesy_inspection_${ENVIRONMENT}_${BACKUP_TYPE}_${timestamp}.${extension}"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILENAME"
    
    log "Backup filename: $BACKUP_FILENAME"
}

# Function to perform backup
perform_backup() {
    log "Performing $BACKUP_TYPE backup..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would create backup at $BACKUP_PATH"
        return
    fi
    
    # Build pg_dump command based on backup type
    case $BACKUP_TYPE in
        full)
            DUMP_OPTIONS="--verbose --no-owner --no-privileges"
            ;;
        schema)
            DUMP_OPTIONS="--verbose --no-owner --no-privileges --schema-only"
            ;;
        data)
            DUMP_OPTIONS="--verbose --no-owner --no-privileges --data-only"
            ;;
    esac
    
    if [[ "$ENVIRONMENT" == "local" ]]; then
        # Local backup
        if [[ "$COMPRESS_BACKUP" == "true" ]]; then
            PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" $DUMP_OPTIONS | gzip > "$BACKUP_PATH"
        else
            PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" $DUMP_OPTIONS > "$BACKUP_PATH"
        fi
    else
        # Railway backup
        if [[ "$COMPRESS_BACKUP" == "true" ]]; then
            railway run "pg_dump \$DATABASE_URL $DUMP_OPTIONS | gzip" --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENV" > "$BACKUP_PATH"
        else
            railway run "pg_dump \$DATABASE_URL $DUMP_OPTIONS" --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENV" > "$BACKUP_PATH"
        fi
    fi
    
    # Check if backup was successful
    if [[ $? -eq 0 && -f "$BACKUP_PATH" ]]; then
        local backup_size=$(du -h "$BACKUP_PATH" | cut -f1)
        log_success "Backup created successfully: $backup_size"
    else
        log_error "Backup failed"
    fi
}

# Function to verify backup integrity
verify_backup_integrity() {
    if [[ "$VERIFY_BACKUP" == "false" || "$DRY_RUN" == "true" ]]; then
        return
    fi
    
    log "Verifying backup integrity..."
    
    # Check if backup file exists and is not empty
    if [[ ! -f "$BACKUP_PATH" ]]; then
        log_error "Backup file not found: $BACKUP_PATH"
    fi
    
    if [[ ! -s "$BACKUP_PATH" ]]; then
        log_error "Backup file is empty: $BACKUP_PATH"
    fi
    
    # Verify compressed backup
    if [[ "$COMPRESS_BACKUP" == "true" ]]; then
        if ! gzip -t "$BACKUP_PATH" 2>/dev/null; then
            log_error "Backup file is corrupted (gzip test failed)"
        fi
        
        # Check if SQL content is valid
        if ! zcat "$BACKUP_PATH" | head -10 | grep -q "PostgreSQL database dump" 2>/dev/null; then
            log_error "Backup file does not contain valid PostgreSQL dump"
        fi
    else
        # Check if SQL content is valid
        if ! head -10 "$BACKUP_PATH" | grep -q "PostgreSQL database dump" 2>/dev/null; then
            log_error "Backup file does not contain valid PostgreSQL dump"
        fi
    fi
    
    log_success "Backup integrity verification passed"
}

# Function to save backup metadata
save_backup_metadata() {
    if [[ "$DRY_RUN" == "true" ]]; then
        return
    fi
    
    log "Saving backup metadata..."
    
    local metadata_file="$BACKUP_DIR/${BACKUP_FILENAME}.metadata.json"
    local backup_size=$(stat -f%z "$BACKUP_PATH" 2>/dev/null || stat -c%s "$BACKUP_PATH" 2>/dev/null || echo "unknown")
    local backup_hash=$(sha256sum "$BACKUP_PATH" 2>/dev/null | cut -d' ' -f1 || echo "unknown")
    
    cat > "$metadata_file" << EOF
{
    "backup_filename": "$BACKUP_FILENAME",
    "backup_path": "$BACKUP_PATH",
    "environment": "$ENVIRONMENT",
    "backup_type": "$BACKUP_TYPE",
    "database_name": "$DB_NAME",
    "database_host": "$DB_HOST",
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "created_by": "$(whoami)",
    "backup_size_bytes": $backup_size,
    "backup_hash_sha256": "$backup_hash",
    "compressed": $COMPRESS_BACKUP,
    "verified": $VERIFY_BACKUP,
    "retention_until": "$(date -u -d "+$RETENTION_DAYS days" +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    
    log_success "Backup metadata saved: $metadata_file"
}

# Function to cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would clean up backups older than $RETENTION_DAYS days"
        find "$BACKUP_DIR" -name "courtesy_inspection_${ENVIRONMENT}_*.sql*" -mtime +$RETENTION_DAYS -ls 2>/dev/null || true
        return
    fi
    
    # Find and remove old backup files
    local removed_count=0
    
    while IFS= read -r -d '' file; do
        log "Removing old backup: $(basename "$file")"
        rm -f "$file"
        rm -f "${file}.metadata.json"
        ((removed_count++))
    done < <(find "$BACKUP_DIR" -name "courtesy_inspection_${ENVIRONMENT}_*.sql*" -mtime +$RETENTION_DAYS -print0 2>/dev/null)
    
    if [[ $removed_count -gt 0 ]]; then
        log_success "Removed $removed_count old backup files"
    else
        log "No old backups to remove"
    fi
}

# Function to upload backup to cloud storage (if configured)
upload_to_cloud() {
    if [[ "$DRY_RUN" == "true" ]]; then
        return
    fi
    
    # Only upload production backups to cloud
    if [[ "$ENVIRONMENT" != "production" ]]; then
        return
    fi
    
    # Check if AWS CLI is available and configured
    if command -v aws &> /dev/null && [[ -n "${AWS_S3_BACKUP_BUCKET:-}" ]]; then
        log "Uploading backup to AWS S3..."
        
        local s3_path="s3://$AWS_S3_BACKUP_BUCKET/courtesy-inspection/database/$BACKUP_FILENAME"
        
        if aws s3 cp "$BACKUP_PATH" "$s3_path" --storage-class STANDARD_IA; then
            log_success "Backup uploaded to S3: $s3_path"
            
            # Upload metadata as well
            aws s3 cp "$BACKUP_DIR/${BACKUP_FILENAME}.metadata.json" "s3://$AWS_S3_BACKUP_BUCKET/courtesy-inspection/database/${BACKUP_FILENAME}.metadata.json"
        else
            log_warning "Failed to upload backup to S3"
        fi
    fi
}

# Function to send notification
send_notification() {
    if [[ "$DRY_RUN" == "true" ]]; then
        return
    fi
    
    log "Sending backup notification..."
    
    local backup_size=$(du -h "$BACKUP_PATH" | cut -f1)
    local status="SUCCESS"
    local color="good"
    
    # Send Slack notification if webhook is configured
    if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"text\": \"💾 Database backup completed for Courtesy Inspection $ENVIRONMENT\",
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"fields\": [
                        {\"title\": \"Environment\", \"value\": \"$ENVIRONMENT\", \"short\": true},
                        {\"title\": \"Backup Type\", \"value\": \"$BACKUP_TYPE\", \"short\": true},
                        {\"title\": \"Size\", \"value\": \"$backup_size\", \"short\": true},
                        {\"title\": \"Compressed\", \"value\": \"$COMPRESS_BACKUP\", \"short\": true},
                        {\"title\": \"Verified\", \"value\": \"$VERIFY_BACKUP\", \"short\": true},
                        {\"title\": \"Retention\", \"value\": \"$RETENTION_DAYS days\", \"short\": true}
                    ]
                }]
            }" "$SLACK_WEBHOOK" || log_warning "Failed to send Slack notification"
    fi
    
    log_success "Backup notification sent"
}

# Function to display backup summary
display_summary() {
    log_success "=== Backup Summary ==="
    log "Environment: $ENVIRONMENT"
    log "Backup Type: $BACKUP_TYPE"
    log "Backup File: $BACKUP_FILENAME"
    
    if [[ "$DRY_RUN" == "false" && -f "$BACKUP_PATH" ]]; then
        local backup_size=$(du -h "$BACKUP_PATH" | cut -f1)
        log "Backup Size: $backup_size"
        log "Backup Path: $BACKUP_PATH"
        log "Compressed: $COMPRESS_BACKUP"
        log "Verified: $VERIFY_BACKUP"
    fi
    
    log "Retention: $RETENTION_DAYS days"
    log "Backup Log: $BACKUP_LOG"
}

# Main backup function
main() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log "=== DRY RUN: Courtesy Inspection Database Backup ==="
    else
        log "=== Courtesy Inspection Database Backup ==="
    fi
    
    check_prerequisites
    get_database_info
    check_database_size
    create_backup_filename
    perform_backup
    verify_backup_integrity
    save_backup_metadata
    cleanup_old_backups
    upload_to_cloud
    send_notification
    display_summary
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_success "Dry run completed successfully"
    else
        log_success "Backup completed successfully"
    fi
}

# Run main function
main "$@"