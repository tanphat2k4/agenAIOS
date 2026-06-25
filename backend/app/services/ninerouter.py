"""Thin client for the 9Router LLM gateway (OpenAI-compatible).

Talks to ``NINEROUTER_BASE_URL`` (default http://localhost:20128/v1). On the
local loopback 9Router needs no key; set ``NINEROUTER_API_KEY`` for remote use.
"""

import re

import httpx

from app.core.config import settings

_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)


def _headers() -> dict[str, str]:
    h = {"Content-Type": "application/json"}
    if settings.NINEROUTER_API_KEY:
        h["Authorization"] = f"Bearer {settings.NINEROUTER_API_KEY}"
    return h


def list_models() -> list[dict]:
    with httpx.Client(timeout=15) as cli:
        r = cli.get(f"{settings.NINEROUTER_BASE_URL}/models", headers=_headers())
        r.raise_for_status()
        return r.json().get("data", [])


def chat(
    messages: list[dict],
    model: str | None = None,
    *,
    temperature: float = 0.7,
    max_tokens: int | None = None,
) -> dict:
    """Run a chat completion. Returns {content, model, usage}."""
    payload: dict = {
        "model": model or settings.NINEROUTER_DEFAULT_MODEL,
        "messages": messages,
        "stream": False,
        "temperature": temperature,
    }
    if max_tokens:
        payload["max_tokens"] = max_tokens
    with httpx.Client(timeout=120) as cli:
        r = cli.post(
            f"{settings.NINEROUTER_BASE_URL}/chat/completions",
            json=payload,
            headers=_headers(),
        )
        r.raise_for_status()
        data = r.json()
    msg = (data.get("choices") or [{}])[0].get("message") or {}
    content = msg.get("content") or ""
    if not content:  # thinking models may put text in reasoning_content
        content = msg.get("reasoning_content") or ""
    content = _THINK_RE.sub("", content).strip()
    return {
        "content": content,
        "model": data.get("model"),
        "usage": data.get("usage", {}),
    }
