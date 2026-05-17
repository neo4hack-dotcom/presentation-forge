"""Extract a brand palette from an uploaded image (logo / screenshot / brand asset)."""
from __future__ import annotations

import io
from collections import Counter
from typing import Optional

from PIL import Image


def _hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02X}{:02X}{:02X}".format(*rgb)


def _luminance(rgb: tuple[int, int, int]) -> float:
    def chan(c: int) -> float:
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)


def _distance(a, b) -> float:
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def extract_palette(data: bytes, max_colors: int = 6) -> dict:
    """Return a structured palette suitable for theming a deck."""
    img = Image.open(io.BytesIO(data)).convert("RGBA")
    img.thumbnail((400, 400))

    # Drop near-transparent and near-white/near-black backgrounds when picking accents
    pixels = []
    for px in img.getdata():
        r, g, b, a = px
        if a < 200:
            continue
        pixels.append((r, g, b))
    if not pixels:
        return _default_palette()

    # Quantize via Pillow's median-cut
    q = img.convert("RGB").quantize(colors=max_colors * 2, method=Image.Quantize.MEDIANCUT)
    palette = q.getpalette()[: max_colors * 2 * 3]
    counts = Counter(q.getdata())
    ranked = []
    for idx, count in counts.most_common():
        r, g, b = palette[idx * 3], palette[idx * 3 + 1], palette[idx * 3 + 2]
        ranked.append(((r, g, b), count))

    # Separate background candidates (very light or very dark, dominant)
    total = sum(c for _, c in ranked)
    bg: Optional[tuple] = None
    for rgb, c in ranked:
        lum = _luminance(rgb)
        if (lum > 0.92 or lum < 0.08) and c / total > 0.25:
            bg = rgb
            break

    # Pick accent: most saturated non-bg color
    def saturation(rgb):
        r, g, b = [x / 255 for x in rgb]
        mx, mn = max(r, g, b), min(r, g, b)
        return 0 if mx == 0 else (mx - mn) / mx

    accents = [rgb for rgb, _ in ranked if rgb != bg]
    accents.sort(key=lambda c: (saturation(c), _distance(c, (128, 128, 128))), reverse=True)

    primary = accents[0] if accents else (37, 99, 235)
    # Secondary: visually distant from primary, also saturated
    secondary = None
    for cand in accents[1:]:
        if _distance(cand, primary) > 80 and saturation(cand) > 0.25:
            secondary = cand
            break
    if secondary is None and len(accents) > 1:
        secondary = accents[1]
    if secondary is None:
        secondary = primary

    is_dark_bg = bg is not None and _luminance(bg) < 0.5
    text = (240, 240, 245) if is_dark_bg else (17, 24, 39)
    muted = (160, 165, 175) if is_dark_bg else (107, 114, 128)
    surface = bg if bg else ((20, 22, 30) if is_dark_bg else (255, 255, 255))

    return {
        "primary": _hex(primary),
        "secondary": _hex(secondary),
        "background": _hex(surface),
        "surface": _hex(surface),
        "text": _hex(text),
        "muted": _hex(muted),
        "dark": is_dark_bg,
        "all": [_hex(rgb) for rgb, _ in ranked[:max_colors]],
    }


def _default_palette() -> dict:
    return {
        "primary": "#2563EB",
        "secondary": "#0EA5E9",
        "background": "#FFFFFF",
        "surface": "#FFFFFF",
        "text": "#111827",
        "muted": "#6B7280",
        "dark": False,
        "all": ["#2563EB", "#0EA5E9", "#111827", "#FFFFFF"],
    }
