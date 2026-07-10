"""Thin client for the 9Router LLM gateway (OpenAI-compatible).

Talks to ``NINEROUTER_BASE_URL`` (default http://localhost:20128/v1). On the
local loopback 9Router needs no key; set ``NINEROUTER_API_KEY`` for remote use.
"""

import re

import httpx

from app.core.config import settings

_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)

# Reasoning models (fast-chat now routes to deepseek-v4-pro) burn completion tokens on hidden
# "thinking" BEFORE the visible answer — observed ~350 reasoning tokens on a 5-sentence ask,
# which ate a caller's max_tokens=380 whole → content came back empty/truncated ("(trống)" in
# the metals/trading agents). Callers mean max_tokens as the ANSWER budget, so reserve extra
# room for the thinking phase on top of it (prompts still bound the visible length).
_REASONING_RESERVE = 1600


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
        payload["max_tokens"] = max_tokens + _REASONING_RESERVE

    def _once() -> tuple[str, dict]:
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
        return _THINK_RE.sub("", content).strip(), data

    content, data = _once()
    if not content and payload.get("max_tokens"):
        # reasoning length varies wildly run-to-run — a spike can still eat the whole
        # budget (finish=length, empty answer). One retry with a much bigger ceiling.
        payload["max_tokens"] += 4000
        content, data = _once()
    return {
        "content": content,
        "model": data.get("model"),
        "usage": data.get("usage", {}),
    }
