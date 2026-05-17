"""Runtime LLM configuration — persisted to disk, mutable from the UI.

Supports:
  - "ollama"     → http://localhost:11434  (native Ollama API)
  - "openai"     → any OpenAI-compatible HTTP endpoint
                   (LM Studio, vLLM, llama.cpp server, LocalAI, Ollama's /v1, etc.)

Everything stays local. No outbound calls unless the user points the
base URL at a remote endpoint themselves.
"""
from __future__ import annotations

import json
import os
import threading
from pathlib import Path

STORAGE = Path(__file__).parent / "storage"
STORAGE.mkdir(parents=True, exist_ok=True)
CONFIG_PATH = STORAGE / "config.json"


DEFAULTS = {
    "provider": "ollama",
    "base_url": "http://localhost:11434",
    "api_key": "",
    "default_model": "gpt-oss:120b-cloud",
    "outline_model": "",
    "timeout": 600,
}


_lock = threading.Lock()
_CONFIG: dict = {**DEFAULTS}


def _coerce(c: dict) -> dict:
    out = {**DEFAULTS}
    if not isinstance(c, dict):
        return out
    for k in DEFAULTS:
        if k in c and c[k] is not None:
            out[k] = c[k]
    # Normalize provider strings
    if out["provider"] not in ("ollama", "openai"):
        out["provider"] = "ollama"
    # Strip trailing slash on base URL
    out["base_url"] = str(out["base_url"] or "").rstrip("/")
    return out


def load() -> dict:
    global _CONFIG
    with _lock:
        if CONFIG_PATH.exists():
            try:
                _CONFIG = _coerce(json.loads(CONFIG_PATH.read_text("utf-8")))
            except Exception:
                _CONFIG = {**DEFAULTS}
        else:
            _CONFIG = {**DEFAULTS}
        # Env-var overrides win on first load
        if os.environ.get("PF_PROVIDER"):
            _CONFIG["provider"] = os.environ["PF_PROVIDER"]
        if os.environ.get("OLLAMA_URL"):
            _CONFIG["base_url"] = os.environ["OLLAMA_URL"].rstrip("/")
        if os.environ.get("PF_API_KEY"):
            _CONFIG["api_key"] = os.environ["PF_API_KEY"]
        if os.environ.get("PF_MODEL"):
            _CONFIG["default_model"] = os.environ["PF_MODEL"]
    return get()


def get() -> dict:
    with _lock:
        # Never leak the api key to consumers that don't ask for it explicitly
        return dict(_CONFIG)


def get_public() -> dict:
    """Same as get() but without the secret key."""
    c = get()
    c["api_key_set"] = bool(c.get("api_key"))
    c.pop("api_key", None)
    return c


def update(patch: dict) -> dict:
    global _CONFIG
    with _lock:
        merged = _coerce({**_CONFIG, **(patch or {})})
        _CONFIG = merged
        try:
            CONFIG_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass
    return get_public()


# Load at import time
load()
