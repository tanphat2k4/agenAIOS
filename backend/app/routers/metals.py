"""Vàng – bạc (metals): #vang-bac channel + the Aurum advisor.

P1: price questions answered from REAL data (SJC/BTMC + Yahoo world spot).
P2: advice questions ("có nên mua vàng…") run the VISIBLE multi-agent pipeline
(wf-metals-analysis: 4 data agents → Bull/Bear → Backtest → Risk → Aurum) async,
mirroring the trading Sage flow. Telegram relay (P3) comes later.
"""
import json
import threading

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.core.deps import get_current_user
from app.crud import next_sort, now_hm, uid
from app.models.agents import Agent
from app.models.comms import Channel, Message
from app.models.user import User
from app.serialize import row_to_dict
from app.services import metals, metals_pipeline as mp, ninerouter
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
    mp.ensure_metals_workflow(db)  # the P2 pipeline card in Agent Workflow
    add_channel_member(db, ch.id, name=current.name, initial=current.initial, color=current.color,
                       role="Owner" if getattr(current, "role", "") == "owner" else "Member", userId=current.id)
    add_channel_member(db, ch.id, name=AURUM["name"], initial=AURUM["initial"], color=AURUM["color"],
                       role="Agent", isAgent=True)
    for a in mp._PIPELINE:  # the analysis team shows as channel members, like #chung-khoan
        if a["name"] != AURUM["name"]:
            add_channel_member(db, ch.id, name=a["name"], initial=a["initial"], color=a["color"], role="Agent", isAgent=True)
    return _channel_dict(db, ch)


@router.get("/snapshot")
def get_snapshot():
    """Raw combined snapshot (domestic + world + premium) — debugging / future UI."""
    return metals.snapshot()


class ChatIn(BaseModel):
    channel_id: str = METALS_CHANNEL_ID
    text: str


_PRICE_WORDS = ("giá", "gia ", "bao nhiêu", "bao nhieu", "premium", "chênh", "chenh", "spot", "hôm nay", "hom nay")
# advice intent → run the visible pipeline (same spirit as trading's _DEEP_KW)
_ADVICE_KW = ("khuyến nghị", "khuyên nghị", "nên mua", "nên bán", "nên giữ", "có nên", "đánh giá",
              "phân tích", "nhận định", "đầu tư", "xuống tiền", "chốt lời", "bắt đáy", "recommend")

_jobs: dict = {}
_JOB_KEY = "METALS"


def _bg_advise(channel_id: str, question: str) -> None:
    """Run the multi-agent pipeline on its own session, then post Aurum's advisory."""
    db = SessionLocal()
    try:
        outputs, ok, headline = mp.run_pipeline(db, question)
        by_name = {a["name"]: txt for a, txt in outputs}
        final = by_name.get("Aurum", "").strip() or "(pipeline không trả kết luận)"
        bear = (by_name.get("Bear", "") or "").strip()
        note = "\n\n🧠 Team Bull/Bear/Risk đã tranh luận — xem từng bước trong **Agent Workflow**, biên bản đầy đủ trong **Kiến thức**. Nghiên cứu, không phải lời khuyên đầu tư."
        counter = f"\n\n⚖️ Ý phản biện đáng chú ý (Bear): {bear[:220]}…" if bear else ""
        _save_aurum_msg(db, channel_id, headline + "\n\n" + final + counter + note)
        _jobs[_JOB_KEY] = {"status": "done" if ok else "error"}
    except Exception as exc:  # noqa: BLE001
        try:
            _save_aurum_msg(db, channel_id, f"Pipeline lỗi: {exc}")
        except Exception:  # noqa: BLE001
            pass
        _jobs[_JOB_KEY] = {"status": "error"}
    finally:
        db.close()


@router.get("/analyze")
def analyze_status():
    return {"status": _jobs.get(_JOB_KEY, {}).get("status", "idle")}


@router.post("/chat")
def metals_chat(body: ChatIn, db: Session = Depends(get_db)):
    cid = body.channel_id or METALS_CHANNEL_ID
    ensure_metals_channel(db)
    text = (body.text or "").strip()
    low = text.lower()

    # advice question → the VISIBLE multi-agent pipeline (async, ~40-90s), like Sage
    if any(k in low for k in _ADVICE_KW):
        job = _jobs.get(_JOB_KEY)
        if job and job.get("status") == "running":
            return {"messages": [_save_aurum_msg(db, cid, "Em đang chạy pipeline vàng–bạc rồi, chờ chút nhé.")], "analyzing": _JOB_KEY}
        _jobs[_JOB_KEY] = {"status": "running"}
        interim = _save_aurum_msg(db, cid, "💼 **Aurum** đang hỏi team (Giá&Premium / Vĩ mô / Tin tức / Kỹ thuật → Bull/Bear → Backtest → Risk), chờ ~1 phút…")
        threading.Thread(target=_bg_advise, args=(cid, text), daemon=True).start()
        return {"messages": [interim], "analyzing": _JOB_KEY}

    snap = metals.snapshot()
    head = metals.headline(snap)

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
