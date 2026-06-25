import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.crud import get_or_404, next_sort, uid
from app.models.comms import Channel, Room
from app.models.user import User
from app.serialize import row_to_dict, rows_to_list

router = APIRouter(prefix="/rooms", tags=["rooms"], dependencies=[Depends(get_current_user)])


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


class RoomCreate(BaseModel):
    name: str
    channel: str = ""
    visibility: str = "private"  # public | private


class RoomEdit(BaseModel):
    name: str


class MemberIn(BaseModel):
    name: str
    handle: str = ""
    type: str = "agent"  # user | agent
    role: str = "staff"  # lead | staff
    initial: str = "?"
    color: str = "#3B5BDB"


@router.get("")
def list_rooms(db: Session = Depends(get_db)):
    return rows_to_list(db.scalars(select(Room).order_by(Room.sort, Room.id)))


@router.post("", status_code=201)
def create_room(
    body: RoomCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Thiếu tên phòng")
    ch = body.channel.strip() or _slug(name)
    rid = ch or ("room-" + uid(""))
    is_pub = body.visibility == "public"
    owner = {
        "name": current.name, "handle": "user #1", "type": "user",
        "role": "lead", "initial": current.initial, "color": current.color,
    }
    room = Room(
        id=rid, name=name, slug=f"{ch.upper()} · MAIN", channel=ch,
        members=[owner], sort=next_sort(db, Room),
    )
    db.add(room)
    # creating a room also creates its channel (mirror the store cross-effect)
    if not db.get(Channel, rid):
        db.add(Channel(
            id=rid, kind="public" if is_pub else "private", name=ch,
            desc=f"Room channel cho {name}",
            visibility="PUBLIC" if is_pub else "PRIVATE", members=1,
            files=f"{ch}/", database=ch, tasks=[], wfTotal=0,
            wfNote="Chưa cấu hình workflow cho room này.", sort=next_sort(db, Channel),
        ))
    db.commit()
    return row_to_dict(room)


@router.patch("/{room_id}")
def edit_room(room_id: str, body: RoomEdit, db: Session = Depends(get_db)):
    r = get_or_404(db, Room, room_id)
    name = body.name.strip()
    if name:
        r.name = name
        db.commit()
    return row_to_dict(r)


@router.delete("/{room_id}")
def delete_room(room_id: str, db: Session = Depends(get_db)):
    r = get_or_404(db, Room, room_id)
    db.delete(r)
    db.commit()
    return {"detail": "deleted"}


@router.post("/{room_id}/members")
def add_member(room_id: str, body: MemberIn, db: Session = Depends(get_db)):
    r = get_or_404(db, Room, room_id)
    if not any(m.get("name") == body.name for m in r.members):
        r.members = [*r.members, body.model_dump()]
        db.commit()
    return row_to_dict(r)


@router.delete("/{room_id}/members/{name}")
def remove_member(room_id: str, name: str, db: Session = Depends(get_db)):
    r = get_or_404(db, Room, room_id)
    r.members = [m for m in r.members if m.get("name") != name]
    db.commit()
    return row_to_dict(r)
