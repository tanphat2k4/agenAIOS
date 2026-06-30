import re
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.crud import get_or_404, now_hm, next_sort, uid
from app.models.agents import Agent
from app.models.comms import Channel, ChannelMember, Message
from app.models.user import User
from app.serialize import row_to_dict, rows_to_list
from app.services import ninerouter

router = APIRouter(tags=["channels"], dependencies=[Depends(get_current_user)])


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _text_from_raw(raw: list) -> str:
    parts: list[str] = []
    for b in raw or []:
        if b.get("kind") == "para":
            parts.append("".join(s.get("v", "") for s in b.get("rich", [])))
        elif b.get("kind") == "attach":
            parts.append(f"[đính kèm: {b.get('name', '')}]")
    return " ".join(p for p in parts if p).strip()


# ------------------------------ channels ------------------------------
class ChannelCreate(BaseModel):
    name: str
    type: str = "private"  # public | private
    desc: str = ""


class ChannelRename(BaseModel):
    name: str


def _members_of(db: Session, channel_id: str):
    return db.scalars(
        select(ChannelMember).where(ChannelMember.channel_id == channel_id).order_by(ChannelMember.sort, ChannelMember.id)
    )


def _channel_dict(db: Session, c: Channel) -> dict:
    d = row_to_dict(c)
    members = rows_to_list(_members_of(db, c.id), exclude={"channel_id"})
    d["memberList"] = members
    d["members"] = len(members)  # real count, overrides the legacy int column
    return d


def add_channel_member(db: Session, channel_id: str, *, name: str, initial: str, color: str,
                       role: str = "Member", isAgent: bool = False, userId: str | None = None) -> ChannelMember:
    """Idempotent add: dedupe by userId (real users) or name+isAgent (agents)."""
    q = select(ChannelMember).where(ChannelMember.channel_id == channel_id)
    q = q.where(ChannelMember.userId == userId) if userId else q.where(ChannelMember.name == name, ChannelMember.isAgent == isAgent)
    existing = db.scalar(q)
    if existing:
        return existing
    m = ChannelMember(
        id=uid("cm"), channel_id=channel_id, userId=userId, name=name,
        initial=initial, color=color, role=role, isAgent=isAgent, sort=next_sort(db, ChannelMember),
    )
    db.add(m)
    db.commit()
    return m


def _unread_map(db: Session, current: User) -> dict[str, int]:
    """Per-channel count of messages newer than the user's last-read mark, excluding their own."""
    reads = dict((current.settings or {}).get("channelReads", {}))
    out: dict[str, int] = {}
    for cid in db.scalars(select(Channel.id)):
        n = db.scalar(
            select(func.count()).select_from(Message).where(
                Message.channel_id == cid,
                Message.sort > reads.get(cid, 0),
                Message.authorName != current.name,
            )
        )
        if n:
            out[cid] = int(n)
    return out


@router.get("/channels")
def list_channels(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Grouped exactly like the store: {public, private, direct}."""
    out: dict[str, list] = {"public": [], "private": [], "direct": []}
    um = _unread_map(db, current)
    for c in db.scalars(select(Channel).order_by(Channel.sort, Channel.id)):
        d = _channel_dict(db, c)
        d["unread"] = um.get(c.id, 0)
        out.setdefault(c.kind, out["public"]).append(d)
    return out


@router.get("/channels/unread")
def channels_unread(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Lightweight poll: {channelId: unreadCount} — new bot replies / others' messages since you last opened it."""
    return _unread_map(db, current)


@router.post("/channels/{channel_id}/read")
def mark_channel_read(channel_id: str, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Advance the user's last-read mark for a channel to its newest message (call when opening it)."""
    get_or_404(db, Channel, channel_id)
    top = db.scalar(select(func.max(Message.sort)).where(Message.channel_id == channel_id)) or 0
    reads = dict((current.settings or {}).get("channelReads", {}))
    reads[channel_id] = int(top)
    current.settings = {**(current.settings or {}), "channelReads": reads}
    db.commit()
    return {"channelId": channel_id, "lastRead": int(top)}


@router.post("/channels", status_code=201)
def create_channel(body: ChannelCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Thiếu tên kênh")
    cid = _slug(name) or uid("room-")
    if db.get(Channel, cid):
        cid = f"{cid}-{uid('')[:4]}"
    kind = "public" if body.type == "public" else "private"
    ch = Channel(
        id=cid, kind=kind, name=name, desc=body.desc.strip() or "Room channel mới",
        visibility="PUBLIC" if kind == "public" else "PRIVATE", members=1,
        files=f"{cid}/", database=cid, tasks=[], wfTotal=0,
        wfNote="Chưa cấu hình workflow cho room này.", sort=next_sort(db, Channel),
    )
    db.add(ch)
    db.commit()
    add_channel_member(db, cid, name=current.name, initial=current.initial, color=current.color,
                       role="Owner" if getattr(current, "role", "") == "owner" else "Member", userId=current.id)
    return _channel_dict(db, ch)


@router.patch("/channels/{channel_id}")
def rename_channel(channel_id: str, body: ChannelRename, db: Session = Depends(get_db)):
    ch = get_or_404(db, Channel, channel_id)
    name = body.name.strip()
    if name:
        ch.name = name
        db.commit()
    return row_to_dict(ch)


@router.delete("/channels/{channel_id}")
def delete_channel(channel_id: str, db: Session = Depends(get_db)):
    ch = get_or_404(db, Channel, channel_id)
    db.execute(delete(Message).where(Message.channel_id == channel_id))
    db.delete(ch)
    db.commit()
    return {"detail": "deleted"}


@router.post("/channels/{channel_id}/leave")
def leave_channel(channel_id: str, db: Session = Depends(get_db)):
    return delete_channel(channel_id, db)


# ------------------------------ members ------------------------------
class MemberAddIn(BaseModel):
    userId: str | None = None
    agentId: str | None = None


@router.get("/channels/{channel_id}/members")
def list_members(channel_id: str, db: Session = Depends(get_db)):
    get_or_404(db, Channel, channel_id)
    return rows_to_list(_members_of(db, channel_id), exclude={"channel_id"})


@router.post("/channels/{channel_id}/members", status_code=201)
def add_member(channel_id: str, body: MemberAddIn, db: Session = Depends(get_db)):
    get_or_404(db, Channel, channel_id)
    if body.userId:
        u = get_or_404(db, User, body.userId)
        role = {"owner": "Owner", "lead": "Lead"}.get(u.role, "Member")
        m = add_channel_member(db, channel_id, name=u.name, initial=u.initial, color=u.color, role=role, userId=u.id)
    elif body.agentId:
        a = get_or_404(db, Agent, body.agentId)
        m = add_channel_member(db, channel_id, name=a.name, initial=a.initial, color=a.color, role="Agent", isAgent=True)
    else:
        raise HTTPException(status_code=400, detail="Thiếu userId hoặc agentId")
    return row_to_dict(m, exclude={"channel_id"})


@router.delete("/channels/{channel_id}/members/{member_id}")
def remove_member(channel_id: str, member_id: str, db: Session = Depends(get_db)):
    m = db.get(ChannelMember, member_id)
    if not m or m.channel_id != channel_id:
        raise HTTPException(status_code=404, detail="Không tìm thấy thành viên")
    if m.role == "Owner":
        raise HTTPException(status_code=400, detail="Không thể gỡ chủ sở hữu khỏi kênh")
    db.delete(m)
    db.commit()
    return {"detail": "removed"}


# ------------------------------ messages ------------------------------
class SendIn(BaseModel):
    text: str = ""
    attach: dict | None = None  # {icon, name, label}


def _expire_messages(db: Session, ch: Channel) -> int:
    """Telegram-style auto-delete: drop messages older than the channel's TTL."""
    ttl = getattr(ch, "autoDeleteSeconds", 0) or 0
    if ttl <= 0:
        return 0
    cutoff = int(time.time()) - ttl
    n = db.execute(delete(Message).where(Message.channel_id == ch.id, Message.created_at < cutoff)).rowcount
    if n:
        db.commit()
    return n or 0


@router.get("/channels/{channel_id}/messages")
def list_messages(channel_id: str, db: Session = Depends(get_db)):
    ch = get_or_404(db, Channel, channel_id)
    _expire_messages(db, ch)
    msgs = db.scalars(
        select(Message).where(Message.channel_id == channel_id).order_by(Message.sort, Message.id)
    )
    return rows_to_list(msgs, exclude={"channel_id"})


@router.post("/channels/{channel_id}/messages", status_code=201)
def send_message(
    channel_id: str,
    body: SendIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    get_or_404(db, Channel, channel_id)
    text = body.text.strip()
    if not text and not body.attach:
        raise HTTPException(status_code=400, detail="Tin nhắn trống")
    raw: list = []
    if text:
        raw.append({"kind": "para", "rich": [{"v": text, "isText": True}]})
    if body.attach:
        raw.append({"kind": "attach", **body.attach})
    m = Message(
        id=uid("m"), channel_id=channel_id, authorName=current.name, time=now_hm(),
        avatarInitial=current.initial, avatarColor=current.color, isAgent=False,
        raw=raw, sort=next_sort(db, Message),
    )
    db.add(m)
    db.commit()
    return row_to_dict(m, exclude={"channel_id"})


@router.delete("/channels/{channel_id}/messages")
def clear_messages(channel_id: str, db: Session = Depends(get_db)):
    """Clear the channel's chat history (all messages)."""
    get_or_404(db, Channel, channel_id)
    n = db.execute(delete(Message).where(Message.channel_id == channel_id)).rowcount
    db.commit()
    return {"deleted": n or 0}


class AutoDeleteIn(BaseModel):
    seconds: int = 0


@router.patch("/channels/{channel_id}/auto-delete")
def set_auto_delete(channel_id: str, body: AutoDeleteIn, db: Session = Depends(get_db)):
    """Set the Telegram-style self-destruct timer (0 = off)."""
    ch = get_or_404(db, Channel, channel_id)
    ch.autoDeleteSeconds = max(0, int(body.seconds))
    db.commit()
    _expire_messages(db, ch)
    return {"autoDeleteSeconds": ch.autoDeleteSeconds}


# ------------------------ real agent reply (9Router) ------------------------
class AgentReplyIn(BaseModel):
    agentId: str | None = None
    agentName: str | None = None
    model: str | None = None


@router.post("/channels/{channel_id}/agent-reply", status_code=201)
def agent_reply(channel_id: str, body: AgentReplyIn, db: Session = Depends(get_db)):
    """Generate a real agent reply for the channel via 9Router and persist it."""
    get_or_404(db, Channel, channel_id)
    agent: Agent | None = None
    if body.agentId:
        agent = db.get(Agent, body.agentId)
    elif body.agentName:
        agent = db.scalar(select(Agent).where(Agent.name == body.agentName))

    history = list(
        db.scalars(
            select(Message).where(Message.channel_id == channel_id).order_by(Message.sort, Message.id)
        )
    )
    convo: list[dict] = []
    for mm in history[-12:]:
        txt = _text_from_raw(mm.raw)
        if txt:
            convo.append({"role": "assistant" if mm.isAgent else "user", "content": txt})
    if not convo:
        raise HTTPException(status_code=400, detail="Chưa có nội dung để agent trả lời")

    persona = (
        f"Bạn là {agent.name}, vai trò {agent.role}. {agent.bio}".strip()
        if agent
        else "Bạn là một trợ lý AI trong workspace AgentAIOS."
    )
    system = {"role": "system", "content": persona + " Trả lời ngắn gọn, tự nhiên bằng tiếng Việt."}
    try:
        res = ninerouter.chat([system, *convo], body.model, max_tokens=500)
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Không gọi được 9Router: {e}")

    reply = res["content"] or "(agent không trả về nội dung)"
    am = Message(
        id=uid("m"), channel_id=channel_id,
        authorName=agent.name if agent else "Agent",
        time=now_hm(),
        avatarInitial=agent.initial if agent else "A",
        avatarColor=agent.color if agent else "#3B5BDB",
        isAgent=True,
        raw=[{"kind": "para", "rich": [{"v": reply, "isText": True}]}],
        sort=next_sort(db, Message),
    )
    db.add(am)
    db.commit()
    out = row_to_dict(am, exclude={"channel_id"})
    out["_usage"] = res.get("usage", {})
    out["_model"] = res.get("model")
    return out
