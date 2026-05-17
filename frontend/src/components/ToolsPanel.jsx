import React, { useState } from 'react'
import * as api from '../api.js'

const LANGS = ['French', 'English', 'German', 'Spanish', 'Italian', 'Portuguese', 'Dutch', 'Japanese', 'Chinese (Simplified)', 'Arabic']

export default function ToolsPanel({ deck, setDeck, fullContext, model, sourcesText, addToast, onPresentMode }) {
  const [review, setReview] = useState(null)
  const [busy, setBusy] = useState(null)
  const [lang, setLang] = useState('French')
  const [fact, setFact] = useState(null)

  const runCritic = async () => {
    if (!deck) return
    setBusy('critic'); setReview(null)
    try {
      const r = await api.criticPass(deck, fullContext, model)
      setReview(r.review)
    } catch (e) { addToast({ type: 'error', message: String(e) }) }
    finally { setBusy(null) }
  }

  const runTranslate = async () => {
    if (!deck) return
    setBusy('translate')
    try {
      const r = await api.translateDeck(deck, lang, model)
      setDeck(r.deck)
      addToast({ type: 'success', message: 'Translated to ' + lang })
    } catch (e) { addToast({ type: 'error', message: String(e) }) }
    finally { setBusy(null) }
  }

  const runFactCheck = async () => {
    if (!deck) return
    setBusy('fact')
    try {
      const r = await api.factcheck(deck, sourcesText)
      setFact(r)
      if (r.flagged.length === 0) addToast({ type: 'success', message: `Fact-check passed: ${r.supported}/${r.checked} numbers grounded.` })
      else addToast({ type: 'error', message: `${r.flagged.length} unsupported numbers — review below.` })
    } catch (e) { addToast({ type: 'error', message: String(e) }) }
    finally { setBusy(null) }
  }

  return (
    <div className="section">
      <h3 style={{ margin: 0, padding: 0 }}>AI tools</h3>

      <div className="btn-group" style={{ marginTop: 10 }}>
        <button className="btn" onClick={runCritic} disabled={!deck || busy}>
          {busy === 'critic' ? <><span className="spinner"></span> Reviewing…</> : '🧐 AI critic'}
        </button>
        <button className="btn" onClick={runFactCheck} disabled={!deck || busy}>
          {busy === 'fact' ? <><span className="spinner"></span> Checking…</> : '🔎 Fact-check'}
        </button>
        <button className="btn" onClick={onPresentMode} disabled={!deck}>▶ Present</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
        <select className="text" style={{ flex: 1 }} value={lang} onChange={(e) => setLang(e.target.value)}>
          {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button className="btn" onClick={runTranslate} disabled={!deck || busy}>
          {busy === 'translate' ? <><span className="spinner"></span></> : '🌍 Translate'}
        </button>
      </div>

      {review && (
        <div style={{ marginTop: 12, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b>Board-readiness score: {review.overall_score}/10</b>
            <button className="btn ghost tiny" onClick={() => setReview(null)}>×</button>
          </div>
          <div style={{ color: 'var(--text-2)', marginTop: 4 }}>{review.summary}</div>
          {(review.issues || []).length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Issues</div>
              {review.issues.map((it, i) => (
                <div key={i} style={{ marginBottom: 6, paddingLeft: 8, borderLeft: `2px solid ${it.severity === 'high' ? '#EF4444' : it.severity === 'medium' ? '#F59E0B' : '#64748B'}` }}>
                  <div style={{ fontSize: 11 }}>
                    <span className="pill" style={{ marginRight: 4 }}>{it.slide_id || 'deck'}</span>
                    <b>{it.category}</b> — {it.issue}
                  </div>
                  {it.suggestion && <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>→ {it.suggestion}</div>}
                </div>
              ))}
            </div>
          )}
          {(review.missing_slides || []).length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Suggested additions</div>
              {review.missing_slides.map((m, i) => (
                <div key={i} style={{ fontSize: 11, marginBottom: 4 }}>
                  + <b>{m.title}</b> ({m.layout}) — <span style={{ color: 'var(--text-2)' }}>{m.why}</span>
                </div>
              ))}
            </div>
          )}
          {(review.strengths || []).length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-2)' }}>
              <span style={{ color: '#6EE7B7' }}>✓</span> {review.strengths.join(' · ')}
            </div>
          )}
        </div>
      )}

      {fact && (
        <div style={{ marginTop: 12, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b>Fact-check: {fact.supported}/{fact.checked} numbers grounded</b>
            <button className="btn ghost tiny" onClick={() => setFact(null)}>×</button>
          </div>
          {fact.flagged.length === 0 ? (
            <div style={{ color: '#6EE7B7', marginTop: 4 }}>All numbers are present in your sources.</div>
          ) : (
            <div style={{ marginTop: 6 }}>
              {fact.flagged.map((f, i) => (
                <div key={i} style={{ fontSize: 11, marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid #EF4444' }}>
                  <span className="pill bad" style={{ marginRight: 4 }}>{f.slide_id}</span>
                  <b>{f.claim}</b> — not found in sources
                  <div style={{ color: 'var(--text-2)', marginTop: 2 }}>"{f.snippet}"</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
