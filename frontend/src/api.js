// Thin client for the FastAPI backend. All endpoints are same-origin via Vite proxy.

const J = { 'Content-Type': 'application/json' };

export async function health() {
  const r = await fetch('/api/health');
  return r.json();
}

export async function listModels() {
  const r = await fetch('/api/models');
  if (!r.ok) throw new Error('Could not list models');
  return r.json();
}

// ---------- LLM configuration ----------

export async function getConfig() {
  const r = await fetch('/api/config');
  if (!r.ok) throw new Error('Could not load config');
  return r.json();
}

export async function saveConfig(patch) {
  const r = await fetch('/api/config', { method: 'POST', headers: J, body: JSON.stringify(patch) });
  if (!r.ok) throw new Error((await r.text()) || 'Could not save config');
  return r.json();
}

export async function testConfig(patch) {
  const r = await fetch('/api/config/test', { method: 'POST', headers: J, body: JSON.stringify(patch) });
  if (!r.ok) throw new Error('Test request failed');
  return r.json();
}

export async function modelsForConfig(patch) {
  const r = await fetch('/api/config/models', { method: 'POST', headers: J, body: JSON.stringify(patch) });
  if (!r.ok) throw new Error('Could not list models for candidate config');
  return r.json();
}

export async function parseFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('/api/parse', { method: 'POST', body: fd });
  if (!r.ok) throw new Error('Parse failed');
  return r.json();
}

export async function paletteFromImage(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('/api/theme/from-image', { method: 'POST', body: fd });
  if (!r.ok) throw new Error('Palette extraction failed');
  return r.json();
}

export async function paletteFromPdf(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('/api/theme/from-pdf', { method: 'POST', body: fd });
  if (!r.ok) throw new Error('Palette extraction failed');
  return r.json();
}

export async function criticPass(deck, context, model) {
  const r = await fetch('/api/critic', { method: 'POST', headers: J, body: JSON.stringify({ deck, context, model }) });
  if (!r.ok) throw new Error((await r.text()) || 'Critic failed');
  return r.json();
}

export async function translateDeck(deck, target_language, model) {
  const r = await fetch('/api/translate', { method: 'POST', headers: J, body: JSON.stringify({ deck, target_language, model }) });
  if (!r.ok) throw new Error((await r.text()) || 'Translate failed');
  return r.json();
}

export async function factcheck(deck, sources_text) {
  const r = await fetch('/api/factcheck', { method: 'POST', headers: J, body: JSON.stringify({ deck, sources_text }) });
  if (!r.ok) throw new Error('Factcheck failed');
  return r.json();
}

export async function quickRefine(slide, preset, context, model) {
  const r = await fetch('/api/slide/quick-refine', { method: 'POST', headers: J, body: JSON.stringify({ slide, preset, context, model }) });
  if (!r.ok) throw new Error((await r.text()) || 'Quick-refine failed');
  return r.json();
}

export async function listVersions(pid) {
  const r = await fetch('/api/projects/' + pid + '/versions');
  return r.json();
}

export async function restoreVersion(pid, index) {
  const r = await fetch(`/api/projects/${pid}/restore/${index}`, { method: 'POST' });
  if (!r.ok) throw new Error('Restore failed');
  return r.json();
}

export async function expandOutlineStream(payload, onEvent, signal) {
  const r = await fetch('/api/generate/expand-outline', { method: 'POST', headers: J, body: JSON.stringify(payload), signal });
  if (!r.ok || !r.body) throw new Error('Expand failed');
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw) continue;
        try { onEvent(JSON.parse(raw)); } catch {}
      }
    }
  }
}

export async function generateOutlineOnly(payload) {
  return generateOutline(payload);
}

export async function listThemes() {
  const r = await fetch('/api/themes');
  return r.json();
}

export async function generateOutline(payload) {
  const r = await fetch('/api/generate/outline', { method: 'POST', headers: J, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error((await r.text()) || 'Outline failed');
  return r.json();
}

export async function refineSlide(payload) {
  const r = await fetch('/api/slide/refine', { method: 'POST', headers: J, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error((await r.text()) || 'Refine failed');
  return r.json();
}

export async function renderHtml(deck, theme) {
  const r = await fetch('/api/render/html', { method: 'POST', headers: J, body: JSON.stringify({ deck, theme }) });
  if (!r.ok) throw new Error('Render failed');
  return r.json();
}

export async function exportPdf(deck, theme) {
  const r = await fetch('/api/export/pdf', { method: 'POST', headers: J, body: JSON.stringify({ deck, theme }) });
  if (!r.ok) throw new Error((await r.text()) || 'PDF export failed');
  return r.blob();
}

export async function exportHtmlFile(deck, theme) {
  const r = await fetch('/api/export/html', { method: 'POST', headers: J, body: JSON.stringify({ deck, theme }) });
  if (!r.ok) throw new Error('HTML export failed');
  return r.blob();
}

export async function saveProject(p) {
  const r = await fetch('/api/projects', { method: 'POST', headers: J, body: JSON.stringify(p) });
  return r.json();
}
export async function listProjects() {
  const r = await fetch('/api/projects');
  return r.json();
}
export async function loadProject(id) {
  const r = await fetch('/api/projects/' + id);
  return r.json();
}
export async function deleteProject(id) {
  const r = await fetch('/api/projects/' + id, { method: 'DELETE' });
  return r.json();
}

/**
 * Stream a generation via SSE. onEvent receives parsed events:
 *   {event:'status', message}
 *   {event:'outline', outline}
 *   {event:'slide', slide}
 *   {event:'done', deck}
 *   {event:'error', message}
 */
export async function streamGenerate(payload, onEvent, signal) {
  const r = await fetch('/api/generate/stream', { method: 'POST', headers: J, body: JSON.stringify(payload), signal });
  if (!r.ok || !r.body) throw new Error((await r.text()) || 'Stream failed');
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw) continue;
        try { onEvent(JSON.parse(raw)); } catch (e) { /* ignore */ }
      }
    }
  }
}
