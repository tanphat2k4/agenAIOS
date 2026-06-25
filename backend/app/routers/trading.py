import threading

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.core.deps import get_current_user
from app.crud import next_sort, now_hm, uid
from app.models.comms import Channel, Message
from app.models.user import User
from app.serialize import row_to_dict
from app.services import ninerouter
from app.services import tradingagents as ta

router = APIRouter(prefix="/trading", tags=["trading"], dependencies=[Depends(get_current_user)])

TRADING_CHANNEL_ID = "chung-khoan"
_AGENT_NAME = "Phân tích CK"
_AGENT_INITIAL = "T"
_AGENT_COLOR = "#0A7B52"


# ------------------------- fast tools (no LLM, sync) -------------------------
@router.get("/snapshot/{ticker}")
def snapshot(ticker: str):
    return {"ticker": ticker, "text": ta.snapshot(ticker)}


@router.get("/news/{ticker}")
def news(ticker: str, days: int = 7):
    return {"ticker": ticker, "text": ta.news(ticker, days)}


@router.get("/extras/{ticker}")
def extras(ticker: str):
    return {"ticker": ticker, "text": ta.extras(ticker)}


@router.get("/macro")
def macro():
    return {"text": ta.macro()}


# ------------------- full analysis (slow, LLM) — background -------------------
_jobs: dict[str, dict] = {}


def _key(ticker: str, date: str | None) -> str:
    return f"{ticker.upper()}|{date or 'today'}"


class AnalyzeIn(BaseModel):
    ticker: str
    date: str | None = None


@router.post("/analyze")
def start_analyze(body: AnalyzeIn):
    key = _key(body.ticker, body.date)
    job = _jobs.get(key)
    if job and job["status"] in ("running", "done"):
        return {"status": job["status"], "key": key, "result": job.get("result")}
    _jobs[key] = {"status": "running", "result": None}

    def work() -> None:
        try:
            _jobs[key] = {"status": "done", "result": ta.analyze(body.ticker, body.date)}
        except Exception as exc:  # noqa: BLE001
            _jobs[key] = {"status": "error", "result": f"Lỗi: {exc}"}

    threading.Thread(target=work, daemon=True).start()
    return {"status": "running", "key": key, "result": None}


@router.get("/analyze")
def analyze_status(ticker: str, date: str | None = None):
    job = _jobs.get(_key(ticker, date))
    if not job:
        return {"status": "idle", "result": None}
    return {"status": job["status"], "result": job["result"]}


# ----------------------- in-app trading chat (P2) -----------------------
def ensure_trading_channel(db: Session) -> Channel:
    ch = db.get(Channel, TRADING_CHANNEL_ID)
    if ch:
        return ch
    ch = Channel(
        id=TRADING_CHANNEL_ID, kind="public", name="Phân tích CK 📈",
        desc='Hỏi giá / tin / phân tích cổ phiếu VN — gõ "phân tích FPT"',
        visibility="PUBLIC", members=1, tasks=[], wfTotal=0,
        wfNote="Trợ lý phân tích chứng khoán VN (TradingAgents).", unread=0, sort=-1,
    )
    db.add(ch)
    db.commit()
    return ch


def _to_raw(text: str) -> list:
    # one para per line so multi-line tool output (tables/report) renders readably in chat
    return [{"kind": "para", "rich": [{"v": line, "isText": True}]} for line in (text or "").split("\n")]


def _text_from_raw(raw: list) -> str:
    parts = []
    for b in raw or []:
        if b.get("kind") == "para":
            parts.append("".join(s.get("v", "") for s in b.get("rich", [])))
    return "\n".join(parts).strip()


def _save_agent_msg(db: Session, channel_id: str, text: str) -> dict:
    m = Message(
        id=uid("m"), channel_id=channel_id, authorName=_AGENT_NAME, time=now_hm(),
        avatarInitial=_AGENT_INITIAL, avatarColor=_AGENT_COLOR, isAgent=True,
        raw=_to_raw(text), sort=next_sort(db, Message),
    )
    db.add(m)
    db.commit()
    return row_to_dict(m, exclude={"channel_id"})


def _bg_analyze(channel_id: str, ticker: str) -> None:
    key = _key(ticker, None)
    _jobs[key] = {"status": "running", "result": None}
    db = SessionLocal()
    try:
        try:
            text = ta.analyze(ticker)
        except Exception as exc:  # noqa: BLE001
            text = f"Lỗi phân tích {ticker}: {exc}"
        _save_agent_msg(db, channel_id, text)
        _jobs[key] = {"status": "done", "result": text}
    finally:
        db.close()


def _llm_reply(db: Session, channel_id: str, _text: str) -> str:
    history = list(db.scalars(
        select(Message).where(Message.channel_id == channel_id).order_by(Message.sort, Message.id)
    ))[-10:]
    convo = []
    for mm in history:
        t = _text_from_raw(mm.raw)
        if t:
            convo.append({"role": "assistant" if mm.isAgent else "user", "content": t})
    system = {
        "role": "system",
        "content": ("Bạn là trợ lý phân tích chứng khoán Việt Nam, trả lời ngắn gọn bằng tiếng Việt, xưng 'em'. "
                    "Giải thích khái niệm/chỉ báo (RSI, MACD, P/E...) khi được hỏi. Đây là công cụ nghiên cứu, "
                    "KHÔNG phải lời khuyên đầu tư."),
    }
    try:
        return ninerouter.chat([system, *convo], max_tokens=500)["content"] or "(không có nội dung)"
    except Exception as exc:  # noqa: BLE001
        return f"Lỗi 9Router: {exc}"


class ChatIn(BaseModel):
    channel_id: str = TRADING_CHANNEL_ID
    text: str


@router.post("/channel/ensure")
def ensure_channel(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    from app.routers.channels import _channel_dict, add_channel_member

    ch = ensure_trading_channel(db)
    add_channel_member(db, ch.id, name=current.name, initial=current.initial, color=current.color,
                       role="Owner" if getattr(current, "role", "") == "owner" else "Member", userId=current.id)
    add_channel_member(db, ch.id, name=_AGENT_NAME, initial=_AGENT_INITIAL, color=_AGENT_COLOR, role="Agent", isAgent=True)
    return _channel_dict(db, ch)


@router.post("/chat")
def trading_chat(body: ChatIn, db: Session = Depends(get_db)):
    cid = body.channel_id or TRADING_CHANNEL_ID
    ensure_trading_channel(db)
    cmd, ticker = ta.classify(body.text)

    if cmd == "analyze":
        if not ticker:
            return {"messages": [_save_agent_msg(db, cid, "Anh cho em mã cổ phiếu để phân tích nhé (vd FPT).")], "analyzing": None}
        interim = _save_agent_msg(db, cid, f"⏳ Đang chạy phân tích đầy đủ {ticker} (analyst → tranh luận → trader → rủi ro → PM), vài phút nhé…")
        threading.Thread(target=_bg_analyze, args=(cid, ticker), daemon=True).start()
        return {"messages": [interim], "analyzing": ticker}

    if cmd in ("snapshot", "news", "extras", "macro"):
        if cmd != "macro" and not ticker:
            return {"messages": [_save_agent_msg(db, cid, "Anh cho em mã cổ phiếu nhé (vd FPT).")], "analyzing": None}
        if cmd == "snapshot":
            text = ta.snapshot(ticker)
        elif cmd == "news":
            text = ta.news(ticker)
        elif cmd == "extras":
            text = ta.extras(ticker)
        else:
            text = ta.macro()
        return {"messages": [_save_agent_msg(db, cid, text)], "analyzing": None}

    # general question / follow-up → conversational reply via 9Router
    return {"messages": [_save_agent_msg(db, cid, _llm_reply(db, cid, body.text))], "analyzing": None}
