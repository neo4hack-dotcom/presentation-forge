import type { Deck, SlideLayout } from '../types'

const LAYOUTS: SlideLayout[] = ['title', 'index', 'section', 'bullets', 'two-column', 'kpi', 'big-number', 'quote', 'table', 'timeline', 'swot', 'matrix', 'process', 'pyramid', 'comparison', 'icon-grid', 'chart', 'closing']

interface Props {
  outline: Deck
  setOutline: React.Dispatch<React.SetStateAction<Deck | null>>
  onExpand: () => void
  onCancel: () => void
  expanding: boolean
}

export default function OutlineEditor({ outline, setOutline, onExpand, onCancel, expanding }: Props) {
  if (!outline) return null

  const updateSlide = (i: number, patch: Partial<typeof outline.slides[number]>) => {
    setOutline((o) => o ? { ...o, slides: o.slides.map((s, idx) => idx === i ? { ...s, ...patch } : s) } : o)
  }
  const move = (i: number, dir: number) => {
    setOutline((o) => {
      if (!o) return o
      const arr = [...o.slides]
      const j = i + dir
      if (j < 0 || j >= arr.length) return o
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return { ...o, slides: arr }
    })
  }
  const remove = (i: number) => setOutline((o) => o ? { ...o, slides: o.slides.filter((_, idx) => idx !== i) } : o)
  const add = (i: number) => setOutline((o) => {
    if (!o) return o
    const next = { id: 'ns_' + Math.random().toString(36).slice(2, 8), layout: 'bullets' as SlideLayout, title: 'New slide' }
    return { ...o, slides: [...o.slides.slice(0, i + 1), next, ...o.slides.slice(i + 1)] }
  })

  return (
    <div className="section" style={{ paddingTop: 12 }}>
      <h3 style={{ margin: 0, padding: 0 }}>
        Review the outline
        <span style={{ fontSize: 10, marginLeft: 8, color: 'var(--muted)', textTransform: 'none', letterSpacing: 0 }}>
          edit titles, layouts, order — then expand
        </span>
      </h3>
      <div style={{ fontSize: 13, marginTop: 8, color: 'var(--text-2)' }}>
        <b style={{ color: 'var(--text)' }}>{outline.title}</b>
        {outline.subtitle && <div style={{ fontSize: 12, marginTop: 2 }}>{outline.subtitle}</div>}
      </div>
      <div className="outline-list" style={{ marginTop: 10 }}>
        {outline.slides.map((s, i) => (
          <div key={s.id || i} className="outline-item">
            <span style={{ width: 22, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', fontSize: 11, textAlign: 'center' }}>{i + 1}</span>
            <select className="text" value={s.layout || 'bullets'} onChange={(e) => updateSlide(i, { layout: e.target.value as SlideLayout })}>
              {LAYOUTS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <input className="text" style={{ flex: 1 }}
              value={s.title || ''} onChange={(e) => updateSlide(i, { title: e.target.value })} />
            <button className="btn tiny" title="Up" onClick={() => move(i, -1)}>↑</button>
            <button className="btn tiny" title="Down" onClick={() => move(i, 1)}>↓</button>
            <button className="btn tiny" title="Add after" onClick={() => add(i)}>＋</button>
            <button className="btn tiny danger" title="Remove" onClick={() => remove(i)}>✕</button>
          </div>
        ))}
      </div>
      <div className="btn-group" style={{ marginTop: 12 }}>
        <button className="btn primary" disabled={expanding} onClick={onExpand}>
          {expanding ? <><span className="spinner"></span> Expanding…</> : '✨ Expand to full slides'}
        </button>
        <button className="btn subtle" onClick={onCancel} disabled={expanding}>Cancel</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
        Each slide is generated in parallel and streams in as it's ready.
      </div>
    </div>
  )
}
