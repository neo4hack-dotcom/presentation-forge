import { useEffect, useMemo, useRef, useState } from 'react'
import * as api from './api'
import type { Theme, ThemePatch, Deck, Slide, SlideLayout, ProjectListItem, Toast, StreamEvent } from './types'

import InputPanel, { type UploadedDoc } from './components/InputPanel'
import ThemePanel from './components/ThemePanel'
import Preview from './components/Preview'
import SlideList from './components/SlideList'
import OutlineEditor from './components/OutlineEditor'
import ToolsPanel from './components/ToolsPanel'
import Presenter from './components/Presenter'
import SettingsModal from './components/SettingsModal'
import BrandKitsBar from './components/BrandKitsBar'
import VisualIdentityPicker from './components/VisualIdentityPicker'
import UserGuide from './components/UserGuide'

const DEFAULT_THEME: Theme = {
  name: 'Aurora',
  primary: '#2563EB', secondary: '#0EA5E9', accent: '#F59E0B',
  background: '#FFFFFF', surface: '#FFFFFF', text: '#0F172A', muted: '#64748B',
  heading_font: "'Inter', 'Helvetica Neue', sans-serif",
  body_font: "'Inter', 'Helvetica Neue', sans-serif",
  mono_font: "'JetBrains Mono', ui-monospace, monospace",
  logo: null, footer: '',
  template: 'consulting', dark: false,
  cover_style: 'minimal', divider_style: 'gradient',
  show_logo_on_cover: true, show_logo_on_header: true, show_logo_on_footer: false,
  logo_size_cover: 64, logo_position_cover: 'top-right',
  logo_size_header: 28, logo_position_header: 'right',
  logo_size_footer: 20, logo_position_footer: 'right',
}

// Max undo history per slide (memory bound)
const MAX_HISTORY = 5

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

/** Strip client-only fields before sending to backend. */
function cleanForBackend(slide: Slide): Slide {
  const { __history, __pending, ...rest } = slide
  return rest as Slide
}

export default function App() {
  // Generation state
  const [prompt, setPrompt] = useState('')
  const [context, setContext] = useState('')
  const [audience, setAudience] = useState('Executive committee')
  const [tone, setTone] = useState('Senior PM / board-level')
  const [targetSlides, setTargetSlides] = useState(12)
  const [docs, setDocs] = useState<UploadedDoc[]>([])
  const [generating, setGenerating] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Outline-first
  const [reviewOutline, setReviewOutline] = useState(true)
  const [pendingOutline, setPendingOutline] = useState<Deck | null>(null)
  const [expandingOutline, setExpandingOutline] = useState(false)

  // Deck
  const [deck, setDeck] = useState<Deck | null>(null)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [refining, setRefining] = useState(false)

  // Theme
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)
  const [presets, setPresets] = useState<Record<string, ThemePatch & { name?: string }>>({})

  // Models
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState('')
  const [outlineModel, setOutlineModel] = useState('')

  // Project
  const [projectName, setProjectName] = useState('Untitled deck')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [showProjects, setShowProjects] = useState(false)
  const [versions, setVersions] = useState<{ saved_at?: number; n_slides?: number }[]>([])

  // Display
  const [notesMode, setNotesMode] = useState(false)
  const [tab, setTab] = useState<'setup' | 'slides'>('setup')
  const [html, setHtml] = useState('')
  const [exporting, setExporting] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [providerLabel, setProviderLabel] = useState('Ollama')

  const addToast = (t: Toast) => setToast(t)

  const refreshHealth = async () => {
    try {
      const h = await api.health()
      if (h.config) setProviderLabel(h.config.provider === 'openai' ? 'OpenAI-compat' : 'Ollama')
      if (h.provider_reachable && h.models) {
        setModels(h.models)
        const cfgDefault = h.config?.default_model
        const preferred = (cfgDefault && h.models.includes(cfgDefault)) ? cfgDefault
          : h.models.find((m) => /gpt-oss/i.test(m))
          || h.models.find((m) => /qwen3/i.test(m))
          || h.models[0]
        setModel(preferred || '')
        const cfgOutline = h.config?.outline_model
        const fast = (cfgOutline && h.models.includes(cfgOutline)) ? cfgOutline
          : (h.models.find((m) => /qwen.*4b|gemma|phi|haiku/i.test(m)) || '')
        setOutlineModel(fast || '')
        return true
      }
      setModels([])
      setToast({ type: 'error', message: `${h.config?.provider === 'openai' ? 'OpenAI-compat endpoint' : 'Ollama'} not reachable at ${h.config?.base_url}. Open ⚙️ Settings to fix.` })
      return false
    } catch {
      setToast({ type: 'error', message: 'Backend unreachable. Did you start it? (./start.sh)' })
      return false
    }
  }

  useEffect(() => {
    (async () => {
      await refreshHealth()
      try { setPresets((await api.listThemes()).presets || {}) } catch {}
      try { setProjects((await api.listProjects()).projects || []) } catch {}
    })()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  const fullContext = useMemo(() => {
    const parts: string[] = []
    if (context.trim()) parts.push('--- pasted context ---\n' + context.trim())
    for (const d of docs) if (d.text) parts.push(`--- ${d.name} (${d.chars} chars) ---\n${d.text}`)
    return parts.join('\n\n')
  }, [context, docs])

  const debouncedDeck = useDebounced(deck, 350)
  const debouncedTheme = useDebounced(theme, 350)
  useEffect(() => {
    if (!debouncedDeck?.slides?.length) { setHtml(''); return }
    let cancelled = false
    api.renderHtml(debouncedDeck, debouncedTheme).then((r) => { if (!cancelled) setHtml(r.html) })
      .catch((e) => setError(String(e)))
    return () => { cancelled = true }
  }, [debouncedDeck, debouncedTheme])

  const handleStreamEvent = (ev: StreamEvent) => {
    if (ev.event === 'status') setStatus(ev.message)
    else if (ev.event === 'outline') {
      const placeholders = ev.outline.slides.map((s) => ({ ...s, __pending: true }))
      setDeck({ ...ev.outline, slides: placeholders })
      setStatus(`Outline ready — ${ev.outline.slides.length} slides drafting…`)
    } else if (ev.event === 'slide') {
      setDeck((d) => d ? { ...d, slides: d.slides.map((s) => s.id === ev.slide.id ? { ...ev.slide, __pending: false } : s) } : d)
    } else if (ev.event === 'done') {
      setDeck(ev.deck); setStatus('Done.')
    } else if (ev.event === 'error') {
      setError(ev.message); setStatus('Error.')
    }
  }

  // ----- Generate
  const onGenerate = async () => {
    setError(null); setDeck(null); setHtml(''); setPendingOutline(null)
    setTab('slides')

    if (reviewOutline) {
      setGenerating(true); setStatus('Drafting outline…')
      try {
        const r = await api.generateOutline({
          prompt, context: fullContext, audience, tone, target_slides: targetSlides,
          model, outline_model: outlineModel || model, theme,
        })
        setPendingOutline(r.outline)
        setStatus('Outline ready — review and expand.')
      } catch (e) {
        setError(String(e))
      } finally {
        setGenerating(false)
      }
      return
    }

    setGenerating(true); setStatus('Starting…')
    const controller = new AbortController(); abortRef.current = controller
    try {
      await api.streamGenerate({
        prompt, context: fullContext, audience, tone, target_slides: targetSlides,
        model, outline_model: outlineModel || model, theme,
      }, handleStreamEvent, controller.signal)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(String(e))
    } finally {
      setGenerating(false); abortRef.current = null
    }
  }

  const expandFromOutline = async () => {
    if (!pendingOutline) return
    setExpandingOutline(true); setError(null); setStatus('Expanding slides…')
    const placeholders = pendingOutline.slides.map((s) => ({ ...s, __pending: true }))
    setDeck({ ...pendingOutline, slides: placeholders })
    const controller = new AbortController(); abortRef.current = controller
    try {
      await api.expandOutlineStream({ outline: pendingOutline, context: fullContext, model }, handleStreamEvent, controller.signal)
      setPendingOutline(null)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(String(e))
    } finally {
      setExpandingOutline(false); abortRef.current = null
    }
  }

  const onAbort = () => abortRef.current?.abort()

  // ----- Slide ops with undo history
  const onSelect = (id: string) => setCurrentId(id)
  const onMove = (i: number, dir: number) => {
    setDeck((d) => {
      if (!d) return d
      const arr = [...d.slides]
      const j = i + dir
      if (j < 0 || j >= arr.length) return d
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return { ...d, slides: arr }
    })
  }
  const onDelete = (i: number) => setDeck((d) => d ? { ...d, slides: d.slides.filter((_, idx) => idx !== i) } : d)

  /** Replace a slide while pushing the OLD version into __history (capped). */
  const replaceSlideWithHistory = (slideId: string, replacement: Slide) => {
    setDeck((d) => {
      if (!d) return d
      return {
        ...d,
        slides: d.slides.map((s) => {
          if (s.id !== slideId) return s
          const { __history = [], __pending, ...prev } = s
          const newHistory = [prev as Slide, ...__history].slice(0, MAX_HISTORY)
          return { ...replacement, __history: newHistory, __pending: false }
        }),
      }
    })
  }

  const onRefine = async (slideId: string, instruction: string) => {
    if (!deck) return
    const slide = deck.slides.find((s) => s.id === slideId)
    if (!slide) return
    setRefining(true)
    try {
      const r = await api.refineSlide({ slide: cleanForBackend(slide), instruction, context: fullContext, model })
      replaceSlideWithHistory(slideId, r.slide)
      setToast({ type: 'success', message: 'Slide refined — ↶ available to undo.' })
    } catch (e) { setToast({ type: 'error', message: String(e) }) }
    finally { setRefining(false) }
  }

  const onQuickRefine = async (slideId: string, preset: string) => {
    if (!deck) return
    const slide = deck.slides.find((s) => s.id === slideId)
    if (!slide) return
    setRefining(true)
    try {
      const r = await api.quickRefine(cleanForBackend(slide), preset, fullContext, model)
      replaceSlideWithHistory(slideId, r.slide)
    } catch (e) { setToast({ type: 'error', message: String(e) }) }
    finally { setRefining(false) }
  }

  const onChangeLayout = async (slideId: string, layout: SlideLayout) => {
    if (!deck) return
    const slide = deck.slides.find((s) => s.id === slideId)
    if (!slide || slide.layout === layout) return
    setRefining(true)
    try {
      const r = await api.refineSlide({
        slide: cleanForBackend({ ...slide, layout }),
        instruction: `Recast this slide as a "${layout}" layout. Keep the title intent but reorganize the content (bullets/kpis/chart/table/timeline/etc.) to match the new layout.`,
        context: fullContext, model,
      })
      replaceSlideWithHistory(slideId, r.slide)
    } catch (e) { setToast({ type: 'error', message: String(e) }) }
    finally { setRefining(false) }
  }

  /** Pop the most recent prior version and restore it. */
  const onUndo = (slideId: string) => {
    setDeck((d) => {
      if (!d) return d
      return {
        ...d,
        slides: d.slides.map((s) => {
          if (s.id !== slideId) return s
          const hist = s.__history || []
          if (hist.length === 0) return s
          const [prev, ...rest] = hist
          return { ...prev, __history: rest } as Slide
        }),
      }
    })
    setToast({ type: 'success', message: 'Reverted to previous version.' })
  }

  // ----- Export
  const onExportPdf = async () => {
    if (!deck) return
    setExporting(true)
    try {
      const blob = await api.exportPdf(deck, theme)
      downloadBlob(blob, (projectName || 'presentation') + '.pdf')
      setToast({ type: 'success', message: 'PDF exported.' })
    } catch (e) { setToast({ type: 'error', message: String(e) }) }
    finally { setExporting(false) }
  }
  const onExportHtml = async () => {
    if (!deck) return
    try {
      const blob = await api.exportHtmlFile(deck, theme)
      downloadBlob(blob, (projectName || 'presentation') + '.html')
    } catch (e) { setToast({ type: 'error', message: String(e) }) }
  }

  // ----- Projects
  const saveProject = async () => {
    try {
      const r = await api.saveProject({ id: projectId || undefined, name: projectName, prompt, context, audience, deck, theme })
      setProjectId(r.id)
      setToast({ type: 'success', message: 'Saved' + (r.n_versions ? ` (${r.n_versions} version${r.n_versions > 1 ? 's' : ''} kept)` : '') })
      setProjects((await api.listProjects()).projects || [])
    } catch (e) { setToast({ type: 'error', message: String(e) }) }
  }
  const loadProject = async (id: string) => {
    try {
      const p = await api.loadProject(id)
      setProjectId(p.id); setProjectName(p.name || 'Loaded')
      setPrompt(p.prompt || ''); setContext(p.context || ''); setAudience(p.audience || '')
      if (p.theme) setTheme((t) => ({ ...t, ...p.theme }))
      if (p.deck) { setDeck(p.deck); setTab('slides') }
      setShowProjects(false)
    } catch (e) { setToast({ type: 'error', message: String(e) }) }
  }
  const openVersionsFor = async (id: string) => {
    try { setVersions((await api.listVersions(id)).versions || []) }
    catch (e) { setToast({ type: 'error', message: String(e) }) }
  }
  const restoreVersion = async (id: string, idx: number) => {
    try {
      const r = await api.restoreVersion(id, idx)
      if (r.deck) setDeck(r.deck)
      if (r.theme) setTheme((t) => ({ ...t, ...r.theme }))
      setToast({ type: 'success', message: 'Version restored' })
      setShowProjects(false)
    } catch (e) { setToast({ type: 'error', message: String(e) }) }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveProject() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !generating) { e.preventDefault(); onGenerate() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') { e.preventDefault(); onExportPdf() }
      if (e.key === 'F5' && deck) { e.preventDefault(); setPresenting(true) }
      if (e.key === '?' && !(e.target as Element | null)?.closest?.('input, textarea, select')) { e.preventDefault(); setShowGuide(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="app">
      <header className="topbar">
        <div className="left">
          <div className="brand">
            <div className="logo"></div>
            Presentation Forge<small>local · LLM · board-grade</small>
          </div>
        </div>
        <input className="project-name" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
        <div className="right">
          <span className={'pill ' + (models.length ? 'ok' : 'bad')} title={models.length ? `${models.length} models via ${providerLabel}` : 'No models — open Settings'}>
            ● {providerLabel} · {models.length ? `${models.length}` : 'offline'}
          </span>
          <button className="btn subtle" onClick={() => setShowGuide(true)} title="User guide (?)">❔</button>
          <button className="btn subtle" onClick={() => setShowSettings(true)} title="LLM Settings">⚙️</button>
          <button className="btn subtle" onClick={() => setShowProjects(true)}>📁 Projects</button>
          <button className="btn" onClick={saveProject} title="Cmd/Ctrl+S">💾 Save</button>
          <button className="btn subtle" onClick={() => deck && setPresenting(true)} disabled={!deck} title="F5">▶ Present</button>
          <label className="toggle" style={{ marginLeft: 4 }}>
            <input type="checkbox" checked={notesMode} onChange={(e) => setNotesMode(e.target.checked)} />
            <span className="track"></span>
            <span style={{ fontSize: 12 }}>notes</span>
          </label>
        </div>
      </header>

      <div className="workspace">
        <div className="pane left" style={{ padding: 0 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            <button className={'btn ghost ' + (tab === 'setup' ? '' : 'subtle')} style={{ flex: 1, borderRadius: 0, padding: '12px' }} onClick={() => setTab('setup')}>Setup</button>
            <button className={'btn ghost ' + (tab === 'slides' ? '' : 'subtle')} style={{ flex: 1, borderRadius: 0, padding: '12px' }} onClick={() => setTab('slides')}>
              Slides {deck?.slides?.length ? `(${deck.slides.length})` : ''}
            </button>
          </div>
          {tab === 'setup' ? (
            <>
              <InputPanel
                prompt={prompt} setPrompt={setPrompt}
                context={context} setContext={setContext}
                audience={audience} setAudience={setAudience}
                tone={tone} setTone={setTone}
                targetSlides={targetSlides} setTargetSlides={setTargetSlides}
                docs={docs} setDocs={setDocs}
                onGenerate={onGenerate} generating={generating} onAbort={onAbort}
                models={models} model={model} setModel={setModel}
                outlineModel={outlineModel} setOutlineModel={setOutlineModel}
                reviewOutline={reviewOutline} setReviewOutline={setReviewOutline}
              />
              {pendingOutline && (
                <OutlineEditor outline={pendingOutline} setOutline={setPendingOutline}
                  onExpand={expandFromOutline} onCancel={() => setPendingOutline(null)}
                  expanding={expandingOutline} />
              )}
            </>
          ) : (
            <div style={{ flex: 1, overflow: 'auto' }}>
              {deck?.title && (
                <div style={{ padding: '14px 18px 4px' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Deck</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{deck.title}</div>
                  {deck.subtitle && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{deck.subtitle}</div>}
                </div>
              )}
              <SlideList
                slides={deck?.slides || []}
                currentId={currentId}
                onSelect={onSelect}
                onMove={onMove}
                onDelete={onDelete}
                onRefine={onRefine}
                onQuickRefine={onQuickRefine}
                onChangeLayout={onChangeLayout}
                onUndo={onUndo}
                refining={refining}
              />
            </div>
          )}
          {(generating || expandingOutline || error) && (
            <div className="status-bar">
              {(generating || expandingOutline) && <span className="spinner"></span>}
              <span>{error || status}</span>
            </div>
          )}
        </div>

        <div className="pane center">
          <Preview html={html} currentSlideId={currentId} slides={deck?.slides || []} notesMode={notesMode} onSelectSlide={setCurrentId} />
        </div>

        {/*
          BUG FIX #1: right pane was inheriting display:flex from .pane, which
          compressed sections below VisualIdentityPicker (taller content squeezed
          the next sections to zero). We override to block + overflow-y:auto so
          children stack at natural heights and the pane scrolls cleanly.
        */}
        <div className="pane right" style={{ padding: 0, overflowY: 'auto', display: 'block' }}>
          <ThemePanel
            theme={theme} setTheme={setTheme} presets={presets}
            slides={deck?.slides || []}
            onExportPdf={onExportPdf}
            onExportHtml={onExportHtml}
            exporting={exporting}
            addToast={addToast}
          />
          <VisualIdentityPicker theme={theme} setTheme={setTheme} />
          <BrandKitsBar theme={theme} setTheme={setTheme} addToast={addToast} />
          <ToolsPanel
            deck={deck} setDeck={setDeck}
            fullContext={fullContext}
            sourcesText={fullContext}
            model={model}
            addToast={addToast}
            onPresentMode={() => setPresenting(true)}
          />
        </div>
      </div>

      {toast && <div className={'toast ' + (toast.type || '')}>{toast.message}</div>}

      {presenting && deck && html && (
        <Presenter html={html} slides={deck.slides} onClose={() => setPresenting(false)} />
      )}

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        addToast={addToast}
        onSaved={() => refreshHealth()}
      />

      <UserGuide open={showGuide} onClose={() => setShowGuide(false)} />

      {showProjects && (
        <div className="modal-bg" onClick={() => { setShowProjects(false); setVersions([]) }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Local projects</h2>
            {projects.length === 0 ? (
              <p style={{ color: 'var(--text-2)' }}>No projects saved yet. Use 💾 Save to create one.</p>
            ) : (
              <div style={{ maxHeight: 360, overflow: 'auto' }}>
                {projects.map((p) => (
                  <div key={p.id} style={{ padding: '10px 4px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.n_slides} slides · {new Date(p.updated_at * 1000).toLocaleString()}</div>
                      </div>
                      <div className="btn-group">
                        <button className="btn tiny" onClick={() => loadProject(p.id)}>Load</button>
                        <button className="btn tiny subtle" onClick={() => openVersionsFor(p.id)}>Versions</button>
                        <button className="btn tiny danger" onClick={async () => {
                          if (!confirm('Delete ' + p.name + '?')) return
                          await api.deleteProject(p.id)
                          setProjects((arr) => arr.filter((x) => x.id !== p.id))
                        }}>Delete</button>
                      </div>
                    </div>
                    {versions.length > 0 && (
                      <div style={{ marginTop: 8, marginLeft: 12, fontSize: 12 }}>
                        {versions.map((v, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--text-2)' }}>
                            <span>v{versions.length - idx} · {v.n_slides} slides · {v.saved_at ? new Date(v.saved_at * 1000).toLocaleString() : ''}</span>
                            <button className="btn tiny" onClick={() => restoreVersion(p.id, idx)}>Restore</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="row">
              <button className="btn subtle" onClick={() => { setShowProjects(false); setVersions([]) }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
