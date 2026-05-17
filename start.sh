#!/usr/bin/env bash
# Presentation Forge — macOS / Linux launcher
# Windows users: double-click start.bat (or run .\start.ps1 in PowerShell)
# Starts the FastAPI backend (port 8765) and the Vite dev server (port 5173)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; RESET="\033[0m"
log() { printf "${GREEN}▸${RESET} %s\n" "$*"; }
warn() { printf "${YELLOW}!${RESET} %s\n" "$*"; }
err() { printf "${RED}✗${RESET} %s\n" "$*" >&2; }

# ---- Sanity checks
command -v python3 >/dev/null || { err "python3 not found"; exit 1; }
command -v node >/dev/null || { err "node not found"; exit 1; }
command -v ollama >/dev/null || warn "ollama not installed — install from https://ollama.com — the app still loads but generation will fail."

# Make sure Ollama daemon is running (no-op if already running)
if command -v ollama >/dev/null; then
  if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    log "Starting Ollama daemon…"
    nohup ollama serve >/tmp/pf-ollama.log 2>&1 &
    sleep 2
  fi
fi

# ---- Backend
if [ ! -d "$ROOT/backend/.venv" ]; then
  log "Creating Python venv…"
  python3 -m venv "$ROOT/backend/.venv"
fi
# shellcheck disable=SC1091
source "$ROOT/backend/.venv/bin/activate"
log "Installing Python deps…"
pip install --quiet --upgrade pip
pip install --quiet -r "$ROOT/backend/requirements.txt"

# Playwright Chromium (needed for PDF export)
if ! python -c "import playwright" 2>/dev/null; then
  pip install --quiet playwright
fi
if [ ! -d "$HOME/Library/Caches/ms-playwright" ] && [ ! -d "$HOME/.cache/ms-playwright" ]; then
  log "Installing Playwright Chromium (one-time, ~150MB)…"
  python -m playwright install chromium
fi

# ---- Frontend
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  log "Installing JS deps…"
  (cd "$ROOT/frontend" && npm install --silent)
fi

# ---- Run
log "Starting backend on http://localhost:8765"
(cd "$ROOT" && python -m uvicorn backend.main:app --host 127.0.0.1 --port 8765 --reload >/tmp/pf-backend.log 2>&1) &
BACK_PID=$!
trap 'kill $BACK_PID 2>/dev/null || true' EXIT INT TERM

sleep 1
log "Starting frontend on http://localhost:5173"
log "Open  ${GREEN}http://localhost:5173${RESET}  in your browser."
(cd "$ROOT/frontend" && npm run dev)
