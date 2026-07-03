"""Morning VN market report — a scheduled briefing for a watchlist.

Gathers real data (macro + snapshots), has 9Router write a concise morning
briefing, then posts it to #chung-khoan + a notification + a knowledge entry,
and updates the cron job. Runs on a schedule (scheduler.py) or on demand.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.crud import next_sort, now_hm, uid
from app.models.agents import CronJob
from app.models.comms import Channel, Message, Notification
from app.models.ops import KnowledgeEntry
from app.services import trading_record as rec

WATCHLIST = ["VIB", "FPT", "VCB", "HPG", "VNM", "MWG"]
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
        "Viết báo cáo sáng chứng khoán VN cho watchlist " + ", ".join(WATCHLIST) + ". "
        "Mở đầu bằng 1 dòng TÓM TẮT NHANH tâm lý thị trường chung. "
        "Rồi mỗi mã đúng 1 dòng: mã + giá + xu hướng (dùng 📈/📉) + khuyến nghị NGẮN (mua/giữ/bán/quan sát). "
        "Kết bằng 1 dòng tỷ giá USD/VND. "
        "ĐỊNH DẠNG (gửi qua Telegram — KHÔNG render markdown): TUYỆT ĐỐI không dùng ký tự ** hoặc # hoặc *; "
        "viết chữ thường, dùng emoji + bullet •. Tối đa ~12 dòng, lời lẽ đời thường, dễ hiểu, tránh biệt ngữ."
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
            [{"role": "system", "content": "Biên tập bản tin sáng CK VN, ngắn gọn: 1-2 câu vĩ mô rồi mỗi mã 1 dòng. " + rec.ANTI_HALLUCINATION},
             {"role": "user", "content": "CHỈ dùng số trong dữ liệu sau:\n" + data[:6500]}],
            temperature=0.3, max_tokens=700,
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

    # gold & silver goes to ITS OWN channel (#vang-bac) — see the block at the end,
    # NOT into the stock briefing (the WSL vn_daily_report keeps its own TG section).

    report = f"# ☀️ Báo cáo sáng VN — {now_hm()}\n\n{reply}\n\n> Gửi qua {via}. Nghiên cứu, không phải lời khuyên đầu tư."

    try:
        if db.get(Channel, "chung-khoan"):
            db.add(Message(
                id=uid("m"), channel_id="chung-khoan", authorName=_BOT[0], time=now_hm(),
                avatarInitial=_BOT[1], avatarColor=_BOT[2], isAgent=True, raw=rec.md_to_blocks(report),
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
        c.spark = (list(c.spark or [0, 0, 0, 0, 0, 0, 0]) + [1])[-7:]  # 1 lần chạy (không phải số mã)
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()

    # ── the morning RECOMMENDATION — VIB deep-dive (mirrors the Telegram VIB report) ──
    try:
        from app.services import ninerouter

        pdb = SessionLocal()  # pipeline on its OWN session (workflow/log/knowledge commit cleanly)
        try:
            outputs, _ok, headline = rec.run_pipeline(pdb, "VIB")
        finally:
            pdb.close()
        team = "\n".join(f"[{a['name']} · {a['role']}]: {t}" for a, t in outputs)
        system = {"role": "system", "content": (f"{rec.ADVISOR['persona']} {rec.ANTI_HALLUCINATION} "
                  "KHÔNG lặp lại dòng giá đầu (đã có). Công cụ nghiên cứu, KHÔNG phải lời khuyên đầu tư.")}
        user = {"role": "user", "content": (f"Kết quả team về VIB sáng nay (giá real-time):\n{team[:3200]}\n\n"
                "Tổng hợp NGẮN: Khuyến nghị (MUA/BÁN/GIỮ) + vùng mua/chốt lời/cắt lỗ + 1 câu rủi ro.")}
        try:
            synth = ninerouter.chat([system, user, {"role": "system", "content": headline}],
                                    temperature=0.3, max_tokens=600)["content"] or ""
        except Exception:  # noqa: BLE001
            synth = outputs[-1][1] if outputs else ""
        text = f"☀️ **Khuyến nghị sáng — VIB**\n\n{headline}\n\n{synth}".strip()
        if db.get(Channel, "chung-khoan"):
            db.add(Message(
                id=uid("m"), channel_id="chung-khoan", authorName=rec.ADVISOR["name"], time=now_hm(),
                avatarInitial=rec.ADVISOR["initial"], avatarColor=rec.ADVISOR["color"], isAgent=True,
                raw=rec.md_to_blocks(text), sort=next_sort(db, Message),
            ))
            db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()

    # ── gold & silver morning card → #vang-bac (Aurum), NOT the stock channel ──
    try:
        from app.routers.metals import METALS_CHANNEL_ID, _save_aurum_msg, ensure_metals_channel
        from app.services import metals

        ensure_metals_channel(db)
        _save_aurum_msg(db, METALS_CHANNEL_ID, "☀️ **Vàng & bạc sáng nay**\n\n" + metals.headline())
    except Exception:  # noqa: BLE001
        db.rollback()
    return report
