import React from 'react'

const COVERS = [
  { id: 'minimal',   label: 'Minimal',   hint: 'Refined typography, accent bar' },
  { id: 'bold',      label: 'Bold',      hint: 'Full-bleed brand gradient' },
  { id: 'mesh',      label: 'Mesh',      hint: 'Ambient mesh gradient backdrop' },
  { id: 'split',     label: 'Split',     hint: 'Diagonal brand band' },
  { id: 'editorial', label: 'Editorial', hint: 'Serif title, magazine feel' },
  { id: 'geometric', label: 'Geometric', hint: 'Abstract brand-color shapes' },
]
const DIVIDERS = [
  { id: 'gradient', label: 'Gradient',  hint: 'Full-bleed brand gradient (default)' },
  { id: 'minimal',  label: 'Minimal',   hint: 'Quiet, accent bar' },
  { id: 'numbered', label: 'Numbered',  hint: 'Huge chapter number on the side' },
]

function CoverPreview({ id, theme }) {
  // Tiny 60x34 swatch hinting at the cover style
  const primary = theme.primary || '#2563EB'
  const secondary = theme.secondary || '#0EA5E9'
  const bg = theme.background || '#FFFFFF'
  if (id === 'bold') {
    return <div style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})`, width: 60, height: 34, borderRadius: 4 }} />
  }
  if (id === 'mesh') {
    return <div style={{ width: 60, height: 34, borderRadius: 4, background: `radial-gradient(at 20% 30%, ${primary}aa, transparent 50%), radial-gradient(at 80% 70%, ${secondary}aa, transparent 50%), ${bg}` }} />
  }
  if (id === 'split') {
    return <div style={{ position: 'relative', width: 60, height: 34, borderRadius: 4, background: bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: primary, clipPath: 'polygon(0 0, 38% 0, 28% 100%, 0 100%)' }} />
    </div>
  }
  if (id === 'editorial') {
    return <div style={{ width: 60, height: 34, borderRadius: 4, background: bg, fontFamily: 'Georgia, serif', color: theme.text || '#0F172A', fontSize: 13, fontWeight: 700, fontStyle: 'italic', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Aa</div>
  }
  if (id === 'geometric') {
    return <div style={{ position: 'relative', width: 60, height: 34, borderRadius: 4, background: bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -14, top: -10, width: 32, height: 32, borderRadius: '50%', background: primary, opacity: .55 }} />
      <div style={{ position: 'absolute', left: -8, bottom: -8, width: 20, height: 20, borderRadius: '50%', background: theme.accent || '#F59E0B', opacity: .45 }} />
    </div>
  }
  // minimal
  return <div style={{ width: 60, height: 34, borderRadius: 4, background: bg, position: 'relative', border: '1px solid var(--border)' }}>
    <div style={{ position: 'absolute', left: 6, top: 14, width: 18, height: 3, background: primary, borderRadius: 2 }} />
  </div>
}

export default function VisualIdentityPicker({ theme, setTheme }) {
  const set = (patch) => setTheme((t) => ({ ...t, ...patch }))
  return (
    <div className="section">
      <h3 style={{ margin: 0, padding: 0 }}>Visual identity</h3>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
        Set the look of your cover page, section dividers, and overall identity. Applies across the whole deck.
      </div>

      <label className="field">Cover style</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {COVERS.map((c) => (
          <button key={c.id}
            className={'preset ' + ((theme.cover_style || 'minimal') === c.id ? 'active' : '')}
            style={{ padding: 8, textAlign: 'left' }}
            title={c.hint}
            onClick={() => set({ cover_style: c.id })}>
            <CoverPreview id={c.id} theme={theme} />
            <div className="name" style={{ marginTop: 4 }}>{c.label}</div>
          </button>
        ))}
      </div>

      <label className="field">Section divider</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {DIVIDERS.map((d) => (
          <button key={d.id}
            className={'preset ' + ((theme.divider_style || 'gradient') === d.id ? 'active' : '')}
            style={{ padding: 8, textAlign: 'left' }}
            title={d.hint}
            onClick={() => set({ divider_style: d.id })}>
            <div className="name">{d.label}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{d.hint}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
