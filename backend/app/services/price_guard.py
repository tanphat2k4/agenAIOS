"""Vệ sĩ giá — cảnh báo rủi ro giá cổ phiếu trong phiên (user duyệt 16/07).

Daemon nền: trong giờ giao dịch (T2-T6, 9:00-11:30 & 13:00-15:00, giờ máy = GMT+7)
mỗi 60s lấy giá TƯƠI (fresh=True, ~7s subprocess — chạy nền nên không ì UI) cho
holdings ∪ watchlist của owner rồi so bộ luật rủi ro. Vi phạm → gửi 3 nơi cùng lúc:
#chung-khoan (Sage), Notification (chuông), Telegram (openclaw message send — bot
trading, KHÔNG tốn LLM cho phát hiện).

Luật mặc định đã duyệt: ① rơi nhanh ≥ -3% so tham chiếu · ② chạm sàn/kịch trần biên
độ · ③ thủng giá vốn + lãi tụt ≥10 điểm % từ đỉnh phiên · ④ VN-Index ≤ -2% · ⑤ luật
riêng "MÃ dưới X" user tự đặt qua chat/card.

Tier 1: mọi cảnh báo kèm 2-3 câu hành động của Sage (1 call 9Router nhỏ, số thật).
Tier 2: sự kiện NẶNG (nằm sàn / thủng vốn / VN-Index sập → mã nắm nhiều nhất) tự chạy
pipeline 5-agent như 'khuyến nghị <MÃ>' và post bản đầy đủ ngay sau tin nhanh.

Chống spam: mỗi (luật, mã) chỉ kêu 1 lần/ngày (in-memory — restart backend giữa phiên
có thể kêu lại 1 lần, chấp nhận được). Config: user.settings['alerts'].
"""

import re
import subprocess
import threading
import time
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.crud import next_sort, now_hm, uid
from app.models.comms import Channel, Message, Notification
from app.models.user import User
from app.services import trading_record as rec

PG_INTERVAL = 60.0  # giây giữa 2 lần quét trong phiên

ALERTS_DEFAULT = {
    "enabled": True,
    "drop_pct": 3.0,    # luật ①: -3% so tham chiếu
    "trail_pct": 10.0,  # luật ③b: lãi tụt ≥10 điểm % từ đỉnh phiên
    "index_pct": 2.0,   # luật ④: VN-Index -2%
    "custom": [],       # luật ⑤: [{"ticker": "VIB", "below": 14.5, "above": 16}]
    "foreign_b": 5.0,   # luật ⑥ (bật 23/07): khối ngoại gom/xả ròng ≥ X tỷ VND trong phiên
    "off": [],          # mã tạm tắt cảnh báo
}

# state trong ngày (reset theo date-key)
_fired: set = set()          # {"YYYY-MM-DD:rule:ticker"}
_peak_pnl: dict = {}         # {"YYYY-MM-DD:ticker": max pnlPct trong ngày}
_started = False


def alerts_of(user: User) -> dict:
    cfg = dict(ALERTS_DEFAULT)
    cfg.update((user.settings or {}).get("alerts") or {})
    cfg["custom"] = list(cfg.get("custom") or [])
    cfg["off"] = [str(t).upper() for t in (cfg.get("off") or [])]
    return cfg


def save_alerts(db: Session, user: User, cfg: dict) -> None:
    keep = {k: cfg[k] for k in ALERTS_DEFAULT if k in cfg}
    user.settings = {**(user.settings or {}), "alerts": keep}  # reassign → SQLAlchemy tracks
    db.commit()


def in_session(now: datetime | None = None) -> bool:
    """Giờ giao dịch (máy chạy giờ VN): T2-T6, 9:00-11:30 & 13:00-15:00.
    HOSE khớp lệnh dừng 14:45 (ATC 14:30-14:45) nhưng HNX có PLO 14:45-15:00 và
    UPCOM khớp liên tục tới 15:00 — canh tới 15:00 phủ đủ 3 sàn (xác minh 16/07)."""
    n = now or datetime.now()
    if n.weekday() >= 5:
        return False
    hm = n.hour * 60 + n.minute
    return (9 * 60 <= hm <= 11 * 60 + 30) or (13 * 60 <= hm <= 15 * 60)


def _owner(db: Session) -> User | None:
    return db.scalar(select(User).where(User.role == "owner")) or db.scalar(select(User))


def _day() -> str:
    return datetime.now().strftime("%Y-%m-%d")


# ----------------------------- rules engine -----------------------------
def _scan(db: Session, *, force: bool = False) -> list[dict]:
    """Một lượt quét → list event {rule, ticker, severe, title, fact}.
    force=True (nút/lệnh test): bỏ qua enabled + cooldown, vẫn dùng giá thật."""
    from app.services import tradingagents as ta

    owner = _owner(db)
    if not owner:
        return []
    cfg = alerts_of(owner)
    if not cfg["enabled"] and not force:
        return []
    holdings = list((owner.settings or {}).get("holdings") or [])
    by_tk = {h["ticker"]: h for h in holdings}
    wl = rec.get_watchlist(db)
    tickers = sorted((set(by_tk) | set(wl)) - set(cfg["off"]))
    if not tickers:
        return []
    hon = rec.honorific(owner)
    quotes = ta._price_board_batch(tickers, fresh=True)
    try:  # nuôi sổ lịch sử khối ngoại (foreign_flows) — mỗi lượt quét ghi đè số trong ngày
        from app.services.foreign_flows import record_today
        record_today({t: (quotes.get(t) or {}).get("foreign_net") for t in tickers})
    except Exception:  # noqa: BLE001
        pass
    day = _day()
    events: list[dict] = []

    def _hit(rule: str, tk: str, severe: bool, title: str, fact: str) -> None:
        key = f"{day}:{rule}:{tk}"
        if key in _fired and not force:
            return
        _fired.add(key)
        events.append({"rule": rule, "ticker": tk, "severe": severe, "title": title, "fact": fact, "hon": hon})

    for tk in tickers:
        q = quotes.get(tk) or {}
        price, ref = q.get("price"), q.get("ref")
        ceil_, floor_ = q.get("ceiling"), q.get("floor")
        chg = q.get("change")
        if price is None:
            continue
        h = by_tk.get(tk)
        pos = ""
        if h and h.get("avg"):
            pnl_pct = round((price - h["avg"]) / h["avg"] * 100, 2)
            pk = f"{day}:{tk}"
            _peak_pnl[pk] = max(_peak_pnl.get(pk, pnl_pct), pnl_pct)
            pos = f"{hon.capitalize()} giữ {h['qty']:,.0f}cp vốn {h['avg']} → lãi/lỗ {pnl_pct:+}%."
        # ① rơi nhanh so tham chiếu
        if chg is not None and chg <= -cfg["drop_pct"]:
            _hit("drop", tk, False, f"⚠️ **{tk} {chg:+}%** còn {price} (tham chiếu {ref})", pos)
        # ② chạm biên độ
        if floor_ and price <= floor_:
            _hit("floor", tk, True, f"🧊 **{tk} NẰM SÀN {floor_}** (tham chiếu {ref})", pos)
        elif ceil_ and price >= ceil_:
            _hit("ceiling", tk, False, f"🟣 **{tk} KỊCH TRẦN {ceil_}** (tham chiếu {ref})", pos)
        # ③ rủi ro P/L cá nhân (chỉ mã đang giữ)
        if h and h.get("avg"):
            if price < h["avg"]:
                _hit("cost_break", tk, True,
                     f"📉 **{tk} thủng giá vốn {h['avg']}** — đang {price}", pos)
            else:
                pk = f"{day}:{tk}"
                peak = _peak_pnl.get(pk, 0.0)
                cur = round((price - h["avg"]) / h["avg"] * 100, 2)
                if peak > 0 and peak - cur >= cfg["trail_pct"]:
                    _hit("trail", tk, False,
                         f"📉 **{tk}: lãi tụt từ +{peak}% còn +{cur}%** (giá {price})", pos)
        # ⑤ luật riêng "dưới X" / "vượt X" (chiều lên thêm 16/07 — user đặt qua chat)
        for c in cfg["custom"]:
            if str(c.get("ticker", "")).upper() != tk:
                continue
            if c.get("below") and price <= float(c["below"]):
                _hit("below", tk, False,
                     f"🔻 **{tk} chạm mốc {hon} đặt: {price} ≤ {c['below']}**", pos)
            if c.get("above") and price >= float(c["above"]):
                _hit("above", tk, False,
                     f"🚀 **{tk} vượt mốc {hon} đặt: {price} ≥ {c['above']}**", pos)
        # ⑥ khối ngoại gom / xả LỚN + đảo chiều MUA LẠI (user hỏi 23/07) — giá trị ròng
        # trong phiên = ròng(cp) × giá khớp; ngưỡng cfg['foreign_b'] tỷ VND
        fnet = q.get("foreign_net")
        if fnet is not None and price:
            net_b = round(fnet * price * 1000 / 1e9, 2)  # tỷ VND
            if net_b <= -cfg["foreign_b"]:
                _hit("foreign_dump", tk, False,
                     f"🌏🔻 **{tk}: khối ngoại XẢ {abs(net_b)} tỷ** ({fnet:+,}cp trong phiên)", pos)
            elif net_b >= cfg["foreign_b"]:
                _hit("foreign_buy", tk, False,
                     f"🌏💰 **{tk}: khối ngoại GOM {net_b} tỷ** ({fnet:+,}cp trong phiên)", pos)
            elif net_b >= 1.0:
                # mua ròng chưa lớn nhưng ĐẢO CHIỀU sau chuỗi phiên bán ròng (sổ lịch sử)
                try:
                    from app.services.foreign_flows import _load_ledger
                    led = _load_ledger()
                    prev = [d for d in sorted(led) if d < day and led[d].get(tk) is not None]
                    streak = 0
                    for d in reversed(prev):
                        if led[d][tk] < 0:
                            streak += 1
                        else:
                            break
                    if streak >= 2:
                        _hit("foreign_reversal", tk, False,
                             f"🌏🔄 **{tk}: khối ngoại MUA LẠI (+{net_b} tỷ) sau {streak} phiên bán ròng**", pos)
                except Exception:  # noqa: BLE001
                    pass

    # ④ VN-Index
    m = ta.market_overview()
    if m and m.get("change") is not None and m["change"] <= -cfg["index_pct"]:
        big = max(holdings, key=lambda h: h.get("qty", 0) * h.get("avg", 0), default=None)
        _hit("index", big["ticker"] if big else "", True,
             f"🌊 **VN-Index {m['change']:+}%** còn {m['close']:.2f} — rủi ro cả thị trường",
             f"Cao {m['high']:.2f} · thấp {m['low']:.2f}.")
    return events


# ----------------------------- delivery -----------------------------
def _tier1_line(ev: dict) -> str:
    """2-3 câu hành động của Sage — 1 call 9Router nhỏ, chỉ dùng số trong event."""
    from app.services import ninerouter

    try:
        out = ninerouter.chat(
            [{"role": "system", "content": (f"{rec.ADVISOR['persona']} {rec.hon_line(ev.get('hon', 'anh'))} {rec.ANTI_HALLUCINATION} "
              "Trả lời 2-3 câu NGẮN, hành động cụ thể kèm mức giá (giữ/hạ tỷ trọng/cắt/quan sát), "
              "KHÔNG markdown, KHÔNG lặp lại con số tiêu đề. Kết: 'Nghiên cứu, không phải lời khuyên đầu tư.'")},
             {"role": "user", "content": f"Cảnh báo vừa nổ: {ev['title']}. {ev['fact']} Khuyên hành động ngay?"}],
            temperature=0.3, max_tokens=220,
        )["content"] or ""
        return out.strip()
    except Exception:  # noqa: BLE001
        return ""


def _tg_send(text: str, account: str = "trading") -> bool:
    """Đẩy thẳng tin ra Telegram — plain send, không agent turn (account = bot gửi)."""
    if not settings.OPENCLAW_ENABLED:
        return False
    plain = re.sub(r"\*\*|__|`", "", text)[:3800]
    import shlex

    cmd = (f"openclaw message send --channel telegram --account {shlex.quote(account)} "
           f"--target {shlex.quote(settings.OPENCLAW_TELEGRAM_CHAT)} --message {shlex.quote(plain)}")
    ok = False
    try:
        r = subprocess.run(["wsl.exe", "-e", "bash", "-lc", cmd + " 2>/dev/null"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90)
        ok = "Sent via telegram" in ((r.stdout or "") + (r.stderr or ""))
    except Exception:  # noqa: BLE001
        ok = False
    try:  # biên nhận để soi khi nghi mất đồng bộ (tail backend/tg_outbound.log)
        import os
        with open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "tg_outbound.log"), "a", encoding="utf-8") as f:
            f.write(f"{datetime.now().isoformat(timespec='seconds')} ok={ok} acc={account} | {plain[:80].replace(chr(10), ' ')}\n")
    except Exception:  # noqa: BLE001
        pass
    return ok


def _post_channel(db: Session, text: str) -> None:
    if not db.get(Channel, "chung-khoan"):
        return
    db.add(Message(
        id=uid("m"), channel_id="chung-khoan", authorName=rec.ADVISOR["name"], time=now_hm(),
        avatarInitial=rec.ADVISOR["initial"], avatarColor=rec.ADVISOR["color"], isAgent=True,
        raw=rec.md_to_blocks(text), sort=next_sort(db, Message),
    ))
    db.commit()


def _notify(db: Session, ev: dict) -> None:
    db.add(Notification(
        id=uid("n"), group="Hôm nay", type="alert", actor="Vệ sĩ giá", initial="🛡",
        color="#C94F3D", action=re.sub(r"\*\*", "", ev["title"])[:110],
        preview=(ev.get("fact") or "")[:110], time=now_hm(), unread=True,
        sort=rec._top_sort(db, Notification),
    ))
    db.commit()


def _tier2_deep(ticker: str) -> None:
    """Sự kiện nặng → pipeline 5-agent + tổng hợp (same shape báo cáo sáng) → post đủ 3 nơi."""
    from app.services import ninerouter

    pdb = SessionLocal()
    try:
        hon = rec.owner_honorific(pdb)
        outputs, _ok, headline = rec.run_pipeline(pdb, ticker)
    finally:
        pdb.close()
    team = "\n".join(f"[{a['name']} · {a['role']}]: {t}" for a, t in outputs)
    system = {"role": "system", "content": (f"{rec.ADVISOR['persona']} {rec.hon_line(hon)} {rec.ANTI_HALLUCINATION} "
              "KHÔNG lặp lại dòng giá đầu (đã có). Công cụ nghiên cứu, KHÔNG phải lời khuyên đầu tư.")}
    user = {"role": "user", "content": (f"CẢNH BÁO RỦI RO vừa nổ với {ticker} — phân tích lại NGAY.\n"
            f"Kết quả team (giá real-time):\n{team[:3200]}\n\n"
            "Tổng hợp NGẮN: Khuyến nghị (MUA/BÁN/GIỮ) + vùng mua/chốt lời/cắt lỗ + 1 câu rủi ro. "
            + rec.PRICE_BAND_LINE)}
    try:
        synth = ninerouter.chat([system, user, {"role": "system", "content": headline}],
                                temperature=0.3, max_tokens=950)["content"] or ""
    except Exception:  # noqa: BLE001
        synth = outputs[-1][1] if outputs else ""
    text = f"🛡️ **Phân tích khẩn sau cảnh báo — {ticker}**\n\n{headline}\n\n{synth}".strip()
    db = SessionLocal()
    try:
        _post_channel(db, text)
    finally:
        db.close()
    _tg_send(text)


def _deliver(db: Session, ev: dict) -> None:
    sage = _tier1_line(ev)
    text = ev["title"] + ("\n" + ev["fact"] if ev.get("fact") else "")
    if sage:
        text += f"\n💼 Sage: {sage}"
    _post_channel(db, text)
    _notify(db, ev)
    _tg_send(text)
    if ev["severe"] and ev.get("ticker"):
        threading.Thread(target=_tier2_deep, args=(ev["ticker"],), daemon=True).start()


def run_tick(*, force: bool = False) -> list[dict]:
    """Một nhịp quét + gửi. Trả events (cho endpoint test)."""
    db = SessionLocal()
    try:
        events = _scan(db, force=force)
        for ev in events:
            try:
                _deliver(db, ev)
            except Exception:  # noqa: BLE001
                db.rollback()
        return events
    finally:
        db.close()


def start_price_guard() -> None:
    global _started
    if _started or not settings.TRADINGAGENTS_ENABLED:
        return
    _started = True

    def _loop() -> None:
        time.sleep(25)  # chờ warmup giá lúc boot
        while True:
            if in_session():
                try:
                    run_tick()
                except Exception:  # noqa: BLE001
                    pass
            time.sleep(PG_INTERVAL)

    threading.Thread(target=_loop, daemon=True, name="price-guard").start()
