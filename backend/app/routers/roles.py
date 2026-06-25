from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.crud import get_or_404, list_ordered, next_sort, uid
from app.models.org import Role
from app.serialize import row_to_dict, rows_to_list

router = APIRouter(prefix="/roles", tags=["roles"], dependencies=[Depends(get_current_user)])

_ROLE_COLORS = ["#0E7490", "#7C3AED", "#0A7B52", "#9A6A1B", "#C2410C", "#BE185D"]
_DEFAULT_TRUE = {"ch_view", "kn_view", "ag_view", "cron_view", "sys_devices"}


def initials(name: str) -> str:
    parts = [w for w in (name or "").split() if w]
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return (parts[0][0].upper() if parts else "?")


class RoleCreate(BaseModel):
    name: str
    icon: str = "🛡"
    desc: str = ""


class MemberCreate(BaseModel):
    name: str
    sub: str = "Thành viên"


class PermToggle(BaseModel):
    permId: str
    value: bool | None = None  # if omitted, flips current


@router.get("")
def list_roles(db: Session = Depends(get_db)):
    return rows_to_list(list_ordered(db, Role))


@router.post("", status_code=201)
def create_role(body: RoleCreate, db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Thiếu tên vai trò")
    count = len(list_ordered(db, Role))
    role = Role(
        id=uid("role"),
        name=name,
        icon=body.icon or "🛡",
        color=_ROLE_COLORS[count % len(_ROLE_COLORS)],
        system=False,
        desc=body.desc.strip() or "Vai trò tùy chỉnh.",
        members=[],
        permissions={pid: True for pid in _DEFAULT_TRUE},
        sort=next_sort(db, Role),
    )
    db.add(role)
    db.commit()
    return row_to_dict(role)


@router.post("/{role_id}/members")
def assign_member(role_id: str, body: MemberCreate, db: Session = Depends(get_db)):
    role = get_or_404(db, Role, role_id)
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Thiếu tên thành viên")
    color = _ROLE_COLORS[(len(name) + len(role_id)) % len(_ROLE_COLORS)]
    member = {"name": name, "initial": initials(name), "color": color, "sub": body.sub.strip() or "Thành viên"}
    role.members = [*role.members, member]  # reassign so SQLAlchemy detects the change
    db.commit()
    return row_to_dict(role)


@router.delete("/{role_id}/members/{name}")
def remove_member(role_id: str, name: str, db: Session = Depends(get_db)):
    role = get_or_404(db, Role, role_id)
    role.members = [m for m in role.members if m.get("name") != name]
    db.commit()
    return row_to_dict(role)


@router.patch("/{role_id}/perms")
def toggle_perm(role_id: str, body: PermToggle, db: Session = Depends(get_db)):
    role = get_or_404(db, Role, role_id)
    current = bool(role.permissions.get(body.permId, False))
    new_val = body.value if body.value is not None else not current
    role.permissions = {**role.permissions, body.permId: new_val}
    db.commit()
    return row_to_dict(role)
