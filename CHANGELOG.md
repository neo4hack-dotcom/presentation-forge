# Changelog

## [1.3.2] — 2026-05-21

### Fixed — Robust request handling (`error handling request /api/events` and friends)
- **Unknown `/api/*` paths now return a clean diagnostic 404** instead of being swallowed by the SPA catch-all or bubbling up as `ERROR: Error handling request` in the uvicorn log. The response includes the method, the path, and a hint pointing to the README endpoint list.
- **SSE streaming endpoint no longer errors on client disconnect.** Checks `request.is_disconnected()` between yields and re-raises `asyncio.CancelledError` cleanly — generation stops without writing to a closed transport.
- **Global exception handler** added: any unhandled error becomes a JSON 500 with `{ error, type, path }` and a full stack-trace log, instead of uvicorn's generic message.
- **Path-traversal safe** SPA fallback: requests like `/../../../etc/passwd` now serve `index.html` instead of attempting to resolve outside `frontend/dist/`.

## [1.3.1] — 2026-05-19

### Changed — Single-process launch (DOINg-style)
- **One command, one port.** `./start.sh` (or `.\start.ps1`) now builds the React frontend then runs a single FastAPI process on `http://localhost:8765` that serves both the API and the built SPA. No more separate Vite dev server in the default flow.
- FastAPI mounts `frontend/dist/assets/` and adds a catch-all that returns `index.html` for non-API routes (so client-side routing keeps working).
- Launchers free port 8765 if a stale process is squatting on it, then `exec` uvicorn — no more zombie backends from previous sessions.
- New env vars / flags: `PF_PORT`, `PF_SKIP_BUILD` (bash) · `-Port`, `-SkipBuild` (PowerShell).
- Dev hot-reload still available by running `npm run dev` + uvicorn separately (Vite proxies `/api` → 8765 as before).

## [1.3.0] — 2026-05-19

### Fixed
- **Right pane no longer hides sections below Visual Identity** — the right column inherited `display: flex; flex-direction: column` from `.pane`, which compressed tall children. Overridden to `display: block; overflow-y: auto` so each section stacks at its natural height and the pane scrolls cleanly.

### Added — Logo placement controls
- Cover page logo: **9-position grid picker** (top/middle/bottom × left/center/right) + size slider (32–200 px)
- Header logo: **3-position row picker** (left/center/right) + size slider (16–64 px)
- Footer logo: **3-position row picker** + size slider (12–48 px)
- Independent show/hide toggles per location
- New theme fields: `show_logo_on_cover/header/footer`, `logo_position_cover/header/footer`, `logo_size_cover/header/footer`
- Brand kits persist all logo placement fields

### Added — Per-slide undo
- Every refine / quick-refine / layout-change pushes the previous slide state onto a per-slide `__history` stack (max 5 versions)
- New **↶ Undo** button on each slide card; restores the most recent prior version
- Pill badge on each slide card showing the number of undo steps available

### Changed — Migrated frontend to TypeScript
- Strict TS with proper types throughout (`Theme`, `Deck`, `Slide`, `SlideLayout`, `ChartType`, `LLMConfig`, `StreamEvent`, etc.)
- `tsconfig.json` with `strict: true`, `react-jsx`, ES2022 target
- `npm run build` now runs `tsc --noEmit && vite build`
- All 11 components converted to `.tsx`, `api.js` → `api.ts`, new `src/types.ts` as the single source of truth
- Zero TS errors, identical UI/UX, identical feature set
- UserGuide also migrated to `.tsx` with full type safety

## [1.2.0] — 2026-05-18

### Added — In-app user guide
- New `UserGuide` modal accessible via the **❔** button in the topbar (or <kbd>?</kbd>)
- 17 sections covering: Getting started · Workspace map · Writing a brief · Generation pipeline · Slide layouts (18) · Charts (10) · Theme · Visual identity · Brand kits · AI tools · Presenter mode · Projects & versioning · LLM settings · Export · Keyboard shortcuts · FAQ · Privacy · Glossary
- Searchable sidebar, prev/next pagination, Steps/Tips/KBD/Tag primitives — pattern lifted from DOINg's UserGuide

## [1.1.0] — 2026-05-18

### Added — Apply AI critic suggestions
- **Apply fix** button on every flagged issue — sends the reviewer's suggestion as a refine instruction to the LLM and updates the targeted slide in place
- **Insert this slide** button on every "missing slide" proposal — generates a full slide from the critic's outline entry (`{layout, title, why}`) and splices it after the suggested anchor
- Backend endpoints `POST /api/critic/fix-slide` and `POST /api/critic/insert-slide`
- Resolved suggestions are visually dimmed with a ✓ checkmark

### Added — Brand kits
- Persistent library of reusable themes (palette + logo + footer + visual identity) at `backend/storage/brands/`
- Save the current theme as a brand kit, load any kit one-click, delete kits
- `BrandKitsBar` component below the theme panel; CRUD endpoints `/api/brands`

### Added — More charts & infographics
- **6 new chart types**: `pie`, `stacked-bar`, `horizontal-bar`, `waterfall` (financial bridge with auto-colored ±, dashed connectors, optional total bar), `funnel` (conversion stages with auto-computed conversion rates), `gauge` (semicircle dial with traffic-light coloring)
- **7 new infographic layouts**:
  - `index` — auto-populated table of contents from section dividers
  - `big-number` — single hero KPI with gradient text fill, label, delta, context
  - `process` — 4-6 numbered horizontal steps with chevron connectors
  - `pyramid` — 3-5 trapezoid tiers (vision → tactics)
  - `comparison` — side-by-side cards with one marked "RECOMMENDED"
  - `icon-grid` — 2-4 tiles with emoji icons, title, detail
  - `matrix` — generic 2x2 (impact/effort, risk/reward, etc.) with color-coded quadrants
- Updated `SLIDE_SYSTEM` prompt so the LLM picks the right type/layout for the data

### Added — Visual identity system
- **6 cover styles**: minimal · bold (full-bleed gradient) · mesh (radial gradient backdrop) · split (diagonal brand band) · editorial (serif title) · geometric (abstract brand-color shapes)
- **3 section divider styles**: gradient · minimal · numbered (huge chapter number)
- `VisualIdentityPicker` component with visual swatch previews of every variant
- Theme fields `cover_style`, `divider_style`, `accent_shape`, `index_style` — applied consistently across the deck

## [1.0.0] — 2026-05-17

### Added
- **Core generation pipeline** — outline-first LLM approach (Pyramid Principle), 11 slide layouts, parallel streaming via SSE
- **Inline SVG charts** server-side (bar, line, area, donut) — perfect PDF fidelity
- **PDF export** via headless Playwright Chromium at native 16:9 resolution (13.33" × 7.5")
- **Standalone HTML export** — single self-contained file, no server needed
- **Live theme editor** — 6 presets (Aurora, Graphite, Forest, Sunset, Midnight, Carbon), 3 templates (consulting / executive / dark-board)
- **Brand palette extraction** from logo image or example PDF (Pillow median-cut)
- **Document ingestion** — PDF, DOCX, Markdown, plain text fed as LLM context
- **AI critic pass** — board-readiness score, issues by severity, missing slides
- **Auto-translate** — 10 languages, preserves JSON structure and numbers
- **Fact-check** — flags numeric claims not found in source documents
- **Per-slide refinement** — quick-action chips (Shorter / Denser / More visual / Add chart / Cite source / Board-ify / layout recast) + freeform instructions
- **Outline editor** — review and edit slide titles/layouts before full expansion
- **Layout switcher** — change a slide's layout, LLM recasts content to fit
- **Presenter mode** — fullscreen, arrow-key navigation, speaker notes overlay (F5)
- **Multi-LLM cascade** — separate model for outline vs slide generation
- **Auto-versioning** — 12 snapshots per project, one-click restore
- **Local project persistence** — JSON snapshots in `backend/storage/projects/`
- **⚙️ Settings panel** — Ollama or OpenAI-compatible HTTP, API key, model picker, test connection
- **Windows support** — `start.bat` / `start.ps1` launcher, asyncio event loop fix
