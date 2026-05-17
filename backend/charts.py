"""SVG chart generation. Pure Python, no JS dependency for PDF fidelity."""
from __future__ import annotations

import math
from typing import Optional


PALETTE = [
    "var(--primary)",
    "var(--secondary)",
    "var(--accent)",
    "#10B981",
    "#A78BFA",
    "#F472B6",
    "#FB923C",
    "#22D3EE",
]


def _fmt(n: float) -> str:
    if n is None:
        return ""
    a = abs(n)
    if a >= 1_000_000_000:
        return f"{n/1_000_000_000:.1f}B"
    if a >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if a >= 10_000:
        return f"{n/1_000:.0f}k"
    if a >= 1000:
        return f"{n/1000:.1f}k"
    if a == int(a):
        return f"{int(a)}"
    return f"{n:.1f}"


def render_chart_svg(chart: Optional[dict]) -> str:
    if not chart:
        return ""
    ctype = (chart.get("type") or "bar").lower()
    if ctype == "donut":
        return _donut(chart)
    if ctype == "line":
        return _xy(chart, "line")
    if ctype == "area":
        return _xy(chart, "area")
    return _xy(chart, "bar")


def _donut(chart: dict) -> str:
    series = chart.get("series") or []
    if not series:
        return ""
    values = series[0].get("values") or []
    labels = chart.get("labels") or [f"#{i+1}" for i in range(len(values))]
    total = sum(values) or 1
    cx, cy, r, ir = 280, 260, 180, 100
    parts = []
    angle = -math.pi / 2
    for i, v in enumerate(values):
        frac = v / total
        end = angle + frac * 2 * math.pi
        x1, y1 = cx + r * math.cos(angle), cy + r * math.sin(angle)
        x2, y2 = cx + r * math.cos(end), cy + r * math.sin(end)
        xi1, yi1 = cx + ir * math.cos(end), cy + ir * math.sin(end)
        xi2, yi2 = cx + ir * math.cos(angle), cy + ir * math.sin(angle)
        large = 1 if frac > 0.5 else 0
        color = PALETTE[i % len(PALETTE)]
        parts.append(
            f'<path d="M {x1:.2f} {y1:.2f} A {r} {r} 0 {large} 1 {x2:.2f} {y2:.2f} '
            f'L {xi1:.2f} {yi1:.2f} A {ir} {ir} 0 {large} 0 {xi2:.2f} {yi2:.2f} Z" '
            f'fill="{color}"/>'
        )
        angle = end
    # Center label
    parts.append(
        f'<text x="{cx}" y="{cy-5}" text-anchor="middle" font-size="20" fill="var(--muted)">Total</text>'
        f'<text x="{cx}" y="{cy+30}" text-anchor="middle" font-size="34" font-weight="800" fill="var(--text)">{_fmt(total)}</text>'
    )
    # Legend
    for i, lbl in enumerate(labels):
        v = values[i] if i < len(values) else 0
        pct = (v / total * 100) if total else 0
        parts.append(
            f'<g transform="translate(540, {120 + i*44})">'
            f'<rect width="20" height="20" rx="4" fill="{PALETTE[i % len(PALETTE)]}"/>'
            f'<text x="32" y="15" font-size="17" fill="var(--text)" font-weight="600">{lbl}</text>'
            f'<text x="32" y="36" font-size="14" fill="var(--muted)">{_fmt(v)} · {pct:.0f}%</text>'
            f'</g>'
        )
    return f'<svg viewBox="0 0 880 520" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">{"".join(parts)}</svg>'


def _xy(chart: dict, kind: str) -> str:
    w, h = 1300, 540
    pad_l, pad_r, pad_t, pad_b = 80, 40, 30, 80
    plot_w = w - pad_l - pad_r
    plot_h = h - pad_t - pad_b

    series = chart.get("series") or []
    labels = chart.get("labels") or []
    all_vals = [v for s in series for v in (s.get("values") or [])]
    if not all_vals:
        return ""
    max_v = max(all_vals)
    min_v = min(0, min(all_vals))
    if max_v == min_v:
        max_v = min_v + 1
    rng = max_v - min_v
    n = len(labels) or max((len(s.get("values") or []) for s in series), default=1)

    def yscale(v):
        return pad_t + plot_h - (plot_h * (v - min_v) / rng)

    parts = []
    # Y grid + ticks
    for g in range(5):
        yy = pad_t + plot_h * g / 4
        val = max_v - rng * g / 4
        parts.append(
            f'<line x1="{pad_l}" y1="{yy:.1f}" x2="{w-pad_r}" y2="{yy:.1f}" '
            f'stroke="color-mix(in srgb, var(--muted) 18%, transparent)" stroke-width="1"/>'
            f'<text x="{pad_l-12}" y="{yy+5:.1f}" text-anchor="end" font-size="13" fill="var(--muted)">{_fmt(val)}</text>'
        )

    if kind in ("line", "area"):
        for si, s in enumerate(series):
            color = PALETTE[si % len(PALETTE)]
            vals = s.get("values") or []
            pts = []
            for i, v in enumerate(vals):
                x = pad_l + (plot_w * i / (max(n - 1, 1)))
                y = yscale(v)
                pts.append((x, y))
            if not pts:
                continue
            poly = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
            if kind == "area":
                area_pts = poly + f" {pts[-1][0]:.1f},{pad_t+plot_h:.1f} {pts[0][0]:.1f},{pad_t+plot_h:.1f}"
                parts.append(f'<polygon points="{area_pts}" fill="{color}" fill-opacity="0.18"/>')
            parts.append(f'<polyline points="{poly}" fill="none" stroke="{color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>')
            for x, y in pts:
                parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5" fill="{color}"/>')
    else:
        # bar
        group_w = plot_w / max(n, 1)
        scount = max(len(series), 1)
        bar_w = (group_w * 0.7) / scount
        for si, s in enumerate(series):
            color = PALETTE[si % len(PALETTE)]
            for i, v in enumerate(s.get("values") or []):
                x = pad_l + group_w * i + (group_w - bar_w * scount) / 2 + si * bar_w
                bh = (plot_h * (v - min_v) / rng)
                y = pad_t + plot_h - bh
                parts.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w-4:.1f}" height="{bh:.1f}" rx="3" fill="{color}"/>')
                if scount <= 2 and v != 0:
                    parts.append(f'<text x="{x + (bar_w-4)/2:.1f}" y="{y-8:.1f}" text-anchor="middle" font-size="13" fill="var(--text)" font-weight="600">{_fmt(v)}</text>')

    # X axis labels
    for i, lbl in enumerate(labels):
        if kind in ("line", "area"):
            xx = pad_l + (plot_w * i / max(n - 1, 1))
        else:
            group_w = plot_w / max(n, 1)
            xx = pad_l + group_w * i + group_w / 2
        parts.append(f'<text x="{xx:.1f}" y="{h-pad_b+24}" text-anchor="middle" font-size="14" fill="var(--muted)">{lbl}</text>')

    # Legend
    for si, s in enumerate(series):
        parts.append(
            f'<g transform="translate({pad_l + 8 + si*230}, {h-26})">'
            f'<rect width="14" height="14" rx="3" fill="{PALETTE[si % len(PALETTE)]}"/>'
            f'<text x="22" y="12" font-size="14" fill="var(--text)" font-weight="600">{s.get("name") or "Series"}</text>'
            f'</g>'
        )

    if chart.get("ylabel"):
        cy = pad_t + plot_h / 2
        parts.append(f'<text x="24" y="{cy:.1f}" transform="rotate(-90, 24, {cy:.1f})" text-anchor="middle" font-size="14" fill="var(--muted)">{chart["ylabel"]}</text>')

    return f'<svg viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">{"".join(parts)}</svg>'
