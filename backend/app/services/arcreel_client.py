"""Thin HTTP client for the ArcReel film engine (separate service on :1242).

AgentAIOS is the cockpit; ArcReel is the engine. We never embed its code — we only
call its REST API with the server-held arc- API key (backend/.env). ArcReel runs the
heavy GPU pipeline (ComfyUI / LLM / ffmpeg) and persists its own state.
"""
from __future__ import annotations

import httpx

from app.core.config import settings


class ArcReelError(RuntimeError):
    """ArcReel is unreachable or returned an HTTP error."""


def _base() -> str:
    return settings.ARCREEL_BASE_URL.rstrip("/")


def _headers() -> dict:
    return {"Authorization": f"Bearer {settings.ARCREEL_API_KEY}", "Accept-Language": "vi"}


def _req(method: str, path: str, *, json: dict | None = None, timeout: float = 30.0):
    try:
        with httpx.Client(base_url=_base(), headers=_headers(), timeout=timeout) as c:
            r = c.request(method, path, json=json)
            r.raise_for_status()
            return r.json() if r.content else {}
    except httpx.HTTPError as exc:  # noqa: BLE001
        raise ArcReelError(str(exc)) from exc


def run_film(payload: dict) -> dict:
    """POST /film/run — start novel→mp4. Returns {task_id, stage, created_at, deduplicated}."""
    return _req("POST", "/api/v1/film/run", json=payload, timeout=60.0)


def film_status(task_id: str) -> dict:
    """GET /film/run/{id} — poll the state machine (stage, progress, review, public_url...)."""
    return _req("GET", f"/api/v1/film/run/{task_id}")


def approve_film(task_id: str, selections: dict | None = None) -> dict:
    """POST /film/run/{id}/approve — pass the current gate; selections = video-variant pick."""
    return _req("POST", f"/api/v1/film/run/{task_id}/approve", json={"selections": selections or {}}, timeout=60.0)


def cancel_film(task_id: str) -> dict:
    """POST /film/run/{id}/cancel — stop the run."""
    return _req("POST", f"/api/v1/film/run/{task_id}/cancel", timeout=30.0)
