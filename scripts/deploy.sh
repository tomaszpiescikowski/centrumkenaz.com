#!/usr/bin/env bash
#
# Production Deployment Script
# Deploy Kenaz application to remote server
#
set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly APP_DIR="${APP_DIR:-/opt/kenaz}"
readonly BACKEND_DIR="${BACKEND_DIR:-${APP_DIR}/backend}"
readonly FRONTEND_DIR="${FRONTEND_DIR:-${APP_DIR}/dist}"
readonly STATIC_DIR="${STATIC_DIR:-${APP_DIR}/static}"
readonly NGINX_SNIPPET="${NGINX_SNIPPET:-/etc/nginx/snippets/kenaz-backend.conf}"
readonly PYTHON_VERSION="${PYTHON_VERSION:-3.14}"

# Functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
    echo -e "${GREEN}✓${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $*"
}

log_error() {
    echo -e "${RED}✗${NC} $*" >&2
}

check_requirements() {
    log_info "Checking requirements..."
    
    # Check required environment variables
    if [[ -z "${SSH_HOST:-}" ]]; then
        log_error "SSH_HOST environment variable is required"
        exit 1
    fi
    
    if [[ -z "${SSH_USER:-}" ]]; then
        log_error "SSH_USER environment variable is required"
        exit 1
    fi
    
    # Check SSH key
    if [[ -n "${SSH_KEY:-}" ]]; then
        if [[ ! -f "${SSH_KEY}" ]]; then
            log_error "SSH key file not found: ${SSH_KEY}"
            exit 1
        fi
        chmod 600 "${SSH_KEY}"
        SSH_KEY_OPT="-i ${SSH_KEY}"
    else
        SSH_KEY_OPT=""
    fi
    
    # Check rsync
    if ! command -v rsync >/dev/null 2>&1; then
        log_error "rsync is required but not installed"
        exit 1
    fi
    
    log_success "Requirements check passed"
}

build_frontend() {
    log_info "Building frontend..."
    
    cd "$PROJECT_ROOT"
    
    if [[ ! -f package.json ]]; then
        log_error "package.json not found"
        exit 1
    fi
    
    npm ci --quiet
    VITE_COMMIT_SHA="$(git rev-parse --short HEAD)" VITE_API_URL="${VITE_API_URL:-}" npm run build
    
    if [[ ! -d dist ]]; then
        log_error "Frontend build failed - dist directory not created"
        exit 1
    fi
    
    log_success "Frontend built successfully"
}

test_ssh_connection() {
    log_info "Testing SSH connection..."
    
    if ssh ${SSH_KEY_OPT} -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new \
        "${SSH_USER}@${SSH_HOST}" "echo 'SSH connection successful'" >/dev/null 2>&1; then
        log_success "SSH connection established"
    else
        log_error "Failed to connect to ${SSH_USER}@${SSH_HOST}"
        exit 1
    fi
}

create_backup() {
    log_info "Creating backup on server..."
    
    ssh ${SSH_KEY_OPT} -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" <<ENDSSH
set -euo pipefail

APP_DIR="${APP_DIR}"
BACKUP_DIR="/opt/kenaz-backup-\$(date +%Y%m%d-%H%M%S)"

if [[ -d "${APP_DIR}" ]]; then
    echo "Creating backup: ${BACKUP_DIR}"
    sudo cp -r "${APP_DIR}" "${BACKUP_DIR}"
    
    # Keep only last 3 backups
    sudo ls -dt /opt/kenaz-backup-* 2>/dev/null | tail -n +4 | xargs -r sudo rm -rf
    
    echo "Backup created successfully"
else
    echo "No existing deployment to backup"
fi
ENDSSH
    
    log_success "Backup completed"
}

sync_files() {
    log_info "Syncing files to server..."
    
    cd "$PROJECT_ROOT"
    
    # Sync backend
    log_info "Syncing backend..."
    rsync -avz --delete \
        --exclude '.git/' \
        --exclude '__pycache__/' \
        --exclude '*.pyc' \
        --exclude '.env' \
        --exclude '.env.*' \
        --exclude 'venv/' \
        --exclude '.pytest_cache/' \
        --exclude '.mypy_cache/' \
        --exclude '*.db' \
        --exclude '*.db-shm' \
        --exclude '*.db-wal' \
        --exclude 'logs/' \
        -e "ssh ${SSH_KEY_OPT} -o StrictHostKeyChecking=accept-new" \
        backend/ "${SSH_USER}@${SSH_HOST}:${BACKEND_DIR}/"
    
    # Sync frontend
    log_info "Syncing frontend..."
    rsync -avz --delete \
        -e "ssh ${SSH_KEY_OPT} -o StrictHostKeyChecking=accept-new" \
        dist/ "${SSH_USER}@${SSH_HOST}:${FRONTEND_DIR}/"
    
    # Sync static (without delete to preserve uploads)
    log_info "Syncing static files..."
    rsync -avz \
        -e "ssh ${SSH_KEY_OPT} -o StrictHostKeyChecking=accept-new" \
        public/static/ "${SSH_USER}@${SSH_HOST}:${STATIC_DIR}/"

    # Sync nginx snippet
    log_info "Syncing nginx backend-locations config..."
    rsync -avz \
        -e "ssh ${SSH_KEY_OPT} -o StrictHostKeyChecking=accept-new" \
        nginx/backend-locations.conf "${SSH_USER}@${SSH_HOST}:/tmp/kenaz-backend-locations.conf"
    ssh ${SSH_KEY_OPT} -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" \
        "sudo install -m 644 /tmp/kenaz-backend-locations.conf ${NGINX_SNIPPET}"
    
    log_success "Files synced successfully"
}

setup_backend() {
    log_info "Setting up backend environment..."
    
    ssh ${SSH_KEY_OPT} -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" <<ENDSSH
set -euo pipefail

cd "${BACKEND_DIR}"

# Check .env file
if [[ ! -f .env ]]; then
    echo "ERROR: .env file not found at ${BACKEND_DIR}/.env"
    echo "Please create it with required configuration"
    exit 1
fi

# Check Python in user local bin (Amazon Linux 2023)
PYTHON_BIN="~/.local/bin/python${PYTHON_VERSION}"
if ! eval "command -v ${PYTHON_BIN}" >/dev/null 2>&1; then
    echo "ERROR: Python ${PYTHON_VERSION} not found at ${PYTHON_BIN}"
    echo "Install with: wget https://www.python.org/ftp/python/${PYTHON_VERSION}.*/Python-${PYTHON_VERSION}.*.tar.xz"
    echo "Then: tar xf Python-*.tar.xz && cd Python-* && ./configure --prefix=\$HOME/.local && make && make install"
    exit 1
fi

# Setup virtual environment
if [[ -d venv ]]; then
    VENV_VERSION=\$(venv/bin/python --version 2>&1 | grep -oP '\d+\.\d+' | head -1)
    if [[ "\${VENV_VERSION}" != "${PYTHON_VERSION}" ]]; then
        echo "Removing old venv (Python \${VENV_VERSION})..."
        rm -rf venv
    fi
fi

if [[ ! -d venv ]]; then
    echo "Creating virtual environment..."
    eval "${PYTHON_BIN}" -m venv venv
fi

# Install dependencies
echo "Installing dependencies..."
venv/bin/pip install --upgrade pip --quiet
venv/bin/pip install -r requirements.txt --quiet

echo "Backend setup completed"
ENDSSH
    
    log_success "Backend environment ready"
}

run_migrations() {
    log_info "Running database migrations..."
    
    ssh ${SSH_KEY_OPT} -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" <<ENDSSH
set -euo pipefail

cd "${BACKEND_DIR}"

echo "Applying migrations..."
venv/bin/python -W error::UserWarning -m alembic upgrade heads

echo "Migrations completed"
ENDSSH
    
    log_success "Migrations applied successfully"
}

restart_services() {
    log_info "Restarting services..."
    
    ssh ${SSH_KEY_OPT} -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" <<'ENDSSH'
set -euo pipefail

# Clear stale Python bytecache to prevent old .pyc files from being used
echo "Clearing __pycache__ directories..."
find /opt/kenaz/backend -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
find /opt/kenaz/backend -name '*.pyc' -delete 2>/dev/null || true

# Restart backend
echo "Restarting backend service..."
sudo systemctl restart kenaz-backend

# Wait for service to start
sleep 2

# Check if running
if sudo systemctl is-active --quiet kenaz-backend; then
    echo "Backend service is running"
else
    echo "ERROR: Backend service failed to start"
    sudo systemctl status kenaz-backend --no-pager
    exit 1
fi

# Reload nginx
echo "Reloading nginx..."
sudo nginx -t
sudo systemctl reload nginx

if sudo systemctl is-active --quiet nginx; then
    echo "Nginx reloaded successfully"
else
    echo "ERROR: Nginx failed to reload"
    sudo systemctl status nginx --no-pager
    exit 1
fi
ENDSSH
    
    log_success "Services restarted successfully"
}

health_check() {
    log_info "Performing health check..."
    
    local health_url="http://${SSH_HOST}/docs"
    local max_attempts=5
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s -o /dev/null "$health_url"; then
            log_success "Health check passed: $health_url"
            return 0
        fi
        
        log_warning "Attempt $attempt/$max_attempts failed, waiting..."
        sleep 3
        ((attempt++))
    done
    
    log_warning "Health check failed, but deployment completed"
    log_warning "Check manually: $health_url"
    return 0
}

print_summary() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}🚀 Deployment completed successfully!${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Frontend: http://${SSH_HOST}"
    echo "API Docs: http://${SSH_HOST}/docs"
    echo "Server:   ${SSH_USER}@${SSH_HOST}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

show_usage() {
    cat <<EOF
Usage: $(basename "$0")

Environment Variables:
  SSH_HOST        Server hostname or IP (required)
  SSH_USER        SSH username (required)
  SSH_KEY         Path to SSH private key (optional)
  APP_DIR         Application directory (default: /opt/kenaz)
  PYTHON_VERSION  Python version (default: 3.14)

Example:
  SSH_HOST=35.157.165.112 \\
  SSH_USER=ec2-user \\
  SSH_KEY=~/.ssh/key.pem \\
  $(basename "$0")

EOF
}

main() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Kenaz Production Deployment"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Show usage if help requested
    if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    check_requirements
    build_frontend
    test_ssh_connection
    create_backup
    sync_files
    setup_backend
    run_migrations
    restart_services
    health_check
    print_summary
}

# Run main function
main "$@"
