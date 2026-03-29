#!/bin/bash
# Praxis - Quick Start Script

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
PIDS=()
REQ_STAMP_FILE="backend/.venv/.requirements.sha256"

echo "Praxis - Surgical Practice Platform"
echo "===================================="

cleanup() {
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
}

trap 'cleanup; exit 130' INT TERM

find_python() {
  local candidates=(
    "${PYTHON_BIN:-}"
    "/opt/homebrew/bin/python3.12"
    "/opt/homebrew/opt/python@3.11/bin/python3.11"
    "python3.11"
    "/opt/homebrew/bin/python3.11"
    "python3.12"
    "/opt/homebrew/bin/python3.13"
    "python3.13"
    "python3"
  )

  for candidate in "${candidates[@]}"; do
    [ -z "$candidate" ] && continue
    if command -v "$candidate" >/dev/null 2>&1; then
      if "$candidate" -c 'import sys; raise SystemExit(0 if (3, 11) <= sys.version_info[:2] <= (3, 12) else 1)' 2>/dev/null; then
        echo "$candidate"
        return 0
      fi
    elif [ -x "$candidate" ]; then
      if "$candidate" -c 'import sys; raise SystemExit(0 if (3, 11) <= sys.version_info[:2] <= (3, 12) else 1)' 2>/dev/null; then
        echo "$candidate"
        return 0
      fi
    fi
  done

  return 1
}

wait_for_port() {
  local port="$1"
  local attempts="${2:-30}"
  local delay="${3:-1}"

  for _ in $(seq 1 "$attempts"); do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done

  return 1
}

kill_repo_processes() {
  local pattern="$1"
  local matches
  matches="$(pgrep -f "$pattern" || true)"
  if [ -n "$matches" ]; then
    echo "$matches" | xargs kill 2>/dev/null || true
    sleep 1
  fi
}

requirements_hash() {
  shasum -a 256 backend/requirements.txt | awk '{print $1}'
}

backend_deps_present() {
  python - <<'PY'
import importlib
modules = [
    "fastapi",
    "uvicorn",
    "httpx",
    "dotenv",
    "pydantic",
    "trimesh",
    "numpy",
    "torch",
    "open_clip",
    "PIL",
    "pydicom",
    "nibabel",
    "skimage",
    "cv2",
    "mediapipe",
    "livekit",
]
for module in modules:
    importlib.import_module(module)
PY
}

ensure_port_free() {
  local port="$1"
  local name="$2"
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo ""
    echo "ERROR: Port $port is already in use, so $name can't start."
    echo "Close the existing process or rerun with a different port, for example:"
    echo "  BACKEND_PORT=8001 FRONTEND_PORT=5174 ./start.sh"
    exit 1
  fi
}

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
  echo "   - K2_API_KEY (K2 Think inference; optional Moonshot via KIMI_BASE_URL)"
  echo "   - LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET"
  echo "   - Optional: GROQ_API_KEY for TTS narration only"
  echo ""
  exit 1
fi

PYTHON_CMD="$(find_python || true)"
if [ -z "$PYTHON_CMD" ]; then
  echo ""
  echo "ERROR: Praxis needs Python 3.11 or 3.12 for the backend and LiveKit agent."
  echo "Install Python 3.11/3.12 and rerun the script."
  exit 1
fi

echo "Using Python: $("$PYTHON_CMD" --version 2>&1)"

# Source .env for LiveKit check
set -a
source .env
set +a

if [ -z "${LIVEKIT_API_KEY:-}" ] || [ "${LIVEKIT_API_KEY:-}" = "devkey" ]; then
  echo "WARNING: LIVEKIT_API_KEY not configured in .env"
  echo ""
fi

echo "Stopping any existing Praxis processes..."
kill_repo_processes "$ROOT_DIR/backend/.venv/bin/uvicorn main:app"
kill_repo_processes "$ROOT_DIR/backend/livekit_agent.py"
kill_repo_processes "$ROOT_DIR/frontend/node_modules/.bin/vite"
kill_repo_processes "$ROOT_DIR/backend/.venv/bin/pip install"

ensure_port_free "$BACKEND_PORT" "the backend"
ensure_port_free "$FRONTEND_PORT" "the frontend"

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
  "$PYTHON_CMD" scripts/download_data.py
fi

echo ""
echo "Preparing backend environment..."
if [ -x backend/.venv/bin/python ]; then
  if ! backend/.venv/bin/python -c 'import sys; raise SystemExit(0 if (3, 11) <= sys.version_info[:2] <= (3, 12) else 1)' 2>/dev/null; then
    echo "Rebuilding backend virtualenv with Python 3.11/3.12..."
    rm -rf backend/.venv
  fi
fi

if [ ! -x backend/.venv/bin/python ]; then
  "$PYTHON_CMD" -m venv backend/.venv
fi

source backend/.venv/bin/activate
CURRENT_REQ_HASH="$(requirements_hash)"
INSTALLED_REQ_HASH=""
if [ -f "$REQ_STAMP_FILE" ]; then
  INSTALLED_REQ_HASH="$(cat "$REQ_STAMP_FILE")"
elif backend_deps_present >/dev/null 2>&1; then
  INSTALLED_REQ_HASH="$CURRENT_REQ_HASH"
  echo "$CURRENT_REQ_HASH" > "$REQ_STAMP_FILE"
fi

if [ "$CURRENT_REQ_HASH" != "$INSTALLED_REQ_HASH" ]; then
  echo "Installing backend dependencies..."
  echo "This can take a few minutes on the first run."
  pip install -r backend/requirements.txt
  echo "$CURRENT_REQ_HASH" > "$REQ_STAMP_FILE"
else
  echo "Backend dependencies already up to date."
fi
deactivate

# Start backend
echo "Starting backend (port $BACKEND_PORT)..."
(
  cd backend
  source .venv/bin/activate
  exec uvicorn main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT"
) &
BACKEND_PID=$!
PIDS+=("$BACKEND_PID")

if ! wait_for_port "$BACKEND_PORT" 20 0.5; then
  echo "ERROR: Backend failed to start on port $BACKEND_PORT."
  exit 1
fi

# Start LiveKit agent worker
echo "Starting LiveKit agent worker..."
(
  cd backend
  source .venv/bin/activate
  exec python livekit_agent.py dev
) &
AGENT_PID=$!
PIDS+=("$AGENT_PID")

sleep 2
if ! kill -0 "$AGENT_PID" 2>/dev/null; then
  echo "ERROR: LiveKit agent exited during startup."
  exit 1
fi

# Start frontend
echo "Starting frontend (port $FRONTEND_PORT)..."
(
  cd frontend
  exec npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" --strictPort
) &
FRONTEND_PID=$!
PIDS+=("$FRONTEND_PID")

if ! wait_for_port "$FRONTEND_PORT" 20 0.5; then
  echo "ERROR: Frontend failed to start on port $FRONTEND_PORT."
  exit 1
fi

echo ""
echo "Praxis is running!"
echo ""
echo "  Laptop:    http://localhost:$FRONTEND_PORT/app"
echo "  Mobile:    http://$LOCAL_IP:$FRONTEND_PORT/mobile"
echo "  Live view: http://localhost:$FRONTEND_PORT/view"
echo "  Backend:   http://localhost:$BACKEND_PORT"
echo ""
echo "Press Ctrl+C to stop all servers"

wait
