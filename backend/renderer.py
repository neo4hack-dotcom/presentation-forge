"""Render a deck JSON + theme into HTML, and HTML into PDF via Playwright."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape
import markdown as md

from .charts import render_chart_svg


TEMPLATES_DIR = Path(__file__).parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
    trim_blocks=True,
    lstrip_blocks=True,
)


def _md(text: str) -> str:
    if not text:
        return ""
    return md.markdown(text, extensions=["extra", "sane_lists"])


_env.filters["md"] = _md
_env.filters["tojson"] = lambda v: json.dumps(v, ensure_ascii=False)
_env.filters["chart_svg"] = render_chart_svg


DEFAULT_THEME = {
    "name": "Aurora",
    "primary": "#2563EB",
    "secondary": "#0EA5E9",
    "accent": "#F59E0B",
    "background": "#FFFFFF",
    "surface": "#FFFFFF",
    "text": "#0F172A",
    "muted": "#64748B",
    "heading_font": "'Inter', 'Helvetica Neue', sans-serif",
    "body_font": "'Inter', 'Helvetica Neue', sans-serif",
    "mono_font": "'JetBrains Mono', ui-monospace, monospace",
    "logo": None,            # data URL or relative path
    "footer": "",            # footer text
    "template": "consulting",  # consulting | executive | dark-board
    "dark": False,
    # ---- Visual identity system (the "wow" effects, consistent across the deck)
    "cover_style": "minimal",       # minimal | bold | mesh | split | editorial | geometric
    "divider_style": "gradient",    # gradient | minimal | numbered | photo
    "accent_shape": "bar",          # bar | dot | line | triangle | none
    "index_style": "list",          # list | grid | numbered
}


def render_html(deck: dict, theme: Optional[dict] = None) -> str:
    theme = {**DEFAULT_THEME, **(theme or {})}
    if theme.get("dark"):
        # Sensible dark defaults if user didn't override
        theme.setdefault("background", "#0B1020")
        theme.setdefault("surface", "#111733")
        theme.setdefault("text", "#E5E7EB")
        theme.setdefault("muted", "#94A3B8")
    tpl = _env.get_template("deck.html")
    return tpl.render(deck=deck, theme=theme)


async def render_pdf(html: str, out_path: Path) -> Path:
    """Use Playwright headless Chromium to print to PDF at native deck size."""
    from playwright.async_api import async_playwright

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        try:
            ctx = await browser.new_context(viewport={"width": 1600, "height": 900})
            page = await ctx.new_page()
            await page.set_content(html, wait_until="networkidle")
            # Match the slide size (16:9, PowerPoint default 13.333" x 7.5")
            await page.pdf(
                path=str(out_path),
                width="13.333in",
                height="7.5in",
                print_background=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                prefer_css_page_size=False,
            )
        finally:
            await browser.close()
    return out_path


def write_standalone_html(html: str, out_path: Path) -> Path:
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")
    return out_path
