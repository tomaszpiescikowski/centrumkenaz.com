#!/bin/bash
# Kenaz Development Container - Post Create Setup
# This script runs once when the container is created

set -euo pipefail

echo "========================================"
echo "🔧 Kenaz Development Environment Setup"
echo "========================================"

cd /workspace

# Create logs directory
mkdir -p logs

# ==========================================
# Backend Setup
# ==========================================
echo ""
echo "📦 Setting up Python backend..."

cd backend
PYTHON_BIN=${PYTHON_BIN:-python3.14}

ensure_backend_venv() {
    # If venv was created on host (e.g., macOS) it will contain broken symlinks
    # and scripts with invalid shebangs inside the container.
    if [ -d "venv" ] && [ ! -x "venv/bin/python" ]; then
        echo "   Detected broken virtual environment (host-created). Recreating..."
        rm -rf venv
    fi

    if [ -x "venv/bin/python" ]; then
        VENV_PY=$(venv/bin/python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        if [ "$VENV_PY" != "3.14" ]; then
            echo "   Detected venv on Python ${VENV_PY}. Recreating for Python 3.14..."
            rm -rf venv
        fi
    fi

    if [ ! -d "venv" ]; then
        echo "   Creating Python virtual environment..."
        # Some base images require the venv package.
        "$PYTHON_BIN" -m venv venv 2>/dev/null || (apt-get update -y && apt-get install -y python3.14-venv && "$PYTHON_BIN" -m venv venv)
    fi
}

ensure_backend_venv

# Activate venv and install dependencies
source venv/bin/activate
echo "   Installing Python dependencies..."
python -m pip install --upgrade pip -q
python -m pip install -r requirements.txt -q

cd /workspace

# ==========================================
# Frontend Setup
# ==========================================
echo ""
echo "🎨 Setting up Node.js frontend..."

# Install npm dependencies
echo "   Installing npm dependencies..."
npm install --silent

# ==========================================
# Agent Configuration Symlinks
# ==========================================
echo ""
echo "🤖 Setting up AI agent configurations..."

# Create symlinks for different AI agents to use AGENTS.md
# These allow each tool to find instructions in their expected location
[ ! -L "GEMINI.md" ] && ln -sf AGENTS.md GEMINI.md
[ ! -L "COPILOT.md" ] && ln -sf AGENTS.md COPILOT.md
[ ! -L "CURSOR.md" ] && ln -sf AGENTS.md CURSOR.md
[ ! -L "AIDER.md" ] && ln -sf AGENTS.md AIDER.md
[ ! -L ".github/copilot-instructions.md" ] && mkdir -p .github && ln -sf ../AGENTS.md .github/copilot-instructions.md

echo "   Created symlinks: GEMINI.md, COPILOT.md, CURSOR.md, AIDER.md"

# ==========================================
# Shell Configuration
# ==========================================
echo ""
echo "🐚 Configuring shell environment..."

# Add workspace-specific zsh config
cat >> ~/.zshrc << 'EOF'

# ==========================================
# Kenaz Project Configuration
# ==========================================

# Auto-activate venv when entering backend directory
cd() {
    builtin cd "$@"
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    fi
}

# Activate venv by default
if [ -d "/workspace/backend/venv" ]; then
    source /workspace/backend/venv/bin/activate
fi

# Navigate to workspace
cd /workspace

# Show welcome message
echo ""
echo "🔥 Kenaz Development Environment Ready!"
echo ""
echo "Commands:"
echo "  start         - Start frontend + backend"
echo "  stop          - Stop all services"
echo "  logs          - Tail all logs"
echo "  logs-backend  - Tail backend logs"
echo "  logs-frontend - Tail frontend logs"
echo ""
echo "URLs (use 127.0.0.1, not localhost):"
echo "  Frontend: http://127.0.0.1:5173"
echo "  Backend:  http://127.0.0.1:8000"
echo "  API Docs: http://127.0.0.1:8000/docs"
echo ""
echo "AI Agents:"
echo "  claude        - Claude Code CLI"
echo "  Read AGENTS.md for AI agent instructions"
echo ""
EOF

# ==========================================
# Verify installations
# ==========================================
echo ""
echo "✅ Verifying installations..."
echo "   Node.js: $(node --version)"
echo "   npm: $(npm --version)"
echo "   Python: $(python3 --version)"
echo "   Claude Code: $(claude --version 2>/dev/null || echo 'not installed')"

# ==========================================
# Initialize database
# ==========================================
echo ""
echo "🗄️  Initializing database..."
cd /workspace
if [ -f "backend/alembic.ini" ]; then
    echo "   Running migrations (alembic upgrade head)..."
    for i in {1..15}; do
        if backend/venv/bin/alembic -c backend/alembic.ini upgrade head >/dev/null 2>&1; then
            echo "   Database migrated successfully"
            break
        fi
        sleep 1
    done
else
    echo "   Alembic not configured; falling back to init_db"
    cd /workspace/backend
    ensure_backend_venv
    ./venv/bin/python -c "import asyncio; from database import init_db; asyncio.run(init_db())" 2>/dev/null || true
fi

cd /workspace

echo ""
echo "========================================"
echo "✨ Setup complete!"
echo "========================================"
echo ""
echo "The application will start automatically."
echo "Access at:"
echo "  Frontend: http://127.0.0.1:5173"
echo "  Backend:  http://127.0.0.1:8000"
echo "  API Docs: http://127.0.0.1:8000/docs"
echo ""
