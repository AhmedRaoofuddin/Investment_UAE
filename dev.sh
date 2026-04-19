#!/usr/bin/env bash
# Spin up backend + frontend together.
# Usage: ./dev.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ─── Backend ───────────────────────────────────────────────
if [[ ! -d "backend/.venv" ]]; then
  echo ">> creating Python venv"
  python -m venv backend/.venv
fi

if [[ -f "backend/.venv/Scripts/python.exe" ]]; then
  PY="backend/.venv/Scripts/python.exe"
else
  PY="backend/.venv/bin/python"
fi

echo ">> installing backend deps"
$PY -m pip install -q -r backend/requirements.txt

if [[ ! -f "backend/.env" ]]; then
  echo ">> copying backend/.env.example → backend/.env (paste your ANTHROPIC_API_KEY)"
  cp backend/.env.example backend/.env
fi

echo ">> starting FastAPI on http://127.0.0.1:8088"
(cd backend && ../$PY -m uvicorn app.main:app --host 127.0.0.1 --port 8088 --reload) &
BACKEND_PID=$!
trap 'echo ">> shutting down"; kill $BACKEND_PID 2>/dev/null || true' EXIT INT TERM

# ─── Frontend ──────────────────────────────────────────────
if [[ ! -d "frontend/node_modules" ]]; then
  echo ">> installing frontend deps"
  (cd frontend && npm install)
fi

if [[ ! -f "frontend/.env.local" ]]; then
  cp frontend/.env.example frontend/.env.local
fi

echo ">> starting Next.js on http://localhost:3000"
(cd frontend && npm run dev)
