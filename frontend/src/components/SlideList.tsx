import { useState, Fragment } from 'react'
import type { Slide, SlideLayout } from '../types'

const LAYOUTS: SlideLayout[] = ['title', 'index', 'section', 'bullets', 'two-column', 'kpi', 'big-number', 'quote', 'table', 'timeline', 'swot', 'matrix', 'process', 'pyramid', 'comparison', 'icon-grid', 'chart', 'closing']

const QUICK = [
  { id: 'shorter', label: '✂ Shorter', tip: 'Cut filler' },
  { id: 'denser', label: '📊 Denser', tip: 'More numbers, names, dates' },
  { id: 'more-visual', label: '🎨 More visual', tip: 'Auto-pick a visual layout' },
  { id: 'add-chart', label: '📈 Add chart', tip: 'Add or improve a chart' },
  { id: 'add-citation', label: '🔗 Cite source', tip: 'Ground numbers in your docs' },
  { id: 'more-board', label: '👔 Board-ify', tip: 'Sharper for executives' },
]

interface Props {
  slides: Slide[]
  currentId: string | null
  onSelect: (id: string) => void
  onMove: (i: number, dir: number) => void
  onDelete: (i: number) => void
  onRefine: (slideId: string, instruction: string) => Promise<void>
  onQuickRefine: (slideId: string, preset: string) => Promise<void>
  onChangeLayout: (slideId: string, layout: SlideLayout) => Promise<void>
  onUndo: (slideId: string) => void
  refining: boolean
}

export default function SlideList({ slides, currentId, onSelect, onMove, onDelete, onRefine, onQuickRefine, onChangeLayout, onUndo, refining }: Props) {
  const [refineId, setRefineId] = useState<string | null>(null)
  const [refineText, setRefineText] = useState('')

  return (
    <div className="slide-list">
      {(!slides || slides.length === 0) && (
        <div style={{ padding: 12, fontSize: 12, color: 'var(--muted)' }}>
          Slides will appear here as they're generated.
        </div>
      )}
      {slides && slides.map((s, i) => {
        const undoCount = s.__history?.length || 0
        const isActive = s.id === currentId
        return (
          <Fragment key={s.id || i}>
            <div className={'slide-card ' + (isActive ? 'active' : '') + (s.__pending ? ' generating' : '')}
              onClick={() => onSelect(s.id)}>
              <div className="num">{i + 1}</div>
              <div className="info">
                <div className="title">{s.title || (s.__pending ? 'Generating…' : '(untitled)')}</div>
                <div className="layout" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <select className="text"
                    style={{ padding: '2px 4px', fontSize: 10, width: 'auto', background: 'transparent', border: 'none', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}
                    value={s.layout || 'bullets'}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onChangeLayout(s.id, e.target.value as SlideLayout)}
                    disabled={s.__pending || refining}>
                    {LAYOUTS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                  {undoCount > 0 && <span className="pill" style={{ fontSize: 9, padding: '0 5px' }}>{undoCount} ↶</span>}
                  {s.__pending && <span className="spinner" style={{ display: 'inline-block', verticalAlign: 'middle' }}></span>}
                </div>
              </div>
              <div className="slide-actions">
                {undoCount > 0 && (
                  <button className="btn tiny" title={`Undo last edit (${undoCount} kept)`}
                    onClick={(e) => { e.stopPropagation(); onUndo(s.id) }}>↶</button>
                )}
                <button className="btn tiny" title="Move up" onClick={(e) => { e.stopPropagation(); onMove(i, -1) }}>↑</button>
                <button className="btn tiny" title="Move down" onClick={(e) => { e.stopPropagation(); onMove(i, 1) }}>↓</button>
                <button className="btn tiny" title="Refine" onClick={(e) => { e.stopPropagation(); setRefineId(refineId === s.id ? null : s.id); setRefineText('') }}>✎</button>
                <button className="btn tiny danger" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(i) }}>✕</button>
              </div>
            </div>
            {refineId === s.id && (
              <div className="refine-box">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {QUICK.map((q) => (
                    <button key={q.id} className="btn tiny subtle" title={q.tip}
                      disabled={refining}
                      onClick={() => onQuickRefine(s.id, q.id)}>{q.label}</button>
                  ))}
                </div>
                <textarea autoFocus value={refineText} onChange={(e) => setRefineText(e.target.value)}
                  onKeyDown={async (e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && refineText.trim()) {
                      await onRefine(s.id, refineText)
                      setRefineId(null); setRefineText('')
                    }
                  }}
                  placeholder="…or describe a custom edit (Cmd/Ctrl+Enter to apply)" />
                <div className="row">
                  <span className="hint">{refining ? 'Refining slide…' : ''}</span>
                  <div className="btn-group">
                    <button className="btn subtle tiny" onClick={() => setRefineId(null)}>Close</button>
                    <button className="btn primary tiny" disabled={!refineText.trim() || refining}
                      onClick={async () => { await onRefine(s.id, refineText); setRefineId(null); setRefineText('') }}>
                      {refining ? 'Working…' : 'Apply'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
