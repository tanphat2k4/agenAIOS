"""Mirror Telegram ↔ #chung-khoan / #vang-bac bằng cách TAIL transcript phiên OpenClaw
(agents trading / metals) — máy móc, KHÔNG phụ thuộc bot có chịu gọi relay hay không.

Vì sao cần (21/07): relay đã nhanh nhưng bot trading "nhớ" trong phiên chat rằng relay
từng lỗi 2 lần hồi sáng → nó bỏ relay, tự trả lời → kênh mất tin. Parity không được
phép phụ thuộc LLM ngoan: tail transcript như kênh nhạc (music.sync_telegram) là đường
đồng bộ VÔ ĐIỀU KIỆN; relay vẫn giữ nguyên để chạy pipeline + Agent Workflow khi được gọi.

Dedupe theo text (so [:120] với ~60 tin gần nhất của kênh) nên hội thoại relay đã lưu
không bị đăng đôi; bot rephrase khác chữ thì có thể lọt 1 bản gần-trùng — chấp nhận,
còn hơn mất tin. Boot từ đuôi file (không backfill lịch sử)."""

import json
import subprocess
import threading
import time
import os

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.crud import next_sort, now_hm, uid
from app.models.comms import Channel, Message
from app.models.user import User
from app.services import trading_record as rec
from app.services.music import _is_internal_noise, _strip_wrappers

_STATE = os.path.join(os.path.dirname(__file__), "..", "..", ".trading_sync.json")
_DAEMON = {"on": False}

# tin user do HỆ THỐNG bơm vào phiên (prompt báo cáo sáng…) — không phải lời chủ gõ;
# skip cả reply NGAY SAU nó (bản tin sáng đã được morning_report tự post lên kênh rồi)
_SYSTEM_PROMPTS = ("Viết báo cáo sáng", "TÓM TẮT batch week")

_MIRRORS = [
    {"agent": "trading", "channel": "chung-khoan"},
    {"agent": "metals", "channel": "vang-bac"},
]


def _bot_identity(agent: str) -> tuple[str, str, str]:
    if agent == "metals":
        try:
            from app.routers.metals import AURUM  # lazy — tránh vòng import lúc nạp module

            return AURUM.get("name", "Aurum"), AURUM.get("initial", "Au"), AURUM.get("color", "#B8860B")
        except Exception:  # noqa: BLE001
            return "Aurum", "Au", "#B8860B"
    return rec.ADVISOR["name"], rec.ADVISOR["initial"], rec.ADVISOR["color"]


def _load_state() -> dict:
    try:
        with open(_STATE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return {}


def _save_state(st: dict) -> None:
    try:
        with open(_STATE, "w", encoding="utf-8") as f:
            json.dump(st, f)
    except Exception:  # noqa: BLE001
        pass


def _norm(txt: str) -> str:
    """Chuẩn hóa để so trùng: markdown bold khi trích lại sinh dấu cách đôi ('Sage  đang')
    còn transcript là 1 dấu cách → so thô trượt → interim đăng đôi (bắt được 21/07)."""
    return " ".join((txt or "").split())[:120]


def _recent_texts(db: Session, channel_id: str, n: int = 60) -> set:
    out = set()
    for m in db.scalars(select(Message).where(Message.channel_id == channel_id)
                        .order_by(Message.sort.desc()).limit(n)):
        txt = " ".join(s.get("v", "") for b in (m.raw or []) for s in b.get("rich", []) if isinstance(s, dict))
        out.add(_norm(txt))
    return out


def _session_entries(agent: str) -> tuple[str, list]:
    """File phiên MỚI NHẤT của agent (bỏ trajectory/reset) + entries (id, role, text)."""
    sess_dir = f"/root/.openclaw/agents/{agent}/sessions"
    ls = subprocess.run(["wsl.exe", "-e", "bash", "-lc",
                         f"ls -t {sess_dir}/*.jsonl 2>/dev/null | grep -v trajectory | grep -v reset | head -1"],
                        capture_output=True, text=True, timeout=15)
    path = (ls.stdout or "").strip()
    if not path:
        return "", []
    cat = subprocess.run(["wsl.exe", "-e", "bash", "-lc", f"cat {path} 2>/dev/null"],
                         capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
    out = []
    for line in (cat.stdout or "").split("\n"):
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except Exception:  # noqa: BLE001
            continue
        m = d.get("message") or {}
        role = m.get("role")
        if role not in ("user", "assistant"):
            continue
        c = m.get("content")
        if isinstance(c, list):
            text = " ".join(x.get("text", "") for x in c if isinstance(x, dict) and x.get("type") == "text").strip()
        else:
            text = str(c or "").strip()
        if text:
            out.append({"id": d.get("id"), "role": role, "text": text})
    return path, out


def _sync_agent(db: Session, cfg: dict, st: dict) -> int:
    agent, channel_id = cfg["agent"], cfg["channel"]
    if not db.get(Channel, channel_id):
        return 0
    path, entries = _session_entries(agent)
    if not entries:
        return 0
    ast = st.setdefault(agent, {})
    if ast.get("path") != path:
        # phiên mới (hoặc lần đầu): bắt đầu từ ĐUÔI — không đổ lịch sử cũ vào kênh
        st[agent] = {"path": path, "last_id": entries[-1]["id"]}
        return 0
    seen = {e["id"]: i for i, e in enumerate(entries)}
    start = seen.get(ast.get("last_id"), -1) + 1
    if start >= len(entries):
        return 0
    recent = _recent_texts(db, channel_id)
    owner = db.scalar(select(User).where(User.role == "owner")) or db.scalar(select(User))
    bot_name, bot_init, bot_color = _bot_identity(agent)
    added = 0
    skip_next_assistant = False
    for e in entries[start:]:
        txt = e["text"]
        if e["role"] == "user":
            txt = _strip_wrappers(txt)
            if any(k in txt for k in _SYSTEM_PROMPTS):
                skip_next_assistant = True  # prompt hệ thống + bản tin trả lời nó đều không mirror
                continue
        if e["role"] == "assistant" and skip_next_assistant:
            skip_next_assistant = False
            continue
        if _is_internal_noise(e["role"], txt) or not txt.strip():
            continue
        if _norm(txt) in recent:  # relay/app đã lưu rồi — không đăng đôi
            continue
        if e["role"] == "user" and owner:
            db.add(Message(id=uid("m"), channel_id=channel_id, authorName=owner.name, time=now_hm(),
                           avatarInitial=owner.initial, avatarColor=owner.color, isAgent=False,
                           raw=[{"kind": "para", "rich": [{"v": txt, "isText": True}]}],
                           sort=next_sort(db, Message)))
            added += 1
        elif e["role"] == "assistant":
            db.add(Message(id=uid("m"), channel_id=channel_id, authorName=bot_name, time=now_hm(),
                           avatarInitial=bot_init, avatarColor=bot_color, isAgent=True,
                           raw=rec.md_to_blocks(txt), sort=next_sort(db, Message)))
            added += 1
        recent.add(_norm(txt))
    if added:
        db.commit()
    st[agent] = {"path": path, "last_id": entries[-1]["id"]}
    return added


def sync_once() -> int:
    st = _load_state()
    total = 0
    db = SessionLocal()
    try:
        for cfg in _MIRRORS:
            try:
                total += _sync_agent(db, cfg, st)
            except Exception:  # noqa: BLE001
                db.rollback()
    finally:
        db.close()
    _save_state(st)
    return total


def start_trading_tg_sync() -> None:
    if _DAEMON["on"]:
        return
    _DAEMON["on"] = True

    def _loop() -> None:
        time.sleep(12)  # cho backend ổn định sau boot
        while True:
            try:
                sync_once()
            except Exception:  # noqa: BLE001
                pass
            time.sleep(6)

    threading.Thread(target=_loop, daemon=True, name="trading-tg-sync").start()
