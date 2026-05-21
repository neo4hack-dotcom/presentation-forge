#!/usr/bin/env bash
# Presentation Forge — macOS / Linux launcher
# One process, one port. FastAPI serves the API AND the built React frontend on :8765.
# Windows users: double-click start.bat (or run .\start.ps1 in PowerShell)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; CYAN="\033[36m"; RESET="\033[0m"
log() { printf "${GREEN}▸${RESET} %s\n" "$*"; }
warn() { printf "${YELLOW}!${RESET} %s\n" "$*"; }
err() { printf "${RED}✗${RESET} %s\n" "$*" >&2; }

PORT="${PF_PORT:-8765}"
SKIP_BUILD="${PF_SKIP_BUILD:-0}"

# ---- Sanity checks
command -v python3 >/dev/null || { err "python3 not found"; exit 1; }
command -v node    >/dev/null || { err "node not found";    exit 1; }
command -v npm     >/dev/null || { err "npm not found";     exit 1; }
command -v ollama  >/dev/null || warn "ollama not installed — install from https://ollama.com OR configure an OpenAI-compatible endpoint in ⚙️ Settings after the app starts."

# ---- Start Ollama daemon if available and not already running
if command -v ollama >/dev/null; then
  if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    log "Starting Ollama daemon…"
    nohup ollama serve >/tmp/pf-ollama.log 2>&1 &
    sleep 2
  fi
fi

# ---- Python venv + deps
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

# ---- Frontend: install deps + build (single-process: backend serves the bundle)
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  log "Installing JS deps…"
  (cd "$ROOT/frontend" && npm install --silent)
fi

if [ "$SKIP_BUILD" != "1" ]; then
  log "Building frontend (TypeScript → static bundle)…"
  (cd "$ROOT/frontend" && npm run build)
else
  log "PF_SKIP_BUILD=1 → skipping frontend build"
fi

if [ ! -f "$ROOT/frontend/dist/index.html" ]; then
  err "frontend/dist/index.html missing — build failed."
  exit 1
fi

# ---- Free the port if a stale process is squatting on it
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  warn "Port $PORT busy — killing stale process(es)"
  lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# ---- Run: single process serves API + SPA
printf "\n${CYAN}  ┌──────────────────────────────────────────────┐${RESET}\n"
printf   "${CYAN}  │  Presentation Forge running on               │${RESET}\n"
printf   "${CYAN}  │  → http://localhost:%-25s│${RESET}\n" "$PORT"
printf   "${CYAN}  │  Ctrl+C to stop.                             │${RESET}\n"
printf   "${CYAN}  └──────────────────────────────────────────────┘${RESET}\n\n"

exec python -m uvicorn backend.main:app --host 127.0.0.1 --port "$PORT"
