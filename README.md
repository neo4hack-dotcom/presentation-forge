# Presentation Forge

A **100% local** app that turns a brief + reference documents into a **board-grade presentation** (HTML + PDF) using a local LLM. No cloud, no telemetry, no API keys required.

> Drop a brief, attach a PDF or two, pick a brand color (or a logo to extract the palette from), hit **Generate**. Watch a 12-slide deck stream in slide-by-slide with the right layout for each section — KPI grids, SWOT, timelines, charts, comparisons, executive summary — and export to native-16:9 PDF or a standalone HTML file.

---

## Stack

- **Backend** — Python 3.10+ · FastAPI · Jinja2 · Pillow · pypdf · python-docx · Playwright (Chromium) for PDF.
- **Frontend** — React 18 · **TypeScript (strict)** · Vite 6.
- **LLM** — pluggable via the ⚙️ Settings panel:
  - **Ollama** (native API) — `http://localhost:11434`
  - **OpenAI-compatible HTTP** — LM Studio (`:1234`), vLLM (`:8000`), llama.cpp server (`:8080`), LocalAI, or any `/v1/chat/completions` endpoint
  - API key support, **Test connection** diagnostic, model auto-discovery
  - **Multi-LLM cascade** — different model for outline (cheap/fast) vs slide expansion (heavy/good)
  - Config persisted to `backend/storage/config.json` · env-var overrides: `PF_PROVIDER`, `OLLAMA_URL`, `PF_API_KEY`, `PF_MODEL`

---

## Quick start

### macOS / Linux
```bash
./start.sh
```

### Windows
```powershell
.\start.ps1
```
Or simply double-click **`start.bat`** in Explorer.

> **First run** — the script creates a Python venv, installs all deps, downloads Playwright Chromium (~150 MB), then builds the React frontend. Takes 2–5 min on first launch; subsequent launches are seconds.

Then open <http://localhost:8765>. **One process, one port** — FastAPI serves both the API and the built React bundle.

### Options
| Flag (bash) | Flag (PowerShell) | Effect |
|---|---|---|
| `PF_PORT=9000 ./start.sh` | `.\start.ps1 -Port 9000` | Run on a different port |
| `PF_SKIP_BUILD=1 ./start.sh` | `.\start.ps1 -SkipBuild` | Skip the frontend rebuild (reuse existing `frontend/dist/`) |

### Dev mode (hot-reload frontend)
For UI iteration with Vite HMR, run the two processes separately:
```bash
# Terminal 1 — backend
source backend/.venv/bin/activate
python -m uvicorn backend.main:app --port 8765 --reload

# Terminal 2 — frontend (Vite dev server, proxies /api → :8765)
cd frontend && npm run dev
# Open http://localhost:5173
```

### Prerequisites
|  | macOS / Linux | Windows |
|---|---|---|
| **Python** | `python3` ≥ 3.10 | `python` ≥ 3.10 from [python.org](https://www.python.org/downloads/) (tick "Add to PATH") |
| **Node.js** | `node` ≥ 18 | [nodejs.org](https://nodejs.org/) |
| **Ollama** (optional but recommended) | `brew install ollama` | [ollama.com](https://ollama.com) installer |

Without Ollama, configure an OpenAI-compatible HTTP endpoint in the ⚙️ Settings panel after first launch.

```bash
# Pull a model (any platform)
ollama pull gpt-oss:120b-cloud      # high quality, cloud-routed
ollama pull qwen2.5-coder:7b         # fast, fully local
```

---

## Features

### Generation pipeline
- **Pyramid-principle outlining** — the LLM proposes 8–14 action-titled slides and picks the right layout per slide (KPI grid, SWOT, timeline, chart, two-col, quote, table, section divider, executive summary, …).
- **Editable outline** — review and edit slide titles/layouts before full expansion.
- **Parallel slide streaming** — slides materialize one by one via SSE as they're produced.
- **Document ingestion** — PDF, DOCX, Markdown, plain text fed as context, with the LLM instructed to cite sources (`footnote`).
- **Multi-LLM cascade** — use a small/fast model for the outline and a larger model for slide expansion.

### Slide layouts (18)
`title-only` · `bullets` · `two-col` · `kpi-grid` · `swot` · `timeline` · `chart` · `table` · `quote` · `image-right` · `section-divider` · `executive-summary` · `index` · `big-number` · `process` · `pyramid` · `comparison` · `icon-grid` · `matrix`

### Charts (10, all inline SVG)
`bar` · `line` · `area` · `donut` · `pie` · `stacked-bar` · `horizontal-bar` · `waterfall` (financial bridge, auto ± colors, optional total) · `funnel` (conversion stages with auto-computed rates) · `gauge` (semicircle dial, traffic-light coloring)

All generated server-side, so PDF fidelity is perfect.

### Visual identity
- **6 cover styles** — minimal · bold (full-bleed gradient) · mesh (radial backdrop) · split (diagonal brand band) · editorial (serif) · geometric (abstract shapes)
- **3 section-divider styles** — gradient · minimal · numbered (huge chapter number)
- **Logo placement** — 9-position grid picker for the cover, 3-row picker for headers/footers, independent show/hide toggles, size sliders for each
- **Brand kits** — save the current palette + logo + identity as a reusable kit, load any kit one-click

### Theme
- **6 presets** (Aurora, Graphite, Forest, Sunset, Midnight, Carbon)
- **3 templates** (consulting / executive / dark-board)
- Live color overrides with debounced preview
- **Auto-extract palette** from a logo image or example PDF (Pillow median-cut)

### AI tools
- **AI critic** — board-readiness score (0–10), severity-tagged issues, list of suggested additions. **Apply fix** button on every flagged issue regenerates that slide. **Insert this slide** button on every missing-slide proposal generates a full new slide and splices it in.
- **Fact-check** — flags numeric claims not found in source documents
- **Auto-translate** — 10 languages, preserves JSON structure and numbers
- **Per-slide refinement** — quick-action chips (Shorter · Denser · More visual · Add chart · Cite source · Board-ify · layout recast) + freeform instructions
- **Per-slide undo** — each refine/quick-refine/layout-change pushes the previous state onto a stack (max 5 versions). ↶ button on every slide card, pill badge shows steps available.

### Output
- **Native-resolution PDF** — 16:9 (13.33" × 7.5"), printed via headless Chromium with background graphics
- **Standalone HTML export** — single self-contained file, no server needed
- **Presenter mode** — fullscreen, arrow-key navigation, speaker notes overlay (F5)
- **Local project save/load** — JSON snapshots in `backend/storage/projects/`, 12 auto-versions with one-click restore

### In-app user guide
- ❔ button in the topbar (or `?` shortcut) opens a 17-section modal: Getting started · Workspace map · Writing a brief · Generation pipeline · Slide layouts · Charts · Theme · Visual identity · Brand kits · AI tools · Presenter mode · Projects & versioning · LLM settings · Export · Keyboard shortcuts · FAQ · Privacy · Glossary
- Searchable sidebar, prev/next pagination

---

## Architecture

```
                ┌──────────────────────────────────────────────┐
browser ───────▶│ FastAPI :8765                                │──HTTP──▶ Ollama :11434
                │   /api/*         → backend handlers          │       (or any OpenAI-compatible endpoint)
                │   /              ┐                           │
                │   /assets/*      │ → frontend/dist/ (Vite)   │
                │   /<spa-route>   ┘                           │
                └──────────────────────────────────────────────┘
```

Same model as **DOINg**: build the React app once into `frontend/dist/`, then FastAPI serves both the API routes and the static bundle from a single Python process. No CORS gymnastics, no separate dev server in production.

```
.
├── backend/                # FastAPI + LLM + rendering
│   ├── main.py             # routes (+ SPA static mount)
│   ├── llm.py              # multi-provider client (Ollama / OpenAI-compatible)
│   ├── config.py           # persistent LLM config
│   ├── generator.py        # outline → slides pipeline
│   ├── enhancements.py     # critic / translate / factcheck / refine
│   ├── charts.py           # inline-SVG chart engine
│   ├── renderer.py         # Jinja2 deck → HTML, Playwright → PDF
│   ├── brand_kits.py       # CRUD for reusable theme bundles
│   ├── parsers.py          # PDF / DOCX / MD / TXT extraction
│   ├── style_extractor.py  # palette extraction from image/PDF
│   ├── templates/          # Jinja2 slide templates
│   └── storage/            # config.json, uploads/, outputs/, projects/, brands/
├── frontend/               # React 18 + TS (Vite)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── types.ts        # single source of truth for Deck / Slide / Theme
│   │   └── components/     # InputPanel · OutlineEditor · Preview · ThemePanel · …
│   └── dist/               # built bundle (served by FastAPI)
├── start.sh                # macOS/Linux launcher
├── start.ps1 / start.bat   # Windows launchers
├── CHANGELOG.md
└── README.md
```

All user data (uploads, exports, saved projects, brand kits, LLM config) lives under `backend/storage/`. Nothing leaves your machine unless you point the LLM endpoint at a remote service yourself.

---

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Provider reachability + model list + active config |
| GET/POST | `/api/config` | Read/update LLM config (provider, base URL, key, models) |
| POST | `/api/config/test` | Test a candidate config without saving |
| POST | `/api/config/models` | List models for a candidate config |
| POST | `/api/parse` | Extract text from PDF / DOCX / MD / TXT |
| POST | `/api/theme/from-image` | Extract palette + return logo data URL |
| POST | `/api/theme/from-pdf` | Extract palette from a sample PDF |
| POST | `/api/generate/outline` | One-shot outline |
| POST | `/api/generate/expand-outline` | Outline → all slides (non-streaming) |
| POST | `/api/generate/slide` | Build one slide from an outline entry |
| POST | `/api/generate/stream` | **SSE** — outline, then each slide as it's produced |
| POST | `/api/slide/refine` | Revise a slide via freeform user instruction |
| POST | `/api/slide/quick-refine` | Apply a preset chip (Shorter / Denser / …) |
| GET | `/api/quick-refinements` | List available preset chips |
| POST | `/api/critic` | AI critic pass: score, issues, missing slides |
| POST | `/api/critic/fix-slide` | Regenerate a slide to address a critic suggestion |
| POST | `/api/critic/insert-slide` | Generate a full slide from a critic "missing slide" entry |
| POST | `/api/translate` | Translate the whole deck to a target language |
| POST | `/api/factcheck` | Flag numeric claims not found in source documents |
| POST | `/api/render/html` | Render deck JSON → full HTML |
| POST | `/api/render/preview` | Lighter render for live preview |
| POST | `/api/export/pdf` | HTML → 16:9 PDF (Playwright) |
| POST | `/api/export/html` | Standalone self-contained HTML file |
| GET/POST/DELETE | `/api/projects[/:id]` | Local project CRUD |
| GET | `/api/projects/:id/versions` | List auto-snapshots |
| POST | `/api/projects/:id/restore/:index` | Restore a snapshot |
| GET | `/api/themes` | Built-in theme presets |
| GET/POST/DELETE | `/api/brands[/:id]` | Brand-kit CRUD |

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Cmd/Ctrl + Enter` | Generate |
| `Cmd/Ctrl + S` | Save project |
| `Cmd/Ctrl + P` | Export PDF |
| `Cmd/Ctrl + scroll` | Zoom the preview canvas |
| `?` | Open the in-app user guide |
| `F5` | Toggle presenter mode |
| `→` / `←` (in presenter mode) | Next / previous slide |

---

## Privacy

Everything runs on `localhost`. The only outbound traffic is from your machine to your configured LLM endpoint. With Ollama, that endpoint is also local (except for explicitly cloud-routed models like `gpt-oss:120b-cloud`, which use Ollama's hosted inference — the model name makes this explicit).

No analytics, no telemetry, no calls home.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `[Errno 2] No such file or directory` from Settings → Test connection | A stale uvicorn process from a previous session (often started from a folder you moved/deleted) is still listening on :8765. The launcher now auto-kills it, but you can also: `lsof -ti:8765 \| xargs kill -9` then re-run `./start.sh`. |
| `Address already in use` on launch | Same fix as above — the launcher handles it automatically. |
| Frontend changes don't show up | The launcher serves the **built** bundle. Re-run `./start.sh` (it rebuilds), or use **Dev mode** for hot-reload. |
| PDF export hangs | Playwright Chromium not installed: `source backend/.venv/bin/activate && python -m playwright install chromium`. |
| Ollama "model not found" | `ollama pull <model-name>` first; the Settings panel lists what's available. |

---

## Versioning

See [CHANGELOG.md](./CHANGELOG.md) — currently **v1.3.1**.

Highlights:
- **v1.3.1** — single-process launch (DOINg-style, one port)
- **v1.3** — full TypeScript migration, logo-placement controls, per-slide undo, right-pane layout fix
- **v1.2** — in-app user guide (17 sections)
- **v1.1** — AI critic apply-fix, brand kits, 13 new charts/layouts, visual identity system
- **v1.0** — core pipeline, PDF export, brand extraction, translate, fact-check, presenter mode

---

## License

Personal/internal use. No license file shipped — adapt as you see fit for your own setup.
