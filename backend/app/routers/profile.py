from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.serialize import row_to_dict

router = APIRouter(tags=["profile"], dependencies=[Depends(get_current_user)])

_DEFAULT_SETTINGS = {
    "activeLang": "vi", "agentLang": "user", "timeFormat": "24h", "dateFormat": "dmy",
    "weekStart": "mon", "timezone": "hcm", "currency": "vnd",
}


def initials(name: str) -> str:
    parts = [w for w in (name or "").split() if w]
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return (parts[0][0].upper() if parts else "?")


# ------------------------------ profile ------------------------------
class ProfileUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    title: str | None = None
    bio: str | None = None
    location: str | None = None
    gender: str | None = None  # male|female — agents gọi 'anh'/'chị' theo trường này (20/07)


class PasswordChange(BaseModel):
    cur: str
    next: str
    confirm: str


@router.get("/profile")
def get_profile(current: User = Depends(get_current_user)):
    return row_to_dict(current)


@router.patch("/profile")
def update_profile(
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if body.name is not None:
        if not body.name.strip():
            raise HTTPException(status_code=400, detail="Tên không được trống")
        current.name = body.name.strip()
        current.initial = initials(current.name)
    for field in ("email", "phone", "title", "bio", "location"):
        val = getattr(body, field)
        if val is not None:
            setattr(current, field, val)
    if body.gender is not None:
        if body.gender not in ("male", "female", ""):
            raise HTTPException(status_code=400, detail="gender phải là male | female")
        current.settings = {**(current.settings or {}), "gender": body.gender}  # reassign → SQLAlchemy tracks
    db.commit()
    return row_to_dict(current)


@router.post("/profile/2fa/toggle")
def toggle_2fa(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    current.twoFA = not current.twoFA
    db.commit()
    return {"twoFA": current.twoFA}


@router.post("/profile/password")
def change_password(
    body: PasswordChange,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.hashed_password and not verify_password(body.cur, current.hashed_password):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")
    if not body.next or body.next != body.confirm:
        raise HTTPException(status_code=400, detail="Mật khẩu mới không khớp")
    current.hashed_password = hash_password(body.next)
    db.commit()
    return {"detail": "Đã đổi mật khẩu"}


@router.get("/profile/sessions")
def list_sessions(current: User = Depends(get_current_user)):
    return current.sessions or []


@router.delete("/profile/sessions/{session_id}")
def revoke_session(session_id: str, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    current.sessions = [s for s in (current.sessions or []) if s.get("id") != session_id]
    db.commit()
    return current.sessions


@router.post("/profile/sessions/revoke-others")
def revoke_other_sessions(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    current.sessions = [s for s in (current.sessions or []) if s.get("current")]
    db.commit()
    return current.sessions


# ------------------------------ settings (language/region) ------------------------------
class SettingsUpdate(BaseModel):
    activeLang: str | None = None
    agentLang: str | None = None
    timeFormat: str | None = None
    dateFormat: str | None = None
    weekStart: str | None = None
    timezone: str | None = None
    currency: str | None = None


@router.get("/settings")
def get_settings(current: User = Depends(get_current_user)):
    return {**_DEFAULT_SETTINGS, **(current.settings or {})}


@router.patch("/settings")
def update_settings(
    body: SettingsUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    merged = {**_DEFAULT_SETTINGS, **(current.settings or {})}
    merged.update({k: v for k, v in body.model_dump().items() if v is not None})
    current.settings = merged
    db.commit()
    return merged


@router.post("/settings/reset")
def reset_settings(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    current.settings = dict(_DEFAULT_SETTINGS)
    db.commit()
    return current.settings
