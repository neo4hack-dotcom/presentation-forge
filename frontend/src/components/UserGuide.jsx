import React, { useMemo, useState } from 'react'

// Small reusable primitives ----------------------------------------------
const Tag = ({ children, tone = 'slate' }) => {
  const tones = {
    indigo: { bg: 'rgba(124,92,255,.18)', fg: '#C7B8FF', bd: 'rgba(124,92,255,.45)' },
    emerald: { bg: 'rgba(16,185,129,.15)', fg: '#6EE7B7', bd: 'rgba(16,185,129,.45)' },
    amber: { bg: 'rgba(245,158,11,.15)', fg: '#FCD34D', bd: 'rgba(245,158,11,.45)' },
    rose: { bg: 'rgba(239,68,68,.12)', fg: '#FCA5A5', bd: 'rgba(239,68,68,.45)' },
    slate: { bg: 'rgba(148,163,184,.12)', fg: 'var(--text-2)', bd: 'var(--border-2)' },
  }
  const t = tones[tone] || tones.slate
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 8px', borderRadius: 999, border: `1px solid ${t.bd}`, background: t.bg, color: t.fg, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>{children}</span>
}

const Step = ({ n, title, children }) => (
  <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
    <div style={{ flex: '0 0 28px', height: 28, borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{n}</div>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.5 }}>{children}</div>
    </div>
  </div>
)

const Tip = ({ children, tone = 'amber' }) => {
  const colors = { amber: ['rgba(245,158,11,.10)', '#F59E0B', '#FCD34D'], indigo: ['rgba(124,92,255,.10)', 'var(--accent)', '#C7B8FF'], rose: ['rgba(239,68,68,.08)', '#EF4444', '#FCA5A5'] }
  const [bg, bd, fg] = colors[tone] || colors.amber
  return <div style={{ display: 'flex', gap: 8, padding: 12, background: bg, borderLeft: `3px solid ${bd}`, borderRadius: '0 6px 6px 0', color: fg, fontSize: 13, lineHeight: 1.5, margin: '12px 0' }}>
    <span style={{ flex: '0 0 auto' }}>💡</span><div>{children}</div>
  </div>
}

const KBD = ({ children }) => <span className="kbd">{children}</span>

const Feat = ({ icon, name, children }) => (
  <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
    <div style={{ fontSize: 18, flex: '0 0 28px', textAlign: 'center' }}>{icon}</div>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>{name}</div>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.5 }}>{children}</div>
    </div>
  </div>
)

// Section content --------------------------------------------------------
const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting started',
    icon: '🚀',
    summary: 'Generate your first board-grade deck in 90 seconds.',
    body: (
      <>
        <p style={{ lineHeight: 1.6 }}>
          <b>Presentation Forge</b> turns a brief plus reference documents into a board-quality
          presentation, generated locally by an LLM (Ollama or any OpenAI-compatible HTTP endpoint).
          Output: live HTML preview, single-file standalone HTML, or PDF at native 16:9.
        </p>
        <Step n={1} title="Open ⚙️ Settings (first time only)">
          Choose your provider (Ollama or OpenAI-compatible), test the connection, pick a default model. Saved to <code>backend/storage/config.json</code>.
        </Step>
        <Step n={2} title="Write a brief">
          In the left <b>Setup</b> tab: describe what you want to present and to whom. Be specific — "Q1 board update emphasizing the EMEA slowdown" is much better than "Q1 update".
        </Step>
        <Step n={3} title="Add your sources">
          Drop PDF / DOCX / MD / TXT files into the upload zone, or paste raw numbers and quotes into "Extra context". The LLM is instructed to pull real figures from these and cite them.
        </Step>
        <Step n={4} title="Generate">
          Hit <b>✨ Generate presentation</b> (or <KBD>⌘/Ctrl+Enter</KBD>). The outline appears first; slides stream in 3-at-a-time. Watch the preview fill up live.
        </Step>
        <Step n={5} title="Polish & export">
          Refine slides, run the <b>AI critic</b>, change the <b>Visual identity</b>, then <b>⇩ PDF</b> (<KBD>⌘/Ctrl+P</KBD>) or <b>⇩ HTML</b>.
        </Step>
        <Tip>Toggle <b>Review outline before expanding</b> (in Setup) to edit the LLM's outline — reorder, rename, change layouts — before paying for the full slide generation. Saves time and steers the deck better.</Tip>
      </>
    ),
  },
  {
    id: 'workspace',
    title: 'Workspace map',
    icon: '🧭',
    summary: 'Three columns, top bar, and where every panel lives.',
    body: (
      <>
        <p>The workspace has a fixed three-pane layout plus a top bar.</p>
        <Feat icon="🧱" name="Top bar">
          Project name (editable, in the center) · model status pill (provider + count) · <b>⚙️ Settings</b> · <b>📁 Projects</b> · <b>💾 Save</b> · <b>▶ Present</b> · <b>notes</b> toggle.
        </Feat>
        <Feat icon="◀" name="Left pane — Setup / Slides">
          Two tabs. <b>Setup</b> holds the brief, document uploads, paste-context, model choices, and the Generate button. After generation, switch to <b>Slides</b> to see the outline, click a slide to jump to it, change its layout, or refine it.
        </Feat>
        <Feat icon="▣" name="Center pane — Live preview">
          The rendered deck in a sandboxed iframe. Zoom in/out (buttons or <KBD>⌘/Ctrl + scroll</KBD>). Click a slide in the left pane to scroll there.
        </Feat>
        <Feat icon="▶" name="Right pane — Theme + Identity + Brand + AI tools">
          From top to bottom: Export (PDF/HTML) · Theme presets · Brand & logo · Colors · Template style · <b>Visual identity</b> · <b>Brand kits</b> · <b>AI tools</b> (critic, translate, fact-check, present).
        </Feat>
      </>
    ),
  },
  {
    id: 'brief',
    title: 'Writing a great brief',
    icon: '✍️',
    summary: 'What the LLM needs to produce a board-grade deck (and what trips it up).',
    body: (
      <>
        <p>The brief is the single biggest lever on quality. Use these patterns.</p>
        <Feat icon="🎯" name="Lead with the so-what">
          Start with the conclusion you want the audience to reach. e.g. "EMEA is slowing — here's our 3-quarter recovery plan and the 3 asks we need from the board."
        </Feat>
        <Feat icon="👥" name="Name the audience explicitly">
          "Board of directors" vs "ExCo" vs "Engineering leadership" leads to different vocabulary and depth. The Audience field is sent to the LLM verbatim.
        </Feat>
        <Feat icon="📦" name="Drop the source documents">
          The model is instructed to <b>pull real numbers and quotes</b> from the docs and cite them in each slide's <code>footnote</code>. PDF, DOCX, MD, TXT supported; max 60k chars per doc (auto-truncated).
        </Feat>
        <Feat icon="📋" name="Paste raw numbers / quotes / emails">
          The "Extra context" textarea is for unstructured snippets. Use it for KPIs, customer quotes, transcript excerpts, ratios — anything you want the LLM to ground its claims in.
        </Feat>
        <Tip tone="indigo">If you don't have a brief but have documents, leave the brief blank and let the LLM infer — it produces a sharper deck than a vague brief. Documents &gt; weak brief.</Tip>
      </>
    ),
  },
  {
    id: 'generation',
    title: 'Generation pipeline',
    icon: '⚙️',
    summary: 'How outline → slides → critique works, and the multi-LLM cascade.',
    body: (
      <>
        <p>Two-phase generation, fully streamed.</p>
        <Step n={1} title="Outline pass (cheap, fast)">
          The "outline model" produces a structured JSON: deck title, subtitle, executive summary, 8-14 slide entries (id, layout, action-oriented title, intent). Follows the Pyramid Principle (situation → complication → question → answer).
        </Step>
        <Step n={2} title="Slide pass (parallel, streamed)">
          The "slide model" expands each outline entry into a fully-typed slide (title, body, bullets, KPIs, charts, etc.). Up to 3 slides run in parallel; results stream into the deck as they arrive (you'll see slide cards fill in one by one).
        </Step>
        <Feat icon="🧬" name="Multi-LLM cascade">
          Configure a fast/cheap model for the outline (e.g. a 4B parameter local model) and the heavy model for slides (e.g. <code>gpt-oss:120b</code>). Set both in Setup or in ⚙️ Settings.
        </Feat>
        <Feat icon="📝" name="Review outline before expanding">
          When toggled ON, the outline pass completes and pauses — you see the slide list in the left panel and can edit titles, change layouts, reorder, add/delete entries before clicking <b>✨ Expand to full slides</b>.
        </Feat>
        <Feat icon="⏹️" name="Cancel mid-stream">
          The <b>Generating…</b> button doubles as cancel. Whatever slides were already produced are preserved.
        </Feat>
        <Tip>If the LLM returns malformed JSON, the system auto-retries up to 3 times asking for valid JSON. If it still fails, the affected slide shows the error inline and you can re-run with refine.</Tip>
      </>
    ),
  },
  {
    id: 'layouts',
    title: 'Slide layouts (18)',
    icon: '🎨',
    summary: 'What each layout is for, when the LLM picks it, and what fields it uses.',
    body: (
      <>
        <p>Every slide has a <code>layout</code>. The LLM picks one based on the content; you can change it any time via the dropdown next to each slide.</p>
        <Feat icon="🏁" name="title">Opening slide. Uses deck title/subtitle/author/date/audience.</Feat>
        <Feat icon="📜" name="index">Auto-populated table of contents — lists every <b>section</b> slide with its page number.</Feat>
        <Feat icon="🗂️" name="section">Chapter divider with brand-color gradient. Use 2-4 per deck.</Feat>
        <Feat icon="•" name="bullets">Title + 3-5 claim-style bullets (not labels). Default layout for textual content.</Feat>
        <Feat icon="▥" name="two-column">Left/right contrast — e.g. "what worked / what didn't".</Feat>
        <Feat icon="🔢" name="kpi">3-6 KPI tiles with headline value, trend, delta.</Feat>
        <Feat icon="🎯" name="big-number">ONE hero figure with gradient text fill — when a single number tells the entire story.</Feat>
        <Feat icon="❝" name="quote">Large pull-quote with author. Use sparingly.</Feat>
        <Feat icon="📊" name="table">Structured data table with brand-color header underline.</Feat>
        <Feat icon="📅" name="timeline">Vertical timeline with connected dots — milestones, roadmap.</Feat>
        <Feat icon="🧭" name="swot">2x2 Strengths/Weaknesses/Opportunities/Threats grid.</Feat>
        <Feat icon="🟦" name="matrix">Generic 2x2 (impact/effort, risk/reward…). Configurable axis labels.</Feat>
        <Feat icon="→" name="process">4-6 numbered horizontal steps with chevron connectors.</Feat>
        <Feat icon="🔺" name="pyramid">3-5 trapezoid tiers from broad (top) to specific (bottom).</Feat>
        <Feat icon="⚖️" name="comparison">Side-by-side cards. Exactly one carries a "RECOMMENDED" ribbon.</Feat>
        <Feat icon="🟦🟦" name="icon-grid">2-4 tiles with emoji icons, title, detail — pillars/capabilities.</Feat>
        <Feat icon="📈" name="chart">See <i>Charts</i> section for the 10 chart types.</Feat>
        <Feat icon="🏁" name="closing">Wrap-up. Use for the asks / next steps / call to action.</Feat>
      </>
    ),
  },
  {
    id: 'charts',
    title: 'Charts (10 types)',
    icon: '📈',
    summary: 'Server-rendered SVG charts — perfect PDF fidelity, no JS dependency.',
    body: (
      <>
        <p>Set the <code>type</code> field on a chart slide. The LLM also picks the type based on the content.</p>
        <Feat icon="📊" name="bar">Default. Compare categories. Supports multi-series (clustered).</Feat>
        <Feat icon="📉" name="line">Trends over time. Multi-series with line + dots.</Feat>
        <Feat icon="🟦" name="area">Same as line + filled area below. Good for cumulative views.</Feat>
        <Feat icon="🍩" name="donut">Composition with center total. Best for ≤6 segments.</Feat>
        <Feat icon="🥧" name="pie">Same as donut without hole. Use when share-of-total is the message.</Feat>
        <Feat icon="📚" name="stacked-bar">Composition over time. Each bar splits into series.</Feat>
        <Feat icon="📏" name="horizontal-bar">Rankings with category labels on the left. Up to ~8 rows.</Feat>
        <Feat icon="💧" name="waterfall">Financial bridge. Positive=green, negative=red, total bar in brand color. Pass negative values for decreases.</Feat>
        <Feat icon="🔻" name="funnel">Conversion stages. Auto-computes stage-to-stage conversion %.</Feat>
        <Feat icon="🎯" name="gauge">Single % vs target. Traffic-light colors (red &lt; 50% &lt; amber &lt; 85% &lt; green). Set <code>max</code> to the goal.</Feat>
        <Tip>Every chart slide has a <b>"So what:" callout</b> below it — the LLM is required to fill the <code>insight</code> field. This is what makes a chart board-grade.</Tip>
      </>
    ),
  },
  {
    id: 'theme',
    title: 'Theme & colors',
    icon: '🎨',
    summary: 'Presets, custom colors, logo extraction, and dark mode.',
    body: (
      <>
        <Feat icon="🎁" name="6 presets">
          Aurora · Graphite · Forest · Sunset · Midnight · Carbon. One click to switch.
        </Feat>
        <Feat icon="🖼️" name="Logo upload (image)">
          Drops a logo into header/cover AND extracts a coherent palette via Pillow median-cut. Drops the dominant background color and picks two saturated accent colors.
        </Feat>
        <Feat icon="📑" name="Learn palette from a PDF">
          Upload an existing deck PDF and the app rasterizes its first page and extracts the palette. Great for matching your company's existing look.
        </Feat>
        <Feat icon="🎚️" name="Manual color overrides">
          Seven color fields (primary, secondary, accent, background, surface, text, muted). Each has a color picker + hex input.
        </Feat>
        <Feat icon="🌙" name="Dark deck toggle">
          Flips defaults to a dark color scheme. Combine with the Midnight or Carbon preset.
        </Feat>
        <Feat icon="🏷️" name="Footer text">
          Free text shown on every content slide (e.g. "Confidential — Board only").
        </Feat>
      </>
    ),
  },
  {
    id: 'identity',
    title: 'Visual identity',
    icon: '✨',
    summary: 'Choose how your cover and section dividers look — the "wow" effect.',
    body: (
      <>
        <p>The Visual identity panel sets the personality of your deck. Settings apply consistently to every relevant slide.</p>
        <Feat icon="🅰️" name="Minimal">Refined typography with a single accent bar. Quiet, executive feel.</Feat>
        <Feat icon="🔥" name="Bold">Full-bleed brand gradient on the cover. High impact.</Feat>
        <Feat icon="🌌" name="Mesh">Multi-stop radial gradient backdrop. Modern SaaS / product launch vibe.</Feat>
        <Feat icon="✂️" name="Split">Diagonal brand-color band — magazine-style. Best with strong primary color.</Feat>
        <Feat icon="📰" name="Editorial">Serif title (Georgia), italic subtitle. Editorial / report style.</Feat>
        <Feat icon="🟠" name="Geometric">Abstract brand-color circles. Energetic, conference-grade.</Feat>
        <p style={{ marginTop: 16 }}><b>Section dividers</b>: <b>Gradient</b> (full-bleed default), <b>Minimal</b> (quiet with accent bar), <b>Numbered</b> (huge chapter number on the side).</p>
        <Tip tone="indigo">For maximum coherence, pair Bold cover with Gradient dividers, Editorial cover with Minimal dividers, and Geometric cover with Numbered dividers.</Tip>
      </>
    ),
  },
  {
    id: 'brand-kits',
    title: 'Brand kits',
    icon: '🎽',
    summary: 'Save the current theme + logo + identity for reuse across decks.',
    body: (
      <>
        <p>Brand kits capture <i>everything</i> visual: colors, logo, footer, template, cover style, divider style. Stored as JSON in <code>backend/storage/brands/</code>.</p>
        <Step n={1} title="Set up your theme">Pick a preset, upload your logo, override colors, choose a cover style.</Step>
        <Step n={2} title="Save current as kit">In the Brand kits section, name the kit (e.g. "Acme Corp 2026") and save.</Step>
        <Step n={3} title="Reuse on another deck">Open any deck, click the kit's swatch row — the theme overlays instantly.</Step>
        <Tip>Keep one kit per audience/customer. Examples: "Internal — leadership", "Board pack", "Acme customer review", "Investor update".</Tip>
      </>
    ),
  },
  {
    id: 'ai-tools',
    title: 'AI tools',
    icon: '🤖',
    summary: 'Critic, translate, fact-check, quick-refine, layout switcher.',
    body: (
      <>
        <Feat icon="🧐" name="AI critic">
          A second LLM pass reviews the whole deck: board-readiness score /10, issues (per severity: low/medium/high), missing slides proposals, strengths. Each issue and missing-slide has an <b>Apply fix</b> / <b>Insert this slide</b> button that actions the change in place.
        </Feat>
        <Feat icon="🌍" name="Translate">
          Re-renders the deck in any of 10 languages while preserving JSON structure, numbers, proper nouns, and the action-orientation of titles.
        </Feat>
        <Feat icon="🔎" name="Fact-check">
          Extracts every numeric claim from the deck and checks it against your uploaded sources + pasted context. Flags unsupported numbers with the slide and the quote where they appear.
        </Feat>
        <Feat icon="✎" name="Per-slide refine (custom)">
          Open the ✎ icon on any slide, type a free-form instruction ("make it shorter", "add a chart from the Q3 PDF data", "ground every number"). <KBD>⌘/Ctrl+Enter</KBD> to apply.
        </Feat>
        <Feat icon="✨" name="Quick-refine chips">
          One-click presets inside the refine box: ✂ Shorter · 📊 Denser · 🎨 More visual · 📈 Add chart · 🔗 Cite source · 👔 Board-ify.
        </Feat>
        <Feat icon="🔄" name="Layout switcher">
          The dropdown next to each slide's layout name. Switching layouts triggers a recast: the LLM reorganizes the existing content to fit the new layout (e.g. bullets → kpi).
        </Feat>
      </>
    ),
  },
  {
    id: 'present',
    title: 'Presenter mode',
    icon: '▶',
    summary: 'Fullscreen, arrow-key navigation, speaker notes overlay.',
    body: (
      <>
        <p>Open with the <b>▶ Present</b> button or <KBD>F5</KBD>. Built-in nav:</p>
        <Feat icon="→" name="Navigation">
          <KBD>→</KBD> / <KBD>Space</KBD> / <KBD>PageDown</KBD> next · <KBD>←</KBD> / <KBD>PageUp</KBD> previous · <KBD>Home</KBD> first · <KBD>End</KBD> last.
        </Feat>
        <Feat icon="📝" name="Speaker notes">
          <KBD>N</KBD> toggles the notes panel at the bottom. Every content slide carries auto-generated speaker notes (3-5 sentences) — see them on your laptop while presenting on an external screen.
        </Feat>
        <Feat icon="🚪" name="Exit">
          <KBD>Esc</KBD>.
        </Feat>
      </>
    ),
  },
  {
    id: 'projects',
    title: 'Projects & versioning',
    icon: '📁',
    summary: 'Local-only persistence with automatic version history.',
    body: (
      <>
        <p>Projects save the full state — brief, context, deck JSON, theme — as a JSON file in <code>backend/storage/projects/</code>. No cloud.</p>
        <Step n={1} title="Save"><KBD>⌘/Ctrl+S</KBD> or click <b>💾 Save</b>. First save creates a new project ID; subsequent saves overwrite it (and snapshot the previous deck into version history).</Step>
        <Step n={2} title="Load">Open <b>📁 Projects</b> in the topbar → click <b>Load</b> on any project.</Step>
        <Step n={3} title="Restore an old version">In the same modal, click <b>Versions</b> next to a project. The 12 most recent snapshots are listed with their timestamp — click <b>Restore</b> to revert.</Step>
        <Tip>Version snapshots are automatic on every save. You can't "lose" work to a bad refine.</Tip>
      </>
    ),
  },
  {
    id: 'settings',
    title: 'LLM settings (⚙️)',
    icon: '⚙️',
    summary: 'Configure Ollama or any OpenAI-compatible HTTP endpoint.',
    body: (
      <>
        <p>Click the <b>⚙️</b> icon in the topbar. Pick your provider:</p>
        <Feat icon="🦙" name="Ollama (native API)">
          Default URL <code>http://localhost:11434</code>. Run <code>ollama serve</code> + <code>ollama pull &lt;model&gt;</code>. Models auto-detected.
        </Feat>
        <Feat icon="🔌" name="OpenAI-compatible HTTP">
          Works with LM Studio (port 1234), vLLM (8000), llama.cpp server (8080), LocalAI, or any <code>/v1/chat/completions</code> endpoint. Set an API key if your server requires one.
        </Feat>
        <Feat icon="🧪" name="Test connection">
          Hits <code>/api/tags</code> (Ollama) or <code>/v1/models</code> (OpenAI-compat) and runs a 1-token ping chat. Returns success + sample output, or the precise error.
        </Feat>
        <Feat icon="🧬" name="Two-model cascade">
          Pick a small/fast outline model and a heavyweight slide model. The pill in the topbar shows the active provider and model count.
        </Feat>
        <Tip>API keys are persisted to <code>backend/storage/config.json</code> on the local disk only. The backend's <code>GET /api/config</code> endpoint <b>never</b> returns the key — only a boolean <code>api_key_set</code>.</Tip>
      </>
    ),
  },
  {
    id: 'export',
    title: 'Export — PDF & HTML',
    icon: '⇩',
    summary: 'Native 16:9 PDF via headless Chromium, or standalone interactive HTML.',
    body: (
      <>
        <Feat icon="📄" name="PDF (recommended)">
          Click <b>⇩ PDF</b> (<KBD>⌘/Ctrl+P</KBD>). Rendered by Playwright headless Chromium at 13.333" × 7.5" (PowerPoint default 16:9). Background graphics preserved. Inline SVG charts come through pixel-perfect.
        </Feat>
        <Feat icon="🌐" name="Standalone HTML">
          <b>⇩ HTML</b> — single self-contained file you can email or host. Includes the <code>?notes=1</code> trick: append it to the URL to reveal speaker notes inline.
        </Feat>
        <Tip>First-run installs Chromium (~150 MB) — the script handles it. Subsequent PDF exports are fast (~2-5s for a 12-slide deck).</Tip>
      </>
    ),
  },
  {
    id: 'shortcuts',
    title: 'Keyboard shortcuts',
    icon: '⌨️',
    summary: 'All hotkeys in one place.',
    body: (
      <>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <tbody>
            {[
              ['⌘/Ctrl + Enter', 'Generate presentation'],
              ['⌘/Ctrl + S', 'Save project (snapshots a new version)'],
              ['⌘/Ctrl + P', 'Export PDF'],
              ['F5', 'Open presenter mode'],
              ['Esc', 'Exit presenter mode / close a modal'],
              ['→  /  Space  /  PageDown', 'Next slide (in presenter)'],
              ['←  /  PageUp', 'Previous slide (in presenter)'],
              ['Home', 'Jump to first slide (in presenter)'],
              ['End', 'Jump to last slide (in presenter)'],
              ['N', 'Toggle speaker notes (in presenter)'],
              ['⌘/Ctrl + scroll', 'Zoom the preview canvas'],
              ['⌘/Ctrl + Enter (in refine box)', 'Apply the custom refine instruction'],
            ].map(([k, d]) => (
              <tr key={k} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{k.split('  /  ').map((part, i) => <React.Fragment key={i}>{i > 0 && <span style={{ color: 'var(--muted)' }}>or </span>}<KBD>{part.trim()}</KBD>{' '}</React.Fragment>)}</td>
                <td style={{ padding: '8px 10px', color: 'var(--text-2)' }}>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: 'faq',
    title: 'FAQ',
    icon: '❓',
    summary: 'Common questions and gotchas.',
    body: (
      <>
        <Feat icon="🔌" name="The provider pill says “offline”">
          Either your Ollama daemon isn't running (<code>ollama serve</code>) or the URL/key in ⚙️ Settings is wrong. Click ⚙️ and hit <b>Test connection</b>.
        </Feat>
        <Feat icon="🔁" name="A slide came back malformed / “(generation error)”">
          The LLM produced invalid JSON 3 times in a row. Click the ✎ refine icon and type "regenerate this slide cleanly". The rest of the deck is unaffected.
        </Feat>
        <Feat icon="🐌" name="Generation feels slow">
          Use a smaller model for the outline pass (Setup → "Outline model"). Models with "cloud" in the name route via Ollama's hosted backend — faster than running 120B locally on a laptop.
        </Feat>
        <Feat icon="📉" name="Charts are missing numbers">
          The LLM only invents numbers if you didn't supply any. Paste a CSV or KPI list into "Extra context" and re-run, or use ✨ Quick-refine → <b>📊 Denser</b> on the chart slide.
        </Feat>
        <Feat icon="🌐" name="Where do I find my projects?">
          <code>backend/storage/projects/&lt;id&gt;.json</code> on your local disk. You can copy/share these files freely. Brand kits live in <code>backend/storage/brands/</code>.
        </Feat>
        <Feat icon="🖨️" name="PDF export fails">
          First-time runs need Playwright Chromium (~150 MB). Run: <code>python -m playwright install chromium</code> in the backend venv. The launcher script (<code>./start.sh</code> / <code>start.ps1</code>) does this automatically on first launch.
        </Feat>
      </>
    ),
  },
  {
    id: 'privacy',
    title: 'Privacy & local-only',
    icon: '🔒',
    summary: 'What stays on your machine, what leaves it, and how to verify.',
    body: (
      <>
        <p>Presentation Forge is built local-first. By default <b>nothing leaves your machine</b>:</p>
        <Feat icon="📁" name="Storage is local files">
          Projects, brand kits, uploaded files, generated PDFs/HTML, and the LLM config all live under <code>backend/storage/</code>. No database, no telemetry.
        </Feat>
        <Feat icon="🦙" name="Ollama provider — fully local">
          All requests go to <code>http://localhost:11434</code>. The only exception: models tagged <code>:cloud</code> are routed by Ollama itself to its hosted backend.
        </Feat>
        <Feat icon="🔌" name="OpenAI-compatible provider">
          Requests go to whatever URL you set. If you point it at a public endpoint, your data leaves. If you point it at <code>localhost</code>, it doesn't.
        </Feat>
        <Feat icon="🔍" name="Verify with the OpenAPI spec">
          <code>http://localhost:8765/docs</code> shows every endpoint. There are no outbound endpoints in the backend — only the configured LLM URL is called.
        </Feat>
      </>
    ),
  },
  {
    id: 'glossary',
    title: 'Glossary',
    icon: '📖',
    summary: 'Quick definitions of the terms used in this guide.',
    body: (
      <>
        {[
          ['Deck', 'The whole presentation — a JSON object with title, subtitle, executive_summary, and a list of slides.'],
          ['Outline', 'The first LLM pass: a deck without the slide bodies — just IDs, layouts, and titles.'],
          ['Slide', 'A typed JSON object. Always has id, layout, title; the other fields depend on the layout (bullets, kpis, chart…).'],
          ['Layout', 'One of 18 visual templates: title, index, section, bullets, two-column, kpi, big-number, quote, table, timeline, swot, matrix, process, pyramid, comparison, icon-grid, chart, closing.'],
          ['Theme', 'The visual style — colors, fonts, logo, footer, template, cover_style, divider_style.'],
          ['Brand kit', 'A saved theme you can reload on any future deck.'],
          ['Visual identity', 'The combo of cover_style + divider_style + accent_shape that gives the deck its personality.'],
          ['Critic', 'An LLM pass that reviews a finished deck and returns a structured report with score, issues, and missing slides.'],
          ['Quick refine', 'A one-click preset instruction sent to the slide refine endpoint (Shorter, Denser, More visual, etc.).'],
          ['Cascade', 'Running two different LLMs for the outline pass vs the slide pass.'],
        ].map(([term, def]) => (
          <Feat key={term} icon="·" name={term}>{def}</Feat>
        ))}
      </>
    ),
  },
]


// Component --------------------------------------------------------------
export default function UserGuide({ open, onClose }) {
  const [activeId, setActiveId] = useState('getting-started')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return SECTIONS
    const q = search.toLowerCase()
    return SECTIONS.filter((s) => s.title.toLowerCase().includes(q) || s.summary.toLowerCase().includes(q) || s.id.includes(q))
  }, [search])

  const active = SECTIONS.find((s) => s.id === activeId) || SECTIONS[0]
  const idx = SECTIONS.findIndex((s) => s.id === active.id)

  if (!open) return null

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 1080, width: '95vw', maxHeight: '92vh', padding: 0, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📖</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>User guide</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Everything Presentation Forge can do — searchable.</div>
            </div>
            <Tag tone="indigo">v1.1</Tag>
          </div>
          <button className="btn ghost tiny" onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', height: 'calc(92vh - 76px)' }}>
          <aside style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-2)', padding: 12, overflow: 'auto' }}>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input className="text" style={{ paddingLeft: 30 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the guide…" />
              <span style={{ position: 'absolute', left: 10, top: 9, color: 'var(--muted)', fontSize: 13 }}>🔍</span>
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filtered.map((s) => (
                <button key={s.id}
                  className="btn ghost"
                  onClick={() => setActiveId(s.id)}
                  style={{
                    justifyContent: 'flex-start',
                    padding: '8px 10px', fontWeight: s.id === active.id ? 700 : 500,
                    background: s.id === active.id ? 'rgba(124,92,255,.12)' : 'transparent',
                    color: s.id === active.id ? '#C7B8FF' : 'var(--text-2)',
                    fontSize: 13, gap: 8, textAlign: 'left',
                  }}>
                  <span style={{ fontSize: 14 }}>{s.icon}</span>
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
                </button>
              ))}
              {filtered.length === 0 && <div style={{ padding: 12, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>No section matches "{search}".</div>}
            </nav>
          </aside>

          <main style={{ padding: '24px 32px', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 28 }}>{active.icon}</span>
              <h2 style={{ margin: 0, fontSize: 24 }}>{active.title}</h2>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', fontStyle: 'italic', marginBottom: 24 }}>{active.summary}</div>
            <div style={{ color: 'var(--text)', lineHeight: 1.6, fontSize: 14 }}>{active.body}</div>

            <div style={{ marginTop: 32, paddingTop: 18, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn subtle" disabled={idx === 0} onClick={() => setActiveId(SECTIONS[idx - 1].id)}>← {idx > 0 ? SECTIONS[idx - 1].title : 'Previous'}</button>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{idx + 1} / {SECTIONS.length}</div>
              <button className="btn primary" disabled={idx === SECTIONS.length - 1} onClick={() => setActiveId(SECTIONS[idx + 1].id)}>{idx < SECTIONS.length - 1 ? SECTIONS[idx + 1].title : 'Next'} →</button>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
