from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.crud import get_or_404, list_ordered, next_sort, uid
from app.models.org import Invite, Role, Signup
from app.models.user import User
from app.serialize import row_to_dict, rows_to_list

router = APIRouter(dependencies=[Depends(get_current_user)])

_ROLE_COLORS = ["#0E7490", "#7C3AED", "#0A7B52", "#9A6A1B", "#C2410C", "#BE185D"]


def initials(name: str) -> str:
    parts = [w for w in (name or "").split() if w]
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return (parts[0][0].upper() if parts else "?")


# ----------------------------- users -----------------------------
class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    role: str | None = None
    status: str | None = None


@router.get("/users", tags=["users"])
def list_users(db: Session = Depends(get_db)):
    return rows_to_list(list_ordered(db, User))


@router.patch("/users/{user_id}", tags=["users"])
def update_user(user_id: str, body: UserUpdate, db: Session = Depends(get_db)):
    u = get_or_404(db, User, user_id)
    if body.name is not None:
        u.name = body.name.strip() or "(chưa đặt tên)"
        u.initial = initials(u.name)
    if body.email is not None:
        u.email = body.email.strip()
    if body.role is not None:
        u.role = body.role
    if body.status is not None:
        u.status = body.status
    db.commit()
    return row_to_dict(u)


@router.post("/users/{user_id}/cycle-role", tags=["users"])
def cycle_role(user_id: str, db: Session = Depends(get_db)):
    u = get_or_404(db, User, user_id)
    if u.role != "owner":
        order = ["lead", "staff", "viewer"]
        idx = order.index(u.role) if u.role in order else -1
        u.role = order[(idx + 1) % len(order)]
        db.commit()
    return row_to_dict(u)


@router.post("/users/{user_id}/toggle-status", tags=["users"])
def toggle_status(user_id: str, db: Session = Depends(get_db)):
    u = get_or_404(db, User, user_id)
    u.status = "active" if u.status == "suspended" else "suspended"
    db.commit()
    return row_to_dict(u)


@router.delete("/users/{user_id}", tags=["users"])
def remove_user(user_id: str, db: Session = Depends(get_db)):
    u = get_or_404(db, User, user_id)
    name = u.name
    db.delete(u)
    # cascade: drop this person from every role's member list
    for role in db.scalars(select(Role)):
        if any(m.get("name") == name for m in role.members):
            role.members = [m for m in role.members if m.get("name") != name]
    db.commit()
    return {"detail": "removed"}


# ----------------------------- invites -----------------------------
class InviteCreate(BaseModel):
    email: str
    role: str = "staff"


@router.get("/invites", tags=["users"])
def list_invites(db: Session = Depends(get_db)):
    return rows_to_list(list_ordered(db, Invite))


@router.post("/invites", tags=["users"], status_code=status.HTTP_201_CREATED)
def create_invite(
    body: InviteCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    email = body.email.strip()
    if not email:
        raise HTTPException(status_code=400, detail="Thiếu email")
    iv = Invite(
        id=uid("i"), email=email, role=body.role, by=current.name, time="vừa xong",
        sort=next_sort(db, Invite),
    )
    db.add(iv)
    db.commit()
    return row_to_dict(iv)


@router.post("/invites/{invite_id}/resend", tags=["users"])
def resend_invite(invite_id: str, db: Session = Depends(get_db)):
    iv = get_or_404(db, Invite, invite_id)
    return {"detail": f"Đã gửi lại lời mời tới {iv.email}"}


@router.delete("/invites/{invite_id}", tags=["users"])
def cancel_invite(invite_id: str, db: Session = Depends(get_db)):
    iv = get_or_404(db, Invite, invite_id)
    db.delete(iv)
    db.commit()
    return {"detail": "cancelled"}


# ----------------------------- signups -----------------------------
class SignupRole(BaseModel):
    role: str


@router.get("/signups", tags=["users"])
def list_signups(db: Session = Depends(get_db)):
    return rows_to_list(list_ordered(db, Signup))


@router.post("/signups/{signup_id}/approve", tags=["users"])
def approve_signup(signup_id: str, db: Session = Depends(get_db)):
    s = get_or_404(db, Signup, signup_id)
    user = User(
        id=uid("u"), name=s.name, email=s.email, initial=s.initial, color=s.color,
        role=s.role, status="active", last="vừa xong", sort=next_sort(db, User),
    )
    db.add(user)
    db.delete(s)
    db.commit()
    return row_to_dict(user)


@router.post("/signups/{signup_id}/reject", tags=["users"])
def reject_signup(signup_id: str, db: Session = Depends(get_db)):
    s = get_or_404(db, Signup, signup_id)
    db.delete(s)
    db.commit()
    return {"detail": "rejected"}


@router.patch("/signups/{signup_id}", tags=["users"])
def set_signup_role(signup_id: str, body: SignupRole, db: Session = Depends(get_db)):
    s = get_or_404(db, Signup, signup_id)
    s.role = body.role
    db.commit()
    return row_to_dict(s)
