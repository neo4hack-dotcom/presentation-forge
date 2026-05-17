"""LLM client — supports Ollama (native API) and any OpenAI-compatible HTTP endpoint.

The provider, base URL, API key, and default model are read from `backend.config`.
That config is mutable at runtime via the Settings UI and persisted to disk.
"""
from __future__ import annotations

import json
import re
from typing import AsyncIterator, Optional

import httpx

from . import config as cfg


class LLMError(RuntimeError):
    pass


# ---------- Provider detection ----------

def _resolve(model: Optional[str], override: Optional[dict] = None) -> dict:
    c = override or cfg.get()
    return {
        "provider": c.get("provider", "ollama"),
        "base_url": (c.get("base_url") or "").rstrip("/"),
        "api_key": c.get("api_key") or "",
        "model": model or c.get("default_model") or "",
        "timeout": c.get("timeout") or 600,
    }


def _auth_headers(api_key: str) -> dict:
    if not api_key:
        return {}
    return {"Authorization": f"Bearer {api_key}"}


# ---------- Listing models ----------

async def list_models(override: Optional[dict] = None) -> list[dict]:
    """Return [{"name": "...", ...}] regardless of provider."""
    r = _resolve(None, override)
    timeout = r["timeout"]
    async with httpx.AsyncClient(timeout=10) as client:
        if r["provider"] == "ollama":
            url = f"{r['base_url']}/api/tags"
            resp = await client.get(url, headers=_auth_headers(r["api_key"]))
            resp.raise_for_status()
            return resp.json().get("models", [])
        # OpenAI-compatible
        url = f"{r['base_url']}/v1/models"
        resp = await client.get(url, headers=_auth_headers(r["api_key"]))
        if resp.status_code == 404:
            # Some servers expose /models without /v1
            resp = await client.get(f"{r['base_url']}/models", headers=_auth_headers(r["api_key"]))
        resp.raise_for_status()
        data = resp.json()
        items = data.get("data") if isinstance(data, dict) else data
        out = []
        for m in items or []:
            if isinstance(m, str):
                out.append({"name": m})
            elif isinstance(m, dict):
                out.append({"name": m.get("id") or m.get("name") or "unknown", **m})
        return out


# ---------- Single-shot chat ----------

async def chat(
    messages: list[dict],
    model: Optional[str] = None,
    temperature: float = 0.4,
    json_mode: bool = False,
    timeout: float | None = None,
    override: Optional[dict] = None,
) -> str:
    r = _resolve(model, override)
    timeout = timeout or r["timeout"]
    headers = {"Content-Type": "application/json", **_auth_headers(r["api_key"])}

    async with httpx.AsyncClient(timeout=timeout) as client:
        if r["provider"] == "ollama":
            payload = {
                "model": r["model"],
                "messages": messages,
                "stream": False,
                "options": {"temperature": temperature},
            }
            if json_mode:
                payload["format"] = "json"
            resp = await client.post(f"{r['base_url']}/api/chat", json=payload, headers=headers)
            if resp.status_code >= 400:
                raise LLMError(f"Ollama {resp.status_code}: {resp.text[:400]}")
            data = resp.json()
            return data["message"]["content"]

        # OpenAI-compatible
        payload: dict = {
            "model": r["model"],
            "messages": messages,
            "temperature": temperature,
            "stream": False,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        resp = await client.post(f"{r['base_url']}/v1/chat/completions", json=payload, headers=headers)
        if resp.status_code >= 400:
            raise LLMError(f"OpenAI-compat {resp.status_code}: {resp.text[:400]}")
        data = resp.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            return data.get("content") or json.dumps(data)


# ---------- Streaming chat ----------

async def chat_stream(
    messages: list[dict],
    model: Optional[str] = None,
    temperature: float = 0.4,
    timeout: float | None = None,
    override: Optional[dict] = None,
) -> AsyncIterator[str]:
    r = _resolve(model, override)
    timeout = timeout or r["timeout"]
    headers = {"Content-Type": "application/json", **_auth_headers(r["api_key"])}

    async with httpx.AsyncClient(timeout=timeout) as client:
        if r["provider"] == "ollama":
            payload = {
                "model": r["model"],
                "messages": messages,
                "stream": True,
                "options": {"temperature": temperature},
            }
            async with client.stream("POST", f"{r['base_url']}/api/chat", json=payload, headers=headers) as resp:
                if resp.status_code >= 400:
                    body = await resp.aread()
                    raise LLMError(f"Ollama {resp.status_code}: {body[:400]!r}")
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    chunk = obj.get("message", {}).get("content", "")
                    if chunk:
                        yield chunk
                    if obj.get("done"):
                        break
            return

        # OpenAI-compatible SSE
        payload = {
            "model": r["model"],
            "messages": messages,
            "temperature": temperature,
            "stream": True,
        }
        async with client.stream("POST", f"{r['base_url']}/v1/chat/completions", json=payload, headers=headers) as resp:
            if resp.status_code >= 400:
                body = await resp.aread()
                raise LLMError(f"OpenAI-compat {resp.status_code}: {body[:400]!r}")
            async for line in resp.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                raw = line[5:].strip()
                if raw == "[DONE]":
                    break
                try:
                    obj = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                try:
                    delta = obj["choices"][0].get("delta") or {}
                    chunk = delta.get("content") or ""
                except Exception:
                    chunk = ""
                if chunk:
                    yield chunk


# ---------- JSON extraction ----------

_JSON_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.S)


def extract_json(text: str):
    text = text.strip()
    m = _JSON_FENCE.search(text)
    if m:
        text = m.group(1).strip()
    for opener, closer in (("{", "}"), ("[", "]")):
        i = text.find(opener)
        if i == -1:
            continue
        depth = 0
        in_str = False
        esc = False
        for j in range(i, len(text)):
            c = text[j]
            if esc:
                esc = False
                continue
            if c == "\\":
                esc = True
                continue
            if c == '"':
                in_str = not in_str
                continue
            if in_str:
                continue
            if c == opener:
                depth += 1
            elif c == closer:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[i : j + 1])
                    except json.JSONDecodeError:
                        break
    return json.loads(text)


async def chat_json(
    messages: list[dict],
    model: Optional[str] = None,
    temperature: float = 0.3,
    retries: int = 2,
    override: Optional[dict] = None,
):
    last_err: Optional[Exception] = None
    for _ in range(retries + 1):
        try:
            raw = await chat(messages, model=model, temperature=temperature, json_mode=True, override=override)
            return extract_json(raw)
        except (json.JSONDecodeError, LLMError) as e:
            last_err = e
            messages = messages + [
                {"role": "user", "content": f"Your last reply could not be parsed as JSON: {e}. Reply ONLY with valid JSON, no prose."}
            ]
    raise LLMError(f"chat_json failed after {retries+1} attempts: {last_err}")


# ---------- Connection test ----------

async def test_connection(override: dict) -> dict:
    """Return {ok: bool, error?: str, sample?: str} — does NOT mutate persistent config."""
    try:
        models = await list_models(override=override)
        # Optional: ping-test a tiny chat if a default model is set
        sample = None
        model = override.get("default_model") or (models[0]["name"] if models else None)
        if model:
            try:
                r = await chat(
                    [{"role": "user", "content": "Reply with the single word OK."}],
                    model=model,
                    temperature=0,
                    timeout=30,
                    override=override,
                )
                sample = (r or "").strip()[:60]
            except Exception as e:
                return {"ok": False, "error": f"Models reachable but chat failed: {e}", "models": [m['name'] for m in models]}
        return {"ok": True, "n_models": len(models), "models": [m["name"] for m in models], "sample": sample}
    except Exception as e:
        return {"ok": False, "error": str(e)}
