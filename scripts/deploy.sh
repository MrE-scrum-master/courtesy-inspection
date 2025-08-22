#!/bin/bash

# Courtesy Inspection - Production Deployment Script
# Zero-downtime deployment with comprehensive validation

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOYMENT_LOG="/tmp/courtesy-inspection-deploy-$(date +%Y%m%d-%H%M%S).log"
ROLLBACK_INFO="/tmp/courtesy-inspection-rollback-info.json"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
    exit 1
}

# Help function
show_help() {
    cat << EOF
Courtesy Inspection Deployment Script

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment    Target environment (staging|production)
    -s, --skip-tests     Skip test execution
    -f, --force          Force deployment without confirmation
    -b, --backup         Create backup before deployment
    -v, --verbose        Verbose output
    -h, --help          Show this help message

EXAMPLES:
    $0 -e staging                   # Deploy to staging
    $0 -e production -b             # Deploy to production with backup
    $0 -e production -f -s          # Force deploy to production, skip tests

EOF
}

# Default values
ENVIRONMENT=""
SKIP_TESTS=false
FORCE_DEPLOY=false
CREATE_BACKUP=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        -f|--force)
            FORCE_DEPLOY=true
            shift
            ;;
        -b|--backup)
            CREATE_BACKUP=true
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

# Validate environment parameter
if [[ -z "$ENVIRONMENT" ]]; then
    log_error "Environment parameter is required. Use -e staging or -e production"
fi

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    log_error "Environment must be either 'staging' or 'production'"
fi

# Set environment-specific variables
if [[ "$ENVIRONMENT" == "production" ]]; then
    RAILWAY_SERVICE="courtesy-inspection-api"
    RAILWAY_ENV="production"
    API_URL="https://api.courtesy-inspection.com"
    CREATE_BACKUP=true  # Always backup production
else
    RAILWAY_SERVICE="courtesy-inspection-api"
    RAILWAY_ENV="staging"
    API_URL="https://staging.courtesy-inspection.railway.app"
fi

log "Starting deployment to $ENVIRONMENT environment"
log "Deployment log: $DEPLOYMENT_LOG"

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
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed."
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed."
    fi
    
    # Check if git is available
    if ! command -v git &> /dev/null; then
        log_error "git is not installed."
    fi
    
    log_success "Prerequisites check passed"
}

# Function to validate git status
validate_git_status() {
    log "Validating git status..."
    
    cd "$PROJECT_ROOT"
    
    # Check if on correct branch
    current_branch=$(git branch --show-current)
    if [[ "$ENVIRONMENT" == "production" && "$current_branch" != "main" ]]; then
        if [[ "$FORCE_DEPLOY" == "false" ]]; then
            log_error "Production deployments must be from 'main' branch. Current branch: $current_branch"
        else
            log_warning "Deploying to production from non-main branch: $current_branch"
        fi
    fi
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        if [[ "$FORCE_DEPLOY" == "false" ]]; then
            log_error "There are uncommitted changes. Please commit or stash them."
        else
            log_warning "Deploying with uncommitted changes"
        fi
    fi
    
    # Get current commit info for rollback
    CURRENT_COMMIT=$(git rev-parse HEAD)
    CURRENT_COMMIT_SHORT=$(git rev-parse --short HEAD)
    CURRENT_BRANCH=$(git branch --show-current)
    
    log_success "Git status validated"
}

# Function to run tests
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warning "Skipping tests as requested"
        return
    fi
    
    log "Running tests..."
    
    cd "$PROJECT_ROOT/server"
    
    # Install dependencies
    log "Installing dependencies..."
    npm ci
    
    # Run type checking
    log "Running type check..."
    npm run type-check
    
    # Run linting
    log "Running linter..."
    npm run lint
    
    # Run security linting
    log "Running security lint..."
    npm run lint:security
    
    # Run unit tests
    log "Running unit tests..."
    npm run test:unit
    
    # Run integration tests
    log "Running integration tests..."
    npm run test:integration
    
    # Run security tests
    log "Running security tests..."
    npm run test:security
    
    log_success "All tests passed"
}

# Function to build application
build_application() {
    log "Building application..."
    
    cd "$PROJECT_ROOT/server"
    
    # Clean previous build
    npm run clean
    
    # Build the application
    npm run build
    
    log_success "Application built successfully"
}

# Function to create backup
create_backup() {
    if [[ "$CREATE_BACKUP" == "false" ]]; then
        return
    fi
    
    log "Creating database backup..."
    
    # Create backup using Railway CLI
    BACKUP_ID=$(railway run "npm run db:backup" --service courtesy-inspection-db --environment "$RAILWAY_ENV" | tail -n 1)
    
    if [[ -n "$BACKUP_ID" ]]; then
        log_success "Backup created: $BACKUP_ID"
        echo "$BACKUP_ID" > "/tmp/courtesy-inspection-backup-$ENVIRONMENT.txt"
    else
        log_error "Failed to create backup"
    fi
}

# Function to save rollback information
save_rollback_info() {
    log "Saving rollback information..."
    
    # Get current deployment info
    CURRENT_DEPLOYMENT=$(railway status --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENV" --json | jq -r '.deployment.id')
    
    cat > "$ROLLBACK_INFO" << EOF
{
    "environment": "$ENVIRONMENT",
    "pre_deployment": {
        "deployment_id": "$CURRENT_DEPLOYMENT",
        "commit": "$CURRENT_COMMIT",
        "commit_short": "$CURRENT_COMMIT_SHORT",
        "branch": "$CURRENT_BRANCH",
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    },
    "backup_info": {
        "backup_id": "$(cat /tmp/courtesy-inspection-backup-$ENVIRONMENT.txt 2>/dev/null || echo 'none')",
        "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    }
}
EOF
    
    log_success "Rollback information saved to $ROLLBACK_INFO"
}

# Function to deploy to Railway
deploy_to_railway() {
    log "Deploying to Railway ($ENVIRONMENT)..."
    
    cd "$PROJECT_ROOT"
    
    # Deploy to Railway
    railway up --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENV"
    
    log_success "Deployment to Railway completed"
}

# Function to run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Run migrations on Railway
    railway run "npm run db:migrate" --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENV"
    
    log_success "Database migrations completed"
}

# Function to perform health checks
perform_health_checks() {
    log "Performing health checks..."
    
    # Wait for deployment to be ready
    log "Waiting for service to be ready..."
    sleep 30
    
    # Health check with retries
    max_attempts=10
    attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -f "$API_URL/api/health" > /dev/null 2>&1; then
            log_success "Health check passed"
            break
        else
            attempt=$((attempt + 1))
            if [[ $attempt -eq $max_attempts ]]; then
                log_error "Health check failed after $max_attempts attempts"
            fi
            log "Health check attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
            sleep 10
        fi
    done
    
    # Test key endpoints
    log "Testing key endpoints..."
    
    # Test auth endpoint
    if curl -f "$API_URL/api/auth/health" > /dev/null 2>&1; then
        log_success "Auth endpoint is healthy"
    else
        log_error "Auth endpoint is not responding"
    fi
    
    # Test database connection
    if curl -f "$API_URL/api/health/database" > /dev/null 2>&1; then
        log_success "Database connection is healthy"
    else
        log_error "Database connection failed"
    fi
}

# Function to run smoke tests
run_smoke_tests() {
    log "Running smoke tests..."
    
    cd "$PROJECT_ROOT/server"
    
    # Install newman if not available
    if ! command -v newman &> /dev/null; then
        npm install -g newman
    fi
    
    # Run smoke tests if they exist
    if [[ -f "tests/postman/smoke-tests.json" ]]; then
        newman run tests/postman/smoke-tests.json \
            --env-var baseUrl="$API_URL" \
            --env-var environment="$ENVIRONMENT"
        
        log_success "Smoke tests passed"
    else
        log_warning "No smoke tests found, skipping"
    fi
}

# Function to update rollback info with new deployment
update_rollback_info() {
    log "Updating rollback information with new deployment..."
    
    # Get new deployment info
    NEW_DEPLOYMENT=$(railway status --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENV" --json | jq -r '.deployment.id')
    
    # Update rollback info
    jq ".post_deployment = {
        \"deployment_id\": \"$NEW_DEPLOYMENT\",
        \"commit\": \"$CURRENT_COMMIT\",
        \"commit_short\": \"$CURRENT_COMMIT_SHORT\",
        \"branch\": \"$CURRENT_BRANCH\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    }" "$ROLLBACK_INFO" > "${ROLLBACK_INFO}.tmp" && mv "${ROLLBACK_INFO}.tmp" "$ROLLBACK_INFO"
    
    log_success "Rollback information updated"
}

# Function to notify stakeholders
notify_stakeholders() {
    log "Notifying stakeholders..."
    
    # Send Slack notification if webhook is configured
    if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"text\": \"🚀 Courtesy Inspection deployed to $ENVIRONMENT\",
                \"attachments\": [{
                    \"color\": \"good\",
                    \"fields\": [
                        {\"title\": \"Environment\", \"value\": \"$ENVIRONMENT\", \"short\": true},
                        {\"title\": \"Commit\", \"value\": \"$CURRENT_COMMIT_SHORT\", \"short\": true},
                        {\"title\": \"Branch\", \"value\": \"$CURRENT_BRANCH\", \"short\": true},
                        {\"title\": \"URL\", \"value\": \"$API_URL\", \"short\": true}
                    ]
                }]
            }" "$SLACK_WEBHOOK"
    fi
    
    log_success "Stakeholders notified"
}

# Function to cleanup temporary files
cleanup() {
    log "Cleaning up temporary files..."
    
    # Keep important files but clean up build artifacts
    cd "$PROJECT_ROOT/server"
    npm run clean
    
    log_success "Cleanup completed"
}

# Main deployment function
main() {
    log "=== Courtesy Inspection Deployment ==="
    log "Environment: $ENVIRONMENT"
    log "Skip Tests: $SKIP_TESTS"
    log "Force Deploy: $FORCE_DEPLOY"
    log "Create Backup: $CREATE_BACKUP"
    log "Verbose: $VERBOSE"
    
    # Confirmation for production
    if [[ "$ENVIRONMENT" == "production" && "$FORCE_DEPLOY" == "false" ]]; then
        echo -e "${YELLOW}WARNING: You are about to deploy to PRODUCTION.${NC}"
        echo "This will affect live users and data."
        echo
        read -p "Are you sure you want to continue? (yes/no): " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log "Deployment cancelled by user"
            exit 0
        fi
    fi
    
    # Run deployment steps
    check_prerequisites
    validate_git_status
    run_tests
    build_application
    create_backup
    save_rollback_info
    deploy_to_railway
    run_migrations
    perform_health_checks
    run_smoke_tests
    update_rollback_info
    notify_stakeholders
    cleanup
    
    log_success "=== Deployment completed successfully ==="
    log "Environment: $ENVIRONMENT"
    log "Commit: $CURRENT_COMMIT_SHORT"
    log "API URL: $API_URL"
    log "Deployment log: $DEPLOYMENT_LOG"
    log "Rollback info: $ROLLBACK_INFO"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo
        echo -e "${GREEN}🎉 Production deployment successful!${NC}"
        echo "Monitor the application at: $API_URL"
        echo "Use ./scripts/rollback.sh if issues are detected"
    fi
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"