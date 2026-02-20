# Deployment Guide

## Overview

This project uses GitHub Actions for continuous deployment to AWS Lightsail. Every push to `main` triggers an automated deployment.

## Prerequisites

### Server Requirements

- AWS Lightsail instance running Amazon Linux 2 or Ubuntu
- Python 3.14 installed
- Nginx configured and running
- PostgreSQL database
- systemd service `kenaz-backend` configured

### GitHub Secrets

Configure these secrets in your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Description | Example |
|------------|-------------|---------|
| `SSH_HOST` | Server IP or hostname | `35.157.165.112` |
| `SSH_USER` | SSH username | `ec2-user` (Amazon Linux)<br>`ubuntu` (Ubuntu) |
| `SSH_PRIVATE_KEY` | SSH private key (PEM format) | Contents of `.pem` file |

## Deployment Workflow

### Automatic Deployment

Pushes to `main` branch automatically trigger deployment:

```bash
git push origin main
```

### Manual Deployment

Trigger from GitHub Actions tab:

1. Go to **Actions** → **Deploy to Production**
2. Click **Run workflow**
3. Choose options:
   - **Skip tests**: Skip running tests (faster deploy)

## Deployment Steps

The workflow performs these steps:

1. **Validate** - Check all required secrets are configured
2. **Build** - Build frontend, install dependencies, run tests
3. **Deploy**:
   - Configure SSH connection
   - Create backup of current deployment
   - Sync backend, frontend, and static files
   - Setup Python virtual environment
   - Run database migrations
   - Restart backend service
   - Reload nginx
   - Health check

## Server Setup

### Initial Server Configuration

```bash
# SSH into your Lightsail instance
ssh -i your-key.pem ec2-user@YOUR_SERVER_IP

# Install Python 3.14 (user-local installation)
# Amazon Linux 2023 doesn't have Python 3.14 in repos, so build from source:
wget https://www.python.org/ftp/python/3.14.3/Python-3.14.3.tar.xz
tar xf Python-3.14.3.tar.xz
cd Python-3.14.3
./configure --prefix=$HOME/.local
make -j$(nproc)
make install
cd ..

# Verify installation
~/.local/bin/python3.14 --version

# Install build dependencies (if needed)
sudo dnf install -y gcc make openssl-devel bzip2-devel libffi-devel zlib-devel

# Create app directory
sudo mkdir -p /opt/kenaz
sudo chown $USER:$USER /opt/kenaz

# Create .env file
nano /opt/kenaz/backend/.env
```

### Backend .env Configuration

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/kenaz

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://YOUR_DOMAIN/auth/google/callback

# Frontend
FRONTEND_URL=https://YOUR_DOMAIN

# JWT
JWT_SECRET_KEY=your-random-secret-key

# Payment (optional)
PAYMENT_GATEWAY_TYPE=fake
```

> **Google OAuth setup:** After updating `GOOGLE_REDIRECT_URI`, also add the
> same URI to **Authorized redirect URIs** in
> [Google Cloud Console → Credentials → OAuth 2.0 Client IDs](https://console.cloud.google.com/apis/credentials).
> Without this step, Google will reject the callback and login will show a blank page.

### Systemd Service

Create `/etc/systemd/system/kenaz-backend.service`:

```ini
[Unit]
Description=Kenaz Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/kenaz/backend
Environment="PATH=/opt/kenaz/backend/venv/bin"
ExecStart=/opt/kenaz/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable kenaz-backend
sudo systemctl start kenaz-backend
```

### Nginx Configuration

First, create `/etc/nginx/proxy_params` (if it doesn't exist):

```nginx
proxy_http_version 1.1;

proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
```

Then create `/etc/nginx/conf.d/kenaz.conf`:

```nginx
server {
    listen 80 default_server;
    server_name YOUR_SERVER_IP _;

    root /opt/kenaz/dist;
    index index.html;

    # MIME type for PWA manifest
    types {
        application/manifest+json webmanifest;
    }

    # Service worker - never cache
    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Service-Worker-Allowed "/";
    }

    # PWA manifest - short cache
    location = /manifest.webmanifest {
        add_header Cache-Control "public, max-age=3600";
    }

    # Static assets (images, logos, icons)
    location /static/ {
        alias /opt/kenaz/static/;
        access_log off;
        expires 7d;
        add_header Cache-Control "public";
    }

    # Backend API endpoints
    location /auth/ { proxy_pass http://127.0.0.1:8000/auth/; include /etc/nginx/proxy_params; }
    location /events/ { proxy_pass http://127.0.0.1:8000/events/; include /etc/nginx/proxy_params; }
    location /payments/ { proxy_pass http://127.0.0.1:8000/payments/; include /etc/nginx/proxy_params; }
    location /users/ { proxy_pass http://127.0.0.1:8000/users/; include /etc/nginx/proxy_params; }
    location /registrations/ { proxy_pass http://127.0.0.1:8000/registrations/; include /etc/nginx/proxy_params; }
    location /products/ { proxy_pass http://127.0.0.1:8000/products/; include /etc/nginx/proxy_params; }
    location /uploads/ { proxy_pass http://127.0.0.1:8000/uploads/; include /etc/nginx/proxy_params; }
    location /cities/ { proxy_pass http://127.0.0.1:8000/cities/; include /etc/nginx/proxy_params; }

    # Admin endpoints
    location /admin/ { proxy_pass http://127.0.0.1:8000/admin/; include /etc/nginx/proxy_params; }

    # API docs
    location = /health { proxy_pass http://127.0.0.1:8000/health; include /etc/nginx/proxy_params; }
    location = /docs { proxy_pass http://127.0.0.1:8000/docs; include /etc/nginx/proxy_params; }
    location = /redoc { proxy_pass http://127.0.0.1:8000/redoc; include /etc/nginx/proxy_params; }
    location = /openapi.json { proxy_pass http://127.0.0.1:8000/openapi.json; include /etc/nginx/proxy_params; }

    # Frontend SPA
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Reload nginx:

```bash
sudo systemctl reload nginx
```

## Monitoring Deployment

### GitHub Actions

View deployment status:
- **Repository → Actions tab**
- Click on latest workflow run
- View detailed logs for each step

### Server Logs

```bash
# Backend service logs
sudo journalctl -u kenaz-backend -f

# Nginx logs
sudo tail -f /var/log/nginx/error.log

# Application logs
tail -f /opt/kenaz/backend/logs/app.log
```

## Rollback

If deployment fails, automatic backup is available:

```bash
# SSH to server
ssh -i your-key.pem ec2-user@YOUR_SERVER_IP

# List backups
ls -ltr /opt/kenaz-backup-*

# Restore from backup
sudo systemctl stop kenaz-backend
sudo rm -rf /opt/kenaz
sudo cp -r /opt/kenaz-backup-YYYYMMDD-HHMMSS /opt/kenaz
sudo systemctl start kenaz-backend
```

## Troubleshooting

### SSH Connection Failed

```bash
# Verify SSH credentials locally
ssh -i your-key.pem ec2-user@YOUR_SERVER_IP whoami
```

### Service Failed to Start

```bash
# Check service status
sudo systemctl status kenaz-backend

# Check logs
sudo journalctl -u kenaz-backend -n 100 --no-pager
```

### Database Migration Failed

```bash
# SSH to server and run manually
cd /opt/kenaz/backend
venv/bin/alembic upgrade head
```

### Health Check Failed

```bash
# Test backend directly
curl http://YOUR_SERVER_IP/docs

# Check if service is running
sudo systemctl status kenaz-backend
```

## Security Best Practices

- ✅ Never commit `.env` files
- ✅ Rotate SSH keys regularly
- ✅ Use strong JWT secrets
- ✅ Enable HTTPS with SSL certificate (Let's Encrypt)
- ✅ Configure firewall rules
- ✅ Keep system packages updated
- ✅ Monitor logs for suspicious activity

## CI/CD Pipeline Diagram

```
┌─────────────┐
│  Git Push   │
│   to main   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│    Validate     │
│  Check Secrets  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Build       │
│  Frontend + Tests│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Deploy      │
│  1. Backup      │
│  2. Sync Files  │
│  3. Migrations  │
│  4. Restart     │
│  5. Health Check│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Success! 🚀   │
│  App Running    │
└─────────────────┘
```

## Manual Deployment (Alternative)

If you prefer to deploy manually:

```bash
# Set environment variables
export SSH_HOST=35.157.165.112
export SSH_USER=ec2-user
export SSH_KEY=~/.ssh/lightsail-key.pem

# Run deployment script
./scripts/deploy.sh
```

The deployment script will:
1. ✓ Check requirements and SSH connection
2. ✓ Build frontend (npm ci && npm run build)
3. ✓ Create automatic backup on server
4. ✓ Sync backend, frontend, and static files
5. ✓ Setup Python virtual environment
6. ✓ Install dependencies
7. ✓ Run database migrations
8. ✓ Restart services (kenaz-backend, nginx)
9. ✓ Perform health check

## Rollback

If deployment fails or causes issues:

```bash
# List available backups and restore
export SSH_HOST=35.157.165.112
export SSH_USER=ec2-user
export SSH_KEY=~/.ssh/lightsail-key.pem

./scripts/rollback.sh
```

The rollback script will:
- Show up to 10 most recent backups
- Allow you to select which backup to restore
- Automatically stop services, restore files, and restart

## Support

For deployment issues:
1. Check GitHub Actions logs
2. Review server logs
3. Verify secrets configuration
4. Check server requirements
5. Open an issue on GitHub
