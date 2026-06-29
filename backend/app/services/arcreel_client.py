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


def regenerate_film(task_id: str, scene_ids: list, instructions: dict | None = None, mode: str = "edit") -> dict:
    """POST /film/run/{id}/regenerate — re-render scenes at the current review gate."""
    return _req("POST", f"/api/v1/film/run/{task_id}/regenerate",
                json={"scene_ids": scene_ids, "instructions": instructions, "mode": mode}, timeout=60.0)


def pick_variant(task_id: str, scene_id: str, variant: int) -> dict:
    """POST /film/run/{id}/pick — pick a video variant for a scene (video gate)."""
    return _req("POST", f"/api/v1/film/run/{task_id}/pick",
                json={"scene_id": scene_id, "variant": variant}, timeout=30.0)


def regenerate_asset(task_id: str, kind: str, name: str) -> dict:
    """POST /film/run/{id}/regenerate-asset — re-render one character/scene/prop sheet."""
    return _req("POST", f"/api/v1/film/run/{task_id}/regenerate-asset",
                json={"asset_kind": kind, "asset_name": name}, timeout=60.0)


def retry_videos(task_id: str) -> dict:
    """POST /film/run/{id}/retry-videos — re-render only the missing/failed clips."""
    return _req("POST", f"/api/v1/film/run/{task_id}/retry-videos", timeout=60.0)


def recompose(task_id: str, selections: dict | None = None) -> dict:
    """POST /film/run/{id}/recompose — re-run ffmpeg with new variant picks (no re-gen)."""
    return _req("POST", f"/api/v1/film/run/{task_id}/recompose", json={"selections": selections}, timeout=120.0)


def scene_ok(task_id: str, scene_id: str) -> dict:
    """POST /film/run/{id}/scene-ok — accept one storyboard scene (accumulates → auto-resume)."""
    return _req("POST", f"/api/v1/film/run/{task_id}/scene-ok", json={"scene_id": scene_id}, timeout=30.0)


def asset_ok(task_id: str, kind: str, name: str) -> dict:
    """POST /film/run/{id}/asset-ok — accept one asset sheet (accumulates)."""
    return _req("POST", f"/api/v1/film/run/{task_id}/asset-ok", json={"kind": kind, "name": name}, timeout=30.0)


def film_usage(project_slug: str, group_by: str | None = None) -> dict:
    """GET /usage/stats?project_name= — actual cost/usage for a film's project (optional group_by=provider)."""
    q = f"?project_name={project_slug}" + (f"&group_by={group_by}" if group_by else "")
    return _req("GET", "/api/v1/usage/stats" + q, timeout=30.0)


def cost_estimate(project_slug: str) -> dict:
    """GET /projects/{slug}/cost-estimate — estimate↔actual drill-down (episode/segment/asset-type)."""
    return _req("GET", f"/api/v1/projects/{project_slug}/cost-estimate", timeout=45.0)
