import re
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
from app.services import trading_record as rec
from app.services import tradingagents as ta

router = APIRouter(prefix="/trading", tags=["trading"], dependencies=[Depends(get_current_user)])

TRADING_CHANNEL_ID = "chung-khoan"
_AGENT_NAME = "Phân tích CK"
_AGENT_INITIAL = "T"
_AGENT_COLOR = "#0A7B52"


# ------------------------- fast tools (no LLM, sync) -------------------------
@router.get("/snapshot/{ticker}")
def snapshot(ticker: str, db: Session = Depends(get_db)):
    text = ta.snapshot(ticker)
    rec.record_mcp_call(db, "snapshot", ok=not text.startswith("Lỗi"))
    return {"ticker": ticker, "text": text}


@router.get("/news/{ticker}")
def news(ticker: str, days: int = 7, db: Session = Depends(get_db)):
    text = ta.news(ticker, days)
    rec.record_mcp_call(db, "news", ok=not text.startswith("Lỗi"))
    return {"ticker": ticker, "text": text}


@router.get("/extras/{ticker}")
def extras(ticker: str, db: Session = Depends(get_db)):
    text = ta.extras(ticker)
    rec.record_mcp_call(db, "extras", ok=not text.startswith("Lỗi"))
    return {"ticker": ticker, "text": text}


@router.get("/macro")
def macro(db: Session = Depends(get_db)):
    text = ta.macro()
    rec.record_mcp_call(db, "macro", ok=not text.startswith("Lỗi"))
    return {"text": text}


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
        import time
        t0 = time.time()
        ok = True
        result = ""
        try:
            result = ta.analyze(body.ticker, body.date)
            _jobs[key] = {"status": "done", "result": result}
            ok = not result.startswith(("Lỗi", "Hết thời gian"))
        except Exception as exc:  # noqa: BLE001
            result = f"Lỗi: {exc}"
            _jobs[key] = {"status": "error", "result": result}
            ok = False
        db = SessionLocal()
        try:
            rec.record_analysis(db, body.ticker, report=result, duration=f"{int(time.time() - t0)}s", ok=ok)
        finally:
            db.close()

    threading.Thread(target=work, daemon=True).start()
    return {"status": "running", "key": key, "result": None}


@router.get("/analyze")
def analyze_status(ticker: str, date: str | None = None):
    job = _jobs.get(_key(ticker, date))
    if not job:
        return {"status": "idle", "result": None}
    return {"status": job["status"], "result": job["result"]}


# ----------------- 5-agent pipeline (real, AgentAIOS-orchestrated) -----------------
class PipelineIn(BaseModel):
    ticker: str


@router.post("/pipeline")
def start_pipeline(body: PipelineIn):
    key = _key(body.ticker, "pipeline")
    job = _jobs.get(key)
    if job and job["status"] in ("running", "done"):
        return {"status": job["status"], "key": key, "result": job.get("result")}
    _jobs[key] = {"status": "running", "result": None}

    def work() -> None:
        db = SessionLocal()
        try:
            outputs, ok, headline = rec.run_pipeline(db, body.ticker)
            body_text = "\n\n".join(f"### {a['name']} · {a['role']}\n{txt}" for a, txt in outputs)
            text = (headline + "\n\n" + body_text) if headline else body_text
            _jobs[key] = {"status": "done" if ok else "error", "result": text}
        except Exception as exc:  # noqa: BLE001
            _jobs[key] = {"status": "error", "result": f"Lỗi: {exc}"}
        finally:
            db.close()

    threading.Thread(target=work, daemon=True).start()
    return {"status": "running", "key": key, "result": None}


@router.get("/pipeline")
def pipeline_status(ticker: str):
    job = _jobs.get(_key(ticker, "pipeline"))
    if not job:
        return {"status": "idle", "result": None}
    return {"status": job["status"], "result": job["result"]}


# ----------------- morning report (P4) -----------------
@router.post("/morning-report")
def start_morning_report():
    key = "morning|now"
    job = _jobs.get(key)
    if job and job["status"] == "running":
        return {"status": "running"}
    _jobs[key] = {"status": "running", "result": None}

    def work() -> None:
        from app.services import morning_report as mr

        db = SessionLocal()
        try:
            _jobs[key] = {"status": "done", "result": mr.run_morning_report(db, manual=True)}
        except Exception as exc:  # noqa: BLE001
            _jobs[key] = {"status": "error", "result": f"Lỗi: {exc}"}
        finally:
            db.close()

    threading.Thread(target=work, daemon=True).start()
    return {"status": "running"}


@router.get("/morning-report")
def morning_report_status():
    return _jobs.get("morning|now") or {"status": "idle", "result": None}


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
        raw=rec.md_to_blocks(text), sort=next_sort(db, Message),
    )
    db.add(m)
    db.commit()
    return row_to_dict(m, exclude={"channel_id"})


def _save_advisor_msg(db: Session, channel_id: str, text: str) -> dict:
    """Post a message as the Sage advisor agent."""
    m = Message(
        id=uid("m"), channel_id=channel_id, authorName=rec.ADVISOR["name"], time=now_hm(),
        avatarInitial=rec.ADVISOR["initial"], avatarColor=rec.ADVISOR["color"], isAgent=True,
        raw=rec.md_to_blocks(text), sort=next_sort(db, Message),
    )
    db.add(m)
    db.commit()
    return row_to_dict(m, exclude={"channel_id"})


def _is_advisor_call(text: str) -> bool:
    """True if the user @mentions / addresses the Sage advisor (English name + VN aliases)."""
    t = (text or "").lower()
    return bool(re.search(r"\bsage\b", t)) or "cố vấn" in t or "covan" in t


_SCREEN_KW = ("mua gì", "cổ phiếu gì", "cổ phiếu nào", "mã gì", "mã nào", "nên mua gì", "gợi ý mã",
              "gợi ý mua", "chọn mã", "lọc mã", "đáng mua", "con nào", "mua con", "mã nào ngon")


def _wants_screening(text: str) -> bool:
    """True if the user asks WHICH stock to buy (watchlist screen), not about one ticker."""
    t = (text or "").lower()
    return any(k in t for k in _SCREEN_KW)


def _summarize_for_chat(ticker: str, full: str) -> str:
    """Condense a long TradingAgents report into a short, plain-Vietnamese,
    chat-friendly briefing (no markdown symbols). Falls back to the full text
    if 9Router is unavailable — never blocks the analysis from surfacing."""
    system = {
        "role": "system",
        "content": ("Bạn là biên tập viên bản tin chứng khoán VN, viết tiếng Việt đời thường, NGẮN GỌN, dễ hiểu. "
                    "TUYỆT ĐỐI không dùng ký tự ** hoặc # hoặc * hoặc bảng markdown. " + rec.ANTI_HALLUCINATION +
                    " Chỉ rút gọn đúng nội dung báo cáo, KHÔNG thêm số liệu mới."),
    }
    user = {
        "role": "user",
        "content": (
            f"Rút gọn báo cáo phân tích {ticker} dưới đây thành bản tin ngắn dễ đọc:\n"
            f"Dòng 1: '⭐ {ticker} — Khuyến nghị: <Mua / Tăng tỷ trọng / Giữ / Giảm tỷ trọng / Bán>' kèm 1 câu lý do chính.\n"
            "Rồi 4-6 dòng, mỗi dòng bắt đầu bằng '• ': vùng giá mua/bán hợp lý, rủi ro chính, chất xúc tác sắp tới, lưu ý thanh khoản.\n"
            "Tối đa ~10 dòng, chữ thường, tránh biệt ngữ nặng.\n\n" + (full or "")[:6500]
        ),
    }
    try:
        out = ninerouter.chat([system, user], temperature=0.3, max_tokens=600)["content"]
        return out.strip() if out else full
    except Exception:  # noqa: BLE001
        return full


def _bg_analyze(channel_id: str, ticker: str) -> None:
    import time

    key = _key(ticker, None)
    _jobs[key] = {"status": "running", "result": None}
    t0 = time.time()
    db = SessionLocal()
    try:
        ok = True
        try:
            text = ta.analyze(ticker)
            ok = not text.startswith(("Lỗi", "Hết thời gian"))
        except Exception as exc:  # noqa: BLE001
            text = f"Lỗi phân tích {ticker}: {exc}"
            ok = False
        # Channel shows a deterministic price line + a clean TL;DR; full report kept in Knowledge.
        if ok:
            _snap, headline, _dir = rec.ground(ticker)
            chat_text = (headline + "\n\n" if headline else "") + _summarize_for_chat(ticker, text) + "\n\n📄 Báo cáo đầy đủ đã lưu trong Kiến thức. Nghiên cứu, không phải lời khuyên đầu tư."
        else:
            chat_text = text
        _save_agent_msg(db, channel_id, chat_text)
        _jobs[key] = {"status": "done", "result": text}
        rec.record_analysis(db, ticker, report=text, duration=f"{int(time.time() - t0)}s", ok=ok)
    finally:
        db.close()


def _recent_ticker(history: list, current_text: str) -> str | None:
    """The stock most recently asked about — prefer short user messages over the
    noisy ALL-CAPS soup of agent reports, so follow-ups ('nên giữ không?') still
    resolve to the right ticker."""
    t = ta._extract_ticker(current_text)
    if t:
        return t
    for mm in reversed(history):
        if not mm.isAgent:
            cand = ta._extract_ticker(_text_from_raw(mm.raw))
            if cand:
                return cand
    return None


def _llm_reply(db: Session, channel_id: str, _text: str) -> str:
    history = list(db.scalars(
        select(Message).where(Message.channel_id == channel_id).order_by(Message.sort, Message.id)
    ))[-10:]
    convo = []
    for mm in history:
        t = _text_from_raw(mm.raw)
        if t:
            if mm.isAgent and len(t) > 500:  # trim long reports so stale numbers don't drown the live price
                t = t[:500] + "…"
            convo.append({"role": "assistant" if mm.isAgent else "user", "content": t})

    # Ground the answer in the CURRENT live price (snapshot ~2s) so follow-up
    # questions don't parrot stale numbers from earlier in the conversation.
    directive = headline = ""
    # Market-overview questions must NOT borrow a ticker from earlier chat (else "thị
    # trường sao?" gets answered about the last stock discussed).
    is_market_q = any(k in _text.lower() for k in ("thị trường", "thi truong", "vn-index", "vnindex", "vn index"))
    ticker = ta._extract_ticker(_text) if is_market_q else _recent_ticker(history, _text)
    if ticker:
        _snap, headline, directive = rec.ground(ticker)
    # Enrich grounding with fundamentals (P/E/ROE when a ticker) + VN-Index context
    # (cached) so the advisor answers valuation + market questions, not just price.
    ctx_extra = []
    mkt = ta.market_overview_text()
    if mkt:
        ctx_extra.append("Tổng quan thị trường: " + mkt)
    if ticker:
        fund = ta.fundamentals_text(ticker)
        if fund:
            ctx_extra.append(f"{ticker} — {fund}")
    if ctx_extra:
        directive = (directive + "\n" + "\n".join(ctx_extra)) if directive else "\n".join(ctx_extra)

    system = {
        "role": "system",
        "content": ("Bạn là trợ lý phân tích chứng khoán Việt Nam, trả lời ngắn gọn bằng tiếng Việt, xưng 'em'. "
                    "Trả lời TRỰC TIẾP đúng câu hỏi mới nhất; KHÔNG lặp lại khuyến nghị/báo cáo cũ trừ khi được hỏi lại. "
                    "Khi được hỏi P/E, P/B, ROE, định giá hoặc tổng quan thị trường, dùng đúng số trong phần dữ liệu cung cấp. "
                    "Giải thích khái niệm/chỉ báo (RSI, MACD, P/E...) khi được hỏi. " + rec.ANTI_HALLUCINATION +
                    " Đây là công cụ nghiên cứu, KHÔNG phải lời khuyên đầu tư."),
    }
    # The price directive goes LAST (most salient) so it overrides stale conversation numbers.
    messages = [system, *convo] + ([{"role": "system", "content": directive}] if directive else [])
    try:
        # low temperature → reliably obeys the live-price directive over stale chat numbers
        out = ninerouter.chat(messages, temperature=0.2, max_tokens=500)["content"] or "(không có nội dung)"
    except Exception as exc:  # noqa: BLE001
        return f"Lỗi 9Router: {exc}"
    # Prepend our own always-correct price line so the user never sees a wrong current price.
    return (headline + "\n\n" + out) if headline else out


def _bg_advise(channel_id: str, ticker: str, question: str) -> None:
    """Sage: run the 5-agent pipeline on REAL-TIME data, then synthesize a clear
    advisory that answers the user's question. Posts as the advisor agent."""
    key = _key(ticker, None)
    db = SessionLocal()
    try:
        outputs, _ok, headline = rec.run_pipeline(db, ticker)
        team = "\n".join(f"[{a['name']} · {a['role']}]: {txt}" for a, txt in outputs)
        system = {
            "role": "system",
            "content": (f"{rec.ADVISOR['persona']} {rec.ANTI_HALLUCINATION} "
                        "KHÔNG lặp lại dòng giá đầu (đã có sẵn). Đây là công cụ nghiên cứu, KHÔNG phải lời khuyên đầu tư."),
        }
        user = {
            "role": "user",
            "content": (f"Câu hỏi của anh: {question}\n\nKết quả phân tích của team về {ticker} (đã dùng giá real-time):\n{team[:3200]}\n\n"
                        "Tổng hợp giúp anh thành lời khuyên: **MUA / BÁN / GIỮ**, vùng giá mua hợp lý, vùng chốt lời & cắt lỗ, "
                        "gợi ý tỷ trọng vốn (đừng all-in), 2-3 lý do chính (kỹ thuật + khối ngoại). "
                        "Gọn bằng gạch đầu dòng, kết bằng 1 dòng cảnh báo rủi ro."),
        }
        try:
            synth = ninerouter.chat([system, user, {"role": "system", "content": headline}], temperature=0.3, max_tokens=650)["content"] or ""
        except Exception as exc:  # noqa: BLE001
            synth = f"(không tổng hợp được: {exc})"
        final = f"{headline}\n\n{synth}" if synth.strip() else (f"{headline}\n\n{outputs[-1][1]}" if outputs else f"{headline}\n\nChưa có kết quả.")
        _save_advisor_msg(db, channel_id, final)
        _jobs[key] = {"status": "done", "result": "ok"}
    except Exception as exc:  # noqa: BLE001
        _save_advisor_msg(db, channel_id, f"{rec.ADVISOR['name']} gặp lỗi khi phân tích {ticker}: {exc}")
        _jobs[key] = {"status": "error", "result": str(exc)}
    finally:
        db.close()


def _bg_screen(channel_id: str, question: str) -> None:
    """Sage screening: rank the watchlist (live quote + fundamentals) to answer 'nên mua mã nào'."""
    key = _key("SCREEN", None)
    db = SessionLocal()
    try:
        rows = ta.screen_watchlist()
        if not rows:
            _save_advisor_msg(db, channel_id, "Chưa lấy được dữ liệu watchlist, anh thử lại sau nhé.")
            _jobs[key] = {"status": "done", "result": "empty"}
            return
        tbl = "\n".join(
            f"{r['ticker']}: giá {r['price']} ({r['change']:+}%), KL {r['vol']:,}, khối ngoại {r['foreign_net']:+,} cp, "
            f"P/E {r.get('pe', '?')}, ROE {r.get('roe', '?')}%" for r in rows
        )
        mkt = ta.market_overview_text()
        system = {
            "role": "system",
            "content": (f"{rec.ADVISOR['persona']} {rec.ANTI_HALLUCINATION} "
                        "Chỉ dùng các mã + số trong danh sách, KHÔNG bịa mã ngoài danh sách. Công cụ nghiên cứu, KHÔNG phải lời khuyên đầu tư."),
        }
        user = {
            "role": "user",
            "content": (f"Câu hỏi của anh: {question}\n\n"
                        + (f"Tổng quan: {mkt}\n\n" if mkt else "")
                        + f"Dữ liệu real-time watchlist hôm nay:\n{tbl}\n\n"
                        "Xếp hạng 3-4 mã ĐÁNG MUA NHẤT lúc này — cân nhắc động lượng giá, khối ngoại mua ròng, "
                        "định giá (P/E thấp + ROE cao). Mỗi mã 1-2 câu lý do + vùng giá tham khảo. "
                        "Nêu 1-2 mã NÊN TRÁNH và vì sao. Gọn bằng gạch đầu dòng, kết bằng 1 dòng cảnh báo rủi ro."),
        }
        try:
            synth = ninerouter.chat([system, user], temperature=0.3, max_tokens=750)["content"] or "(không có nội dung)"
        except Exception as exc:  # noqa: BLE001
            synth = f"(không tổng hợp được: {exc})"
        head = "📊 Lọc watchlist" + (f" · {mkt}" if mkt else "")
        _save_advisor_msg(db, channel_id, f"{head}\n\n{synth}")
        _jobs[key] = {"status": "done", "result": "ok"}
    except Exception as exc:  # noqa: BLE001
        _save_advisor_msg(db, channel_id, f"{rec.ADVISOR['name']} gặp lỗi khi lọc mã: {exc}")
        _jobs[key] = {"status": "error", "result": str(exc)}
    finally:
        db.close()


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
    add_channel_member(db, ch.id, name=rec.ADVISOR["name"], initial=rec.ADVISOR["initial"], color=rec.ADVISOR["color"], role="Agent", isAgent=True)
    for a in rec._PIPELINE:
        add_channel_member(db, ch.id, name=a["name"], initial=a["initial"], color=a["color"], role="Agent", isAgent=True)
    rec.ensure_all(db)
    from app.services import morning_report as mr

    mr.ensure_morning_cron(db)
    return _channel_dict(db, ch)


@router.post("/chat")
def trading_chat(body: ChatIn, db: Session = Depends(get_db)):
    cid = body.channel_id or TRADING_CHANNEL_ID
    ensure_trading_channel(db)
    cmd, ticker = ta.classify(body.text)

    # --- Sage: @gọi trong chat → screening / pipeline tư vấn / hội thoại, đều real-time ---
    if _is_advisor_call(body.text):
        has_ticker = bool(ticker and ticker in body.text)
        # "nên mua mã nào?" (không nêu mã cụ thể) → lọc & xếp hạng watchlist
        if not has_ticker and _wants_screening(body.text):
            key = _key("SCREEN", None)
            job = _jobs.get(key)
            if not (job and job["status"] == "running"):
                _jobs[key] = {"status": "running", "result": None}
                interim = _save_advisor_msg(db, cid, f"📊 **{rec.ADVISOR['name']}** đang lọc watchlist (giá real-time + cơ bản) để chọn mã đáng mua, chờ chút…")
                threading.Thread(target=_bg_screen, args=(cid, body.text), daemon=True).start()
                return {"messages": [interim], "analyzing": "SCREEN"}
            return {"messages": [_save_advisor_msg(db, cid, "Em đang lọc rồi, chờ chút nhé.")], "analyzing": "SCREEN"}
        # mã cụ thể + ý kiến/phân tích → chạy pipeline 5-agent
        if has_ticker and (cmd == "analyze" or ta.is_opinion(body.text)):
            key = _key(ticker, None)
            job = _jobs.get(key)
            if not (job and job["status"] == "running"):
                _jobs[key] = {"status": "running", "result": None}
                interim = _save_advisor_msg(db, cid, f"💼 **{rec.ADVISOR['name']}** đang hỏi team (Analyst → Bull/Bear → Trader → Risk → Portfolio) cho **{ticker}** trên giá real-time, chờ ~30 giây…")
                threading.Thread(target=_bg_advise, args=(cid, ticker, body.text), daemon=True).start()
                return {"messages": [interim], "analyzing": ticker}
            return {"messages": [_save_advisor_msg(db, cid, f"Em đang phân tích {ticker} rồi, chờ chút nhé.")], "analyzing": ticker}
        # general question / follow-up → conversational reply, signed Sage
        return {"messages": [_save_advisor_msg(db, cid, _llm_reply(db, cid, body.text))], "analyzing": None}

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
        rec.record_mcp_call(db, cmd, ok=not text.startswith("Lỗi"))
        return {"messages": [_save_agent_msg(db, cid, text)], "analyzing": None}

    # general question / follow-up → conversational reply via 9Router
    return {"messages": [_save_agent_msg(db, cid, _llm_reply(db, cid, body.text))], "analyzing": None}
