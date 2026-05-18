"""Brand kits — persisted palette + logo + footer + visual-identity settings.

A brand kit captures everything style-related from a theme so the user can
reuse it across multiple decks. Stored as JSON files under storage/brands/.
"""
from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Optional


# Fields we persist from the theme. We deliberately drop ephemeral state.
BRAND_FIELDS = (
    "primary", "secondary", "accent",
    "background", "surface", "text", "muted",
    "heading_font", "body_font", "mono_font",
    "logo", "footer", "template", "dark",
    "cover_style", "divider_style", "accent_shape", "index_style",
)


def theme_to_brand(theme: dict) -> dict:
    return {k: theme[k] for k in BRAND_FIELDS if k in theme and theme[k] is not None}


def brand_to_theme_patch(brand: dict) -> dict:
    return {k: brand[k] for k in BRAND_FIELDS if k in brand}


def list_brands(storage: Path) -> list[dict]:
    storage.mkdir(parents=True, exist_ok=True)
    items = []
    for f in sorted(storage.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            d = json.loads(f.read_text("utf-8"))
            items.append({
                "id": d.get("id", f.stem),
                "name": d.get("name", f.stem),
                "primary": d.get("primary"),
                "secondary": d.get("secondary"),
                "accent": d.get("accent"),
                "logo": d.get("logo"),
                "dark": d.get("dark", False),
                "updated_at": f.stat().st_mtime,
            })
        except Exception:
            continue
    return items


def get_brand(storage: Path, bid: str) -> Optional[dict]:
    f = storage / f"{bid}.json"
    if not f.exists():
        return None
    return json.loads(f.read_text("utf-8"))


def save_brand(storage: Path, brand: dict) -> dict:
    storage.mkdir(parents=True, exist_ok=True)
    bid = brand.get("id") or uuid.uuid4().hex[:12]
    name = brand.get("name") or "Untitled brand"
    f = storage / f"{bid}.json"
    payload = {**brand, "id": bid, "name": name, "updated_at": time.time()}
    # Keep only known fields + id/name/updated_at
    keep = set(BRAND_FIELDS) | {"id", "name", "updated_at"}
    payload = {k: v for k, v in payload.items() if k in keep}
    f.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload


def delete_brand(storage: Path, bid: str) -> bool:
    f = storage / f"{bid}.json"
    if f.exists():
        f.unlink()
        return True
    return False
