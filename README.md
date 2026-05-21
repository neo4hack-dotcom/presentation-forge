# Presentation Forge

A 100% local app that turns a brief + reference documents into a **board-grade presentation** (HTML + PDF) using a local LLM via Ollama. No cloud, no telemetry, no API keys.

## Stack
- **Backend** — Python 3.12 · FastAPI · Jinja2 · Pillow · pypdf · python-docx · Playwright (Chromium) for PDF.
- **Frontend** — React 18 · Vite. Pure JS + CSS (no TS).
- **LLM** — pluggable via the ⚙️ Settings panel:
  - **Ollama** (native API) — `http://localhost:11434`
  - **OpenAI-compatible HTTP** — LM Studio (`:1234`), vLLM (`:8000`), llama.cpp server (`:8080`), LocalAI, or any `/v1/chat/completions` endpoint
  - API key support, "Test connection" diagnostic, model auto-discovery
  - Config persisted to `backend/storage/config.json` · env-var overrides: `PF_PROVIDER`, `OLLAMA_URL`, `PF_API_KEY`, `PF_MODEL`

## Quick start

### macOS / Linux
```bash
./start.sh
```

### Windows (PowerShell — recommended)
```powershell
.\start.ps1
```
Or simply double-click **`start.bat`** in Explorer.

> **First run** — the script creates a Python venv, installs all deps, downloads Playwright Chromium (~150 MB), then **builds the React frontend**. Takes 2–5 min on first launch; subsequent launches are seconds.

Then open <http://localhost:8765>. **One process, one port** — FastAPI serves both the API and the built React bundle.

### Options
- `PF_PORT=9000 ./start.sh` — change the port
- `PF_SKIP_BUILD=1 ./start.sh` — skip the frontend rebuild (use the existing `frontend/dist/`)
- Windows: `.\start.ps1 -Port 9000 -SkipBuild`

### Dev mode (hot-reload frontend)
If you're iterating on the UI and want Vite HMR:
```bash
# Terminal 1 — backend (FastAPI)
source backend/.venv/bin/activate
python -m uvicorn backend.main:app --port 8765 --reload

# Terminal 2 — frontend (Vite dev server with /api → 8765 proxy)
cd frontend && npm run dev
# Then open http://localhost:5173
```

### Prerequisites
| | macOS/Linux | Windows |
|---|---|---|
| Python | `python3` ≥ 3.10 | `python` ≥ 3.10 from [python.org](https://www.python.org/downloads/) (tick "Add to PATH") |
| Node.js | `node` ≥ 18 | [nodejs.org](https://nodejs.org/) |
| Ollama | `brew install ollama` | [ollama.com](https://ollama.com) installer |

Without Ollama, configure an OpenAI-compatible HTTP endpoint in the ⚙️ Settings panel after first launch.

```bash
# macOS — pull a model
ollama pull gpt-oss:120b-cloud

# Windows PowerShell
ollama pull gpt-oss:120b-cloud
```

## What it does (highlights)
- **Pyramid-principle outlining**: the LLM proposes 8–14 action-titled slides, picks the right layout per slide (KPI grid, SWOT, timeline, chart, two-col, quote, table, section divider…).
- **Parallel slide generation with live streaming** — slides materialize one by one as they're produced.
- **Document ingestion** — PDF, DOCX, Markdown, plain text — fed as context, with the LLM instructed to cite sources (`footnote`).
- **Brand learning** — drop your logo, the app extracts a coherent palette via Pillow median-cut and applies it to the deck.
- **Live theme editor** — 6 presets, full color overrides, three template styles (consulting / executive / dark-board), debounced live preview.
- **Per-slide refinement** — type "make this shorter", "switch to a chart", "ground the numbers in the uploaded PDF" — the slide is regenerated in place.
- **Speaker notes** — produced for every content slide, toggle on/off in the preview.
- **Inline SVG charts** — bar / line / area / donut, generated server-side so PDF fidelity is perfect.
- **Native-resolution PDF export** — 16:9 (13.33" × 7.5"), printed via headless Chromium with background graphics.
- **Standalone HTML export** — single self-contained file.
- **Local project save/load** — JSON snapshots in `backend/storage/projects/`.

## Architecture
```
                ┌─────────────────────────────────────────┐
browser ───────▶│ FastAPI :8765                           │──HTTP──▶ Ollama :11434
                │   /api/*         → backend handlers      │       (or any OpenAI-compatible endpoint)
                │   /            ┐                         │
                │   /assets/*    │ → frontend/dist/ (Vite) │
                │   /<spa-route> ┘                         │
                └─────────────────────────────────────────┘
```

Same model as DOINg: build the React app once into `frontend/dist/`, then FastAPI serves both the API routes and the static bundle from a single Python process. No CORS gymnastics, no separate dev server in production, nothing to wire up.

All assets, uploads, exports, and saved projects live under `backend/storage/`.

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Provider reachability + model list + active config |
| GET/POST | `/api/config` | Read/update LLM config (provider, base URL, key, models) |
| POST | `/api/config/test` | Test a candidate config without saving it |
| POST | `/api/config/models` | List models for a candidate config |
| POST | `/api/parse` | Extract text from PDF/DOCX/MD/TXT |
| POST | `/api/theme/from-image` | Extract palette + return logo data URL |
| POST | `/api/generate/outline` | One-shot outline |
| POST | `/api/generate/stream` | SSE — outline, then each slide |
| POST | `/api/slide/refine` | Revise one slide via user instruction |
| POST | `/api/render/html` | Render deck JSON → HTML |
| POST | `/api/export/pdf` | HTML → PDF via Playwright |
| POST | `/api/export/html` | Standalone HTML file |
| GET/POST/DELETE | `/api/projects[/:id]` | Local project CRUD |

## Hotkeys
- `Cmd/Ctrl + Enter` — generate
- `Cmd/Ctrl + S` — save project
- `Cmd/Ctrl + P` — export PDF
- `Cmd/Ctrl + scroll` — zoom the preview canvas
