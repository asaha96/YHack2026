#!/bin/bash
# SurgiVision - Quick Start Script

echo "🫀 SurgiVision - AI Surgical Planning Assistant"
echo "================================================"

# Check for .env
if [ ! -f .env ]; then
  echo ""
  echo "⚠️  No .env file found. Creating from template..."
  cp .env.example .env
  echo "📝 Please edit .env and add your API keys:"
  echo "   - ANTHROPIC_API_KEY"
  echo "   - ELEVENLABS_API_KEY"
  echo ""
fi

# Generate mesh data if needed
if [ ! -f frontend/public/models/metadata.json ]; then
  echo "🔧 Generating organ mesh data..."
  python3 scripts/download_data.py
fi

# Start backend
echo ""
echo "🚀 Starting backend (port 8000)..."
cd backend
source .venv/bin/activate 2>/dev/null || python3 -m venv .venv && source .venv/bin/activate
pip install -q -r requirements.txt
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Start frontend
echo "🚀 Starting frontend (port 5173)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ SurgiVision is running!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo "   Health:   http://localhost:8000/health"
echo ""
echo "Press Ctrl+C to stop both servers"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
