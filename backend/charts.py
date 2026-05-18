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
        return _donut(chart, hole=True)
    if ctype == "pie":
        return _donut(chart, hole=False)
    if ctype == "line":
        return _xy(chart, "line")
    if ctype == "area":
        return _xy(chart, "area")
    if ctype in ("stacked-bar", "stacked"):
        return _stacked_bar(chart)
    if ctype in ("horizontal-bar", "hbar"):
        return _horizontal_bar(chart)
    if ctype == "waterfall":
        return _waterfall(chart)
    if ctype == "funnel":
        return _funnel(chart)
    if ctype == "gauge":
        return _gauge(chart)
    return _xy(chart, "bar")


def _donut(chart: dict, hole: bool = True) -> str:
    series = chart.get("series") or []
    if not series:
        return ""
    values = series[0].get("values") or []
    labels = chart.get("labels") or [f"#{i+1}" for i in range(len(values))]
    total = sum(values) or 1
    cx, cy, r = 280, 260, 180
    ir = 100 if hole else 0
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
    # Center label only when there's a hole (donut), not for solid pie
    if hole:
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


# ---------- Stacked bar ----------

def _stacked_bar(chart: dict) -> str:
    w, h = 1300, 540
    pad_l, pad_r, pad_t, pad_b = 80, 40, 30, 80
    plot_w, plot_h = w - pad_l - pad_r, h - pad_t - pad_b
    series = chart.get("series") or []
    labels = chart.get("labels") or []
    n = len(labels)
    if not series or not n:
        return ""
    totals = [sum((s.get("values") or [0]*n)[i] for s in series) for i in range(n)]
    max_v = max(totals) if totals else 1
    rng = max_v or 1

    parts = []
    for g in range(5):
        yy = pad_t + plot_h * g / 4
        val = max_v - rng * g / 4
        parts.append(f'<line x1="{pad_l}" y1="{yy:.1f}" x2="{w-pad_r}" y2="{yy:.1f}" stroke="color-mix(in srgb, var(--muted) 18%, transparent)" stroke-width="1"/>')
        parts.append(f'<text x="{pad_l-12}" y="{yy+5:.1f}" text-anchor="end" font-size="13" fill="var(--muted)">{_fmt(val)}</text>')

    group_w = plot_w / n
    bar_w = group_w * 0.65
    for i, lbl in enumerate(labels):
        x = pad_l + group_w * i + (group_w - bar_w) / 2
        cum = 0
        for si, s in enumerate(series):
            v = (s.get("values") or [0]*n)[i] if i < len(s.get("values") or []) else 0
            bh = plot_h * v / rng
            y = pad_t + plot_h - cum - bh
            parts.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w:.1f}" height="{bh:.1f}" rx="2" fill="{PALETTE[si % len(PALETTE)]}"/>')
            cum += bh
        parts.append(f'<text x="{x + bar_w/2:.1f}" y="{h-pad_b+24}" text-anchor="middle" font-size="14" fill="var(--muted)">{lbl}</text>')

    for si, s in enumerate(series):
        parts.append(
            f'<g transform="translate({pad_l + 8 + si*200}, {h-26})">'
            f'<rect width="14" height="14" rx="3" fill="{PALETTE[si % len(PALETTE)]}"/>'
            f'<text x="22" y="12" font-size="14" fill="var(--text)" font-weight="600">{s.get("name") or "Series"}</text>'
            f'</g>'
        )
    return f'<svg viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">{"".join(parts)}</svg>'


# ---------- Horizontal bar (good for rankings) ----------

def _horizontal_bar(chart: dict) -> str:
    w, h = 1300, 540
    pad_l, pad_r, pad_t, pad_b = 240, 60, 30, 30
    plot_w, plot_h = w - pad_l - pad_r, h - pad_t - pad_b
    series = (chart.get("series") or [{}])
    labels = chart.get("labels") or []
    vals = (series[0].get("values") or []) if series else []
    n = len(labels)
    if not n:
        return ""
    max_v = max(vals) if vals else 1
    rng = max_v or 1
    row_h = plot_h / n
    bar_h = min(row_h * 0.72, 48)

    parts = []
    for i, lbl in enumerate(labels):
        v = vals[i] if i < len(vals) else 0
        y = pad_t + row_h * i + (row_h - bar_h) / 2
        bw = plot_w * v / rng
        parts.append(f'<text x="{pad_l-14}" y="{y + bar_h/2 + 6:.1f}" text-anchor="end" font-size="16" fill="var(--text)" font-weight="600">{lbl}</text>')
        parts.append(f'<rect x="{pad_l}" y="{y:.1f}" width="{bw:.1f}" height="{bar_h:.1f}" rx="6" fill="{PALETTE[i % len(PALETTE)]}"/>')
        parts.append(f'<text x="{pad_l + bw + 10:.1f}" y="{y + bar_h/2 + 6:.1f}" font-size="15" fill="var(--text)" font-weight="700">{_fmt(v)}</text>')
    return f'<svg viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">{"".join(parts)}</svg>'


# ---------- Waterfall (financial bridge) ----------

def _waterfall(chart: dict) -> str:
    w, h = 1300, 540
    pad_l, pad_r, pad_t, pad_b = 80, 40, 30, 80
    plot_w, plot_h = w - pad_l - pad_r, h - pad_t - pad_b
    series = chart.get("series") or [{}]
    labels = chart.get("labels") or []
    vals = (series[0].get("values") or [])
    n = len(labels)
    if not n:
        return ""

    cum = [0]
    for v in vals:
        cum.append(cum[-1] + v)
    # Make last bar absolute (total)
    show_total = chart.get("show_total", True)

    all_y = cum + [0]
    max_v = max(all_y)
    min_v = min(all_y)
    if max_v == min_v:
        max_v = min_v + 1
    rng = max_v - min_v

    def yscale(v):
        return pad_t + plot_h - (plot_h * (v - min_v) / rng)

    parts = []
    for g in range(5):
        yy = pad_t + plot_h * g / 4
        val = max_v - rng * g / 4
        parts.append(f'<line x1="{pad_l}" y1="{yy:.1f}" x2="{w-pad_r}" y2="{yy:.1f}" stroke="color-mix(in srgb, var(--muted) 15%, transparent)" stroke-width="1"/>')
        parts.append(f'<text x="{pad_l-12}" y="{yy+5:.1f}" text-anchor="end" font-size="13" fill="var(--muted)">{_fmt(val)}</text>')

    group_w = plot_w / n
    bar_w = group_w * 0.65
    POS, NEG, TOTAL = "#10B981", "#EF4444", "var(--primary)"
    for i, v in enumerate(vals):
        x = pad_l + group_w * i + (group_w - bar_w) / 2
        is_total = (i == n - 1) and show_total
        if is_total:
            y_top = yscale(cum[-1])
            y_bot = yscale(0)
            color = TOTAL
            label_v = cum[-1]
        else:
            start = cum[i]
            end = cum[i+1]
            y_top = yscale(max(start, end))
            y_bot = yscale(min(start, end))
            color = POS if v >= 0 else NEG
            label_v = v
        parts.append(f'<rect x="{x:.1f}" y="{y_top:.1f}" width="{bar_w:.1f}" height="{(y_bot-y_top):.1f}" rx="2" fill="{color}"/>')
        parts.append(f'<text x="{x + bar_w/2:.1f}" y="{y_top - 8:.1f}" text-anchor="middle" font-size="13" fill="var(--text)" font-weight="700">{("+" if (label_v > 0 and not is_total) else "")}{_fmt(label_v)}</text>')
        # Connector line to next
        if i < n - 1:
            y_conn = yscale(cum[i+1])
            parts.append(f'<line x1="{x + bar_w:.1f}" y1="{y_conn:.1f}" x2="{x + group_w:.1f}" y2="{y_conn:.1f}" stroke="color-mix(in srgb, var(--muted) 40%, transparent)" stroke-width="1.5" stroke-dasharray="4 3"/>')
        parts.append(f'<text x="{x + bar_w/2:.1f}" y="{h-pad_b+24}" text-anchor="middle" font-size="14" fill="var(--muted)">{labels[i]}</text>')
    return f'<svg viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">{"".join(parts)}</svg>'


# ---------- Funnel (conversion stages) ----------

def _funnel(chart: dict) -> str:
    w, h = 1300, 540
    pad_t, pad_b = 30, 30
    series = chart.get("series") or [{}]
    labels = chart.get("labels") or []
    vals = series[0].get("values") or []
    n = min(len(labels), len(vals))
    if not n:
        return ""

    max_v = max(vals) or 1
    stage_h = (h - pad_t - pad_b) / n
    center = w / 2
    max_half = (w * 0.7) / 2

    parts = []
    for i in range(n):
        v_top = vals[i]
        v_bot = vals[i+1] if i+1 < n else max(v_top * 0.55, 0.1)
        y_top = pad_t + stage_h * i
        y_bot = y_top + stage_h - 12
        half_top = max_half * (v_top / max_v)
        half_bot = max_half * (v_bot / max_v)
        # Trapezoid
        points = f"{center-half_top:.1f},{y_top:.1f} {center+half_top:.1f},{y_top:.1f} {center+half_bot:.1f},{y_bot:.1f} {center-half_bot:.1f},{y_bot:.1f}"
        color = PALETTE[i % len(PALETTE)]
        parts.append(f'<polygon points="{points}" fill="{color}" fill-opacity="0.92"/>')
        # Stage label inside
        parts.append(f'<text x="{center:.1f}" y="{y_top + stage_h/2 - 4:.1f}" text-anchor="middle" font-size="17" font-weight="700" fill="white">{labels[i]}</text>')
        parts.append(f'<text x="{center:.1f}" y="{y_top + stage_h/2 + 18:.1f}" text-anchor="middle" font-size="15" fill="white" fill-opacity=".85">{_fmt(v_top)}</text>')
        # Conversion rate to next
        if i+1 < n and v_top:
            rate = (vals[i+1] / v_top) * 100
            parts.append(f'<text x="{center + max_half + 30:.1f}" y="{y_top + stage_h/2 + 6:.1f}" font-size="14" fill="var(--muted)" font-weight="600">→ {rate:.0f}% conv.</text>')
    return f'<svg viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">{"".join(parts)}</svg>'


# ---------- Gauge (single KPI dial) ----------

def _gauge(chart: dict) -> str:
    w, h = 700, 460
    series = chart.get("series") or [{}]
    vals = series[0].get("values") or [0]
    value = vals[0] if vals else 0
    target = chart.get("max", chart.get("target", 100))
    label = chart.get("ylabel") or (chart.get("labels") or [""])[0]
    cx, cy, r = w/2, h*0.72, 200
    pct = max(0, min(1, value / target if target else 0))

    # Semicircle from 180° to 0° (left to right at top)
    import math as _m
    start_a = _m.pi  # 180°
    end_a = 0
    cur_a = start_a - (start_a - end_a) * pct

    def pt(a, rad):
        return (cx + rad * _m.cos(a), cy - rad * _m.sin(a))

    parts = []
    # Background arc
    x1, y1 = pt(start_a, r); x2, y2 = pt(end_a, r)
    parts.append(f'<path d="M {x1:.1f} {y1:.1f} A {r} {r} 0 0 1 {x2:.1f} {y2:.1f}" stroke="color-mix(in srgb, var(--muted) 22%, transparent)" stroke-width="34" fill="none" stroke-linecap="round"/>')
    # Value arc
    xc, yc = pt(cur_a, r)
    large = 1 if pct > 0.5 else 0
    color = PALETTE[0]
    if pct >= 0.85: color = "#10B981"
    elif pct >= 0.5: color = "#F59E0B"
    else: color = "#EF4444"
    parts.append(f'<path d="M {x1:.1f} {y1:.1f} A {r} {r} 0 {large} 1 {xc:.1f} {yc:.1f}" stroke="{color}" stroke-width="34" fill="none" stroke-linecap="round"/>')
    # Center text
    parts.append(f'<text x="{cx:.1f}" y="{cy-20:.1f}" text-anchor="middle" font-size="76" font-weight="800" fill="var(--text)">{_fmt(value)}</text>')
    if label:
        parts.append(f'<text x="{cx:.1f}" y="{cy+22:.1f}" text-anchor="middle" font-size="20" fill="var(--muted)">{label}</text>')
    parts.append(f'<text x="{cx - r + 12:.1f}" y="{cy + 30:.1f}" font-size="13" fill="var(--muted)">0</text>')
    parts.append(f'<text x="{cx + r - 12:.1f}" y="{cy + 30:.1f}" text-anchor="end" font-size="13" fill="var(--muted)">{_fmt(target)}</text>')
    return f'<svg viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">{"".join(parts)}</svg>'
