import { useEffect, useRef, useState, type WheelEvent } from 'react'
import type { Slide } from '../types'

interface Props {
  html: string
  currentSlideId: string | null
  slides: Slide[]
  notesMode: boolean
  onSelectSlide?: (id: string) => void
}

export default function Preview({ html, currentSlideId, slides, notesMode }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [zoom, setZoom] = useState(0.5)

  useEffect(() => {
    const f = iframeRef.current
    if (!f || !html) return
    const doc = f.contentDocument
    if (!doc) return
    doc.open(); doc.write(html); doc.close()
    if (notesMode) doc.body.classList.add('show-notes')
  }, [html, notesMode])

  useEffect(() => {
    const f = iframeRef.current
    if (!f || !currentSlideId) return
    const doc = f.contentDocument
    if (!doc) return
    const el = doc.getElementById(currentSlideId)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [currentSlideId, html])

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      setZoom((z) => Math.max(0.15, Math.min(1.2, z + (e.deltaY < 0 ? 0.05 : -0.05))))
    }
  }

  if (!html) {
    return (
      <div className="empty-state">
        <div className="big">📑</div>
        <h2>Ready when you are</h2>
        <p>Add a brief, drop in reference documents, then hit <b>Generate presentation</b>.
           The deck appears here as the local LLM streams slides back.</p>
      </div>
    )
  }

  return (
    <div className="preview-wrap">
      <div className="preview-toolbar">
        <div className="center-info">
          <b>{slides?.length || 0}</b> slides · zoom <b>{Math.round(zoom * 100)}%</b>
          {currentSlideId && <span> · viewing <b>{currentSlideId}</b></span>}
        </div>
        <div className="zoom-group">
          <button className="btn subtle tiny" onClick={() => setZoom(0.3)}>30%</button>
          <button className="btn subtle tiny" onClick={() => setZoom(0.5)}>50%</button>
          <button className="btn subtle tiny" onClick={() => setZoom(0.75)}>75%</button>
          <button className="btn subtle tiny" onClick={() => setZoom(1)}>100%</button>
          <button className="btn subtle tiny" onClick={() => setZoom((z) => Math.max(0.15, z - 0.05))}>−</button>
          <button className="btn subtle tiny" onClick={() => setZoom((z) => Math.min(1.2, z + 0.05))}>＋</button>
        </div>
      </div>
      <div className="preview-canvas" onWheel={onWheel}>
        <div style={{ width: 1600 * zoom + 48, margin: '0 auto' }}>
          <iframe
            ref={iframeRef}
            title="deck preview"
            style={{
              width: 1600,
              height: (900 * (slides?.length || 1)) + (48 * (slides?.length || 1)) + 100,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              border: 'none',
            }}
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      </div>
    </div>
  )
}
