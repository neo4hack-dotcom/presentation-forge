import { useRef } from 'react'
import * as api from '../api'
import type { Theme, ThemePatch, Slide, Toast } from '../types'

const COLOR_FIELDS = [
  ['primary', 'Primary'], ['secondary', 'Secondary'], ['accent', 'Accent'],
  ['background', 'Background'], ['surface', 'Surface'],
  ['text', 'Text'], ['muted', 'Muted'],
] as const

interface Props {
  theme: Theme
  setTheme: React.Dispatch<React.SetStateAction<Theme>>
  presets: Record<string, ThemePatch & { name?: string }>
  slides: Slide[]
  onExportPdf: () => void
  onExportHtml: () => void
  exporting: boolean
  addToast?: (t: Toast) => void
}

export default function ThemePanel({ theme, setTheme, presets, slides, onExportPdf, onExportHtml, exporting, addToast }: Props) {
  const logoRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  const update = (patch: ThemePatch) => setTheme((t) => ({ ...t, ...patch }))

  const applyPreset = (key: string) => {
    const p = presets[key]
    if (!p) return
    setTheme((t) => ({ ...t, ...p, logo: t.logo, footer: t.footer, name: p.name || t.name }))
  }

  const handleLogo = async (file: File) => {
    try {
      const r = await api.paletteFromImage(file)
      setTheme((t) => ({
        ...t,
        logo: r.logo_data_url || t.logo,
        primary: r.primary || t.primary,
        secondary: r.secondary || t.secondary,
        background: r.background || t.background,
        surface: r.surface || t.surface,
        text: r.text || t.text,
        muted: r.muted || t.muted,
        dark: r.dark ?? t.dark,
        // Enable showing the logo by default once one is added
        show_logo_on_cover: t.show_logo_on_cover ?? true,
        show_logo_on_header: t.show_logo_on_header ?? true,
      }))
    } catch {
      const reader = new FileReader()
      reader.onload = () => setTheme((t) => ({ ...t, logo: String(reader.result || '') }))
      reader.readAsDataURL(file)
    }
  }

  const handlePdfStyle = async (file: File) => {
    try {
      const r = await api.paletteFromPdf(file)
      setTheme((t) => ({
        ...t,
        primary: r.primary || t.primary,
        secondary: r.secondary || t.secondary,
        background: r.background || t.background,
        surface: r.surface || t.surface,
        text: r.text || t.text,
        muted: r.muted || t.muted,
        dark: r.dark ?? t.dark,
      }))
      addToast?.({ type: 'success', message: 'Palette learned from PDF' })
    } catch (e) {
      addToast?.({ type: 'error', message: String(e) })
    }
  }

  return (
    <div className="pane right">

      <div className="section">
        <h3 style={{ margin: 0, padding: 0 }}>Export</h3>
        <div className="btn-group" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={onExportPdf} disabled={!slides?.length || exporting}>
            {exporting ? <><span className="spinner"></span> PDF…</> : '⇩ PDF'}
          </button>
          <button className="btn" onClick={onExportHtml} disabled={!slides?.length}>⇩ HTML</button>
        </div>
        <div className="hint" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
          PDF is rendered headless via Chromium at deck-native resolution (13.33" × 7.5", 16:9).
        </div>
      </div>

      <div className="section">
        <h3 style={{ margin: 0, padding: 0 }}>Theme presets</h3>
        <div className="preset-grid" style={{ marginTop: 10 }}>
          {Object.entries(presets).map(([key, p]) => (
            <button key={key} className={'preset ' + (theme.name === p.name ? 'active' : '')}
              onClick={() => applyPreset(key)}>
              <div className="swatches">
                <div className="sw" style={{ background: p.primary }}></div>
                <div className="sw" style={{ background: p.secondary }}></div>
                <div className="sw" style={{ background: p.accent }}></div>
                <div className="sw" style={{ background: p.background, border: '1px solid var(--border)' }}></div>
              </div>
              <div className="name">{p.name}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <h3 style={{ margin: 0, padding: 0 }}>Brand & logo</h3>
        <label className="field">Logo (auto-extracts a palette)</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => logoRef.current?.click()}>
            {theme.logo ? '↺ Change logo' : '＋ Upload logo'}
          </button>
          <button className="btn subtle" onClick={() => pdfRef.current?.click()} title="Match the look of an existing deck">
            📑 Learn from a PDF
          </button>
          {theme.logo && (
            <>
              <img src={theme.logo} alt="logo" style={{ height: 28, maxWidth: 80, objectFit: 'contain' }} />
              <button className="btn ghost tiny" onClick={() => update({ logo: null })}>remove logo</button>
            </>
          )}
        </div>
        <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && handleLogo(e.target.files[0])} />
        <input ref={pdfRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && handlePdfStyle(e.target.files[0])} />

        <label className="field">Footer text</label>
        <input className="text" placeholder="Confidential — Internal use only"
          value={theme.footer || ''} onChange={(e) => update({ footer: e.target.value })} />
      </div>

      <div className="section">
        <h3 style={{ margin: 0, padding: 0 }}>Colors</h3>
        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          {COLOR_FIELDS.map(([k, label]) => (
            <div key={k} className="color-pick">
              <input type="color" value={theme[k] || '#000000'} onChange={(e) => update({ [k]: e.target.value.toUpperCase() } as ThemePatch)} />
              <label>{label}</label>
              <input type="text" value={theme[k] || ''} onChange={(e) => update({ [k]: e.target.value } as ThemePatch)} />
            </div>
          ))}
        </div>
        <label className="toggle" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={!!theme.dark} onChange={(e) => update({ dark: e.target.checked })} />
          <span className="track"></span>
          <span>Dark deck</span>
        </label>
      </div>

      <div className="section">
        <h3 style={{ margin: 0, padding: 0 }}>Template</h3>
        <select className="text" style={{ marginTop: 8 }} value={theme.template || 'consulting'} onChange={(e) => update({ template: e.target.value as Theme['template'] })}>
          <option value="consulting">Consulting — accent bar, McKinsey-style</option>
          <option value="executive">Executive — generous white space</option>
          <option value="dark-board">Dark board — high-contrast night mode</option>
        </select>
      </div>
    </div>
  )
}
