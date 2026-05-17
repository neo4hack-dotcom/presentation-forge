import React from 'react'

const LAYOUTS = ['title','section','bullets','two-column','kpi','quote','table','timeline','swot','chart','closing']

export default function OutlineEditor({ outline, setOutline, onExpand, onCancel, expanding }) {
  if (!outline) return null

  const updateSlide = (i, patch) => {
    setOutline((o) => ({ ...o, slides: o.slides.map((s, idx) => idx === i ? { ...s, ...patch } : s) }))
  }
  const move = (i, dir) => {
    setOutline((o) => {
      const arr = [...o.slides]
      const j = i + dir
      if (j < 0 || j >= arr.length) return o
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return { ...o, slides: arr }
    })
  }
  const remove = (i) => setOutline((o) => ({ ...o, slides: o.slides.filter((_, idx) => idx !== i) }))
  const add = (i) => setOutline((o) => {
    const next = { id: 'ns_' + Math.random().toString(36).slice(2, 8), layout: 'bullets', title: 'New slide', intent: '' }
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
            <select className="text" value={s.layout || 'bullets'} onChange={(e) => updateSlide(i, { layout: e.target.value })}>
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
