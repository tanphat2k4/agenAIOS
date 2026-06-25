"""Morning VN market report — a scheduled briefing for a watchlist.

Gathers real data (macro + snapshots), has 9Router write a concise morning
briefing, then posts it to #chung-khoan + a notification + a knowledge entry,
and updates the cron job. Runs on a schedule (scheduler.py) or on demand.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud import next_sort, now_hm, uid
from app.models.agents import CronJob
from app.models.comms import Channel, Message, Notification
from app.models.ops import KnowledgeEntry
from app.services import trading_record as rec

WATCHLIST = ["FPT", "VCB", "HPG", "VNM", "MWG"]
CRON_ID = "cron-morning-ck"
_BOT = ("Báo cáo sáng", "☀", "#E8A33D")


def ensure_morning_cron(db: Session) -> CronJob:
    c = db.get(CronJob, CRON_ID)
    if c:
        return c
    c = CronJob(
        id=CRON_ID, name="Báo cáo sáng CK", target="Watchlist · " + ", ".join(WATCHLIST), expr="0 8 * * *",
        last="—", next="08:00", creator="Hệ thống", creatorInitial="H", creatorColor="#0A7B52",
        enabled=True, spark=[0, 0, 0, 0, 0, 0, 0], sort=-1,
    )
    db.add(c)
    db.commit()
    return c


def _to_raw(text: str) -> list:
    return [{"kind": "para", "rich": [{"v": line, "isText": True}]} for line in (text or "").split("\n")]


def _build_prompt() -> str:
    return (
        "Báo cáo sáng chứng khoán VN cho watchlist " + ", ".join(WATCHLIST) +
        ": mỗi mã 1-2 dòng (giá mới nhất + xu hướng + lưu ý ngắn), thêm 1 dòng tỷ giá USD/VND. "
        "Ngắn gọn, định dạng Telegram (bullet •, KHÔNG dùng bảng markdown)."
    )


def _fallback_briefing(db: Session) -> str:
    """AgentAIOS builds the briefing itself when OpenClaw is off/unreachable."""
    from app.services import ninerouter
    from app.services import tradingagents as ta

    macro = ta.macro()
    snaps = {t: ta.snapshot(t) for t in WATCHLIST}
    data = "VĨ MÔ:\n" + macro + "\n\n" + "\n\n".join(f"{t}:\n{s}" for t, s in snaps.items())
    try:
        return ninerouter.chat(
            [{"role": "system", "content": "Biên tập bản tin sáng CK VN, markdown ngắn: 1-2 câu vĩ mô rồi mỗi mã 1 dòng. KHÔNG bịa số."},
             {"role": "user", "content": data[:6500]}],
            max_tokens=700,
        )["content"] or "(không có nội dung)"
    except Exception as exc:  # noqa: BLE001
        return f"(Lỗi 9Router: {exc})"


def run_morning_report(db: Session, *, manual: bool = False) -> str:
    """Trigger OpenClaw's trading agent (analyses + delivers to Telegram), then
    mirror the result in-app. Falls back to an in-app 9Router briefing if
    OpenClaw is off/unreachable. Returns the report markdown."""
    from app.services import openclaw

    reply, delivered = openclaw.send_agent(_build_prompt(), deliver=True)
    if reply:
        via = "OpenClaw → Telegram ✓" if delivered else "OpenClaw (Telegram chưa gửi được)"
    else:
        reply = _fallback_briefing(db)
        via = "9Router in-app (OpenClaw tắt/lỗi)"
        delivered = False

    report = f"# ☀️ Báo cáo sáng VN — {now_hm()}\n\n{reply}\n\n> Gửi qua {via}. Nghiên cứu, không phải lời khuyên đầu tư."

    try:
        if db.get(Channel, "chung-khoan"):
            db.add(Message(
                id=uid("m"), channel_id="chung-khoan", authorName=_BOT[0], time=now_hm(),
                avatarInitial=_BOT[1], avatarColor=_BOT[2], isAgent=True, raw=_to_raw(report),
                sort=next_sort(db, Message),
            ))
        db.add(Notification(
            id=uid("n"), group="Hôm nay", type="cron", cronId=CRON_ID, actor=_BOT[0], initial=_BOT[1],
            color=_BOT[2],
            action=("đã gửi Báo cáo sáng VN qua Telegram" if delivered else "đã tạo Báo cáo sáng VN (in-app)"),
            preview=reply[:110].replace("\n", " "), time=now_hm(), unread=True,
            sort=rec._top_sort(db, Notification),
        ))
        db.add(KnowledgeEntry(
            id=uid("kn"), type="note", title=f"Báo cáo sáng ({now_hm()})", repo="trading/vn", ver="v1",
            time="vừa xong", private=False, avatars=[{"i": _BOT[1], "c": _BOT[2]}], content=report,
            sort=rec._top_sort(db, KnowledgeEntry),
        ))
        c = ensure_morning_cron(db)
        c.last = now_hm()
        c.spark = (list(c.spark or [0, 0, 0, 0, 0, 0, 0]) + [len(WATCHLIST)])[-7:]
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
    return report
