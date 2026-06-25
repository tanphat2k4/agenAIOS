"""Small shared helpers used across routers."""

import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session


def uid(prefix: str = "") -> str:
    """Frontend-style short id, e.g. uid('ag') -> 'ag1f3c9b2a'."""
    return prefix + uuid.uuid4().hex[:8]


def now_hm() -> str:
    """Current HH:MM, matching the prototype's message timestamps."""
    d = datetime.now()
    return f"{d.hour:02d}:{d.minute:02d}"


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
