"""Film cockpit — proxy the ArcReel film engine + keep a light mirror row per film.

AgentAIOS holds one arc- API key (backend/.env) and acts for the signed-in user;
ArcReel does the heavy GPU pipeline. See app/services/arcreel_client.py + docs.
"""
import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.crud import get_or_404, next_sort, uid
from app.models.film import Film
from app.models.user import User
from app.serialize import row_to_dict, rows_to_list
from app.services import arcreel_client
from app.services.arcreel_client import ArcReelError

router = APIRouter(prefix="/films", tags=["films"], dependencies=[Depends(get_current_user)])

# ArcReel default local backends (ComfyUI on the GPU box). Held server-side.
_DEFAULTS = {
    "image_backend": "comfyui/flux2_dev_fp8mixed.safetensors",
    "video_backend": "comfyui/ltx-2.3-22b-distilled-Q5_K_M.gguf",
}
_REVIEW_STAGES = {"awaiting_script_review", "awaiting_asset_review", "awaiting_review", "awaiting_video_review"}


def _status_of(stage: str) -> str:
    if stage == "done":
        return "done"
    if stage in ("error", "cancelled"):
        return "error"
    if stage in _REVIEW_STAGES:
        return "needs_review"
    if stage in ("", "queued"):
        return "queued"
    return "running"


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def _sync(db: Session, f: Film) -> dict:
    """Refresh the mirror row from ArcReel + return serialized row plus live fields."""
    if not f.arcTaskId:
        return {**row_to_dict(f), "progress": [], "review": None}
    try:
        st = arcreel_client.film_status(f.arcTaskId)
    except ArcReelError:
        return {**row_to_dict(f), "progress": [], "review": None, "offline": True}
    f.stage = st.get("stage", f.stage)
    f.status = _status_of(f.stage)
    f.projectSlug = st.get("project_name") or f.projectSlug
    f.publicUrl = st.get("public_url") or f.publicUrl
    f.errorMessage = st.get("error") or ""
    f.updatedAt = _now()
    db.commit()
    return {
        **row_to_dict(f),
        "progress": st.get("progress", []),
        "subStage": st.get("sub_stage"),
        "review": st.get("review"),
        "scriptSegments": st.get("script_segments"),
        "elapsedSeconds": st.get("elapsed_seconds"),
    }


class FilmCreate(BaseModel):
    title: str = ""
    novel: str
    aspectRatio: str = "9:16"
    contentMode: str = "narration"
    channelId: str = ""


class ApproveBody(BaseModel):
    selections: dict[str, int] | None = None


@router.get("")
def list_films(db: Session = Depends(get_db)):
    for f in db.scalars(select(Film).order_by(Film.sort.desc())):
        if f.arcTaskId and f.status not in ("done", "error"):
            try:
                _sync(db, f)
            except Exception:  # noqa: BLE001
                pass
    return rows_to_list(db.scalars(select(Film).order_by(Film.sort.desc())))


@router.post("", status_code=201)
def create_film(body: FilmCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    novel = (body.novel or "").strip()
    if not novel:
        raise HTTPException(status_code=400, detail="Thiếu nội dung truyện")
    title = (body.title or "").strip() or novel.splitlines()[0][:60]
    payload = {
        "novel_text": novel,
        "title": title,
        "content_mode": body.contentMode,
        "aspect_ratio": body.aspectRatio,
        "review_before_storyboard": True,
        "review_before_video": True,
        "review_before_compose": True,
        **_DEFAULTS,
    }
    try:
        res = arcreel_client.run_film(payload)
    except ArcReelError as exc:
        raise HTTPException(status_code=503, detail=f"ArcReel không phản hồi: {exc}") from exc
    f = Film(
        id=uid("film"),
        title=title,
        arcTaskId=res.get("task_id", ""),
        stage=res.get("stage", "queued"),
        status=_status_of(res.get("stage", "queued")),
        aspectRatio=body.aspectRatio,
        contentMode=body.contentMode,
        channelId=body.channelId,
        createdBy=current.id,
        createdAt=_now(),
        updatedAt=_now(),
        sort=next_sort(db, Film),
    )
    db.add(f)
    db.commit()
    return _sync(db, f)


@router.get("/{film_id}")
def get_film(film_id: str, db: Session = Depends(get_db)):
    return _sync(db, get_or_404(db, Film, film_id))


@router.post("/{film_id}/approve")
def approve_film(film_id: str, body: ApproveBody | None = None, db: Session = Depends(get_db)):
    f = get_or_404(db, Film, film_id)
    try:
        arcreel_client.approve_film(f.arcTaskId, body.selections if body else None)
    except ArcReelError as exc:
        raise HTTPException(status_code=503, detail=f"ArcReel không phản hồi: {exc}") from exc
    return _sync(db, f)


@router.post("/{film_id}/cancel")
def cancel_film(film_id: str, db: Session = Depends(get_db)):
    f = get_or_404(db, Film, film_id)
    try:
        arcreel_client.cancel_film(f.arcTaskId)
    except ArcReelError:
        pass
    f.stage, f.status, f.errorMessage, f.updatedAt = "cancelled", "error", "Đã hủy", _now()
    db.commit()
    return row_to_dict(f)


@router.delete("/{film_id}")
def delete_film(film_id: str, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, Film, film_id))
    db.commit()
    return {"detail": "deleted"}


@router.get("/{film_id}/video")
def film_video(film_id: str, db: Session = Depends(get_db)):
    f = get_or_404(db, Film, film_id)
    try:
        st = arcreel_client.film_status(f.arcTaskId)
    except ArcReelError as exc:
        raise HTTPException(status_code=503, detail=f"ArcReel không phản hồi: {exc}") from exc
    path = st.get("output_path") or ""
    if path and not os.path.isabs(path):
        path = os.path.join(settings.ARCREEL_DIR, path)
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Phim chưa sẵn sàng")
    return FileResponse(path, media_type="video/mp4", filename=f"{f.title or 'film'}.mp4")
