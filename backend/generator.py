"""Presentation generation orchestrator.

Two-phase approach:
  1. Outline: produce a structured outline (titles, layouts, one-line intent).
  2. Slides: expand each outline item into a fully-typed slide with rich content.

This separation makes generation incremental (you can stream slides one by one)
and lets the user edit the outline before paying for the full expansion.
"""
from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator, Optional

from . import llm


SUPPORTED_LAYOUTS = [
    "title",       # opening slide
    "section",     # divider/section header
    "bullets",     # title + bullet list
    "two-column",  # left/right text panels
    "kpi",         # 3-6 KPI tiles
    "quote",       # large pull-quote
    "table",       # structured table
    "timeline",    # vertical timeline
    "swot",        # 2x2 SWOT grid
    "chart",       # bar / line / donut
    "closing",     # closing slide / next steps
]


OUTLINE_SYSTEM = """You are a senior management consultant (think McKinsey / BCG partner level) producing board-grade presentations.

You build an OUTLINE first. The outline is a JSON object:

{
  "title": "Sharp, board-ready deck title",
  "subtitle": "One-line value proposition (<= 90 chars)",
  "author": "...", "date": "...", "audience": "...",
  "executive_summary": "3-5 sentences distilling the so-what for an executive audience.",
  "slides": [
    {"id": "s1", "layout": "<one of: title|section|bullets|two-column|kpi|quote|table|timeline|swot|chart|closing>",
     "title": "Slide title (action-oriented, MECE)", "intent": "What this slide must convey in one line"}
  ]
}

RULES:
- 8 to 14 slides total. Open with `title`, close with `closing`. Use `section` to break the deck into 2-4 chapters.
- Every non-divider slide title must be ACTION-ORIENTED and reveal the so-what (e.g. "Demand has tripled but margin is compressing" — NOT "Demand"). No vague topic titles.
- Pick the layout that fits the *content*, not the other way around. Use `kpi` for numeric snapshots, `chart` when there is a trend or comparison, `timeline` for sequencing, `swot` for posture, `table` for structured comparisons, `quote` sparingly.
- The deck should follow a Pyramid Principle arc: situation → complication → question → answer → supporting arguments → recommendation / next steps.
- Reply with VALID JSON only. No markdown, no prose."""


SLIDE_SYSTEM = """You are a senior management consultant producing one slide of a board-grade deck.

You receive: the full deck outline, the user context (prompt + reference documents), and the target slide's outline entry. You output ONE slide as a JSON object matching this schema (only include the fields relevant to the chosen layout):

{
  "id": "s1",
  "layout": "<same as outline>",
  "title": "Action-oriented title with the so-what",
  "subtitle": "Optional one-line subtitle",
  "body": "Optional short markdown paragraph (2-3 sentences max)",
  "bullets": ["Bullet 1 (one tight sentence)", "..."],            // for layout=bullets, max 5
  "left": {"title": "...", "bullets": ["..."]},                    // for layout=two-column
  "right": {"title": "...", "bullets": ["..."]},
  "kpis": [{"label": "...", "value": "12.4M€", "delta": "+18% YoY", "trend": "up|down|flat"}],  // for kpi, 3-6 items
  "quote": {"text": "...", "author": "..."},                       // for quote
  "table": {"headers": ["..."], "rows": [["..."]]},                // for table
  "timeline": [{"when": "Q1 2026", "what": "Milestone", "detail": "1-line detail"}],  // for timeline
  "swot": {"strengths": ["..."], "weaknesses": ["..."], "opportunities": ["..."], "threats": ["..."]},
  "chart": {"type": "bar|line|donut", "labels": ["..."], "series": [{"name": "...", "values": [1,2,3]}], "ylabel": "...", "insight": "1-line so-what"},
  "footnote": "Optional source citation (e.g. 'Source: Q3 board pack, p.12')",
  "notes": "Speaker notes: 3-5 sentences expanding what the presenter should say."
}

RULES:
- Use the user context *aggressively*. Pull real numbers, names, dates, and quotes from the provided documents. Cite the source in `footnote` when you do.
- NO filler, NO platitudes, NO generic business-speak. Every word earns its place.
- Bullets are tight sentences (<= 18 words), not labels. They make a claim.
- For `chart`, invent numbers ONLY if explicit data is missing — and clearly mark them as illustrative in `insight`.
- For `kpi`, the `value` is the headline number; `delta` is the change vs prior period.
- Speaker `notes` ARE mandatory for every content slide — they're how the user will deliver this.
- Reply with VALID JSON only. No code fence, no prose."""


async def build_outline(
    prompt: str,
    context: str,
    audience: str = "",
    tone: str = "Senior PM / board-level",
    target_slides: int = 12,
    model: Optional[str] = None,
) -> dict:
    user = f"""USER BRIEF:
{prompt or '(no brief provided — infer from context)'}

TARGET AUDIENCE: {audience or 'Executive committee / board'}
TONE: {tone}
TARGET DECK LENGTH: ~{target_slides} slides

REFERENCE CONTEXT (excerpts from user-uploaded documents and pasted text):
---
{context[:50_000] if context else '(no reference documents provided — rely on the brief and your senior-consultant judgement)'}
---

Produce the outline now."""
    out = await llm.chat_json(
        [
            {"role": "system", "content": OUTLINE_SYSTEM},
            {"role": "user", "content": user},
        ],
        model=model,
        temperature=0.35,
    )
    # Normalize
    out.setdefault("slides", [])
    for i, s in enumerate(out["slides"], 1):
        s.setdefault("id", f"s{i}")
        if s.get("layout") not in SUPPORTED_LAYOUTS:
            s["layout"] = "bullets"
    return out


async def build_slide(
    outline: dict,
    slide_entry: dict,
    context: str,
    model: Optional[str] = None,
) -> dict:
    user = f"""DECK OUTLINE:
{json.dumps({k: v for k, v in outline.items() if k != 'slides'}, ensure_ascii=False)}
ALL SLIDE TITLES (for coherence): {json.dumps([s.get('title') for s in outline.get('slides', [])], ensure_ascii=False)}

TARGET SLIDE (expand this one):
{json.dumps(slide_entry, ensure_ascii=False)}

REFERENCE CONTEXT (excerpts from user-uploaded documents and pasted text):
---
{context[:40_000] if context else '(none — use the outline + brief)'}
---

Produce this single slide now."""
    slide = await llm.chat_json(
        [
            {"role": "system", "content": SLIDE_SYSTEM},
            {"role": "user", "content": user},
        ],
        model=model,
        temperature=0.45,
    )
    # Carry over identity from outline
    slide["id"] = slide_entry.get("id", slide.get("id"))
    if slide.get("layout") not in SUPPORTED_LAYOUTS:
        slide["layout"] = slide_entry.get("layout", "bullets")
    return slide


async def build_deck_streaming(
    prompt: str,
    context: str,
    audience: str = "",
    tone: str = "Senior PM / board-level",
    target_slides: int = 12,
    model: Optional[str] = None,
    parallel: int = 3,
) -> AsyncIterator[dict]:
    """Yield events as the deck is built.

    Event shape: {"event": "outline|slide|done|error", ...}
    """
    try:
        yield {"event": "status", "message": "Designing the outline…"}
        outline = await build_outline(prompt, context, audience, tone, target_slides, model)
        yield {"event": "outline", "outline": outline}

        slide_entries = outline.get("slides", [])
        sem = asyncio.Semaphore(parallel)
        results: dict[str, dict] = {}

        async def run_one(entry):
            async with sem:
                try:
                    s = await build_slide(outline, entry, context, model)
                except Exception as e:  # graceful fallback
                    s = {
                        "id": entry.get("id"),
                        "layout": entry.get("layout", "bullets"),
                        "title": entry.get("title", "Slide"),
                        "body": f"_(generation error: {e})_",
                        "notes": "",
                    }
                results[entry["id"]] = s
                return s

        tasks = [asyncio.create_task(run_one(e)) for e in slide_entries]
        for fut in asyncio.as_completed(tasks):
            slide = await fut
            yield {"event": "slide", "slide": slide}

        ordered = [results[e["id"]] for e in slide_entries if e["id"] in results]
        outline["slides"] = ordered
        yield {"event": "done", "deck": outline}
    except Exception as e:
        yield {"event": "error", "message": str(e)}


REFINE_SYSTEM = """You revise a single slide based on user feedback. Output the FULL revised slide JSON (same schema as before). No prose, JSON only."""


async def refine_slide(slide: dict, instruction: str, context: str = "", model: Optional[str] = None) -> dict:
    user = f"""CURRENT SLIDE:
{json.dumps(slide, ensure_ascii=False)}

USER INSTRUCTION:
{instruction}

REFERENCE CONTEXT:
---
{context[:30_000]}
---

Return the revised slide as JSON."""
    revised = await llm.chat_json(
        [
            {"role": "system", "content": SLIDE_SYSTEM + "\n\n" + REFINE_SYSTEM},
            {"role": "user", "content": user},
        ],
        model=model,
        temperature=0.45,
    )
    revised["id"] = slide.get("id")
    if revised.get("layout") not in SUPPORTED_LAYOUTS:
        revised["layout"] = slide.get("layout", "bullets")
    return revised
