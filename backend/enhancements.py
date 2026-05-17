"""High-impact enhancements on top of the core generator.

- AI critic pass (board-level review of the draft deck)
- Translation
- Fact-check against source documents
- Single-slide expansion from outline (parallelizable on the frontend)
- Style extraction from a PDF's first page
"""
from __future__ import annotations

import io
import json
import re
from typing import Optional

from . import llm
from .style_extractor import extract_palette


# ---------- 1) AI critic pass ----------

CRITIC_SYSTEM = """You are a senior partner-level reviewer for a board-grade presentation. You evaluate a deck with a sharp, fair eye and produce *actionable* feedback — never generic platitudes.

Reply with VALID JSON only, no prose:
{
  "overall_score": 0-10,
  "summary": "2-3 sentence verdict for the deck author",
  "issues": [
    {"slide_id": "s4 or null if deck-wide", "severity": "low|medium|high", "category": "structure|content|data|design|story|gap", "issue": "what's wrong", "suggestion": "concrete fix"}
  ],
  "missing_slides": [
    {"after_slide_id": "s3", "layout": "kpi", "title": "Proposed title", "why": "why this is missing"}
  ],
  "strengths": ["..."]
}
- Be concrete. Bad: "this slide could be clearer". Good: "Slide 4 makes 3 unrelated claims — split bullets into 2 slides".
- Flag generic business-speak. Flag titles that lack a so-what. Flag pyramid-principle breaks (MECE issues, jumping levels).
- Score by board readiness, not by polish.
"""


async def critic(deck: dict, context: str = "", model: Optional[str] = None) -> dict:
    user = f"""DECK TO REVIEW:
{json.dumps(deck, ensure_ascii=False)[:60_000]}

USER'S REFERENCE CONTEXT (what the deck is supposed to draw from):
---
{context[:20_000] if context else '(none)'}
---

Produce your review as JSON."""
    return await llm.chat_json(
        [
            {"role": "system", "content": CRITIC_SYSTEM},
            {"role": "user", "content": user},
        ],
        model=model,
        temperature=0.3,
    )


# ---------- 2) Translate ----------

TRANSLATE_SYSTEM = """You translate a presentation deck JSON from its current language to the target language while preserving:
- the JSON structure exactly (same keys, same arrays, same ids and layouts)
- numbers, dates, KPI values, proper nouns, brand names, technical terms
- the tone (board-grade) and the action-orientation of titles

Translate ALL human-readable text fields including: title, subtitle, body, bullets, kpis[].label/delta, quote.text/author, table.headers/rows, timeline[].when/what/detail, swot[*], chart.labels/series[].name/ylabel/insight, footnote, notes, executive_summary.

Reply with ONLY the translated JSON object, no prose, no code fence."""


async def translate(deck: dict, target_language: str, model: Optional[str] = None) -> dict:
    user = f"""TARGET LANGUAGE: {target_language}

DECK JSON:
{json.dumps(deck, ensure_ascii=False)[:80_000]}

Translate it now."""
    return await llm.chat_json(
        [
            {"role": "system", "content": TRANSLATE_SYSTEM},
            {"role": "user", "content": user},
        ],
        model=model,
        temperature=0.2,
    )


# ---------- 3) Fact-check against source documents ----------

_NUMBER_RE = re.compile(
    r"""
    (?<![A-Za-z])                         # not preceded by a letter
    (?:€|\$|£|¥)?\s?                      # optional currency
    -?\d{1,3}(?:[\.\, ]\d{3})*(?:[\.\,]\d+)?  # 1,234.56 or 12.4
    \s?(?:%|pp|bps|k|K|M|Mn|B|Bn|bn|million|billion|years?|months?|days?|hrs?|hours?|x|×)?
    """,
    re.X,
)


def _extract_numbers(text: str) -> list[str]:
    if not text:
        return []
    found = []
    for m in _NUMBER_RE.finditer(text):
        s = m.group(0).strip()
        # Skip noise
        if len(s) < 2:
            continue
        if s in {"0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"}:
            continue
        found.append(s)
    return found


def _normalize_for_match(s: str) -> str:
    """Loose comparison: strip currency, spaces, normalize decimal sep."""
    return re.sub(r"[^\d\.\-]", "", s.replace(",", ".")).strip(".")


def factcheck(deck: dict, sources_text: str) -> dict:
    """Flag numeric claims in the deck that don't appear (loosely) in the source text.

    Returns:
      {"checked": int, "flagged": [{"slide_id":..., "claim":..., "context":...}], "supported": int}
    """
    src_numbers = set(_normalize_for_match(n) for n in _extract_numbers(sources_text or "") if _normalize_for_match(n))
    flagged = []
    checked = 0
    supported = 0

    def visit(slide_id, field, text):
        nonlocal checked, supported
        if not text:
            return
        for n in _extract_numbers(text):
            checked += 1
            norm = _normalize_for_match(n)
            if not norm:
                continue
            # Match if exact normalized number is a substring of any source number (or vice versa within 1 decimal)
            ok = norm in src_numbers
            if not ok:
                # Try without trailing zero
                ok = any(norm in s or s in norm for s in src_numbers if len(s) >= 2)
            if ok:
                supported += 1
            else:
                flagged.append({"slide_id": slide_id, "field": field, "claim": n, "snippet": text[:160]})

    for s in deck.get("slides") or []:
        sid = s.get("id")
        visit(sid, "body", s.get("body"))
        visit(sid, "subtitle", s.get("subtitle"))
        for b in s.get("bullets") or []:
            visit(sid, "bullets", b)
        for k in s.get("kpis") or []:
            visit(sid, "kpi.value", k.get("value"))
            visit(sid, "kpi.delta", k.get("delta"))
        if s.get("chart"):
            visit(sid, "chart.insight", s["chart"].get("insight"))
        if s.get("table"):
            for row in s["table"].get("rows") or []:
                for cell in row:
                    visit(sid, "table.cell", str(cell))
        if s.get("timeline"):
            for it in s["timeline"]:
                visit(sid, "timeline.detail", it.get("detail"))

    return {"checked": checked, "supported": supported, "flagged": flagged}


# ---------- 4) Style extraction from PDF first page ----------

def palette_from_pdf(pdf_bytes: bytes) -> dict:
    """Render the first page of a PDF to a raster, then extract a palette.

    Uses pypdf to find the page count; tries pdf2image-style raster via Pillow's
    built-in support is not enough — so we shell out to a pure-Python approach
    using pdfplumber/pypdfium2 if available, else fall back to embedded raster
    images from the PDF (cover slide usually has one).
    """
    # Try pypdfium2 first (no system deps)
    try:
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(io.BytesIO(pdf_bytes))
        page = pdf[0]
        pil_image = page.render(scale=2).to_pil()
        buf = io.BytesIO()
        pil_image.save(buf, format="PNG")
        return extract_palette(buf.getvalue())
    except Exception:
        pass

    # Fallback: scan embedded images in the first few pages
    try:
        from pypdf import PdfReader
        from PIL import Image
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for page in reader.pages[:3]:
            for image in page.images:
                try:
                    img = Image.open(io.BytesIO(image.data))
                    buf = io.BytesIO()
                    img.save(buf, format="PNG")
                    return extract_palette(buf.getvalue())
                except Exception:
                    continue
    except Exception:
        pass

    # Last resort: default palette
    from .style_extractor import _default_palette
    return _default_palette()


# ---------- 5) Quick refinement presets ----------

QUICK_REFINEMENTS = {
    "shorter": "Make this slide shorter and tighter. Cut filler. Bullets should be < 14 words.",
    "denser": "Add more substance — numbers, names, dates. Replace generic statements with concrete facts pulled from the reference context.",
    "more-visual": "Switch this slide to a more visual layout (kpi, chart, timeline, or swot) that fits the content best. Reorganize the data accordingly.",
    "add-chart": "Add or improve a chart on this slide. Choose the best chart type (bar/line/area/donut) and produce a sharp one-line so-what insight.",
    "add-citation": "Ground every numeric claim in a specific source citation in the `footnote` field. Reference the document name and (when possible) the page.",
    "more-board": "Sharpen this for a board audience: action-oriented title with the so-what, no jargon, lead with the recommendation.",
    "kpi": "Recast this slide as a `kpi` layout with 3-6 KPI tiles drawn from the content.",
    "bullets": "Recast this slide as a `bullets` layout with up to 5 tight, claim-style bullets.",
    "chart": "Recast this slide as a `chart` layout. Choose the chart type that best reveals the so-what.",
    "two-column": "Recast this slide as a `two-column` layout with a clear left/right contrast.",
    "swot": "Recast this slide as a `swot` 2x2 analysis.",
    "timeline": "Recast this slide as a `timeline` of dated milestones.",
    "table": "Recast this slide as a `table` with crisp headers and 4-6 rows.",
    "quote": "Recast this slide as a high-impact `quote` slide if a relevant quote exists in the context.",
}
