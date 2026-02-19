#!/bin/bash

# Kenaz Application Starter
# Starts both frontend (Vite) and backend (FastAPI) servers

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
PYTHON_BIN=${PYTHON_BIN:-python3.14}

echo -e "${GREEN}🔥 Starting Kenaz Application...${NC}"

# Check if processes are already running
FRONTEND_PID=$(lsof -ti:5173 2>/dev/null || true)
BACKEND_PID=$(lsof -ti:8000 2>/dev/null || true)

if [ -n "$FRONTEND_PID" ]; then
    echo -e "${YELLOW}⚠️  Frontend already running on port 5173 (PID: $FRONTEND_PID)${NC}"
    echo -e "${YELLOW}   Run ./stop.sh first to clean up${NC}"
    exit 1
fi

if [ -n "$BACKEND_PID" ]; then
    echo -e "${YELLOW}⚠️  Backend already running on port 8000 (PID: $BACKEND_PID)${NC}"
    echo -e "${YELLOW}   Run ./stop.sh first to clean up${NC}"
    exit 1
fi

# Create logs directory
mkdir -p logs

# Setup backend venv if needed
echo -e "${GREEN}📦 Setting up backend...${NC}"
cd backend
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Missing backend/.env${NC}"
    echo -e "${YELLOW}   Configure DATABASE_URL as PostgreSQL, e.g. postgresql://postgres:postgres@localhost:5432/kenaz${NC}"
    exit 1
fi
DB_URL=$(grep -E '^DATABASE_URL=' .env | head -n1 | cut -d= -f2- | tr -d '"')
if [ -z "$DB_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL is missing in backend/.env${NC}"
    exit 1
fi
if [[ "$DB_URL" != postgresql://* && "$DB_URL" != postgres://* ]]; then
    echo -e "${RED}❌ DATABASE_URL must point to PostgreSQL (current: $DB_URL)${NC}"
    exit 1
fi
if [ -d "venv" ] && [ ! -x "venv/bin/python" ]; then
    echo -e "${YELLOW}   Detected broken virtual environment (host-created). Recreating...${NC}"
    rm -rf venv
fi
if [ -d "venv" ] && [ -x "venv/bin/python" ]; then
    VENV_PY=$(venv/bin/python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    if [ "$VENV_PY" != "3.14" ]; then
        echo -e "${YELLOW}   Detected venv on Python ${VENV_PY}; recreating with Python 3.14...${NC}"
        rm -rf venv
    fi
fi
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}   Creating virtual environment...${NC}"
    if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
        echo -e "${RED}❌ ${PYTHON_BIN} not found. Install Python 3.14 first.${NC}"
        exit 1
    fi
    "$PYTHON_BIN" -m venv venv
fi
source venv/bin/activate
echo -e "${YELLOW}   Installing dependencies...${NC}"
python -m pip install -q -r requirements.txt
cd ..

# Start backend in background
echo -e "${GREEN}🚀 Starting backend (FastAPI on :8000)...${NC}"
(cd backend && source venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000 >> ../logs/backend.log 2>&1) &
BACKEND_PID=$!
echo $BACKEND_PID > .backend.pid

# Wait for backend to be ready
echo -e "${YELLOW}   Waiting for backend...${NC}"
for i in {1..10}; do
    if lsof -ti:8000 > /dev/null 2>&1; then
        echo -e "${GREEN}   Backend ready!${NC}"
        break
    fi
    sleep 1
done

# Auto-seed demo data
SEED_DEMO=${SEED_DEMO:-1}
if [ "$SEED_DEMO" = "1" ]; then
    echo -e "${YELLOW}   Seeding demo data...${NC}"
    (cd backend && source venv/bin/activate && python -m backend.cli seed-demo --reset --users 40 --per-event 0 >> ../logs/backend.log 2>&1)
else
    echo -e "${YELLOW}   Skipping demo data seed (SEED_DEMO=0)${NC}"
fi

# Start frontend in background
echo -e "${GREEN}🎨 Starting frontend (Vite on :5173)...${NC}"
# Bind to 0.0.0.0 so VS Code port-forwarding and host browser access work reliably.
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort >> logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > .frontend.pid

# Wait for frontend to be ready
echo -e "${YELLOW}   Waiting for frontend...${NC}"
for i in {1..10}; do
    if lsof -ti:5173 > /dev/null 2>&1; then
        echo -e "${GREEN}   Frontend ready!${NC}"
        break
    fi
    sleep 1
done

# Verify both are running
FRONTEND_CHECK=$(lsof -ti:5173 2>/dev/null || true)
BACKEND_CHECK=$(lsof -ti:8000 2>/dev/null || true)

echo ""
if [ -n "$FRONTEND_CHECK" ] && [ -n "$BACKEND_CHECK" ]; then
    echo -e "${GREEN}✅ Kenaz is running!${NC}"
    echo ""
    echo -e "   Frontend: ${GREEN}http://localhost:5173${NC}"
    echo -e "   Backend:  ${GREEN}http://localhost:8000${NC}"
    echo -e "   API Docs: ${GREEN}http://localhost:8000/docs${NC}"
    echo ""
    echo -e "   Logs:"
    echo -e "   - Frontend: logs/frontend.log"
    echo -e "   - Backend:  logs/backend.log"
    echo ""
    echo -e "${YELLOW}To stop: ./stop.sh${NC}"
else
    echo -e "${RED}❌ Failed to start application${NC}"
    [ -z "$FRONTEND_CHECK" ] && echo -e "${RED}   Frontend not running - check logs/frontend.log${NC}"
    [ -z "$BACKEND_CHECK" ] && echo -e "${RED}   Backend not running - check logs/backend.log${NC}"
    exit 1
fi
