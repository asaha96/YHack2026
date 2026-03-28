#!/bin/bash
# Praxis - Quick Start Script

echo "Praxis - Surgical Practice Platform"
echo "===================================="

# Detect local IP for mobile access
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP="localhost"
fi

# Check for .env
if [ ! -f .env ]; then
  echo ""
  echo "No .env file found. Creating from template..."
  cp .env.example .env
  echo "Please edit .env and add your API keys:"
  echo "   - GROQ_API_KEY"
  echo "   - LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET"
  echo ""
  exit 1
fi

# Source .env for LiveKit check
set -a
source .env
set +a

if [ -z "$LIVEKIT_API_KEY" ] || [ "$LIVEKIT_API_KEY" = "devkey" ]; then
  echo "WARNING: LIVEKIT_API_KEY not configured in .env"
  echo ""
fi

# Generate self-signed certs for HTTPS (needed for mobile camera access)
if [ ! -f certs/cert.pem ]; then
  echo "Generating self-signed SSL certificate for HTTPS..."
  mkdir -p certs
  openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem \
    -days 365 -nodes -subj '/CN=localhost' 2>/dev/null
fi

# Generate mesh data if needed
if [ ! -f frontend/public/models/metadata.json ]; then
  echo "Generating organ mesh data..."
  python3 scripts/download_data.py
fi

# Start backend (bound to 0.0.0.0 so phone can reach it)
echo ""
echo "Starting backend (port 8000)..."
cd backend
source .venv/bin/activate 2>/dev/null || python3 -m venv .venv && source .venv/bin/activate
pip install -q -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Start LiveKit agent worker
echo "Starting LiveKit agent worker..."
cd backend
source .venv/bin/activate 2>/dev/null
python livekit_agent.py dev &
AGENT_PID=$!
cd ..

# Start frontend (--host exposes on local network for mobile access)
echo "Starting frontend..."
cd frontend
npm run dev -- --host &
FRONTEND_PID=$!
cd ..

sleep 2

echo ""
echo "Praxis is running!"
echo ""
echo "  Laptop:   http://localhost:5173/app"
echo "  Mobile:   http://$LOCAL_IP:5173/mobile"
echo "  Live view: https://localhost:5173/view"
echo "  Backend:  http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all servers"

trap "kill $BACKEND_PID $AGENT_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
