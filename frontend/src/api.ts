// Thin client for the FastAPI backend. All endpoints same-origin via Vite proxy.

import type {
  Deck, ThemePatch, BrandKitSummary, Theme,
  LLMConfig, LLMConfigPatch, CriticReview, CriticIssue, CriticMissingSlide,
  FactCheckResult, ProjectListItem, FullProject, StreamEvent, Slide,
} from './types'

const J = { 'Content-Type': 'application/json' } as const

// ---------- Health / models ----------

export interface HealthInfo {
  ok: boolean
  provider_reachable: boolean
  ollama?: boolean
  models?: string[]
  error?: string
  config?: LLMConfig
}

export async function health(): Promise<HealthInfo> {
  const r = await fetch('/api/health')
  return r.json()
}

export async function listModels(): Promise<{ models: { name: string }[] }> {
  const r = await fetch('/api/models')
  if (!r.ok) throw new Error('Could not list models')
  return r.json()
}

// ---------- LLM config ----------

export async function getConfig(): Promise<LLMConfig> {
  const r = await fetch('/api/config')
  if (!r.ok) throw new Error('Could not load config')
  return r.json()
}
export async function saveConfig(patch: LLMConfigPatch): Promise<LLMConfig> {
  const r = await fetch('/api/config', { method: 'POST', headers: J, body: JSON.stringify(patch) })
  if (!r.ok) throw new Error((await r.text()) || 'Could not save config')
  return r.json()
}
export async function testConfig(patch: LLMConfigPatch): Promise<{ ok: boolean; n_models?: number; models?: string[]; sample?: string; error?: string }> {
  const r = await fetch('/api/config/test', { method: 'POST', headers: J, body: JSON.stringify(patch) })
  if (!r.ok) throw new Error('Test request failed')
  return r.json()
}
export async function modelsForConfig(patch: LLMConfigPatch): Promise<{ models: { name: string }[] }> {
  const r = await fetch('/api/config/models', { method: 'POST', headers: J, body: JSON.stringify(patch) })
  if (!r.ok) throw new Error('Could not list models for candidate config')
  return r.json()
}

// ---------- Documents / theme extraction ----------

export interface ParsedDoc { name: string; chars: number; text: string }
export async function parseFile(file: File): Promise<ParsedDoc> {
  const fd = new FormData(); fd.append('file', file)
  const r = await fetch('/api/parse', { method: 'POST', body: fd })
  if (!r.ok) throw new Error('Parse failed')
  return r.json()
}
export interface PaletteResult extends ThemePatch { logo_data_url?: string; all?: string[] }
export async function paletteFromImage(file: File): Promise<PaletteResult> {
  const fd = new FormData(); fd.append('file', file)
  const r = await fetch('/api/theme/from-image', { method: 'POST', body: fd })
  if (!r.ok) throw new Error('Palette extraction failed')
  return r.json()
}
export async function paletteFromPdf(file: File): Promise<PaletteResult> {
  const fd = new FormData(); fd.append('file', file)
  const r = await fetch('/api/theme/from-pdf', { method: 'POST', body: fd })
  if (!r.ok) throw new Error('Palette extraction failed')
  return r.json()
}

// ---------- Themes ----------

export async function listThemes(): Promise<{ presets: Record<string, ThemePatch>; default: Theme }> {
  const r = await fetch('/api/themes')
  return r.json()
}

// ---------- Generation ----------

export interface GenerateRequest {
  prompt: string
  context: string
  audience: string
  tone: string
  target_slides: number
  model: string
  outline_model?: string
  theme?: ThemePatch
}

export async function generateOutline(payload: GenerateRequest): Promise<{ outline: Deck }> {
  const r = await fetch('/api/generate/outline', { method: 'POST', headers: J, body: JSON.stringify(payload) })
  if (!r.ok) throw new Error((await r.text()) || 'Outline failed')
  return r.json()
}

export async function refineSlide(payload: { slide: Slide; instruction: string; context?: string; model?: string }): Promise<{ slide: Slide }> {
  const r = await fetch('/api/slide/refine', { method: 'POST', headers: J, body: JSON.stringify(payload) })
  if (!r.ok) throw new Error((await r.text()) || 'Refine failed')
  return r.json()
}

export async function quickRefine(slide: Slide, preset: string, context: string, model: string): Promise<{ slide: Slide }> {
  const r = await fetch('/api/slide/quick-refine', { method: 'POST', headers: J, body: JSON.stringify({ slide, preset, context, model }) })
  if (!r.ok) throw new Error((await r.text()) || 'Quick-refine failed')
  return r.json()
}

// ---------- Rendering / export ----------

export async function renderHtml(deck: Deck, theme: ThemePatch): Promise<{ html: string }> {
  const r = await fetch('/api/render/html', { method: 'POST', headers: J, body: JSON.stringify({ deck, theme }) })
  if (!r.ok) throw new Error('Render failed')
  return r.json()
}

export async function exportPdf(deck: Deck, theme: ThemePatch): Promise<Blob> {
  const r = await fetch('/api/export/pdf', { method: 'POST', headers: J, body: JSON.stringify({ deck, theme }) })
  if (!r.ok) throw new Error((await r.text()) || 'PDF export failed')
  return r.blob()
}
export async function exportHtmlFile(deck: Deck, theme: ThemePatch): Promise<Blob> {
  const r = await fetch('/api/export/html', { method: 'POST', headers: J, body: JSON.stringify({ deck, theme }) })
  if (!r.ok) throw new Error('HTML export failed')
  return r.blob()
}

// ---------- Projects ----------

export async function saveProject(p: { id?: string; name: string; prompt: string; context: string; audience: string; deck: Deck | null; theme: ThemePatch }): Promise<{ id: string; n_versions?: number }> {
  const r = await fetch('/api/projects', { method: 'POST', headers: J, body: JSON.stringify(p) })
  return r.json()
}
export async function listProjects(): Promise<{ projects: ProjectListItem[] }> {
  const r = await fetch('/api/projects')
  return r.json()
}
export async function loadProject(id: string): Promise<FullProject> {
  const r = await fetch('/api/projects/' + id)
  return r.json()
}
export async function deleteProject(id: string): Promise<{ ok: boolean }> {
  const r = await fetch('/api/projects/' + id, { method: 'DELETE' })
  return r.json()
}
export async function listVersions(pid: string): Promise<{ versions: { saved_at?: number; n_slides?: number }[] }> {
  const r = await fetch('/api/projects/' + pid + '/versions')
  return r.json()
}
export async function restoreVersion(pid: string, idx: number): Promise<{ deck?: Deck; theme?: ThemePatch }> {
  const r = await fetch(`/api/projects/${pid}/restore/${idx}`, { method: 'POST' })
  if (!r.ok) throw new Error('Restore failed')
  return r.json()
}

// ---------- Brand kits ----------

export async function listBrands(): Promise<{ brands: BrandKitSummary[] }> {
  const r = await fetch('/api/brands'); return r.json()
}
export async function saveBrand(name: string, theme: ThemePatch, id?: string): Promise<BrandKitSummary> {
  const r = await fetch('/api/brands', { method: 'POST', headers: J, body: JSON.stringify({ id, name, theme }) })
  if (!r.ok) throw new Error('Save brand failed')
  return r.json()
}
export async function getBrand(id: string): Promise<ThemePatch & { id: string; name: string }> {
  const r = await fetch('/api/brands/' + id)
  if (!r.ok) throw new Error('Brand not found')
  return r.json()
}
export async function deleteBrand(id: string): Promise<void> {
  await fetch('/api/brands/' + id, { method: 'DELETE' })
}

// ---------- Critic / translate / fact-check ----------

export async function criticPass(deck: Deck, context: string, model: string): Promise<{ review: CriticReview }> {
  const r = await fetch('/api/critic', { method: 'POST', headers: J, body: JSON.stringify({ deck, context, model }) })
  if (!r.ok) throw new Error((await r.text()) || 'Critic failed')
  return r.json()
}
export async function translateDeck(deck: Deck, target_language: string, model: string): Promise<{ deck: Deck }> {
  const r = await fetch('/api/translate', { method: 'POST', headers: J, body: JSON.stringify({ deck, target_language, model }) })
  if (!r.ok) throw new Error((await r.text()) || 'Translate failed')
  return r.json()
}
export async function factcheck(deck: Deck, sources_text: string): Promise<FactCheckResult> {
  const r = await fetch('/api/factcheck', { method: 'POST', headers: J, body: JSON.stringify({ deck, sources_text }) })
  if (!r.ok) throw new Error('Factcheck failed')
  return r.json()
}
export async function criticInsertSlide(outline: Deck, after_slide_id: string | null, proposed: CriticMissingSlide, context: string, model: string): Promise<{ slide: Slide; after_slide_id: string | null }> {
  const r = await fetch('/api/critic/insert-slide', { method: 'POST', headers: J, body: JSON.stringify({ outline, after_slide_id, proposed, context, model }) })
  if (!r.ok) throw new Error((await r.text()) || 'Insert failed')
  return r.json()
}
export async function criticFixSlide(slide: Slide, issue: CriticIssue, context: string, model: string): Promise<{ slide: Slide }> {
  const r = await fetch('/api/critic/fix-slide', { method: 'POST', headers: J, body: JSON.stringify({ slide, issue, context, model }) })
  if (!r.ok) throw new Error((await r.text()) || 'Fix failed')
  return r.json()
}

// ---------- Streaming (SSE) ----------

type StreamHandler = (ev: StreamEvent) => void

async function consumeSSE(url: string, body: unknown, onEvent: StreamHandler, signal?: AbortSignal): Promise<void> {
  const r = await fetch(url, { method: 'POST', headers: J, body: JSON.stringify(body), signal })
  if (!r.ok || !r.body) throw new Error((await r.text()) || 'Stream failed')
  const reader = r.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let idx: number
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2)
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue
        const raw = line.slice(5).trim()
        if (!raw) continue
        try { onEvent(JSON.parse(raw) as StreamEvent) } catch { /* ignore malformed line */ }
      }
    }
  }
}

export async function streamGenerate(payload: GenerateRequest, onEvent: StreamHandler, signal?: AbortSignal): Promise<void> {
  await consumeSSE('/api/generate/stream', payload, onEvent, signal)
}

export async function expandOutlineStream(payload: { outline: Deck; context: string; model: string }, onEvent: StreamHandler, signal?: AbortSignal): Promise<void> {
  await consumeSSE('/api/generate/expand-outline', payload, onEvent, signal)
}
