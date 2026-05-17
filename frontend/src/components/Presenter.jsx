import React, { useEffect, useRef, useState } from 'react'

/** Fullscreen presenter mode: arrow keys navigate, Esc exits, N toggles notes. */
export default function Presenter({ html, slides, onClose }) {
  const [idx, setIdx] = useState(0)
  const [showNotes, setShowNotes] = useState(false)
  const iframeRef = useRef(null)

  const slide = slides?.[idx]

  useEffect(() => {
    const f = iframeRef.current
    if (!f) return
    const doc = f.contentDocument
    doc.open(); doc.write(html); doc.close()
    if (showNotes) doc.body.classList.add('show-notes')
  }, [html, showNotes])

  useEffect(() => {
    if (!slide || !iframeRef.current) return
    const el = iframeRef.current.contentDocument?.getElementById(slide.id)
    el?.scrollIntoView({ block: 'start' })
  }, [idx, slide, html])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') setIdx((i) => Math.min(i + 1, (slides?.length || 1) - 1))
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setIdx((i) => Math.max(i - 1, 0))
      if (e.key === 'Home') setIdx(0)
      if (e.key === 'End') setIdx((slides?.length || 1) - 1)
      if (e.key.toLowerCase() === 'n') setShowNotes((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slides, onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, display: 'flex', gap: 8 }}>
        <span style={{ color: '#888', fontSize: 12, alignSelf: 'center', marginRight: 8 }}>
          {idx + 1} / {slides?.length || 0} · <span className="kbd">←</span> <span className="kbd">→</span> <span className="kbd">N</span> notes · <span className="kbd">Esc</span> exit
        </span>
        <button className="btn subtle tiny" onClick={() => setShowNotes((v) => !v)}>{showNotes ? 'Hide notes' : 'Show notes'}</button>
        <button className="btn danger tiny" onClick={onClose}>Exit</button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{
          width: '95vw', maxWidth: 1600,
          aspectRatio: '16 / 9',
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,.5)',
          background: 'white',
        }}>
          <iframe
            ref={iframeRef}
            title="presenter"
            sandbox="allow-same-origin allow-scripts"
            style={{
              width: 1600, height: 900,
              border: 'none',
              transform: `scale(min(${typeof window !== 'undefined' ? (window.innerWidth * 0.95 / 1600) : 1}, ${typeof window !== 'undefined' ? (window.innerHeight * 0.85 / 900) : 1}))`,
              transformOrigin: 'top left',
            }}
          />
        </div>
      </div>
      {showNotes && slide?.notes && (
        <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, background: 'rgba(20,20,28,.95)', color: '#E5E7EB', padding: '12px 18px', borderRadius: 8, fontSize: 14, lineHeight: 1.5, maxHeight: '22vh', overflow: 'auto', border: '1px solid #2A2E3C' }}>
          <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Speaker notes — {slide.title}</div>
          {slide.notes}
        </div>
      )}
    </div>
  )
}
