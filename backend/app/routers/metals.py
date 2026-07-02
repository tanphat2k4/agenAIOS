"""Vàng – bạc (metals) P1: #vang-bac channel + the Aurum advisor answering price
questions on REAL data (SJC/BTMC/Phú Quý + Yahoo world spot). Mirrors the trading
channel wiring: /ensure bootstraps channel+agent on hydrate, /chat answers a message.
Pipeline (P2) and Telegram relay (P3) come later.
"""
import json

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.crud import next_sort, now_hm, uid
from app.models.agents import Agent
from app.models.comms import Channel, Message
from app.models.user import User
from app.serialize import row_to_dict
from app.services import metals, ninerouter
from app.services import trading_record as rec

router = APIRouter(prefix="/metals", tags=["metals"], dependencies=[Depends(get_current_user)])

METALS_CHANNEL_ID = "vang-bac"

AURUM = {
    "id": "agent-metals-aurum", "name": "Aurum", "handle": "@aurum", "initial": "Au", "color": "#B8860B",
    "persona": ("Bạn là Aurum — cố vấn vàng & bạc. Em trả lời dựa DUY NHẤT trên dữ liệu giá được cung cấp "
                "(SJC/nhẫn/BTMC, bạc Phú Quý, spot thế giới, DXY, lợi suất, tỷ giá, premium trong nước so với "
                "thế giới). Trọng tâm: premium quyết định lời/lỗ thực của người mua VN — premium cao bất thường "
                "thì cân nhắc nhẫn/bạc thay vì miếng. Trả lời gọn, tiếng Việt, có số liệu dẫn chứng."),
}


def ensure_metals_channel(db: Session) -> Channel:
    ch = db.get(Channel, METALS_CHANNEL_ID)
    if not ch:
        ch = Channel(
            id=METALS_CHANNEL_ID, kind="public", name="Vàng & Bạc 🥇",
            desc="Giá SJC / nhẫn / bạc Phú Quý + premium — gõ 'giá vàng'",
            visibility="PUBLIC", members=1, files=f"{METALS_CHANNEL_ID}/",
            database=METALS_CHANNEL_ID, tasks=[], wfTotal=0,
            wfNote="Pipeline vàng–bạc (P2) chưa bật — hiện là cố vấn dữ liệu real-time.",
            sort=next_sort(db, Channel),
        )
        db.add(ch)
        db.commit()
    return ch


def ensure_aurum_agent(db: Session) -> Agent:
    ag = db.get(Agent, AURUM["id"])
    if not ag:
        ag = Agent(
            id=AURUM["id"], name=AURUM["name"], handle=AURUM["handle"], role="Cố vấn vàng – bạc",
            roleType="research", initial=AURUM["initial"], color=AURUM["color"], status="online",
            model="fast-chat", modelType="local", tasks=0, rooms=1, success=100,
            skills=["Giá SJC/BTMC real-time", "Premium trong nước vs TG", "Bạc Phú Quý"],
            lastActive="vừa xong", bio=AURUM["persona"], roomsList=["#vang-bac"], recentTasks=[], sort=-1,
        )
        db.add(ag)
        db.commit()
    return ag


def _save_aurum_msg(db: Session, channel_id: str, text: str) -> dict:
    m = Message(
        id=uid("m"), channel_id=channel_id, authorName=AURUM["name"], time=now_hm(),
        avatarInitial=AURUM["initial"], avatarColor=AURUM["color"], isAgent=True,
        raw=rec.md_to_blocks(text), sort=next_sort(db, Message),
    )
    db.add(m)
    db.commit()
    return row_to_dict(m, exclude={"channel_id"})


@router.post("/ensure")
def ensure(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    from app.routers.channels import _channel_dict, add_channel_member

    ch = ensure_metals_channel(db)
    ensure_aurum_agent(db)
    add_channel_member(db, ch.id, name=current.name, initial=current.initial, color=current.color,
                       role="Owner" if getattr(current, "role", "") == "owner" else "Member", userId=current.id)
    add_channel_member(db, ch.id, name=AURUM["name"], initial=AURUM["initial"], color=AURUM["color"],
                       role="Agent", isAgent=True)
    return _channel_dict(db, ch)


@router.get("/snapshot")
def get_snapshot():
    """Raw combined snapshot (domestic + world + premium) — debugging / future UI."""
    return metals.snapshot()


class ChatIn(BaseModel):
    channel_id: str = METALS_CHANNEL_ID
    text: str


_PRICE_WORDS = ("giá", "gia ", "bao nhiêu", "bao nhieu", "premium", "chênh", "chenh", "spot", "hôm nay", "hom nay")


@router.post("/chat")
def metals_chat(body: ChatIn, db: Session = Depends(get_db)):
    cid = body.channel_id or METALS_CHANNEL_ID
    ensure_metals_channel(db)
    snap = metals.snapshot()
    head = metals.headline(snap)
    text = (body.text or "").strip()
    low = text.lower()

    # bare price question → deterministic card, no LLM (fast + can't hallucinate)
    if any(k in low for k in _PRICE_WORDS) and len(text) <= 60:
        return {"messages": [_save_aurum_msg(db, cid, head)]}

    # anything richer → grounded LLM reply, headline always prepended
    data_block = json.dumps(
        {k: v for k, v in snap.items() if k != "errors"}, ensure_ascii=False, default=str,
    )[:3000]
    system = {
        "role": "system",
        "content": (AURUM["persona"] + " " + rec.ANTI_HALLUCINATION +
                    f"\n\nDỮ LIỆU REAL-TIME (VND & USD, nguồn SJC/BTMC/Yahoo):\n{data_block}"),
    }
    try:
        res = ninerouter.chat([system, {"role": "user", "content": text}], None, max_tokens=600)
        reply = (res.get("content") or "").strip() or "(không có nội dung)"
    except httpx.HTTPError:
        reply = "Không gọi được 9Router — em trả số liệu thô ở trên, hỏi lại sau nhé."
    return {"messages": [_save_aurum_msg(db, cid, head + "\n\n" + reply)]}
