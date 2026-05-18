import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as api from './api.js'
import InputPanel from './components/InputPanel.jsx'
import ThemePanel from './components/ThemePanel.jsx'
import Preview from './components/Preview.jsx'
import SlideList from './components/SlideList.jsx'
import OutlineEditor from './components/OutlineEditor.jsx'
import ToolsPanel from './components/ToolsPanel.jsx'
import Presenter from './components/Presenter.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import BrandKitsBar from './components/BrandKitsBar.jsx'
import VisualIdentityPicker from './components/VisualIdentityPicker.jsx'

const DEFAULT_THEME = {
  name: 'Aurora',
  primary: '#2563EB',
  secondary: '#0EA5E9',
  accent: '#F59E0B',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  heading_font: "'Inter', 'Helvetica Neue', sans-serif",
  body_font: "'Inter', 'Helvetica Neue', sans-serif",
  mono_font: "'JetBrains Mono', ui-monospace, monospace",
  logo: null,
  footer: '',
  template: 'consulting',
  dark: false,
}

function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

export default function App() {
  // Generation state
  const [prompt, setPrompt] = useState('')
  const [context, setContext] = useState('')
  const [audience, setAudience] = useState('Executive committee')
  const [tone, setTone] = useState('Senior PM / board-level')
  const [targetSlides, setTargetSlides] = useState(12)
  const [docs, setDocs] = useState([])
  const [generating, setGenerating] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const abortRef = useRef(null)

  // Outline-first workflow (improvement #1)
  const [reviewOutline, setReviewOutline] = useState(true)
  const [pendingOutline, setPendingOutline] = useState(null)
  const [expandingOutline, setExpandingOutline] = useState(false)

  // Deck state
  const [deck, setDeck] = useState(null)
  const [currentId, setCurrentId] = useState(null)
  const [refining, setRefining] = useState(false)

  // Theme
  const [theme, setTheme] = useState(DEFAULT_THEME)
  const [presets, setPresets] = useState({})

  // Models
  const [models, setModels] = useState([])
  const [model, setModel] = useState('')
  const [outlineModel, setOutlineModel] = useState('')

  // Project
  const [projectName, setProjectName] = useState('Untitled deck')
  const [projectId, setProjectId] = useState(null)
  const [projects, setProjects] = useState([])
  const [showProjects, setShowProjects] = useState(false)
  const [versions, setVersions] = useState([])

  // Display state
  const [notesMode, setNotesMode] = useState(false)
  const [tab, setTab] = useState('setup')
  const [html, setHtml] = useState('')
  const [exporting, setExporting] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [providerLabel, setProviderLabel] = useState('Ollama')

  const addToast = (t) => setToast(t)

  const refreshHealth = async () => {
    try {
      const h = await api.health()
      if (h.config) {
        setProviderLabel(h.config.provider === 'openai' ? 'OpenAI-compat' : 'Ollama')
      }
      if (h.provider_reachable && h.models) {
        setModels(h.models)
        const cfgDefault = h.config && h.config.default_model
        const preferred = (cfgDefault && h.models.includes(cfgDefault)) ? cfgDefault
          : h.models.find((m) => /gpt-oss/i.test(m))
          || h.models.find((m) => /qwen3/i.test(m))
          || h.models[0]
        setModel(preferred || '')
        const cfgOutline = h.config && h.config.outline_model
        const fast = (cfgOutline && h.models.includes(cfgOutline)) ? cfgOutline
          : (h.models.find((m) => /qwen.*4b|gemma|phi|haiku/i.test(m)) || '')
        setOutlineModel(fast || '')
        return true
      } else {
        setModels([])
        setToast({ type: 'error', message: `${h.config?.provider === 'openai' ? 'OpenAI-compat endpoint' : 'Ollama'} not reachable at ${h.config?.base_url}. Open ⚙️ Settings to fix.` })
        return false
      }
    } catch (e) {
      setToast({ type: 'error', message: 'Backend unreachable. Did you start it? (./start.sh)' })
      return false
    }
  }

  // ----- bootstrap
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
    const parts = []
    if (context.trim()) parts.push('--- pasted context ---\n' + context.trim())
    for (const d of docs) if (d.text) parts.push(`--- ${d.name} (${d.chars} chars) ---\n${d.text}`)
    return parts.join('\n\n')
  }, [context, docs])

  // Debounced HTML render
  const debouncedDeck = useDebounced(deck, 350)
  const debouncedTheme = useDebounced(theme, 350)
  useEffect(() => {
    if (!debouncedDeck || !debouncedDeck.slides || debouncedDeck.slides.length === 0) {
      setHtml('')
      return
    }
    let cancelled = false
    api.renderHtml(debouncedDeck, debouncedTheme).then((r) => {
      if (!cancelled) setHtml(r.html)
    }).catch((e) => setError(String(e)))
    return () => { cancelled = true }
  }, [debouncedDeck, debouncedTheme])

  // ----- Generate (two paths: outline-first review, or straight to slides)
  const onGenerate = async () => {
    setError(null); setDeck(null); setHtml(''); setPendingOutline(null)
    setTab('slides')

    if (reviewOutline) {
      // Outline only, then user edits and clicks Expand
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

    // Straight-through: outline + parallel slide generation streamed
    setGenerating(true); setStatus('Starting…')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await api.streamGenerate({
        prompt, context: fullContext, audience, tone, target_slides: targetSlides,
        model, outline_model: outlineModel || model, theme,
      }, handleStreamEvent, controller.signal)
    } catch (e) {
      if (e.name !== 'AbortError') setError(String(e))
    } finally {
      setGenerating(false)
      abortRef.current = null
    }
  }

  const expandFromOutline = async () => {
    if (!pendingOutline) return
    setExpandingOutline(true); setError(null); setStatus('Expanding slides…')
    const placeholders = pendingOutline.slides.map((s) => ({ ...s, __pending: true }))
    setDeck({ ...pendingOutline, slides: placeholders })
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await api.expandOutlineStream(
        { outline: pendingOutline, context: fullContext, model },
        handleStreamEvent,
        controller.signal,
      )
      setPendingOutline(null)
    } catch (e) {
      if (e.name !== 'AbortError') setError(String(e))
    } finally {
      setExpandingOutline(false)
      abortRef.current = null
    }
  }

  const handleStreamEvent = (ev) => {
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

  const onAbort = () => abortRef.current?.abort()

  // ----- Slide ops
  const onSelect = (id) => setCurrentId(id)
  const onMove = (i, dir) => {
    setDeck((d) => {
      const arr = [...d.slides]
      const j = i + dir
      if (j < 0 || j >= arr.length) return d
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return { ...d, slides: arr }
    })
  }
  const onDelete = (i) => setDeck((d) => ({ ...d, slides: d.slides.filter((_, idx) => idx !== i) }))

  const onRefine = async (slideId, instruction) => {
    const slide = deck.slides.find((s) => s.id === slideId)
    if (!slide) return
    setRefining(true)
    try {
      const r = await api.refineSlide({ slide, instruction, context: fullContext, model })
      setDeck((d) => ({ ...d, slides: d.slides.map((s) => s.id === slideId ? r.slide : s) }))
      setToast({ type: 'success', message: 'Slide refined.' })
    } catch (e) { setToast({ type: 'error', message: String(e) }) }
    finally { setRefining(false) }
  }

  const onQuickRefine = async (slideId, preset) => {
    const slide = deck.slides.find((s) => s.id === slideId)
    if (!slide) return
    setRefining(true)
    try {
      const r = await api.quickRefine(slide, preset, fullContext, model)
      setDeck((d) => ({ ...d, slides: d.slides.map((s) => s.id === slideId ? r.slide : s) }))
    } catch (e) { setToast({ type: 'error', message: String(e) }) }
    finally { setRefining(false) }
  }

  const onChangeLayout = async (slideId, layout) => {
    const slide = deck.slides.find((s) => s.id === slideId)
    if (!slide || slide.layout === layout) return
    // Optimistic update first
    setDeck((d) => ({ ...d, slides: d.slides.map((s) => s.id === slideId ? { ...s, layout } : s) }))
    // Ask LLM to recast content to fit the new layout
    setRefining(true)
    try {
      const r = await api.refineSlide({
        slide: { ...slide, layout },
        instruction: `Recast this slide as a "${layout}" layout. Keep the title intent but reorganize the content (bullets/kpis/chart/table/timeline/etc.) to match the new layout.`,
        context: fullContext, model,
      })
      setDeck((d) => ({ ...d, slides: d.slides.map((s) => s.id === slideId ? r.slide : s) }))
    } catch (e) { setToast({ type: 'error', message: String(e) }) }
    finally { setRefining(false) }
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

  // ----- Projects + versions
  const saveProject = async () => {
    try {
      const r = await api.saveProject({ id: projectId, name: projectName, prompt, context, audience, deck, theme })
      setProjectId(r.id)
      setToast({ type: 'success', message: 'Saved' + (r.n_versions ? ` (${r.n_versions} version${r.n_versions > 1 ? 's' : ''} kept)` : '') })
      const p = await api.listProjects(); setProjects(p.projects || [])
    } catch (e) { setToast({ type: 'error', message: String(e) }) }
  }
  const loadProject = async (id) => {
    try {
      const p = await api.loadProject(id)
      setProjectId(p.id); setProjectName(p.name || 'Loaded')
      setPrompt(p.prompt || ''); setContext(p.context || ''); setAudience(p.audience || '')
      if (p.theme) setTheme((t) => ({ ...t, ...p.theme }))
      if (p.deck) { setDeck(p.deck); setTab('slides') }
      setShowProjects(false)
    } catch (e) { setToast({ type: 'error', message: String(e) }) }
  }
  const openVersionsFor = async (id) => {
    try {
      const r = await api.listVersions(id)
      setVersions(r.versions || [])
    } catch (e) { setToast({ type: 'error', message: String(e) }) }
  }
  const restoreVersion = async (id, idx) => {
    try {
      const r = await api.restoreVersion(id, idx)
      if (r.deck) setDeck(r.deck)
      if (r.theme) setTheme((t) => ({ ...t, ...r.theme }))
      setToast({ type: 'success', message: 'Version restored' })
      setShowProjects(false)
    } catch (e) { setToast({ type: 'error', message: String(e) }) }
  }

  // Hotkeys
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveProject() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !generating) { e.preventDefault(); onGenerate() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') { e.preventDefault(); onExportPdf() }
      if (e.key === 'F5' && deck) { e.preventDefault(); setPresenting(true) }
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

        <div className="pane right" style={{ padding: 0, overflow: 'auto' }}>
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
