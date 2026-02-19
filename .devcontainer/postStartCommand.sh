#!/bin/bash
# Kenaz Development Container - Post Start Script
# This script runs every time the container starts

set -e

cd /workspace

echo "🚀 Starting Kenaz application..."

# Ensure logs directory exists
mkdir -p logs

# Clean up any stale PID files
rm -f .backend.pid .frontend.pid

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Gracefully stopping Kenaz..."
    ./stop.sh 2>/dev/null || true
    exit 0
}

# Set up signal handlers for graceful shutdown
trap cleanup SIGTERM SIGINT SIGHUP

# Check if services are already running
FRONTEND_RUNNING=$(lsof -ti:5173 2>/dev/null || true)
BACKEND_RUNNING=$(lsof -ti:8000 2>/dev/null || true)

if [ -n "$FRONTEND_RUNNING" ] || [ -n "$BACKEND_RUNNING" ]; then
    echo "⚠️  Services already running, stopping first..."
    ./stop.sh 2>/dev/null || true
    sleep 2
fi

# Start the application using existing start script
./start.sh

echo ""
echo "✅ Kenaz is running!"
echo ""
echo "Access the application:"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "Use './stop.sh' to stop the application"
echo ""
