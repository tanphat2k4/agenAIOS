"""Small shared helpers used across routers."""

import time
import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session


def uid(prefix: str = "") -> str:
    """Frontend-style short id, e.g. uid('ag') -> 'ag1f3c9b2a'."""
    return prefix + uuid.uuid4().hex[:8]


def now_hm() -> str:
    """Current HH:MM, matching the prototype's message timestamps."""
    d = datetime.now()
    return f"{d.hour:02d}:{d.minute:02d}"


def today_ymd() -> str:
    """Current local date as YYYY-MM-DD — lets the UI group workflow runs by day."""
    return datetime.now().strftime("%Y-%m-%d")


def prune_old_logs(db: Session, model) -> int:
    """Retention: drop rows older than LOG_RETENTION_DAYS (model needs a created_at epoch column).

    Rows with created_at == 0 (pre-migration placeholder) are left alone.
    Called lazily from the list endpoints, mirroring the chat auto-delete pattern.
    """
    from app.core.config import settings  # local import: keep crud free of config at import time

    cutoff = int(time.time()) - settings.LOG_RETENTION_DAYS * 86400
    n = db.execute(delete(model).where(model.created_at > 0, model.created_at < cutoff)).rowcount
    if n:
        db.commit()
    return n or 0


def get_or_404(db: Session, model, obj_id):
    obj = db.get(model, obj_id)
    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"{model.__name__} không tồn tại"
        )
    return obj


def next_sort(db: Session, model) -> int:
    current = db.scalar(select(func.max(model.sort)))
    return (current or 0) + 1


def list_ordered(db: Session, model):
    return db.scalars(select(model).order_by(model.sort, model.id)).all()


def apply_updates(obj, data: dict, allowed: set[str] | None = None) -> None:
    for key, value in data.items():
        if allowed is not None and key not in allowed:
            continue
        if hasattr(obj, key):
            setattr(obj, key, value)
