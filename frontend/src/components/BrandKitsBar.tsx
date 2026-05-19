import { useEffect, useState } from 'react'
import * as api from '../api'
import type { Theme, BrandKitSummary, Toast } from '../types'

interface Props {
  theme: Theme
  setTheme: React.Dispatch<React.SetStateAction<Theme>>
  addToast?: (t: Toast) => void
}

export default function BrandKitsBar({ theme, setTheme, addToast }: Props) {
  const [brands, setBrands] = useState<BrandKitSummary[]>([])
  const [showSave, setShowSave] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const refresh = async () => {
    try { setBrands((await api.listBrands()).brands || []) } catch {}
  }
  useEffect(() => { refresh() }, [])

  const save = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const saved = await api.saveBrand(name.trim(), theme, activeId || undefined)
      setShowSave(false); setName(''); setActiveId(saved.id)
      addToast?.({ type: 'success', message: 'Brand kit saved.' })
      await refresh()
    } catch (e) { addToast?.({ type: 'error', message: String(e) }) }
    finally { setBusy(false) }
  }

  const load = async (b: BrandKitSummary) => {
    try {
      const full = await api.getBrand(b.id)
      setTheme((t) => ({ ...t, ...full }))
      setActiveId(b.id)
      addToast?.({ type: 'success', message: `Loaded brand: ${b.name}` })
    } catch (e) { addToast?.({ type: 'error', message: String(e) }) }
  }

  const del = async (b: BrandKitSummary) => {
    if (!confirm('Delete brand "' + b.name + '"?')) return
    await api.deleteBrand(b.id)
    if (activeId === b.id) setActiveId(null)
    await refresh()
  }

  return (
    <div className="section">
      <h3 style={{ margin: 0, padding: 0 }}>Brand kits</h3>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
        Save the current theme (colors, logo, fonts, cover style) for reuse across decks.
      </div>

      <div className="btn-group" style={{ marginTop: 10 }}>
        <button className="btn primary tiny" onClick={() => { setName(theme.name && theme.name !== 'Aurora' ? theme.name : ''); setShowSave(true) }}>
          💾 Save current as kit
        </button>
        {activeId && <button className="btn subtle tiny" onClick={() => setActiveId(null)}>Detach</button>}
      </div>

      {showSave && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input className="text" placeholder="Brand kit name (e.g. Acme Corp 2026)"
            value={name} onChange={(e) => setName(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setShowSave(false) }} />
          <button className="btn primary tiny" onClick={save} disabled={!name.trim() || busy}>
            {busy ? <span className="spinner"></span> : 'Save'}
          </button>
          <button className="btn subtle tiny" onClick={() => setShowSave(false)}>×</button>
        </div>
      )}

      {brands.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {brands.map((b) => (
            <div key={b.id} className={'preset ' + (activeId === b.id ? 'active' : '')}
              style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: 8, cursor: 'default' }}>
              <div onClick={() => load(b)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="swatches" style={{ marginBottom: 0 }}>
                  <div className="sw" style={{ background: b.primary }}></div>
                  <div className="sw" style={{ background: b.secondary }}></div>
                  <div className="sw" style={{ background: b.accent }}></div>
                  {b.logo && <img src={b.logo} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />}
                </div>
                <div className="name" style={{ flex: 1 }}>{b.name}</div>
              </div>
              <div className="btn-group">
                <button className="btn ghost tiny" onClick={(e) => { e.stopPropagation(); load(b) }}>Load</button>
                <button className="btn ghost tiny danger" onClick={(e) => { e.stopPropagation(); del(b) }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {brands.length === 0 && !showSave && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, fontStyle: 'italic' }}>
          No brand kits yet. Set up your theme then click "Save current as kit".
        </div>
      )}
    </div>
  )
}
