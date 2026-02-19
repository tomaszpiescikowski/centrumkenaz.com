#!/usr/bin/env bash
#
# Rollback Script
# Restore previous deployment from backup
#
set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
    echo -e "${GREEN}✓${NC} $*"
}

log_error() {
    echo -e "${RED}✗${NC} $*" >&2
}

check_requirements() {
    if [[ -z "${SSH_HOST:-}" ]]; then
        log_error "SSH_HOST environment variable is required"
        exit 1
    fi
    
    if [[ -z "${SSH_USER:-}" ]]; then
        log_error "SSH_USER environment variable is required"
        exit 1
    fi
    
    if [[ -n "${SSH_KEY:-}" ]]; then
        chmod 600 "${SSH_KEY}"
        SSH_KEY_OPT="-i ${SSH_KEY}"
    else
        SSH_KEY_OPT=""
    fi
}

list_backups() {
    log_info "Available backups:"
    echo ""
    
    ssh ${SSH_KEY_OPT} -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" <<'ENDSSH'
sudo ls -dt /opt/kenaz-backup-* 2>/dev/null | head -10 | nl -w2 -s'. '
ENDSSH
}

restore_backup() {
    local backup_dir="$1"
    
    log_info "Restoring from: $backup_dir"
    
    ssh ${SSH_KEY_OPT} -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" <<ENDSSH
set -euo pipefail

BACKUP_DIR="$backup_dir"
APP_DIR="/opt/kenaz"

if [[ ! -d "\${BACKUP_DIR}" ]]; then
    echo "ERROR: Backup directory not found: \${BACKUP_DIR}"
    exit 1
fi

# Stop services
echo "Stopping services..."
sudo systemctl stop kenaz-backend

# Restore files
echo "Restoring files..."
sudo rm -rf "\${APP_DIR}"
sudo cp -r "\${BACKUP_DIR}" "\${APP_DIR}"

# Restart services
echo "Starting services..."
sudo systemctl start kenaz-backend
sudo systemctl reload nginx

# Check status
if sudo systemctl is-active --quiet kenaz-backend; then
    echo "Services started successfully"
else
    echo "ERROR: Failed to start services"
    sudo systemctl status kenaz-backend --no-pager
    exit 1
fi
ENDSSH
    
    log_success "Rollback completed successfully"
}

main() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Kenaz Rollback Tool"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    check_requirements
    list_backups
    
    echo ""
    read -p "Enter backup number to restore (or 'q' to quit): " choice
    
    if [[ "$choice" == "q" ]] || [[ "$choice" == "Q" ]]; then
        log_info "Cancelled"
        exit 0
    fi
    
    # Get the selected backup path
    backup_path=$(ssh ${SSH_KEY_OPT} -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" \
        "sudo ls -dt /opt/kenaz-backup-* 2>/dev/null | head -10 | sed -n '${choice}p'")
    
    if [[ -z "$backup_path" ]]; then
        log_error "Invalid selection"
        exit 1
    fi
    
    echo ""
    log_info "Selected: $backup_path"
    read -p "Are you sure you want to rollback? (yes/no): " confirm
    
    if [[ "$confirm" != "yes" ]]; then
        log_info "Cancelled"
        exit 0
    fi
    
    restore_backup "$backup_path"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}✓ Rollback completed!${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

main "$@"
