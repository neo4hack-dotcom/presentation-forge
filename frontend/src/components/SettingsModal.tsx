import { useEffect, useState } from 'react'
import * as api from '../api'
import type { LLMConfigPatch, ProviderId, Toast } from '../types'

const PROVIDERS = [
  { id: 'ollama' as const, label: 'Ollama', hint: 'Native Ollama API · /api/tags · /api/chat', defaultUrl: 'http://localhost:11434', needsKey: false },
  { id: 'openai' as const, label: 'OpenAI-compatible HTTP', hint: 'LM Studio · vLLM · llama.cpp server · LocalAI · any /v1/chat/completions endpoint', defaultUrl: 'http://localhost:1234', needsKey: true },
]

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: (saved: unknown) => void
  addToast?: (t: Toast) => void
}

interface UIState {
  provider: ProviderId
  base_url: string
  api_key: string
  default_model: string
  outline_model: string
  timeout: number
}

export default function SettingsModal({ open, onClose, onSaved, addToast }: Props) {
  const [cfg, setCfg] = useState<UIState>({
    provider: 'ollama', base_url: 'http://localhost:11434', api_key: '',
    default_model: '', outline_model: '', timeout: 600,
  })
  const [keyChanged, setKeyChanged] = useState(false)
  const [keyAlreadySet, setKeyAlreadySet] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [test, setTest] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    (async () => {
      try {
        const c = await api.getConfig()
        const fallback = PROVIDERS.find((x) => x.id === (c.provider || 'ollama'))?.defaultUrl || 'http://localhost:11434'
        setCfg((p) => ({
          ...p,
          provider: c.provider || 'ollama',
          base_url: c.base_url || fallback,
          default_model: c.default_model || '',
          outline_model: c.outline_model || '',
          timeout: c.timeout || 600,
          api_key: '',
        }))
        setKeyChanged(false)
        setKeyAlreadySet(!!c.api_key_set)
        setTest({ status: 'idle', message: '' })
        try { await refreshModels() } catch {}
      } catch (e) {
        addToast?.({ type: 'error', message: 'Could not load current config: ' + (e as Error).message })
      }
    })()
  }, [open])

  const patchToSend = (): LLMConfigPatch => {
    const p: LLMConfigPatch = {
      provider: cfg.provider, base_url: cfg.base_url,
      default_model: cfg.default_model, outline_model: cfg.outline_model,
      timeout: cfg.timeout,
    }
    if (keyChanged) p.api_key = cfg.api_key
    return p
  }

  const refreshModels = async () => {
    setLoadingModels(true)
    try {
      const r = await api.modelsForConfig(patchToSend())
      const list = (r.models || []).map((m) => m.name).filter(Boolean)
      setModels(list)
      setCfg((p) => {
        if (list.length && (!p.default_model || !list.includes(p.default_model))) {
          return { ...p, default_model: list[0] }
        }
        return p
      })
    } catch {
      setModels([])
    } finally {
      setLoadingModels(false)
    }
  }

  const runTest = async () => {
    setTest({ status: 'testing', message: '' })
    try {
      const r = await api.testConfig(patchToSend())
      if (r.ok) {
        setTest({ status: 'success', message: `Connected — ${r.n_models || 0} model${(r.n_models || 0) === 1 ? '' : 's'}${r.sample ? ` · sample: "${r.sample}"` : ''}` })
      } else {
        setTest({ status: 'error', message: r.error || 'Unknown error' })
      }
    } catch (e) {
      setTest({ status: 'error', message: (e as Error).message })
    }
    setTimeout(() => setTest((t) => t.status !== 'testing' ? { ...t, status: 'idle' } : t), 6000)
  }

  const save = async () => {
    setSaving(true)
    try {
      const saved = await api.saveConfig(patchToSend())
      addToast?.({ type: 'success', message: 'Configuration saved.' })
      onSaved?.(saved)
      onClose()
    } catch (e) {
      addToast?.({ type: 'error', message: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const switchProvider = (id: ProviderId) => {
    const p = PROVIDERS.find((x) => x.id === id)
    setCfg((c) => ({ ...c, provider: id, base_url: p ? p.defaultUrl : c.base_url, default_model: '', api_key: '' }))
    setKeyChanged(false); setKeyAlreadySet(false); setModels([])
    setTest({ status: 'idle', message: '' })
  }

  if (!open) return null
  const provider = PROVIDERS.find((p) => p.id === cfg.provider) || PROVIDERS[0]

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>⚙️ LLM Configuration</h2>
          <button className="btn ghost tiny" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 18, lineHeight: 1.5 }}>
          Choose a local provider. Everything stays on your machine — the backend never calls anything you don't point it at.
        </div>

        <label className="field">Provider</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          {PROVIDERS.map((p) => (
            <button key={p.id}
              className={'preset ' + (cfg.provider === p.id ? 'active' : '')}
              style={{ textAlign: 'left', padding: 14 }}
              onClick={() => switchProvider(p.id)}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                {p.id === 'ollama' ? '🦙' : '🔌'}  {p.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>{p.hint}</div>
            </button>
          ))}
        </div>

        <label className="field">Base URL</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="text" style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 13 }}
            value={cfg.base_url} placeholder={provider.defaultUrl}
            onChange={(e) => setCfg((c) => ({ ...c, base_url: e.target.value.replace(/\/+$/, '') }))} />
          <button className="btn subtle" onClick={refreshModels} disabled={loadingModels}>
            {loadingModels ? <span className="spinner"></span> : '↻'} Models
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
          {cfg.provider === 'ollama'
            ? 'Default: http://localhost:11434 — run `ollama serve` if not already running.'
            : 'OpenAI-compatible: appends /v1/models and /v1/chat/completions. Works with LM Studio (1234), vLLM (8000), llama.cpp server (8080), LocalAI (8080).'}
        </div>

        {provider.needsKey && (
          <>
            <label className="field">
              API Key <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional · stored locally in config.json)</span>
            </label>
            <input className="text" type="password" style={{ fontFamily: 'var(--mono)' }}
              placeholder={keyAlreadySet ? '•••••••• (already set — leave blank to keep)' : 'sk-… or leave blank if not required'}
              value={cfg.api_key}
              onChange={(e) => { setCfg((c) => ({ ...c, api_key: e.target.value })); setKeyChanged(true) }} />
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="field">Default model</label>
            {models.length > 0 ? (
              <select className="text" value={cfg.default_model} onChange={(e) => setCfg((c) => ({ ...c, default_model: e.target.value }))}>
                <option value="">(none)</option>
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input className="text" placeholder="e.g. gpt-oss:120b-cloud, llama3.1, qwen2.5-coder"
                value={cfg.default_model} onChange={(e) => setCfg((c) => ({ ...c, default_model: e.target.value }))} />
            )}
          </div>
          <div>
            <label className="field">Outline model (optional · faster)</label>
            {models.length > 0 ? (
              <select className="text" value={cfg.outline_model || ''} onChange={(e) => setCfg((c) => ({ ...c, outline_model: e.target.value }))}>
                <option value="">(use default)</option>
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input className="text" placeholder="(blank → uses default)"
                value={cfg.outline_model} onChange={(e) => setCfg((c) => ({ ...c, outline_model: e.target.value }))} />
            )}
          </div>
        </div>

        <label className="field">Request timeout (seconds)</label>
        <input className="text" type="number" min={30} max={3600}
          value={cfg.timeout} onChange={(e) => setCfg((c) => ({ ...c, timeout: parseInt(e.target.value) || 600 }))} />

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontSize: 12 }}>
            {test.status === 'testing' && <><span className="spinner"></span> <span style={{ marginLeft: 6 }}>Testing…</span></>}
            {test.status === 'success' && <span style={{ color: '#6EE7B7' }}>✓ {test.message}</span>}
            {test.status === 'error' && <span style={{ color: '#FCA5A5' }}>✗ {test.message}</span>}
          </div>
          <div className="btn-group">
            <button className="btn subtle" onClick={runTest} disabled={test.status === 'testing'}>Test connection</button>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={saving}>
              {saving ? <><span className="spinner"></span> Saving…</> : '💾 Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
