import type { Theme, ThemePatch, CoverStyle, DividerStyle, LogoGridPosition, LogoRowPosition } from '../types'

const COVERS: { id: CoverStyle; label: string; hint: string }[] = [
  { id: 'minimal',   label: 'Minimal',   hint: 'Refined typography, accent bar' },
  { id: 'bold',      label: 'Bold',      hint: 'Full-bleed brand gradient' },
  { id: 'mesh',      label: 'Mesh',      hint: 'Ambient mesh gradient backdrop' },
  { id: 'split',     label: 'Split',     hint: 'Diagonal brand band' },
  { id: 'editorial', label: 'Editorial', hint: 'Serif title, magazine feel' },
  { id: 'geometric', label: 'Geometric', hint: 'Abstract brand-color shapes' },
]

const DIVIDERS: { id: DividerStyle; label: string; hint: string }[] = [
  { id: 'gradient', label: 'Gradient', hint: 'Full-bleed brand gradient (default)' },
  { id: 'minimal',  label: 'Minimal',  hint: 'Quiet, accent bar' },
  { id: 'numbered', label: 'Numbered', hint: 'Huge chapter number on the side' },
]

const COVER_GRID: LogoGridPosition[][] = [
  ['top-left', 'top-center', 'top-right'],
  ['middle-left', 'middle-center', 'middle-right'],
  ['bottom-left', 'bottom-center', 'bottom-right'],
]

interface Props {
  theme: Theme
  setTheme: React.Dispatch<React.SetStateAction<Theme>>
}

// Tiny visual swatch hinting at the cover style
function CoverPreview({ id, theme }: { id: CoverStyle; theme: Theme }) {
  const primary = theme.primary || '#2563EB'
  const secondary = theme.secondary || '#0EA5E9'
  const bg = theme.background || '#FFFFFF'
  if (id === 'bold') return <div style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})`, width: 60, height: 34, borderRadius: 4 }} />
  if (id === 'mesh') return <div style={{ width: 60, height: 34, borderRadius: 4, background: `radial-gradient(at 20% 30%, ${primary}aa, transparent 50%), radial-gradient(at 80% 70%, ${secondary}aa, transparent 50%), ${bg}` }} />
  if (id === 'split') return <div style={{ position: 'relative', width: 60, height: 34, borderRadius: 4, background: bg, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', inset: 0, background: primary, clipPath: 'polygon(0 0, 38% 0, 28% 100%, 0 100%)' }} />
  </div>
  if (id === 'editorial') return <div style={{ width: 60, height: 34, borderRadius: 4, background: bg, fontFamily: 'Georgia, serif', color: theme.text || '#0F172A', fontSize: 13, fontWeight: 700, fontStyle: 'italic', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Aa</div>
  if (id === 'geometric') return <div style={{ position: 'relative', width: 60, height: 34, borderRadius: 4, background: bg, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', right: -14, top: -10, width: 32, height: 32, borderRadius: '50%', background: primary, opacity: .55 }} />
    <div style={{ position: 'absolute', left: -8, bottom: -8, width: 20, height: 20, borderRadius: '50%', background: theme.accent || '#F59E0B', opacity: .45 }} />
  </div>
  return <div style={{ width: 60, height: 34, borderRadius: 4, background: bg, position: 'relative', border: '1px solid var(--border)' }}>
    <div style={{ position: 'absolute', left: 6, top: 14, width: 18, height: 3, background: primary, borderRadius: 2 }} />
  </div>
}

// Visual 3x3 grid picker — each cell shows where the logo would sit
function GridPositionPicker({ value, onChange, accent }: { value: LogoGridPosition; onChange: (v: LogoGridPosition) => void; accent: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, padding: 4, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, width: 90 }}>
      {COVER_GRID.flat().map((pos) => (
        <button key={pos} onClick={() => onChange(pos)} title={pos}
          style={{
            aspectRatio: '1',
            width: '100%',
            border: 'none', padding: 0, cursor: 'pointer',
            background: value === pos ? accent : 'var(--panel-2)',
            borderRadius: 3,
          }} />
      ))}
    </div>
  )
}

function RowPositionPicker({ value, onChange, accent }: { value: LogoRowPosition; onChange: (v: LogoRowPosition) => void; accent: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, padding: 4, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, width: 90 }}>
      {(['left', 'center', 'right'] as LogoRowPosition[]).map((pos) => (
        <button key={pos} onClick={() => onChange(pos)} title={pos}
          style={{
            height: 16,
            border: 'none', padding: 0, cursor: 'pointer',
            background: value === pos ? accent : 'var(--panel-2)',
            borderRadius: 3,
          }} />
      ))}
    </div>
  )
}

export default function VisualIdentityPicker({ theme, setTheme }: Props) {
  const set = (patch: ThemePatch) => setTheme((t) => ({ ...t, ...patch }))
  const accent = theme.primary || '#7C5CFF'

  // Sensible defaults so the visual rendering matches current state
  const coverPos = theme.logo_position_cover || 'top-right'
  const coverSize = theme.logo_size_cover || 64
  const headerPos = theme.logo_position_header || 'right'
  const headerSize = theme.logo_size_header || 28
  const footerPos = theme.logo_position_footer || 'right'
  const footerSize = theme.logo_size_footer || 20

  const showCover = theme.show_logo_on_cover ?? true
  const showHeader = theme.show_logo_on_header ?? true
  const showFooter = theme.show_logo_on_footer ?? false

  return (
    <div className="section">
      <h3 style={{ margin: 0, padding: 0 }}>Visual identity</h3>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
        Cover style · section dividers · logo placement. Applied across the whole deck.
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

      {/* ---- Logo placement ---- */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, padding: 0 }}>Logo placement</h3>
          {!theme.logo && <span style={{ fontSize: 10, color: 'var(--muted)', fontStyle: 'italic' }}>Upload a logo first ↑</span>}
        </div>

        {/* COVER */}
        <div style={{ marginTop: 10, padding: 10, background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', opacity: theme.logo ? 1 : .5 }}>
          <label className="toggle" style={{ marginBottom: 6 }}>
            <input type="checkbox" checked={showCover}
              onChange={(e) => set({ show_logo_on_cover: e.target.checked })} disabled={!theme.logo} />
            <span className="track"></span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>On cover page</span>
          </label>
          {showCover && (
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 12, alignItems: 'flex-start', marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Position</div>
                <GridPositionPicker value={coverPos} onChange={(v) => set({ logo_position_cover: v })} accent={accent} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Size · {coverSize}px</div>
                <input type="range" min={32} max={200} step={4} value={coverSize}
                  onChange={(e) => set({ logo_size_cover: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: accent }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--muted)' }}>
                  <span>S</span><span>M</span><span>L</span><span>XL</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* HEADER */}
        <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', opacity: theme.logo ? 1 : .5 }}>
          <label className="toggle" style={{ marginBottom: 6 }}>
            <input type="checkbox" checked={showHeader}
              onChange={(e) => set({ show_logo_on_header: e.target.checked })} disabled={!theme.logo} />
            <span className="track"></span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>In header (each slide)</span>
          </label>
          {showHeader && (
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 12, alignItems: 'flex-start', marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Position</div>
                <RowPositionPicker value={headerPos} onChange={(v) => set({ logo_position_header: v })} accent={accent} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Size · {headerSize}px</div>
                <input type="range" min={16} max={64} step={2} value={headerSize}
                  onChange={(e) => set({ logo_size_header: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: accent }} />
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', opacity: theme.logo ? 1 : .5 }}>
          <label className="toggle" style={{ marginBottom: 6 }}>
            <input type="checkbox" checked={showFooter}
              onChange={(e) => set({ show_logo_on_footer: e.target.checked })} disabled={!theme.logo} />
            <span className="track"></span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>In footer (each slide)</span>
          </label>
          {showFooter && (
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 12, alignItems: 'flex-start', marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Position</div>
                <RowPositionPicker value={footerPos} onChange={(v) => set({ logo_position_footer: v })} accent={accent} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Size · {footerSize}px</div>
                <input type="range" min={12} max={48} step={2} value={footerSize}
                  onChange={(e) => set({ logo_size_footer: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: accent }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
