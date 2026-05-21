# Presentation Forge — Functional Specification

> A complete, implementation-agnostic spec for rebuilding the app from scratch in any stack.
> Reference implementation: Python (FastAPI) + React (TS/Vite) + Ollama. Anything you read here can be implemented in Go + Svelte, Rust + Vue, Node + Next, etc.

**Document version:** 1.0 (matches app v1.3.2, 2026-05-21)

---

## Table of Contents

1. [Product Vision & Scope](#1-product-vision--scope)
2. [User Personas & Top Journeys](#2-user-personas--top-journeys)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Domain Model (Data Contracts)](#4-domain-model-data-contracts)
5. [Slide Layout Catalogue](#5-slide-layout-catalogue)
6. [Chart Catalogue](#6-chart-catalogue)
7. [Theme & Visual Identity](#7-theme--visual-identity)
8. [AI Pipelines](#8-ai-pipelines)
9. [LLM Prompts (canonical text)](#9-llm-prompts-canonical-text)
10. [LLM Configuration](#10-llm-configuration)
11. [Document Ingestion](#11-document-ingestion)
12. [Brand Palette Extraction](#12-brand-palette-extraction)
13. [Export Formats](#13-export-formats)
14. [Persistence Model](#14-persistence-model)
15. [REST API Contract](#15-rest-api-contract)
16. [UI Specification](#16-ui-specification)
17. [Keyboard Shortcuts](#17-keyboard-shortcuts)
18. [Error Handling & Edge Cases](#18-error-handling--edge-cases)
19. [Non-Functional Requirements](#19-non-functional-requirements)
20. [Out of Scope](#20-out-of-scope)

---

## 1. Product Vision & Scope

### Pitch
Turn a brief + reference documents into a **board-grade slide deck** (HTML + PDF) in under 2 minutes, using a **local LLM**. No cloud, no telemetry, no API keys required.

### Non-negotiables
- **100% local-first.** All compute, storage, and inference run on the user's machine by default. Only outbound traffic is to the LLM endpoint they configure.
- **Pyramid Principle structure.** Every generated deck follows situation → complication → question → answer → recommendation. Slides have action-oriented titles that reveal the so-what.
- **Editable JSON deck.** The deck is a strongly-typed JSON document; the UI is a renderer + editor over that document. The LLM produces JSON, never raw HTML.
- **Native-16:9 output fidelity.** PDF export at 1280×720 (13.33"×7.5") with all charts as inline SVG so vector fidelity is preserved.
- **Single-process deployment.** One command, one port, one process serves API + UI.

### What it is
A **deck generator + editor + exporter** for a single user (no multi-user, no auth).

### What it is not
- Not a real-time collaboration tool
- Not a Figma/Canva replacement (no free-form canvas, no drawing primitives)
- Not a chart library (charts are picked & emitted by the LLM and rendered as SVG)
- Not an LLM training/fine-tuning environment

---

## 2. User Personas & Top Journeys

### Personas
- **P1 — Consultant / PM** preparing a board pack or steerco deck (primary)
- **P2 — Founder** building investor / pitch material
- **P3 — Internal trainer** turning a doc into a teaching deck

### Critical user journeys

**J1 — First deck from a brief (90 s)**
1. User opens app
2. Types a one-paragraph brief: *"Q1 board update for our SaaS, focus on retention drop and 2026 plan"*
3. Optionally drops 1–3 PDFs / DOCXs as context
4. Picks a theme preset or default
5. Clicks **Generate** → outline streams in (~5 s), then slides stream one-by-one (~5 s per slide)
6. Reviews preview, clicks **Export PDF**

**J2 — Brand-matched deck**
1. User uploads company logo
2. Palette extracted automatically (median-cut), theme updated live
3. User saves it as a Brand Kit for reuse on future decks

**J3 — Iterate on a single slide**
1. User clicks a slide in the slide list
2. Uses quick-action chip (*Shorter* / *Add chart* / *Board-ify*) or freeform *"Replace the bullets with a 4-step process"*
3. Slide regenerates in place
4. If they don't like it: ↶ Undo restores prior version

**J4 — Critic-driven polish**
1. User clicks **🧐 AI critic**
2. Gets score, list of issues, suggested missing slides
3. Clicks **✨ Apply fix** on each issue → slide auto-revised
4. Clicks **＋ Insert this slide** on missing-slide suggestions → new slide spliced in

**J5 — Translation**
1. User picks target language from dropdown
2. Clicks **🌍 Translate** → entire deck translated in place, JSON structure preserved, numbers preserved

---

## 3. High-Level Architecture

### Process topology
```
                ┌──────────────────────────────────────────────┐
browser ───────▶│ Application server :PORT                     │──HTTP──▶ LLM endpoint
                │   /api/*         → JSON handlers             │       (Ollama native / OpenAI-compatible)
                │   /              ┐                           │
                │   /assets/*      │ → built SPA bundle        │
                │   /<spa-route>   ┘                           │
                └──────────────────────────────────────────────┘
```

- **One server process** serves both the JSON API and the static SPA bundle.
- **SPA is built once** into a `dist/` folder; the server mounts it as static files with a catch-all that falls back to `index.html` for client-side routes.
- **LLM is out-of-process.** The app speaks to it over HTTP. Two protocols are supported: Ollama's native API and any OpenAI-compatible `/v1/chat/completions` endpoint.

### Module decomposition (logical)
| Module | Responsibility |
|---|---|
| **LLM client** | Single-shot chat, streaming chat, JSON-mode chat with retries, provider abstraction |
| **Config** | Persist + load LLM provider settings (provider, base URL, API key, default model, outline model, timeout) |
| **Parsers** | Extract plain text from PDF / DOCX / Markdown / TXT uploads |
| **Style extractor** | Extract palette from logo image (median-cut) or sample PDF |
| **Generator** | Outline → slides pipeline, including streaming and per-slide refinement |
| **Enhancements** | Critic, translate, fact-check, quick-refinement presets |
| **Charts** | Render `ChartSpec` JSON to inline SVG (10 chart types) |
| **Renderer** | Render `Deck` JSON to standalone HTML via templates; render HTML to PDF via headless Chromium |
| **Brand kits** | CRUD for saved theme bundles (palette + logo + identity settings) |
| **Projects** | CRUD for saved decks (full state snapshot) + auto-versioning |
| **API layer** | HTTP routes wiring all of the above |
| **UI** | React SPA with the editor, preview, settings, user guide |

---

## 4. Domain Model (Data Contracts)

These are the canonical types. The frontend and backend share these shapes; the LLM is prompted to emit JSON matching them.

### 4.1 Deck
```ts
interface Deck {
  title: string
  subtitle?: string
  author?: string
  date?: string
  audience?: string
  executive_summary?: string
  slides: Slide[]
}
```

### 4.2 Slide
A slide is a tagged union: `layout` is the discriminator; only the fields relevant to that layout are populated.

```ts
type SlideLayout =
  | 'title' | 'index' | 'section' | 'bullets' | 'two-column'
  | 'kpi' | 'big-number' | 'quote' | 'table' | 'timeline'
  | 'swot' | 'matrix' | 'process' | 'pyramid' | 'comparison'
  | 'icon-grid' | 'chart' | 'closing'

interface Slide {
  id: string                  // stable, e.g. "s1"…"s14"
  layout: SlideLayout
  title?: string
  subtitle?: string
  body?: string               // optional short paragraph (Markdown)
  bullets?: string[]          // for layout=bullets, max 5
  left?:  { title?: string; bullets?: string[] }   // two-column
  right?: { title?: string; bullets?: string[] }   // two-column
  kpis?: KpiTile[]            // 3–6 tiles
  quote?: { text: string; author?: string }
  table?: { headers: string[]; rows: (string|number)[][] }
  timeline?: { when: string; what: string; detail?: string }[]
  swot?: {
    strengths?: string[]; weaknesses?: string[]
    opportunities?: string[]; threats?: string[]
  }
  matrix?: {
    x_label?: string; y_label?: string
    q1?: QuadrantCell; q2?: QuadrantCell
    q3?: QuadrantCell; q4?: QuadrantCell
  }
  process?: { steps?: { title: string; detail?: string }[] }      // 4–6 steps
  pyramid?: { tiers?: { label: string; detail?: string }[] }      // 3–5 tiers
  comparison?: { items?: { title: string; highlight?: boolean; points?: string[] }[] }
  icon_grid?: { tiles?: { icon?: string; title: string; detail?: string }[] }
  big_number?: {
    value: string; label?: string
    delta?: string; trend?: 'up'|'down'|'flat'
    context?: string
  }
  chart?: ChartSpec
  footnote?: string           // source citation
  notes?: string              // speaker notes (mandatory for content slides)

  // Client-only flags (NOT persisted on backend, MUST be stripped before LLM calls)
  __pending?: boolean         // slide is currently being regenerated
  __history?: Slide[]         // undo stack (max 5 entries)
}

interface KpiTile {
  label: string
  value: string               // headline number, formatted ("€12.4M", "+18%")
  delta?: string              // change vs prior period
  trend?: 'up'|'down'|'flat'
}

interface QuadrantCell {
  title?: string
  items?: string[]
}
```

### 4.3 ChartSpec
```ts
type ChartType =
  | 'bar' | 'line' | 'area' | 'donut' | 'pie'
  | 'stacked-bar' | 'horizontal-bar'
  | 'waterfall' | 'funnel' | 'gauge'

interface ChartSpec {
  type: ChartType
  labels?: string[]                              // x-axis / category labels
  series?: { name: string; values: number[] }[]  // 1+ series; for waterfall, NEGATIVE = decrease
  ylabel?: string
  insight?: string                                // one-line so-what
  max?: number                                    // for gauge: the goal value
}
```

### 4.4 Theme
```ts
interface Theme {
  name: string                                  // preset name or "Custom"
  primary: string; secondary: string; accent: string  // hex
  background: string; surface: string; text: string; muted: string
  heading_font: string                          // CSS font-family string
  body_font: string
  mono_font: string
  logo: string | null                           // data URL (base64) or null
  footer: string                                // free text shown in footer
  template: 'consulting' | 'executive' | 'dark-board'
  dark: boolean

  // Visual identity
  cover_style: 'minimal' | 'bold' | 'mesh' | 'split' | 'editorial' | 'geometric'
  divider_style: 'gradient' | 'minimal' | 'numbered'
  accent_shape?: 'bar' | 'dot' | 'line' | 'triangle' | 'none'
  index_style?: 'list' | 'grid' | 'numbered'

  // Logo placement
  show_logo_on_cover?: boolean
  show_logo_on_header?: boolean
  show_logo_on_footer?: boolean
  logo_size_cover?: number         // px, 32–200
  logo_position_cover?: LogoGridPosition
  logo_size_header?: number        // px, 16–64
  logo_position_header?: LogoRowPosition
  logo_size_footer?: number        // px, 12–48
  logo_position_footer?: LogoRowPosition
}

type LogoGridPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'
type LogoRowPosition = 'left' | 'center' | 'right'
```

### 4.5 LLMConfig
```ts
interface LLMConfig {
  provider: 'ollama' | 'openai'   // "openai" = any OpenAI-compatible endpoint
  base_url: string                 // e.g. "http://localhost:11434" or "http://localhost:1234"
  default_model: string            // model id for slide generation
  outline_model: string            // optional separate model for outline (cascade)
  timeout: number                  // seconds
  api_key_set: boolean             // never returns the key itself
}
```

### 4.6 Project (saved deck)
```ts
interface ProjectListItem {
  id: string                       // ULID-style or short uuid
  name: string
  updated_at: number               // ms timestamp
  n_slides: number
}
interface FullProject extends ProjectListItem {
  prompt: string
  context: string                  // concatenated source-document text
  audience: string
  deck: Deck | null
  theme: Partial<Theme> | null
  versions?: Deck[]                // auto-snapshots, max 12, most recent first
}
```

### 4.7 BrandKit
```ts
interface BrandKitSummary {
  id: string
  name: string
  primary: string; secondary: string; accent: string
  logo?: string | null
  dark: boolean
  updated_at: number
}
// Full brand kit = BrandKitSummary + the full Theme it captures
```

### 4.8 Critic & Fact-check
```ts
interface CriticIssue {
  slide_id?: string | null         // null = deck-wide
  severity: 'low' | 'medium' | 'high'
  category: string                  // e.g. "Clarity", "Evidence", "Layout"
  issue: string
  suggestion?: string               // actionable fix
}
interface CriticMissingSlide {
  after_slide_id?: string | null   // null = append at end
  layout: SlideLayout
  title: string
  why?: string
}
interface CriticReview {
  overall_score: number             // 0–10
  summary: string
  issues: CriticIssue[]
  missing_slides: CriticMissingSlide[]
  strengths: string[]
}

interface FactCheckResult {
  checked: number                   // count of numeric claims found
  supported: number                 // count grounded in sources
  flagged: {
    slide_id: string
    field: string                   // which slide field contained the claim
    claim: string
    snippet: string                 // the unsupported number in context
  }[]
}
```

### 4.9 StreamEvent (SSE)
```ts
type StreamEvent =
  | { event: 'status'; message: string }
  | { event: 'outline'; outline: Deck }
  | { event: 'slide'; slide: Slide }
  | { event: 'done'; deck: Deck }
  | { event: 'error'; message: string }
```

---

## 5. Slide Layout Catalogue

The deck supports 18 layouts. Each is a contract between the LLM (emits JSON), the renderer (produces HTML), and the editor (shows the right form).

| Layout | Required fields | Optional | Purpose | Renderer rule |
|---|---|---|---|---|
| `title` | `title` | `subtitle`, `author`, `date` | Cover slide | Apply selected `cover_style` |
| `index` | `title` | — (auto-populated from sections) | Table of contents | Render list of `section` slide titles in deck order |
| `section` | `title` | `subtitle` | Chapter divider | Apply selected `divider_style` |
| `bullets` | `bullets[]` (≤ 5) | `body`, `title` | Standard bulleted slide | Tight sentences, no fragments |
| `two-column` | `left.bullets[]`, `right.bullets[]` | `left.title`, `right.title` | Side-by-side contrast | 2 columns 50/50 |
| `kpi` | `kpis[]` (3–6) | `body` | Numeric snapshot | Grid of tiles with value+delta+trend arrow |
| `big-number` | `big_number.value` | `label`, `delta`, `trend`, `context` | Hero single-number slide | Massive type, gradient fill on number |
| `quote` | `quote.text` | `quote.author` | High-impact quote | Centered, large serif, attribution below |
| `table` | `table.headers[]`, `table.rows[][]` | — | Structured comparison | 4–6 rows, headers sticky |
| `timeline` | `timeline[]` (≥ 3) | — | Sequenced milestones | Horizontal or vertical timeline with date/event/detail |
| `swot` | `swot.{strengths,weaknesses,opportunities,threats}` | — | 2x2 strategic posture | 4 quadrants, color-coded |
| `matrix` | `matrix.{q1..q4}` | `x_label`, `y_label` | Generic 2x2 | Q1 top-right (high/high), labels on axes |
| `process` | `process.steps[]` (4–6) | — | Sequential numbered steps | Chevron connectors between steps |
| `pyramid` | `pyramid.tiers[]` (3–5) | — | Hierarchical decomposition | Trapezoid tiers from broad (top) to specific (bottom) |
| `comparison` | `comparison.items[]` (2–4) | — | Option comparison | Exactly ONE item has `highlight: true` (the recommendation) |
| `icon-grid` | `icon_grid.tiles[]` (2–4) | — | Feature/principle grid | One emoji icon per tile |
| `chart` | `chart` | `title`, `subtitle` | Data visualization | See chart catalogue (§6) |
| `closing` | `title` | `body`, `bullets` | Final slide | Typically "Thank you" or "Next steps" |

**Universal optional fields on every slide:** `footnote` (source citation), `notes` (speaker notes).

---

## 6. Chart Catalogue

Charts are rendered as **inline SVG** server-side so PDF export is pixel-perfect and vector-scalable.

| Type | Best for | Required fields | Notes |
|---|---|---|---|
| `bar` | Compare across categories | `labels`, `series` (1+) | Vertical bars, grouped if >1 series |
| `line` | Trends over time | `labels`, `series` (1+) | Smoothed or straight lines |
| `area` | Trends with magnitude | `labels`, `series` (1+) | Filled below the line |
| `donut` | Share of whole, with hole | `labels`, `series[0].values` | Single series only |
| `pie` | Share of whole, full | `labels`, `series[0].values` | Single series only |
| `stacked-bar` | Composition over time | `labels`, `series` (2+) | Stacked vertical bars |
| `horizontal-bar` | Ranked lists, long labels | `labels`, `series[0].values` | Sort descending |
| `waterfall` | Financial bridge (start → contributions → end) | `labels`, `series[0].values` | NEGATIVE values = decreases; dashed connectors; auto-colored ± |
| `funnel` | Conversion stages | `labels`, `series[0].values` | Auto-computed conversion rate per stage |
| `gauge` | Single % vs target | `series[0].values[0]`, `max` | Semicircle dial; traffic-light coloring (red/amber/green) |

Every chart accepts an `insight` field: a one-line so-what rendered below the chart.

---

## 7. Theme & Visual Identity

### 7.1 Theme presets
Ship at least 6 named presets:
| Name | Vibe | Notes |
|---|---|---|
| Aurora | Bright blue/violet gradient | Default |
| Graphite | Neutral grey on white | Conservative |
| Forest | Deep green | Sustainability/agri |
| Sunset | Warm orange/red | Marketing |
| Midnight | Dark navy + cyan accent | Tech |
| Carbon | Black + electric green | Bold/board |

### 7.2 Templates
Three layout templates change spacing, header style, and accent treatment:
- **consulting** — quiet, dense, neutral header bar
- **executive** — generous whitespace, large accent header
- **dark-board** — high-contrast, dark surface, glowing accents

### 7.3 Cover styles (6)
| Style | Description |
|---|---|
| `minimal` | Refined typography + accent bar |
| `bold` | Full-bleed brand-color gradient |
| `mesh` | Radial-gradient ambient backdrop |
| `split` | Diagonal brand-color band |
| `editorial` | Serif title, magazine feel |
| `geometric` | Abstract brand-color shapes |

### 7.4 Section-divider styles (3)
| Style | Description |
|---|---|
| `gradient` | Full-bleed brand gradient (default) |
| `minimal` | Quiet, accent bar |
| `numbered` | Huge chapter number on the side |

### 7.5 Logo placement
- **Cover:** 9-position grid (top/middle/bottom × left/center/right), size 32–200 px
- **Header (each slide):** 3-position row (left/center/right), size 16–64 px
- **Footer (each slide):** 3-position row, size 12–48 px
- Each location has an **independent show/hide toggle**
- The picker UI is **visual** — a 3×3 grid of clickable cells, not a dropdown

### 7.6 Brand kits
A **BrandKit** is a snapshot of (palette + logo + footer + visual identity settings) — basically a saved `Theme`. Users can save the current theme as a kit, list kits, load any kit one-click, delete kits.

---

## 8. AI Pipelines

### 8.1 Generation pipeline (outline-first)
```
User brief + context + audience + tone + target_slides
        │
        ▼
┌──────────────────┐
│  build_outline   │  LLM call #1 (JSON mode)
│  → Deck (slides  │  Uses OUTLINE_SYSTEM prompt
│    have only id, │  Output: 8–14 outline entries
│    layout, title,│
│    intent)       │
└──────────────────┘
        │
        ▼ (parallel, semaphore=3)
┌──────────────────┐
│  build_slide × N │  LLM call #2…N+1 (JSON mode)
│  → Slide         │  Uses SLIDE_SYSTEM prompt
│                  │  Each slide produced independently
└──────────────────┘
        │
        ▼
        Final Deck
```
- **Streaming via SSE.** Emit `status` → `outline` → N × `slide` → `done`. On any failure: emit `error`.
- **Parallelism cap = 3** concurrent slide generations (configurable).
- **Cascade:** outline can use a cheaper/faster model than slides.

### 8.2 Per-slide refinement
**Inputs:** the slide JSON + a free-text instruction + optional context.
**Behavior:** LLM rewrites the entire slide JSON (same schema) honoring the instruction. The result replaces the original in place.

### 8.3 Quick-refinement presets
A fixed set of preset instructions chip-buttons exposed in the UI. Canonical list (must include at least these 14):
- `shorter` — "Make this slide shorter and tighter. Cut filler. Bullets <14 words."
- `denser` — "Add more substance — numbers, names, dates. Pull concrete facts from context."
- `more-visual` — "Switch to a more visual layout (kpi, chart, timeline, or swot)."
- `add-chart` — "Add or improve a chart. Pick the type that reveals the so-what."
- `add-citation` — "Ground every numeric claim in a `footnote`."
- `more-board` — "Sharpen for a board audience: action-oriented title, no jargon."
- `kpi` / `bullets` / `chart` / `two-column` / `swot` / `timeline` / `table` / `quote` — recast as that specific layout

### 8.4 Critic pipeline
**Input:** the whole deck JSON + context.
**Output:** `CriticReview` with score, summary, issues (per-slide or deck-wide), missing-slide proposals, and strengths.

**Apply-fix flow:**
- For each `CriticIssue` with `slide_id`: regenerate that slide using the issue's `suggestion` as a refinement instruction. Update in place. Mark issue as resolved (`_resolved: true`, dimmed in UI).
- For each `CriticMissingSlide`: generate a new slide from the proposed outline entry, splice it after `after_slide_id` (or append if null). Mark as resolved.

### 8.5 Translate pipeline
**Input:** the deck JSON + target language.
**Output:** the same deck JSON with all human-readable strings translated. Preserves:
- JSON structure and keys
- All numbers, dates, IDs
- Layout types (not translated)
- The `id` field on every slide

### 8.6 Fact-check pipeline
**Local algorithm (no LLM):**
1. Walk every slide, extract all numeric tokens from text fields using a regex covering currencies, percentages, magnitudes (`€12.4M`, `+18%`, `1,234`, `3.5x`).
2. Normalize each number (strip currency symbols, separators).
3. For each number, check whether a normalized form appears in the concatenated `sources_text`.
4. If not found, add to `flagged[]` with `slide_id`, `field`, the claim, and a snippet showing the surrounding text.

---

## 9. LLM Prompts (canonical text)

These prompts produce the canonical schemas. They are the most important "code" in the system — preserve them verbatim when porting.

### 9.1 `OUTLINE_SYSTEM`
```
You are a senior management consultant (think McKinsey / BCG partner level) producing board-grade presentations.

You build an OUTLINE first. The outline is a JSON object:

{
  "title": "Sharp, board-ready deck title",
  "subtitle": "One-line value proposition (<= 90 chars)",
  "author": "...", "date": "...", "audience": "...",
  "executive_summary": "3-5 sentences distilling the so-what for an executive audience.",
  "slides": [
    {"id": "s1", "layout": "<one of: title|section|bullets|two-column|kpi|quote|table|timeline|swot|chart|closing>",
     "title": "Slide title (action-oriented, MECE)", "intent": "What this slide must convey in one line"}
  ]
}

RULES:
- 8 to 14 slides total. Open with `title`, close with `closing`. Use `section` to break the deck into 2-4 chapters.
- Every non-divider slide title must be ACTION-ORIENTED and reveal the so-what (e.g. "Demand has tripled but margin is compressing" — NOT "Demand"). No vague topic titles.
- Pick the layout that fits the *content*, not the other way around. Use `kpi` for numeric snapshots, `chart` when there is a trend or comparison, `timeline` for sequencing, `swot` for posture, `table` for structured comparisons, `quote` sparingly.
- The deck should follow a Pyramid Principle arc: situation → complication → question → answer → supporting arguments → recommendation / next steps.
- Reply with VALID JSON only. No markdown, no prose.
```

### 9.2 `SLIDE_SYSTEM`
(See `backend/generator.py` for the full canonical text — too long to reproduce here.)

Key requirements baked into the prompt:
- Output ONE slide as JSON matching the union schema in §4.2
- Use the user context aggressively — pull real numbers, names, dates, quotes
- NO filler, NO platitudes; bullets are tight claim-style sentences ≤ 18 words
- For `chart`, pick the type that best reveals the so-what (with exhaustive guidance per chart type)
- For `comparison`, mark exactly ONE item with `highlight: true`
- For `matrix`, q1 = high impact / low effort (quick wins), q2 = high impact / high effort, etc.
- **Speaker `notes` are mandatory for every content slide**
- Reply with VALID JSON only

### 9.3 `REFINE_SYSTEM`
```
You revise a single slide based on user feedback. Output the FULL revised slide JSON (same schema as before). No prose, JSON only.
```

### 9.4 `CRITIC_SYSTEM`
```
You are a senior partner-level reviewer for a board-grade presentation. You evaluate a deck with a sharp, fair eye and produce *actionable* feedback — never generic platitudes.

Output JSON:
{
  "overall_score": 0–10,
  "summary": "1-2 sentence overall verdict",
  "issues": [
    {"slide_id": "s3" | null, "severity": "low|medium|high",
     "category": "Clarity|Evidence|Layout|Narrative|Visual|...",
     "issue": "What's wrong, specifically",
     "suggestion": "How to fix it (actionable instruction)"}
  ],
  "missing_slides": [
    {"after_slide_id": "s5" | null,
     "layout": "<SlideLayout>",
     "title": "Action-oriented title",
     "why": "What this slide would add to the narrative"}
  ],
  "strengths": ["Short bullet 1", ...]
}
```

### 9.5 `TRANSLATE_SYSTEM`
```
You translate a presentation deck JSON from its current language to the target language while preserving:
- JSON structure and keys (do NOT translate keys)
- All numbers, dates, IDs (do NOT alter them)
- Layout types
- The id field on every slide

Output VALID JSON only.
```

---

## 10. LLM Configuration

### 10.1 Providers
Two providers, both pluggable at runtime:

**Ollama (native API)**
- List models: `GET {base_url}/api/tags`
- Chat: `POST {base_url}/api/chat` with `{model, messages, stream, options:{temperature}, format?:"json"}`
- Streaming: `stream: true` → JSON lines, each with `{message:{content}, done}`

**OpenAI-compatible HTTP**
- List models: `GET {base_url}/v1/models` (fallback: `/models`)
- Chat: `POST {base_url}/v1/chat/completions` with `{model, messages, temperature, stream, response_format?:{type:"json_object"}}`
- Streaming: SSE with `data: {...}` lines and `data: [DONE]`
- API key sent as `Authorization: Bearer <key>`

### 10.2 JSON-mode chat with retries
- Wrap `chat()` calls that expect JSON: ask for JSON-mode (Ollama `format:"json"` or OpenAI `response_format`).
- On `JSONDecodeError` or partial response, retry up to 2× with an appended message: *"Your last reply could not be parsed as JSON: {error}. Reply ONLY with valid JSON, no prose."*
- Extract the first balanced `{…}` or `[…]` block from the response — handles minor prose leakage.

### 10.3 Persistence
- Config file lives at `backend/storage/config.json` (single tenant, no users).
- Schema: `{provider, base_url, api_key, default_model, outline_model, timeout}`.
- Defaults: `{provider:"ollama", base_url:"http://localhost:11434", default_model:"", outline_model:"", timeout:600}`.
- Env-var overrides (loaded once at startup): `PF_PROVIDER`, `OLLAMA_URL`, `PF_API_KEY`, `PF_MODEL`.

### 10.4 Test connection
A dedicated endpoint takes a **candidate** config (without saving it), tries `list_models()` and a tiny ping chat ("Reply with the single word OK."), returns `{ok, n_models, models, sample}` or `{ok:false, error}`.

---

## 11. Document Ingestion

The user can upload reference documents that become "context" for generation.

| File type | Parser |
|---|---|
| `.pdf` | Page-by-page text extraction (PyPDF2 / pdf.js / equivalent) |
| `.docx` | Paragraph + table cells extraction |
| `.md` | Strip frontmatter, plaintext output |
| `.txt` | UTF-8 decode |

**Behavior:**
- Multiple files concatenated with a separator (`\n\n---\n\n`) and a header per file (`# {filename}`) into `sources_text`.
- `sources_text` is passed as part of the LLM context.
- The same `sources_text` powers the fact-check (number grounding).
- File size cap: 10 MB per file, 50 MB total (configurable).
- All files stored under `backend/storage/uploads/`.

---

## 12. Brand Palette Extraction

### From a logo image
1. Decode image (any format Pillow supports).
2. Resize to max 200×200 to bound compute.
3. Quantize to 6 colors via median-cut.
4. Drop near-white and near-black colors (luminance < 0.05 or > 0.95).
5. Sort by frequency, then by saturation.
6. Assign: `primary` = most dominant saturated color; `secondary` = next most dominant; `accent` = highest-saturation remaining.
7. Pick a light/dark background based on average luminance.
8. Return a `Theme` patch with these colors + the logo as a base64 data URL.

### From a sample PDF
1. Render first 1–3 pages to images.
2. Sample pixels at fixed grid points (avoid white background).
3. Run the same quantization pipeline.
4. Return a `Theme` patch (no logo).

---

## 13. Export Formats

### 13.1 Standalone HTML
A single self-contained `.html` file (CSS inlined, all charts as inline SVG, logo embedded as data URL). Opens in any browser, prints natively at 16:9.

### 13.2 PDF
- Render the deck to HTML using the same template as the in-browser preview.
- Launch a headless Chromium (Playwright).
- Set viewport to **1280 × 720** (16:9).
- Print to PDF with: `format: { width: '13.33in', height: '7.5in' }`, `printBackground: true`, `margin: 0`.
- Output to `backend/storage/outputs/deck_{uuid}.pdf`, return a download URL.

### 13.3 Preview rendering
The in-app preview renders the same template as the export, scaled to fit the right-pane canvas. Zoom level adjustable via `Cmd/Ctrl + scroll`.

---

## 14. Persistence Model

All persistence is **filesystem-based JSON**. No database. Structure:

```
backend/storage/
├── config.json              # LLM config
├── uploads/                 # raw source documents
│   └── <uuid>_<filename>
├── outputs/                 # exported PDFs/HTMLs
│   └── deck_<uuid>.pdf
├── projects/                # saved decks
│   └── <project-id>.json    # { id, name, updated_at, prompt, context, audience, deck, theme, versions[] }
└── brands/                  # brand kits
    └── <brand-id>.json      # { id, name, theme, updated_at }
```

### Auto-versioning
Each `POST /api/projects` (save) pushes the previous `deck` snapshot onto a `versions[]` array (max 12 entries, FIFO eviction). The user can list versions and restore any one via `POST /api/projects/:id/restore/:index`.

### Per-slide undo (client-only)
- Each slide carries a `__history: Slide[]` array.
- Every refine / quick-refine / layout-change pushes the **previous** slide JSON onto `__history` (max 5 entries).
- The ↶ Undo button restores `__history[__history.length-1]` and pops it.
- **`__history` MUST be stripped before any backend call** (it's purely UI state).

---

## 15. REST API Contract

All routes return JSON unless noted. Auth is **none** (single-user local app).

### Configuration & health
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/health` | — | `{ok, provider_reachable, models, config, ollama}` |
| GET | `/api/config` | — | `LLMConfig` (public — no api_key) |
| POST | `/api/config` | `LLMConfigPatch` | Updated `LLMConfig` |
| POST | `/api/config/test` | `LLMConfigPatch` | `{ok, n_models, models, sample}` or `{ok:false, error}` |
| POST | `/api/config/models` | `LLMConfigPatch` | `{models: [{name, ...}]}` |
| GET | `/api/models` | — | `{models}` for the active config |

### Ingestion & extraction
| Method | Path | Body (multipart) | Response |
|---|---|---|---|
| POST | `/api/parse` | `files[]` | `{text}` |
| POST | `/api/theme/from-image` | `file` | `Partial<Theme>` (palette + logo data URL) |
| POST | `/api/theme/from-pdf` | `file` | `Partial<Theme>` (palette only) |
| GET | `/api/themes` | — | List of built-in theme presets |

### Generation
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/generate/outline` | `{prompt, context, audience, tone, target_slides, model?}` | `{outline: Deck}` |
| POST | `/api/generate/expand-outline` | `{outline, context, model?}` | SSE stream of slides |
| POST | `/api/generate/slide` | `{outline, slide_entry, context?, model?}` | `{slide: Slide}` |
| POST | `/api/generate/stream` | `{prompt, context, audience, tone, target_slides, model?, outline_model?}` | **SSE** stream of `StreamEvent`s |
| POST | `/api/slide/refine` | `{slide, instruction, context?, model?}` | `{slide: Slide}` |
| POST | `/api/slide/quick-refine` | `{slide, preset, context?, model?}` | `{slide: Slide}` |
| GET | `/api/quick-refinements` | — | `{presets: {[id]: instruction}}` |

### Enhancements
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/critic` | `{deck, context?, model?}` | `{review: CriticReview}` |
| POST | `/api/critic/fix-slide` | `{slide, issue, context?, model?}` | `{slide: Slide}` |
| POST | `/api/critic/insert-slide` | `{outline, after_slide_id, proposed, context?, model?}` | `{slide, after_slide_id}` |
| POST | `/api/translate` | `{deck, target_language, model?}` | `{deck: Deck}` |
| POST | `/api/factcheck` | `{deck, sources_text}` | `FactCheckResult` |

### Rendering & export
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/render/html` | `{deck, theme}` | `{html}` |
| POST | `/api/render/preview` | `{deck, theme}` | Raw HTML (text/html) |
| POST | `/api/export/pdf` | `{deck, theme}` | PDF file download |
| POST | `/api/export/html` | `{deck, theme}` | Standalone HTML download |

### Projects
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/projects` | — | `ProjectListItem[]` |
| GET | `/api/projects/:id` | — | `FullProject` |
| POST | `/api/projects` | `FullProject` (id optional → created) | `FullProject` |
| DELETE | `/api/projects/:id` | — | `{ok}` |
| GET | `/api/projects/:id/versions` | — | `{versions: Deck[]}` |
| POST | `/api/projects/:id/restore/:index` | — | `{deck: Deck}` |

### Brand kits
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/brands` | — | `BrandKitSummary[]` |
| GET | `/api/brands/:id` | — | Full brand kit (`BrandKitSummary` + `Theme`) |
| POST | `/api/brands` | `{id?, name, theme}` | `BrandKitSummary` |
| DELETE | `/api/brands/:id` | — | `{ok}` |

### Error contract
- All `/api/*` errors return JSON: `{detail: {...}}` (FastAPI default) or `{error, type, path}` (global handler).
- Unknown `/api/*` paths return **404** with `{detail: {error, method, path, hint}}`.
- Client disconnects from SSE return **499** (nginx convention), logged at INFO only.

---

## 16. UI Specification

### 16.1 Top-level layout
A **three-pane workspace** + topbar + bottom toast container.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TOPBAR: logo · project name · save · settings ⚙ · user guide ❔        │
├──────────────────┬─────────────────────────────┬────────────────────────┤
│ LEFT PANE        │ CENTER PANE                  │ RIGHT PANE             │
│ (input + tools)  │ (preview canvas)             │ (theme + brand + ID)   │
│                  │                              │                        │
│ - InputPanel     │ - Preview (live deck render) │ - ThemePanel           │
│ - SlideList      │   - Zoom (Cmd+scroll)         │ - BrandKitsBar         │
│ - ToolsPanel     │   - Slide navigator            │ - VisualIdentityPicker │
│ - OutlineEditor  │                              │                        │
│   (modal)        │                              │                        │
└──────────────────┴─────────────────────────────┴────────────────────────┘
```

### 16.2 Pane: Input
- **Brief** textarea — large, primary call-to-action
- **Audience** input — short text
- **Tone** dropdown — defaults to "Senior PM / board-level"
- **Target slides** number — default 12, range 5–20
- **Sources** file dropzone — accepts PDF/DOCX/MD/TXT, shows extracted-text length per file
- **Generate** button — primary CTA, shows spinner during streaming, displays current step from `status` events
- **Stop** button — appears during streaming, cancels via AbortController

### 16.3 Pane: SlideList
- One card per slide
- Each card shows: slide number, layout pill, title, undo-steps pill badge
- Click card → focus that slide in preview
- Click ↶ Undo → restore previous version (max 5 in stack)
- Click 🗑 Delete → confirm modal → remove slide
- Click ⇅ Change layout → dropdown picker → triggers refine

### 16.4 Pane: ToolsPanel
- **🧐 AI critic** button → opens results panel inline
- **🌍 Translate** button + language dropdown (10 languages)
- **🔎 Fact-check** button → opens results panel inline
- **▶ Present** button → enters presenter mode
- Each result panel: close × button, can be dismissed without losing state

### 16.5 Pane: ThemePanel
- 6 preset thumbnails (color swatches)
- Color pickers: primary / secondary / accent / background / text
- Template radio: consulting / executive / dark-board
- Dark-mode toggle
- Heading font / body font dropdowns
- Logo dropzone (extracts palette automatically when image uploaded)
- Footer text input

### 16.6 Pane: BrandKitsBar
- Horizontal scroll of saved kits, each shown as: name + 3-color swatch + tiny logo
- Click kit → load it
- "+ Save current as kit" button → name modal → POST `/api/brands`
- × on each kit → confirm → delete

### 16.7 Pane: VisualIdentityPicker
- **Cover style** — 6 visual swatch previews of each style (mini SVG renders)
- **Section divider** — 3 visual swatch previews
- **Logo placement** — three collapsible groups (Cover / Header / Footer)
  - Each group: independent on/off toggle, **visual position picker** (9-grid for cover, 3-row for header/footer), size slider with min/max labels
  - Disabled with hint "Upload a logo first ↑" if no logo

### 16.8 OutlineEditor (modal)
- Triggered between "outline received" and "slides streaming"
- Lists outline entries: drag to reorder, edit title inline, change layout via dropdown
- **Continue** button → proceed to slide expansion
- **Cancel** button → abandon the run

### 16.9 SettingsModal (⚙)
- Provider radio: Ollama / OpenAI-compatible
- Base URL input (with placeholder per provider)
- API key input (password type, never displayed once set)
- Default model dropdown — auto-populated from `list_models` for the candidate config
- Outline model dropdown — optional separate model
- Timeout slider — 30–1200 s
- **Test connection** button → shows `{ok, models, sample}` or error inline
- **Save** button → persists, closes modal

### 16.10 UserGuide (❔ or `?`)
- Fullscreen modal
- Left sidebar: searchable section list (17 sections — see README)
- Right pane: current section content
- Prev / Next buttons at bottom
- Esc closes

### 16.11 Presenter mode
- Fullscreen
- Arrow keys: `←` `→` navigate; `Esc` exit; `F5` enter
- Bottom-left: current slide / total
- Bottom-right: speaker notes toggle
- Notes overlay appears at the bottom when toggled (semi-transparent)

### 16.12 Toast system
- Bottom-right corner
- 3 types: success (green), error (red), info (default)
- Auto-dismiss after 4 s; manual close button
- Stacks vertically, max 5 visible

---

## 17. Keyboard Shortcuts

| Key | Action |
|---|---|
| `Cmd/Ctrl + Enter` | Generate |
| `Cmd/Ctrl + S` | Save project |
| `Cmd/Ctrl + P` | Export PDF |
| `Cmd/Ctrl + scroll` (on preview) | Zoom in/out |
| `?` | Open in-app user guide |
| `F5` | Toggle presenter mode |
| `→` / `←` (in presenter) | Next / previous slide |
| `Esc` | Close any modal / exit presenter |

---

## 18. Error Handling & Edge Cases

### Required global behaviors
- **Global exception handler** turns ANY unhandled error into JSON 500 with `{error, type, path}` + stack-trace log. Never let raw stack traces hit the wire.
- **Client disconnect mid-stream** → return HTTP 499 (nginx convention), log at INFO, don't propagate `CancelledError`.
- **Unknown `/api/*` path** → JSON 404 with `{error, method, path, hint}` (diagnostic, not generic "Not Found"). Must be declared AFTER all real `/api/*` routes, BEFORE the SPA catch-all.
- **SPA catch-all path traversal** → resolve absolute, verify it's inside the dist root; otherwise serve `index.html`.

### LLM failures
- JSON parse failure → retry up to 2× with appended instruction. After that, surface as error event in SSE / error response in single-shot.
- Per-slide generation failure → produce a "graceful fallback" slide with `body: "_(generation error: <message>)_"` so the deck remains complete and the user can refine just that one slide.
- Network error → propagate `LLMError` with the upstream status code + first 400 chars of the response body.

### File upload edge cases
- Reject files > 10 MB (per file) and > 50 MB total (cumulative) with `413 Payload Too Large`.
- Reject unknown MIME types with `415`.
- Empty file (0 bytes) → return `{text: ""}` (don't 400 — it's recoverable).

### Persistence edge cases
- Project list returns empty array if `projects/` doesn't exist (don't 404).
- Project save with no `id` → assign a new ULID.
- Versions array cap is enforced server-side; clients can't bypass it.
- Deleted project leaves orphan uploads — no automatic cleanup (could be a future scheduled job).

---

## 19. Non-Functional Requirements

| Concern | Requirement |
|---|---|
| **Single-process startup** | One command launches API + UI on one port. First run installs deps + builds frontend (~2–5 min); subsequent runs are seconds. |
| **Cold start** | Server responds to `/api/health` within 3 s of process start (excluding LLM reachability check). |
| **Streaming latency** | First `status` event within 200 ms of `/api/generate/stream` connection accepted. |
| **PDF export latency** | < 8 s for a 12-slide deck on commodity hardware (excluding LLM time — the PDF call uses a pre-rendered deck). |
| **Memory** | Server idle < 200 MB; under load < 1 GB excluding LLM. |
| **Concurrency** | Backend handles ≥ 5 simultaneous SSE streams (Python async / event-loop model). |
| **Cross-platform** | macOS + Linux + Windows. Same launcher behavior. |
| **No telemetry** | Zero outbound network calls except to the configured LLM endpoint and (on first run) to download Playwright Chromium + npm/PyPI packages. |
| **Accessibility** | Keyboard navigation for all primary actions; focus rings visible; aria-labels on icon-only buttons. |
| **Internationalization (UI)** | Out of scope for v1; deck content can be in any language via the translate feature. |
| **Privacy** | No analytics. No "phone home". `backend/storage/config.json` (which may contain an API key) is gitignored. |
| **Security** | Single-user local app; no auth model. Path-traversal blocked on static catch-all. API key never returned by `GET /api/config`. |

---

## 20. Out of Scope (explicitly)

To bound the rebuild and avoid feature creep, these are **deliberately excluded** from v1:

- Multi-user, auth, RBAC
- Real-time multiplayer editing
- Cloud sync / SaaS deployment
- Comments / review threads inside the editor
- Embedded video or audio in slides
- Animations / slide transitions
- Custom font upload (only system + Google Fonts presets)
- Direct PowerPoint (`.pptx`) export
- LLM fine-tuning / RAG over a persistent knowledge base
- Browser extension
- Mobile/tablet-optimized UI (desktop-first; works on tablet but not tuned)

---

## Appendix A — Default values

| Setting | Default |
|---|---|
| `target_slides` | 12 |
| `tone` | "Senior PM / board-level" |
| `parallel slide generation` | 3 |
| `timeout` (LLM) | 600 s |
| `versions[]` cap | 12 |
| `__history` cap | 5 |
| `target file size per upload` | 10 MB |
| `target total upload size` | 50 MB |
| `port` | 8765 |

## Appendix B — Suggested tech for a fresh build

| Layer | Suggested tech |
|---|---|
| Backend | FastAPI (Python) **or** Express/Fastify (Node) **or** Axum (Rust) |
| LLM client | httpx (Python) / undici (Node) / reqwest (Rust) |
| PDF | Playwright headless Chromium (any language has bindings) |
| SVG charts | Hand-rolled — keep zero deps so PDF rendering is deterministic |
| Frontend | React + TypeScript + Vite **or** SvelteKit **or** Solid + Vite |
| State | Local React state + URL state; no Redux/Zustand needed at v1 scale |
| Storage | Plain JSON files on disk; no DB |
| Auth | None |

## Appendix C — Glossary

- **Deck** — the full presentation, root JSON object
- **Slide** — one slide, a tagged union discriminated by `layout`
- **Outline** — a Deck with `slides[]` containing only `{id, layout, title, intent}` (no content yet)
- **Slide entry** — one item from an outline
- **Theme** — visual settings (palette, fonts, logo, identity)
- **Brand kit** — a saved, reusable Theme
- **Project** — a saved Deck + theme + prompt + context, with auto-versions
- **Quick refinement** — a preset chip instruction for `/api/slide/quick-refine`
- **So-what** — the "therefore" — the action or implication a slide must convey
- **MECE** — Mutually Exclusive, Collectively Exhaustive (slide titles should be)
- **Pyramid Principle** — Minto's structuring approach (situation → complication → question → answer)

---

**End of spec.** This document is the contract; the current implementation is one realization of it.
