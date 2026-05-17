# Changelog

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
