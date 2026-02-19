#!/bin/bash

# Kenaz Application Stopper
# Stops both frontend and backend servers with cleanup

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}🛑 Stopping Kenaz Application...${NC}"

KILLED=0

# Function to kill process on port
kill_port() {
    local PORT=$1
    local NAME=$2
    local PIDS=$(lsof -ti:$PORT 2>/dev/null || true)

    if [ -n "$PIDS" ]; then
        echo -e "${YELLOW}   Killing $NAME on port $PORT (PID: $PIDS)${NC}"
        echo "$PIDS" | xargs kill -9 2>/dev/null || true
        KILLED=1
    fi
}

# Kill by PID files if they exist
if [ -f ".frontend.pid" ]; then
    PID=$(cat .frontend.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${YELLOW}   Killing frontend (PID: $PID)${NC}"
        kill -9 $PID 2>/dev/null || true
        KILLED=1
    fi
    rm -f .frontend.pid
fi

if [ -f ".backend.pid" ]; then
    PID=$(cat .backend.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${YELLOW}   Killing backend (PID: $PID)${NC}"
        kill -9 $PID 2>/dev/null || true
        KILLED=1
    fi
    rm -f .backend.pid
fi

# Also check ports directly (in case PID files are stale)
kill_port 5173 "Frontend (Vite)"
kill_port 8000 "Backend (FastAPI)"

# Kill any lingering node processes from this project
VITE_PIDS=$(pgrep -f "vite.*kenaz" 2>/dev/null || true)
if [ -n "$VITE_PIDS" ]; then
    echo -e "${YELLOW}   Killing lingering Vite processes: $VITE_PIDS${NC}"
    echo "$VITE_PIDS" | xargs kill -9 2>/dev/null || true
    KILLED=1
fi

# Kill any lingering uvicorn processes from this project
UVICORN_PIDS=$(pgrep -f "uvicorn.*main:app" 2>/dev/null || true)
if [ -n "$UVICORN_PIDS" ]; then
    echo -e "${YELLOW}   Killing lingering Uvicorn processes: $UVICORN_PIDS${NC}"
    echo "$UVICORN_PIDS" | xargs kill -9 2>/dev/null || true
    KILLED=1
fi

if [ $KILLED -eq 0 ]; then
    echo -e "${GREEN}   No running processes found${NC}"
else
    echo ""
    echo -e "${GREEN}✅ All Kenaz processes stopped${NC}"
fi

# Verify ports are free
sleep 1
FRONTEND_CHECK=$(lsof -ti:5173 2>/dev/null || true)
BACKEND_CHECK=$(lsof -ti:8000 2>/dev/null || true)

if [ -n "$FRONTEND_CHECK" ] || [ -n "$BACKEND_CHECK" ]; then
    echo -e "${RED}⚠️  Warning: Some processes may still be running${NC}"
    [ -n "$FRONTEND_CHECK" ] && echo -e "${RED}   Port 5173: PID $FRONTEND_CHECK${NC}"
    [ -n "$BACKEND_CHECK" ] && echo -e "${RED}   Port 8000: PID $BACKEND_CHECK${NC}"
else
    echo -e "${GREEN}   Ports 5173 and 8000 are now free${NC}"
fi
