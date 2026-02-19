# Deployment Scripts

This directory contains scripts for deploying and managing the Kenaz application.

## Active Scripts

### deploy.sh

Production deployment script. Deploys the application to a remote server.

**Usage:**
```bash
export SSH_HOST=35.157.165.112
export SSH_USER=ec2-user
export SSH_KEY=~/.ssh/lightsail-key.pem  # Optional

./scripts/deploy.sh
```

**What it does:**
1. Checks requirements (rsync, SSH connection)
2. Builds frontend (npm ci && npm run build)
3. Creates automatic backup on server
4. Syncs backend, frontend, and static files via rsync
5. Sets up Python virtual environment
6. Installs dependencies
7. Runs database migrations (alembic upgrade head)
8. Restarts systemd services (kenaz-backend, nginx)
9. Performs health check on deployed application

**Environment Variables:**
- `SSH_HOST` - Server IP or hostname (required)
- `SSH_USER` - SSH username (required)
- `SSH_KEY` - Path to SSH private key (optional, uses default SSH config if not set)
- `APP_DIR` - Application directory on server (default: /opt/kenaz)
- `PYTHON_VERSION` - Python version (default: 3.14)

### rollback.sh

Rollback tool for restoring previous deployments.

**Usage:**
```bash
export SSH_HOST=35.157.165.112
export SSH_USER=ec2-user
export SSH_KEY=~/.ssh/lightsail-key.pem  # Optional

./scripts/rollback.sh
```

**What it does:**
1. Lists available backups (up to 10 most recent)
2. Prompts user to select backup to restore
3. Confirms rollback action
4. Stops backend service
5. Restores files from selected backup
6. Restarts services

**Features:**
- Interactive backup selection
- Confirmation prompt before rollback
- Automatic service restart
- Status verification

## Deprecated Scripts

The following scripts are old and should NOT be used:

- ❌ `deploy_lightsail.sh` - Replaced by deploy.sh
- ❌ `release_lightsail.sh` - Replaced by deploy.sh

These will be removed in a future cleanup.

## CI/CD Integration

The GitHub Actions workflow (`.github/workflows/deploy.yml`) uses the same deployment logic as `deploy.sh`, but runs it directly in the workflow steps for better visibility and logging.

## Requirements

**Local machine:**
- bash 4.0+
- rsync
- ssh
- curl (for health checks)
- npm (for frontend build)

**Remote server:**
- Python 3.14 (in `~/.local/bin/`)
- Amazon Linux 2023
- systemd (for service management)
- nginx (for reverse proxy)
- rsync

## Troubleshooting

### SSH Connection Fails
```bash
# Test SSH connection manually
ssh -i ~/.ssh/lightsail-key.pem ec2-user@35.157.165.112

# Check SSH key permissions
chmod 600 ~/.ssh/lightsail-key.pem
```

### Build Fails
```bash
# Clean node_modules and rebuild
rm -rf node_modules dist
npm ci
npm run build
```

### Service Won't Start
```bash
# SSH into server and check logs
ssh -i ~/.ssh/lightsail-key.pem ec2-user@35.157.165.112
sudo journalctl -u kenaz-backend -n 50 --no-pager
sudo systemctl status kenaz-backend
```

## See Also

- [DEPLOYMENT.md](../docs/DEPLOYMENT.md) - Complete deployment guide
- [README.md](../README.md) - Project overview
- [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) - CI/CD configuration
