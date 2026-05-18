# Changelog

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
