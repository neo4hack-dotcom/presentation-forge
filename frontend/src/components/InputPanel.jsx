import React, { useRef, useState } from 'react'
import * as api from '../api.js'

export default function InputPanel({
  prompt, setPrompt,
  context, setContext,
  audience, setAudience,
  tone, setTone,
  targetSlides, setTargetSlides,
  docs, setDocs,
  onGenerate, generating, onAbort,
  models, model, setModel,
  outlineModel, setOutlineModel,
  reviewOutline, setReviewOutline,
}) {
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  const handleFiles = async (files) => {
    for (const file of files) {
      try {
        const parsed = await api.parseFile(file)
        setDocs((prev) => [...prev, { id: crypto.randomUUID(), name: parsed.name, chars: parsed.chars, text: parsed.text }])
      } catch (e) {
        setDocs((prev) => [...prev, { id: crypto.randomUUID(), name: file.name, chars: 0, text: '', error: String(e) }])
      }
    }
  }

  return (
    <div className="pane left">
      <div className="section">
        <h3 style={{ margin: 0, padding: 0 }}>Brief</h3>
        <label className="field">What do you want to present?</label>
        <textarea
          className="text"
          rows={6}
          placeholder="Ex: Board update on Q1 — emphasize the slowdown in EMEA, the recovery plan, and our 3 asks for the board…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="field">Audience</label>
            <input className="text" placeholder="Board / ExCo / Leadership team"
              value={audience} onChange={(e) => setAudience(e.target.value)} />
          </div>
          <div>
            <label className="field">Tone</label>
            <select className="text" value={tone} onChange={(e) => setTone(e.target.value)}>
              <option>Senior PM / board-level</option>
              <option>McKinsey-style consulting</option>
              <option>Founder pitch</option>
              <option>Internal team update</option>
              <option>Investor update</option>
              <option>Technical deep-dive</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="field">Slides</label>
            <input className="text" type="number" min={4} max={30}
              value={targetSlides} onChange={(e) => setTargetSlides(parseInt(e.target.value) || 12)} />
          </div>
          <div>
            <label className="field">Slide model</label>
            <select className="text" value={model} onChange={(e) => setModel(e.target.value)}>
              {models.length === 0 && <option value="">(no local model detected)</option>}
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <label className="field">Outline model (faster · for the first pass)</label>
        <select className="text" value={outlineModel || ''} onChange={(e) => setOutlineModel(e.target.value)}>
          <option value="">(use slide model)</option>
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        <label className="toggle" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={!!reviewOutline} onChange={(e) => setReviewOutline(e.target.checked)} />
          <span className="track"></span>
          <span>Review outline before expanding to slides</span>
        </label>
      </div>

      <div className="section">
        <h3 style={{ margin: 0, padding: 0 }}>Reference documents</h3>
        <div
          className={'drop ' + (dragOver ? 'over' : '')}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)) }}
          onClick={() => fileRef.current?.click()}
        >
          <div style={{ fontSize: 22, marginBottom: 4, opacity: .6 }}>↑</div>
          <div><b>Drop files</b> or click to browse</div>
          <div style={{ marginTop: 4, fontSize: 11 }}>PDF · DOCX · MD · TXT — used as context</div>
          <input ref={fileRef} type="file" multiple
            accept=".pdf,.docx,.md,.markdown,.txt"
            onChange={(e) => handleFiles(Array.from(e.target.files || []))} />
        </div>
        {docs.length > 0 && (
          <div className="file-list">
            {docs.map((d) => (
              <div key={d.id} className="file-row">
                <span title={d.error || ''}>{d.error ? '⚠ ' : '📄 '}{d.name}</span>
                <span className="meta">
                  {d.chars.toLocaleString()} chars
                  <button className="btn tiny ghost" style={{ marginLeft: 8 }}
                    onClick={() => setDocs((p) => p.filter((x) => x.id !== d.id))}>×</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3 style={{ margin: 0, padding: 0 }}>Extra context (paste)</h3>
        <label className="field">Paste numbers, quotes, emails, transcripts…</label>
        <textarea
          className="text"
          rows={5}
          placeholder={`Q1 revenue: €12.4M (+18% YoY)\nChurn EMEA: 4.1% (vs 2.8% target)\nLast board ask: …`}
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </div>

      <div className="section" style={{ marginTop: 'auto' }}>
        {!generating ? (
          <button className="btn primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            onClick={onGenerate} disabled={!prompt && docs.length === 0 && !context}>
            ✨  Generate presentation
          </button>
        ) : (
          <button className="btn danger" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            onClick={onAbort}>
            <span className="spinner"></span> Generating… click to stop
          </button>
        )}
      </div>
    </div>
  )
}
