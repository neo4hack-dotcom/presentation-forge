"""FastAPI app — presentation-forge backend.

Runs entirely locally. Talks to a local Ollama instance for the LLM.
"""
from __future__ import annotations

import asyncio
import base64
import io
import json
import sys
import time
import uuid
from pathlib import Path
from typing import Optional

# Windows: httpx streaming + asyncio requires SelectorEventLoop (not ProactorEventLoop)
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from . import generator, llm, parsers, renderer, enhancements, brand_kits, config as cfg
from .style_extractor import extract_palette


BASE_DIR = Path(__file__).parent
STORAGE = BASE_DIR / "storage"
UPLOADS = STORAGE / "uploads"
OUTPUTS = STORAGE / "outputs"
PROJECTS = STORAGE / "projects"
BRANDS = STORAGE / "brands"
for p in (UPLOADS, OUTPUTS, PROJECTS, BRANDS):
    p.mkdir(parents=True, exist_ok=True)


app = FastAPI(title="Presentation Forge", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Models ----------

class GenerateRequest(BaseModel):
    prompt: str = ""
    context: str = ""
    audience: str = ""
    tone: str = "Senior PM / board-level"
    target_slides: int = 12
    model: Optional[str] = None
    outline_model: Optional[str] = None  # multi-LLM cascade
    theme: Optional[dict] = None


class ExpandOutlineRequest(BaseModel):
    outline: dict
    context: str = ""
    model: Optional[str] = None


class ExpandSlideRequest(BaseModel):
    outline: dict
    slide_entry: dict
    context: str = ""
    model: Optional[str] = None


class CriticRequest(BaseModel):
    deck: dict
    context: str = ""
    model: Optional[str] = None


class TranslateRequest(BaseModel):
    deck: dict
    target_language: str
    model: Optional[str] = None


class FactCheckRequest(BaseModel):
    deck: dict
    sources_text: str = ""


class QuickRefineRequest(BaseModel):
    slide: dict
    preset: str
    context: str = ""
    model: Optional[str] = None


class RenderRequest(BaseModel):
    deck: dict
    theme: Optional[dict] = None


class RefineRequest(BaseModel):
    slide: dict
    instruction: str
    context: str = ""
    model: Optional[str] = None


class ProjectSave(BaseModel):
    id: Optional[str] = None
    name: str
    prompt: str = ""
    context: str = ""
    audience: str = ""
    deck: Optional[dict] = None
    theme: Optional[dict] = None


# ---------- Health / models ----------

@app.get("/api/health")
async def health():
    info = {"ok": True, "provider_reachable": False, "models": [], "config": cfg.get_public()}
    try:
        models = await llm.list_models()
        info["provider_reachable"] = True
        info["ollama"] = True  # backwards compat
        info["models"] = [m.get("name") for m in models]
    except Exception as e:
        info["error"] = str(e)
        info["ollama"] = False
    return info


@app.get("/api/models")
async def models():
    try:
        return {"models": await llm.list_models()}
    except Exception as e:
        raise HTTPException(503, f"Provider unreachable: {e}")


# ---------- LLM Configuration ----------

class LLMConfigPatch(BaseModel):
    provider: Optional[str] = None         # "ollama" | "openai"
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    default_model: Optional[str] = None
    outline_model: Optional[str] = None
    timeout: Optional[int] = None


@app.get("/api/config")
async def get_config():
    return cfg.get_public()


@app.post("/api/config")
async def update_config(patch: LLMConfigPatch):
    public = cfg.update({k: v for k, v in patch.model_dump().items() if v is not None})
    return public


@app.post("/api/config/test")
async def test_config(patch: LLMConfigPatch):
    """Test a candidate config WITHOUT persisting it."""
    base = cfg.get()
    candidate = {**base, **{k: v for k, v in patch.model_dump().items() if v is not None}}
    return await llm.test_connection(candidate)


@app.post("/api/config/models")
async def list_models_for_config(patch: LLMConfigPatch):
    """List models for a *candidate* config (used by the Settings UI before save)."""
    base = cfg.get()
    candidate = {**base, **{k: v for k, v in patch.model_dump().items() if v is not None}}
    try:
        return {"models": await llm.list_models(override=candidate)}
    except Exception as e:
        raise HTTPException(503, f"Provider unreachable: {e}")


# ---------- Document ingestion ----------

@app.post("/api/parse")
async def parse_doc(file: UploadFile = File(...)):
    data = await file.read()
    text = parsers.parse_file(file.filename or "file", data)
    return {"name": file.filename, "chars": len(text), "text": text}


# ---------- Theme: palette extraction from logo / brand image / sample PDF ----------

@app.post("/api/theme/from-image")
async def theme_from_image(file: UploadFile = File(...)):
    data = await file.read()
    try:
        palette = extract_palette(data)
    except Exception as e:
        raise HTTPException(400, f"Could not analyze image: {e}")
    mime = file.content_type or "image/png"
    b64 = base64.b64encode(data).decode("ascii")
    palette["logo_data_url"] = f"data:{mime};base64,{b64}"
    return palette


@app.post("/api/theme/from-pdf")
async def theme_from_pdf(file: UploadFile = File(...)):
    """Extract a palette from an example deck PDF (renders the first page)."""
    data = await file.read()
    try:
        palette = enhancements.palette_from_pdf(data)
    except Exception as e:
        raise HTTPException(400, f"Could not analyze PDF: {e}")
    return palette


# ---------- Generation ----------

@app.post("/api/generate/outline")
async def outline_only(req: GenerateRequest):
    try:
        outline = await generator.build_outline(
            prompt=req.prompt,
            context=req.context,
            audience=req.audience,
            tone=req.tone,
            target_slides=req.target_slides,
            model=req.outline_model or req.model,
        )
        return {"outline": outline}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/generate/expand-outline")
async def expand_outline(req: ExpandOutlineRequest):
    """Stream slides given an already-edited outline (improvement #1)."""

    async def event_stream():
        try:
            outline = req.outline
            yield f"data: {json.dumps({'event':'outline','outline':outline}, ensure_ascii=False)}\n\n"
            sem = asyncio.Semaphore(3)
            results = {}

            async def run_one(entry):
                async with sem:
                    try:
                        s = await generator.build_slide(outline, entry, req.context, req.model)
                    except Exception as e:
                        s = {"id": entry.get("id"), "layout": entry.get("layout", "bullets"),
                             "title": entry.get("title", "Slide"), "body": f"_(error: {e})_", "notes": ""}
                    results[entry["id"]] = s
                    return s

            tasks = [asyncio.create_task(run_one(e)) for e in outline.get("slides", [])]
            for fut in asyncio.as_completed(tasks):
                slide = await fut
                yield f"data: {json.dumps({'event':'slide','slide':slide}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0)
            ordered = [results[e['id']] for e in outline.get('slides', []) if e['id'] in results]
            yield f"data: {json.dumps({'event':'done','deck':{**outline, 'slides':ordered}}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'event':'error','message':str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/api/generate/slide")
async def expand_one_slide(req: ExpandSlideRequest):
    try:
        s = await generator.build_slide(req.outline, req.slide_entry, req.context, req.model)
        return {"slide": s}
    except Exception as e:
        raise HTTPException(500, str(e))


# ---------- Enhancements: critic / translate / factcheck / quick-refine ----------

@app.post("/api/critic")
async def critic_endpoint(req: CriticRequest):
    try:
        return {"review": await enhancements.critic(req.deck, req.context, req.model)}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/translate")
async def translate_endpoint(req: TranslateRequest):
    try:
        return {"deck": await enhancements.translate(req.deck, req.target_language, req.model)}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/factcheck")
async def factcheck_endpoint(req: FactCheckRequest):
    try:
        return enhancements.factcheck(req.deck, req.sources_text)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/slide/quick-refine")
async def quick_refine(req: QuickRefineRequest):
    instr = enhancements.QUICK_REFINEMENTS.get(req.preset)
    if not instr:
        raise HTTPException(400, f"Unknown preset: {req.preset}")
    try:
        revised = await generator.refine_slide(req.slide, instr, req.context, req.model)
        return {"slide": revised}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/quick-refinements")
async def quick_refinements():
    return {"presets": enhancements.QUICK_REFINEMENTS}


@app.post("/api/generate/stream")
async def generate_stream(req: GenerateRequest):
    """Server-sent events: outline, then each slide as it completes."""

    async def event_stream():
        try:
            async for ev in generator.build_deck_streaming(
                prompt=req.prompt,
                context=req.context,
                audience=req.audience,
                tone=req.tone,
                target_slides=req.target_slides,
                model=req.model,
            ):
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0)  # cooperative
        except Exception as e:
            yield f"data: {json.dumps({'event':'error','message':str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/slide/refine")
async def slide_refine(req: RefineRequest):
    try:
        revised = await generator.refine_slide(req.slide, req.instruction, req.context, req.model)
        return {"slide": revised}
    except Exception as e:
        raise HTTPException(500, str(e))


# ---------- Rendering / export ----------

@app.post("/api/render/html")
async def render_html_endpoint(req: RenderRequest):
    html = renderer.render_html(req.deck, req.theme)
    return JSONResponse({"html": html})


@app.post("/api/render/preview")
async def render_preview(req: RenderRequest):
    html = renderer.render_html(req.deck, req.theme)
    return StreamingResponse(io.BytesIO(html.encode("utf-8")), media_type="text/html")


@app.post("/api/export/pdf")
async def export_pdf(req: RenderRequest):
    html = renderer.render_html(req.deck, req.theme)
    out = OUTPUTS / f"deck_{uuid.uuid4().hex}.pdf"
    try:
        await renderer.render_pdf(html, out)
    except Exception as e:
        raise HTTPException(500, f"PDF export failed (is Playwright installed? run: python -m playwright install chromium): {e}")
    return FileResponse(out, filename="presentation.pdf", media_type="application/pdf")


@app.post("/api/export/html")
async def export_html(req: RenderRequest):
    html = renderer.render_html(req.deck, req.theme)
    out = OUTPUTS / f"deck_{uuid.uuid4().hex}.html"
    out.write_text(html, encoding="utf-8")
    return FileResponse(out, filename="presentation.html", media_type="text/html")


# ---------- Project persistence (local files) ----------

@app.get("/api/projects")
async def list_projects():
    items = []
    for f in sorted(PROJECTS.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            d = json.loads(f.read_text("utf-8"))
            items.append({
                "id": d.get("id", f.stem),
                "name": d.get("name", f.stem),
                "updated_at": f.stat().st_mtime,
                "n_slides": len((d.get("deck") or {}).get("slides", [])),
            })
        except Exception:
            continue
    return {"projects": items}


@app.get("/api/projects/{pid}")
async def get_project(pid: str):
    f = PROJECTS / f"{pid}.json"
    if not f.exists():
        raise HTTPException(404, "not found")
    return json.loads(f.read_text("utf-8"))


MAX_VERSIONS = 12


@app.post("/api/projects")
async def save_project(p: ProjectSave):
    pid = p.id or uuid.uuid4().hex[:12]
    f = PROJECTS / f"{pid}.json"
    # Snapshot previous deck into version history (improvement: auto-versioning)
    versions = []
    if f.exists():
        try:
            prev = json.loads(f.read_text("utf-8"))
            versions = prev.get("versions", [])
            if prev.get("deck"):
                versions.insert(0, {
                    "saved_at": prev.get("updated_at"),
                    "deck": prev["deck"],
                    "theme": prev.get("theme"),
                    "n_slides": len((prev["deck"] or {}).get("slides", [])),
                })
            versions = versions[:MAX_VERSIONS]
        except Exception:
            versions = []
    payload = p.model_dump()
    payload["id"] = pid
    payload["updated_at"] = time.time()
    payload["versions"] = versions
    f.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"id": pid, "n_versions": len(versions)}


@app.get("/api/projects/{pid}/versions")
async def list_versions(pid: str):
    f = PROJECTS / f"{pid}.json"
    if not f.exists():
        raise HTTPException(404, "not found")
    d = json.loads(f.read_text("utf-8"))
    return {"versions": [{"saved_at": v.get("saved_at"), "n_slides": v.get("n_slides")} for v in d.get("versions", [])]}


@app.post("/api/projects/{pid}/restore/{index}")
async def restore_version(pid: str, index: int):
    f = PROJECTS / f"{pid}.json"
    if not f.exists():
        raise HTTPException(404, "not found")
    d = json.loads(f.read_text("utf-8"))
    vs = d.get("versions", [])
    if index < 0 or index >= len(vs):
        raise HTTPException(400, "bad version index")
    return {"deck": vs[index].get("deck"), "theme": vs[index].get("theme")}


@app.delete("/api/projects/{pid}")
async def delete_project(pid: str):
    f = PROJECTS / f"{pid}.json"
    if f.exists():
        f.unlink()
    return {"ok": True}


# ---------- Built-in theme presets ----------

PRESETS = {
    "aurora": {"name": "Aurora", "primary": "#2563EB", "secondary": "#0EA5E9", "accent": "#F59E0B", "background": "#FFFFFF", "surface": "#FFFFFF", "text": "#0F172A", "muted": "#64748B", "dark": False, "template": "consulting"},
    "graphite": {"name": "Graphite", "primary": "#111827", "secondary": "#374151", "accent": "#EF4444", "background": "#FFFFFF", "surface": "#F9FAFB", "text": "#111827", "muted": "#6B7280", "dark": False, "template": "executive"},
    "forest": {"name": "Forest", "primary": "#065F46", "secondary": "#10B981", "accent": "#F59E0B", "background": "#FFFFFF", "surface": "#F0FDF4", "text": "#0F172A", "muted": "#475569", "dark": False, "template": "consulting"},
    "sunset": {"name": "Sunset", "primary": "#DC2626", "secondary": "#F97316", "accent": "#FACC15", "background": "#FFFBEB", "surface": "#FFFFFF", "text": "#1F2937", "muted": "#78716C", "dark": False, "template": "consulting"},
    "midnight": {"name": "Midnight", "primary": "#60A5FA", "secondary": "#A78BFA", "accent": "#F472B6", "background": "#0B1020", "surface": "#111733", "text": "#E5E7EB", "muted": "#94A3B8", "dark": True, "template": "dark-board"},
    "carbon": {"name": "Carbon", "primary": "#22D3EE", "secondary": "#A78BFA", "accent": "#FACC15", "background": "#0A0A0A", "surface": "#141414", "text": "#F4F4F5", "muted": "#A1A1AA", "dark": True, "template": "dark-board"},
}


@app.get("/api/themes")
async def themes():
    return {"presets": PRESETS, "default": renderer.DEFAULT_THEME}


# ---------- Brand kits ----------

class BrandSave(BaseModel):
    id: Optional[str] = None
    name: str
    theme: dict


@app.get("/api/brands")
async def brands_list():
    return {"brands": brand_kits.list_brands(BRANDS)}


@app.get("/api/brands/{bid}")
async def brand_get(bid: str):
    b = brand_kits.get_brand(BRANDS, bid)
    if not b:
        raise HTTPException(404, "not found")
    return b


@app.post("/api/brands")
async def brand_save(p: BrandSave):
    brand = brand_kits.theme_to_brand(p.theme or {})
    brand["name"] = p.name
    if p.id:
        brand["id"] = p.id
    saved = brand_kits.save_brand(BRANDS, brand)
    return saved


@app.delete("/api/brands/{bid}")
async def brand_delete(bid: str):
    brand_kits.delete_brand(BRANDS, bid)
    return {"ok": True}


# ---------- Critic-apply: insert a proposed missing slide ----------

class InsertSlideRequest(BaseModel):
    outline: dict          # full current deck (used as context + slide ids)
    after_slide_id: Optional[str] = None  # if None, append
    proposed: dict         # { layout, title, why? } from the critic
    context: str = ""
    model: Optional[str] = None


@app.post("/api/critic/insert-slide")
async def critic_insert_slide(req: InsertSlideRequest):
    """Build a full slide from a critic-proposed entry and return it.

    The frontend is responsible for splicing it into the deck at the right
    position (it has the slide-id sequence already).
    """
    try:
        # Give the slide a unique id deterministically based on time
        entry = {
            "id": "ins_" + uuid.uuid4().hex[:8],
            "layout": req.proposed.get("layout", "bullets"),
            "title": req.proposed.get("title", "New slide"),
            "intent": req.proposed.get("why", req.proposed.get("intent", "")),
        }
        slide = await generator.build_slide(req.outline, entry, req.context, req.model)
        return {"slide": slide, "after_slide_id": req.after_slide_id}
    except Exception as e:
        raise HTTPException(500, str(e))


# ---------- Critic-apply: refine a slide using a critic suggestion ----------

class CriticFixRequest(BaseModel):
    slide: dict
    issue: dict              # { category, issue, suggestion }
    context: str = ""
    model: Optional[str] = None


@app.post("/api/critic/fix-slide")
async def critic_fix_slide(req: CriticFixRequest):
    suggestion = req.issue.get("suggestion") or req.issue.get("issue") or ""
    if not suggestion.strip():
        raise HTTPException(400, "Empty suggestion")
    instr = f"Apply this reviewer fix exactly: {suggestion}\n(Reviewer category: {req.issue.get('category', 'general')})"
    try:
        revised = await generator.refine_slide(req.slide, instr, req.context, req.model)
        return {"slide": revised}
    except Exception as e:
        raise HTTPException(500, str(e))
