"""Workflow 'Điều tra khối ngoại' (user yêu cầu 22/07) — đa-agent như pipeline CK/Vàng-Bạc.

Trả lời lớp câu hỏi 'khối ngoại mua lại chưa / đang gom gì / xả gì' KHÔNG cần nêu mã:
① Toàn sàn (1 price_board call: tổng ròng tỷ VND, top mua/bán ròng) → ② Ngành →
③ Mã của anh (holdings ∪ watchlist + lịch sử sổ) → ④ Sage kết luận đúng câu hỏi.

Lịch sử: vnstock bản này KHÔNG có API lịch sử khối ngoại (foreign_trade/trading_stats
đều NotImplemented — dò 22/07) → tự nuôi SỔ backend/.foreign_history.json: Vệ sĩ giá
ghi foreign_net mỗi lượt quét trong phiên (ghi đè trong ngày — số cuối phiên là chuẩn),
pipeline cũng ghi lúc chạy. Sổ mỏng ngày đầu, dày dần theo thời gian — Sage được dặn
nói thật khi thiếu lịch sử."""

import json
import os
import time
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud import now_hm, today_ymd, uid
from app.models.agents import Agent, Workflow
from app.models.ops import KnowledgeEntry, SessionLog
from app.models.user import User
from app.services import ninerouter
from app.services import trading_record as rec
from app.services import tradingagents as ta
from app.services.trading_record import ANTI_HALLUCINATION, _top_sort

WF_ID = "wf-foreign-flows"
_LEDGER = os.path.join(os.path.dirname(__file__), "..", "..", ".foreign_history.json")
_KEEP_DAYS = 40

_PIPELINE = [
    {"id": "agent-ff-market", "name": "Toàn sàn", "role": "Dòng tiền ngoại cả HOSE", "initial": "S", "color": "#3B5BDB", "group": "data",
     "io": "Tổng ròng + top mua/bán ròng",
     "persona": ("Bạn là Market Flow Agent — tóm tắt dòng tiền khối ngoại TOÀN SÀN hôm nay: tổng ròng (tỷ VND), "
                 "bao nhiêu mã mua ròng vs bán ròng, các mã bị xả/được gom mạnh nhất. Nhận định 1 câu: tiền ngoại "
                 "đang vào hay ra. KHÔNG bịa số.")},
    {"id": "agent-ff-sector", "name": "Ngành", "role": "Ngành được gom / bị xả", "initial": "N", "color": "#9C36B5", "group": "data",
     "io": "Ròng theo ngành",
     "persona": ("Bạn là Sector Flow Agent — đọc số ròng khối ngoại THEO NGÀNH, chỉ ra 2-3 ngành đang được gom và "
                 "2-3 ngành bị xả mạnh nhất, kèm con số. Nhận định luân chuyển 1 câu. KHÔNG bịa số.")},
    {"id": "agent-ff-focus", "name": "Mã của anh", "role": "Holdings ∪ watchlist + lịch sử", "initial": "M", "color": "#0A7B52", "group": "data",
     "io": "Ròng hôm nay + chuỗi ngày (sổ)",
     "persona": ("Bạn là Focus Agent — với TỪNG mã người dùng đang giữ/theo dõi: khối ngoại hôm nay mua hay bán ròng "
                 "bao nhiêu, và so với CHUỖI các ngày trước trong sổ (nếu có) thì đang đảo chiều mua lại, tiếp tục xả, "
                 "hay chững. Sổ lịch sử mỏng thì nói rõ 'sổ mới ghi từ ngày X'. KHÔNG bịa số.")},
    {"id": "agent-ck-covan", "name": "Sage", "role": "Kết luận — trả lời câu hỏi", "initial": "S", "color": "#0E9F6E", "group": "decision",
     "io": "Mua lại chưa? + hàm ý hành động",
     "persona": ""},  # dùng rec.ADVISOR persona + hon lúc chạy
]


# ----------------------------- sổ lịch sử khối ngoại -----------------------------
def _load_ledger() -> dict:
    try:
        with open(_LEDGER, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return {}


def record_today(nets: dict) -> None:
    """Ghi {ticker: foreign_net cp} cho HÔM NAY (ghi đè — foreign_net là lũy kế trong
    phiên nên lần ghi cuối cùng của ngày là số chuẩn). Gọi từ Vệ sĩ giá mỗi lượt quét."""
    clean = {str(t).upper(): int(v) for t, v in (nets or {}).items() if v is not None}
    if not clean:
        return
    try:
        led = _load_ledger()
        day = datetime.now().strftime("%Y-%m-%d")
        led.setdefault(day, {}).update(clean)
        for d in sorted(led)[:-_KEEP_DAYS]:
            led.pop(d, None)
        with open(_LEDGER, "w", encoding="utf-8") as f:
            json.dump(led, f, ensure_ascii=False)
    except Exception:  # noqa: BLE001
        pass


def history_text(tickers: list[str], days: int = 10) -> str:
    """Chuỗi ròng ngoại theo ngày cho từng mã từ sổ — '' nếu sổ trống."""
    led = _load_ledger()
    if not led:
        return ""
    recent = sorted(led)[-days:]
    lines = []
    for tk in tickers:
        pts = [(d, led[d].get(tk.upper())) for d in recent if led[d].get(tk.upper()) is not None]
        if not pts:
            continue
        seq = " → ".join(f"{d[5:]}: {v:+,}cp" for d, v in pts)
        lines.append(f"{tk}: {seq}")
    if not lines:
        return ""
    return f"(sổ tự ghi từ {sorted(led)[0]}, số cuối mỗi ngày)\n" + "\n".join(lines)


# ----------------------------- workflow card + agents -----------------------------
def ensure_foreign_workflow(db: Session) -> Workflow:
    template = [{"agent": a["name"], "initial": a["initial"], "color": a["color"], "title": a["role"],
                 "io": a.get("io", ""), "status": "idle", "dur": ""} for a in _PIPELINE]
    w = db.get(Workflow, WF_ID)
    if not w:
        w = Workflow(
            id=WF_ID, name="Điều tra khối ngoại (đa-agent)",
            desc="Toàn sàn (1 call cả HOSE) → Ngành → Mã của anh + sổ lịch sử → Sage kết luận 'mua lại chưa'.",
            trigger="manual", triggerLabel="Khi hỏi 'khối ngoại…' trong #chung-khoan / Telegram", enabled=True,
            lastRun="", runs24=0, success=100, steps=template, runs=[], runState="idle", sort=-1,
        )
        db.add(w)
        db.commit()
        return w
    if not w.steps or len(w.steps) != len(template) or w.steps[0].get("agent") != template[0]["agent"]:
        w.steps = template
        db.commit()
    return w


def ensure_foreign_agents(db: Session) -> None:
    for a in _PIPELINE:
        if a["id"] == "agent-ck-covan":  # Sage đã có sẵn trong registry
            continue
        if not db.get(Agent, a["id"]):
            db.add(Agent(
                id=a["id"], name=a["name"], handle="@" + a["id"].replace("agent-ff-", "ff-"),
                role=a["role"], roleType="research", initial=a["initial"], color=a["color"],
                status="online", model="fast-chat", modelType="local", tasks=0, rooms=1, success=100,
                skills=[a.get("io", "")], lastActive="vừa xong", bio=a["persona"],
                roomsList=["#chung-khoan"], recentTasks=[], sort=-1,
            ))
    db.commit()


# ----------------------------- pipeline -----------------------------
def run_foreign_pipeline(db: Session, question: str = "") -> tuple[list, bool, str]:
    """([(agent, output)…], ok, headline). Đánh dấu workflow đang chạy như metals."""
    t0 = time.time()
    ok = {"v": True}
    w = ensure_foreign_workflow(db)
    ensure_foreign_agents(db)
    w.runState = "running"
    db.commit()

    owner = db.scalar(select(User).where(User.role == "owner")) or db.scalar(select(User))
    holdings = [h["ticker"] for h in ((owner.settings or {}).get("holdings") or [])] if owner else []
    focus = sorted(set(holdings) | set(rec.get_watchlist(db)))
    scan = ta.foreign_market_scan(focus)
    if not scan:
        w.runState = "idle"
        db.commit()
        return [], False, "Không lấy được dữ liệu khối ngoại (vnstock)."
    record_today({r["ticker"]: r["net"] for r in (scan.get("focus") or [])})

    headline = (f"🌏 Khối ngoại {today_ymd()}: sàn HOSE ròng {scan['totalB']:+} tỷ · "
                f"{scan['nBuy']} mã mua ròng / {scan['nSell']} mã bán ròng")
    mkt_slice = (headline + "\nTop GOM: " + " · ".join(f"{r['ticker']} {r['netB']:+} tỷ" for r in scan["buys"])
                 + "\nTop XẢ: " + " · ".join(f"{r['ticker']} {r['netB']:+} tỷ" for r in scan["sells"]))
    sec_slice = ("Ròng theo ngành (tỷ VND): "
                 + " · ".join(f"{s['industry']} {s['netB']:+}" for s in scan["sectors"])
                 + " | Bị xả: "
                 + " · ".join(f"{s['industry']} {s['netB']:+}" for s in scan["weakSectors"]))
    hist = history_text(focus)
    focus_slice = ("\n".join(
        f"{r['ticker']}: giá {r['price']} ({(r['change'] or 0):+}%) · ròng hôm nay {r['net']:+,}cp ≈ {r['netB']:+} tỷ"
        for r in (scan.get("focus") or [])) or "(không có mã focus)")
    if hist:
        focus_slice += "\n\nLỊCH SỬ SỔ:\n" + hist
    else:
        focus_slice += "\n\n(Sổ lịch sử mới bắt đầu ghi hôm nay — chưa so được với các phiên trước.)"

    slice_of = {"Toàn sàn": mkt_slice, "Ngành": sec_slice, "Mã của anh": focus_slice}

    def _call(a: dict, ctx: str, mx: int = 380) -> tuple:
        persona = a["persona"] or rec.ADVISOR["persona"]
        try:
            r = ninerouter.chat(
                [{"role": "system", "content": persona + " " + ANTI_HALLUCINATION + " Trả lời ngắn gọn tiếng Việt, tối đa 5 câu."},
                 {"role": "user", "content": ctx}], temperature=0.3, max_tokens=mx)["content"] or "(trống)"
        except Exception as exc:  # noqa: BLE001
            ok["v"] = False
            r = f"Lỗi 9Router: {exc}"
        return a, r

    from concurrent.futures import ThreadPoolExecutor

    data_agents = [a for a in _PIPELINE if a["group"] == "data"]
    with ThreadPoolExecutor(max_workers=3) as ex:
        data_out = list(ex.map(lambda a: _call(a, f"DỮ LIỆU (chỉ dùng số trong đây):\n{slice_of.get(a['name'], '')}"), data_agents))
    analyses = "\n".join(f"[{a['name']}]: {r}" for a, r in data_out)

    sage = next(a for a in _PIPELINE if a["id"] == "agent-ck-covan")
    hon = rec.honorific(owner)
    sage_sys = {"role": "system", "content": (f"{rec.ADVISOR['persona']} {rec.hon_line(hon)} {ANTI_HALLUCINATION} "
                "Công cụ nghiên cứu, KHÔNG phải lời khuyên đầu tư.")}
    sage_user = {"role": "user", "content": (
        (f"CÂU HỎI CỦA {hon.upper()}: {question}\n\n" if question else "")
        + f"KẾT QUẢ ĐIỀU TRA:\n{analyses}\n\nSỐ GỐC:\n{mkt_slice}\n{sec_slice}\n{focus_slice[:1200]}\n\n"
        "Kết luận NGẮN, mỗi mục 1 dòng:\n"
        "• **Trả lời thẳng câu hỏi** (vd 'mua lại chưa?': rồi/chưa — theo từng mã của người dùng + toàn sàn)\n"
        "• **Điểm nóng**: ngoại đang gom gì, xả gì\n"
        "• **Hàm ý**: 1-2 hành động cụ thể\n"
        "Thiếu lịch sử thì nói thẳng 'sổ mới ghi từ hôm nay'.")}
    try:
        sage_r = ninerouter.chat([sage_sys, sage_user], temperature=0.3, max_tokens=650)["content"] or "(trống)"
    except Exception as exc:  # noqa: BLE001
        ok["v"] = False
        sage_r = f"Lỗi 9Router: {exc}"

    outputs = data_out + [(sage, sage_r)]
    _record(db, outputs, f"{int(time.time() - t0)}s", ok["v"])
    return outputs, ok["v"], headline


def _record(db: Session, outputs: list, dur: str, ok: bool) -> None:
    try:
        w = ensure_foreign_workflow(db)
        by_name = {a["name"]: txt for a, txt in outputs}
        w.steps = [{**s, "status": "done", "dur": "",
                    "io": (by_name.get(s["agent"], "")[:70].replace("\n", " ") or s.get("io", ""))}
                   for s in (w.steps or [])]
        w.runs = [{"time": now_hm(), "date": today_ymd(), "status": "success" if ok else "failed", "dur": dur}, *(w.runs or [])][:200]
        w.lastRun = now_hm()
        w.runs24 = (w.runs24 or 0) + 1
        w.runState = "idle"
        for a, txt in outputs:
            db.add(SessionLog(
                id=uid("s"), agent=a["name"], initial=a["initial"], color=a["color"], room="#chung-khoan",
                model="fast-chat", modelType="local", status="done" if ok else "failed",
                started=now_hm(), duration=dur, tokens="—",
                log=[{"t": now_hm(), "lvl": "info", "msg": (txt or "")[:160]}], sort=_top_sort(db, SessionLog),
            ))
        if ok:
            db.add(KnowledgeEntry(
                id=uid("kn"), type="knowledge", title=f"Điều tra khối ngoại ({now_hm()})", repo="trading/vn",
                ver="v1", time="vừa xong", private=False, avatars=[{"i": "S", "c": "#0E9F6E"}],
                content="\n\n".join(f"### {a['name']} · {a['role']}\n{txt}" for a, txt in outputs),
                sort=_top_sort(db, KnowledgeEntry),
            ))
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
