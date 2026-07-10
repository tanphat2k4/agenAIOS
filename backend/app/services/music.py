"""Music Trend pipeline ("Beat" / `music-orchestrator`) integration.

Twin of the trading integration: AgentAIOS triggers the OpenClaw `music-orchestrator`
agent (which runs the 9-stage batch pipeline + delivers to Telegram), and mirrors
the result in-app. M1 = scaffolding (agents/room/channel/workflow) + batch trigger.
We do NOT touch the live music-system in WSL — only trigger + mirror.
"""

import json
import re
import shlex
import subprocess

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud import next_sort, now_hm, today_ymd, uid
from app.models.agents import Agent, CronJob, Workflow
from app.models.comms import Channel, Message, Notification, Room
from app.models.ops import KnowledgeEntry
from app.models.user import User
from app.services import trading_record as rec  # reuse md_to_blocks + _top_sort

MUSIC_AGENT = "music-orchestrator"
CHANNEL_ID = "am-nhac"
ROOM_ID = "room-am-nhac"
WF_ID = "wf-music-batch"
_BOT = ("Beat", "B", "#8B5CF6")  # the orchestrator's display identity

# The live music-system pipeline (Research → … → Clipmaker) as 9 distinct agents.
_PIPELINE = [
    {"id": "agent-mu-research", "name": "Research", "role": "Nghiên cứu trend nhạc VN", "initial": "Re", "color": "#3B5BDB", "io": "Trend TikTok/YT/Spotify + dữ kiện thực tế"},
    {"id": "agent-mu-strategy", "name": "Strategy", "role": "Xây batch concept", "initial": "St", "color": "#E8A33D", "io": "3–5 concept theo tỷ lệ vàng"},
    {"id": "agent-mu-songwriter", "name": "Songwriter", "role": "Viết lời (meta-tag Suno)", "initial": "So", "color": "#0A7B52", "io": "Lời đầy đủ, prosody khớp dấu"},
    {"id": "agent-mu-factcheck", "name": "Fact-check", "role": "Soi chi tiết đời thực", "initial": "Fc", "color": "#C94F3D", "io": "Sửa chi tiết sai/vô lý"},
    {"id": "agent-mu-arrangement", "name": "Arrangement", "role": "Sound brief + style Suno", "initial": "Ar", "color": "#0EA5A0", "io": "Style prompt + cover + release pack"},
    {"id": "agent-mu-reviewer", "name": "Reviewer", "role": "QC nguyên gốc/prosody", "initial": "Rv", "color": "#9A6A1B", "io": "Red-line đạo nhạc/lời"},
    {"id": "agent-mu-scorer", "name": "Scorer", "role": "Chấm hit-potential", "initial": "Sc", "color": "#8B5CF6", "io": "8 tiêu chí /100 + JSON"},
    {"id": "agent-mu-reviser", "name": "Reviser", "role": "Áp sửa QC vào lời", "initial": "Rs", "color": "#DB2777", "io": "Sửa từ/cụm QC flag (câu cũ→mới)"},
    {"id": "agent-mu-producer", "name": "Producer", "role": "Gọi Suno generate", "initial": "Pr", "color": "#3B82C4", "io": "Payload → Suno (~6'/bài)", "manual": True},
    {"id": "agent-mu-clipmaker", "name": "Clipmaker", "role": "Audio → video clip", "initial": "Cl", "color": "#C0392B", "io": "YT / TikTok / Canvas (ffmpeg + ComfyUI)", "manual": True},
]


# ----------------------------- ensure scaffolding -----------------------------
def ensure_music_agents(db: Session) -> list:
    out = []
    for i, a in enumerate(_PIPELINE):
        ag = db.get(Agent, a["id"])  # dedup by id (rename-safe)
        if not ag:
            ag = Agent(
                id=a["id"], name=a["name"], handle="@" + a["id"].replace("agent-mu-", ""), role=a["role"],
                roleType="research", initial=a["initial"], color=a["color"], status="online",
                model="qwen3.6:27b", modelType="local", tasks=0, rooms=1, success=100, skills=[a["io"]],
                lastActive="vừa xong", bio=f"{a['role']} — hệ làm nhạc AI bắt trend VN (Beat / music-orchestrator).",
                roomsList=["#am-nhac"], recentTasks=[], sort=-10 - i,
            )
            db.add(ag)
        else:
            ag.name, ag.role, ag.initial, ag.color = a["name"], a["role"], a["initial"], a["color"]
        out.append(ag)
    db.commit()
    return out


def ensure_music_channel(db: Session) -> Channel:
    from app.routers.channels import add_channel_member

    ch = db.get(Channel, CHANNEL_ID)
    if not ch:
        ch = Channel(
            id=CHANNEL_ID, kind="public", name="Âm nhạc 🎵",
            desc='Pipeline làm nhạc AI bắt trend VN (Beat/Suno) — gõ "chạy batch tuần này"',
            visibility="PUBLIC", members=1, tasks=[], wfTotal=0,
            wfNote="Hệ làm nhạc AI bắt trend (music-orchestrator).", unread=0, sort=-2,
        )
        db.add(ch)
        db.commit()
    owner = db.scalar(select(User).where(User.role == "owner")) or db.scalar(select(User))
    if owner:
        add_channel_member(db, CHANNEL_ID, name=owner.name, initial=owner.initial, color=owner.color,
                           role="Owner" if getattr(owner, "role", "") == "owner" else "Member", userId=owner.id)
    add_channel_member(db, CHANNEL_ID, name=_BOT[0], initial=_BOT[1], color=_BOT[2], role="Agent", isAgent=True)
    for a in _PIPELINE:
        add_channel_member(db, CHANNEL_ID, name=a["name"], initial=a["initial"], color=a["color"], role="Agent", isAgent=True)
    return ch


def ensure_music_room(db: Session) -> Room:
    owner = db.scalar(select(User).where(User.role == "owner")) or db.scalar(select(User))
    want: list = []
    if owner:
        want.append({"name": owner.name, "handle": "@" + (owner.name.split()[0].lower() if owner.name else "owner"),
                     "type": "user", "role": "lead", "initial": owner.initial, "color": owner.color})
    for a in _PIPELINE:
        want.append({"name": a["name"], "handle": "@" + a["id"].replace("agent-mu-", ""),
                     "type": "agent", "role": "staff", "initial": a["initial"], "color": a["color"]})
    r = db.get(Room, ROOM_ID)
    if not r:
        r = Room(id=ROOM_ID, name="Âm nhạc", slug="am-nhac", channel="am-nhac", members=want, sort=-2)
        db.add(r)
    else:
        r.members = want
    db.commit()
    return r


_WF_DESC = ("Pipeline 10 khâu: Research → Strategy → Songwriter → Fact-check → Arrangement → "
            "Reviewer → Scorer → Reviser → Producer → Clipmaker.")


def ensure_music_workflow(db: Session) -> Workflow:
    steps = [{"agent": a["name"], "initial": a["initial"], "color": a["color"], "title": a["role"], "io": a["io"], "status": "idle", "dur": "", "manual": a.get("manual", False)} for a in _PIPELINE]
    w = db.get(Workflow, WF_ID)
    if not w:
        w = Workflow(
            id=WF_ID, name="Làm nhạc bắt trend (Beat)",
            desc=_WF_DESC,
            trigger="manual", triggerLabel="Khi chạy batch tuần", enabled=True, lastRun="", runs24=0,
            success=100, steps=steps, runs=[], runState="idle", sort=-2,
        )
        db.add(w)
        db.commit()
        return w
    if not w.steps or len(w.steps) != len(steps) or w.steps[0].get("agent") != steps[0]["agent"]:
        w.steps = steps            # rebuild when the pipeline shape changes (e.g. Reviser added: 9→10 steps)
        w.desc = _WF_DESC
        db.commit()
    elif any("manual" not in (s or {}) for s in w.steps):
        # migrate old rows: add the `manual` flag without disturbing live statuses
        w.steps = [{**s, "manual": steps[i].get("manual", False)} for i, s in enumerate(w.steps)]
        db.commit()
    return w


MUSIC_CRON_ID = "cron-music-weekly"


def ensure_music_cron(db: Session) -> CronJob:
    c = db.get(CronJob, MUSIC_CRON_ID)
    if c:
        return c
    c = CronJob(
        id=MUSIC_CRON_ID, name="Batch nhạc tuần", target="Beat · 5 bài bắt trend / tuần", expr="0 8 * * 1",
        last="—", next="T2 08:00", creator="Hệ thống", creatorInitial="H", creatorColor="#8B5CF6",
        enabled=True, spark=[0, 0, 0, 0, 0, 0, 0], sort=-1,
    )
    db.add(c)
    db.commit()
    return c


def ensure_music_all(db: Session) -> None:
    ensure_music_agents(db)
    ensure_music_channel(db)
    ensure_music_room(db)
    ensure_music_workflow(db)
    ensure_music_cron(db)


# ----------------------------- read the active batch (M2) -----------------------------
_MUSIC_WS = "/root/.openclaw/workspaces/music-system"


def _wsl_cat(path: str) -> str:
    """Read a file from the live WSL music-system workspace (read-only)."""
    try:
        proc = subprocess.run(
            ["wsl.exe", "-e", "bash", "-lc", f"cat {shlex.quote(path)} 2>/dev/null"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20,
        )
        return proc.stdout or ""
    except Exception:  # noqa: BLE001
        return ""


# Automatic batch = Research→Reviser (8 stages). Each writes one file into the
# active batch dir, in pipeline order. Producer/Clipmaker are on-demand (Suno is
# never auto-fired), so they have no file here and stay idle during a batch run.
_STAGE_FILES = [
    "research.md", "strategy.md", "lyrics.md", "factcheck.md",
    "arrangement.md", "review.md", "score.md", "revise.md",
]


def _wsl_mtime(path: str) -> float:
    """mtime (epoch secs) of a WSL file, or 0.0 if it doesn't exist."""
    try:
        proc = subprocess.run(
            ["wsl.exe", "-e", "bash", "-lc", f"stat -c %Y {shlex.quote(path)} 2>/dev/null || echo 0"],
            capture_output=True, text=True, timeout=10,
        )
        return float((proc.stdout or "0").strip() or 0)
    except Exception:  # noqa: BLE001
        return 0.0


def _count_done_stages(since: float) -> int:
    """How many pipeline stages have finished THIS run: stage output files in the
    active batch dir with a fresh mtime (>= run start), counted in order (stages
    are sequential → stop at the first not-yet-written)."""
    batch_dir = (_wsl_cat(f"{_MUSIC_WS}/output/.active_batch") or "").strip().split("\n")[0].strip()
    if not batch_dir:
        return 0
    done = 0
    for f in _STAGE_FILES:
        if _wsl_mtime(f"{batch_dir}/{f}") >= since - 30:
            done += 1
        else:
            break
    return done


_watcher_active = {"on": False}


def _apply_steps(done: int, run_state: str | None = None) -> None:
    """Set workflow steps (own session): 0..done-1 = done, `done` = running, rest idle."""
    from app.core.database import SessionLocal

    db2 = SessionLocal()
    try:
        w = db2.get(Workflow, WF_ID)
        if w and w.steps:
            w.steps = [
                {**s, "status": ("done" if i < done
                                 else "running" if i == done and i < len(_STAGE_FILES)
                                 else "idle")}
                for i, s in enumerate(w.steps)
            ]
            if run_state is not None:
                w.runState = run_state
            db2.commit()
    finally:
        db2.close()


def _finalize_watch(done: int) -> None:
    from app.core.database import SessionLocal

    db3 = SessionLocal()
    try:
        w = db3.get(Workflow, WF_ID)
        if w and w.steps:
            w.steps = [{**s, "status": ("done" if i < done else "idle")} for i, s in enumerate(w.steps)]
            w.runState = "idle"
            if done >= len(_STAGE_FILES):
                w.lastRun = now_hm()
                w.runs24 = (w.runs24 or 0) + 1
                w.runs = [{"time": now_hm(), "date": today_ymd(), "status": "success", "dur": ""}, *(w.runs or [])][:200]
            db3.commit()
    finally:
        db3.close()


def _watch_stages(since: float) -> None:
    """Drive the workflow card in realtime by watching WSL stage files until the
    batch finishes (revise.md) or times out. Owns w.steps + runState for the run.
    Polls FILES (not the agent), so it works whether Beat blocks ~15' or spawns
    the pipeline async and replies immediately — and for both the button + chat."""
    import time as _t

    start = _t.time()
    last = 0
    idle_since = start
    try:
        while _t.time() - start < 1800:  # 30-min hard cap
            try:
                done = max(last, _count_done_stages(since))
            except Exception:  # noqa: BLE001
                done = last
            if done != last:
                last = done
                idle_since = _t.time()
                _apply_steps(done, run_state="running")
            if done >= len(_STAGE_FILES):
                break  # all 8 batch stages done (revise.md present)
            if _t.time() - idle_since > 900:
                break  # 15-min with no new stage → stop tracking (stalled/done)
            _t.sleep(8)
    finally:
        try:
            final = max(last, _count_done_stages(since))
        except Exception:  # noqa: BLE001
            final = last
        _finalize_watch(final)
        _watcher_active["on"] = False


def start_stage_watcher() -> None:
    """Begin realtime per-stage tracking of a batch (idempotent — one watcher at a
    time). Marks the card RUNNING now, then a daemon thread advances it as WSL
    stage files appear. Call from run_batch AND the chat trigger."""
    import threading
    import time as _t

    if _watcher_active["on"]:
        return
    _watcher_active["on"] = True
    try:
        _apply_steps(0, run_state="running")
    except Exception:  # noqa: BLE001
        pass
    # since = 15' ago so an already-in-progress run (files just written) is caught up.
    threading.Thread(target=_watch_stages, args=(_t.time() - 900,), daemon=True).start()


def _parse_lyrics(md: str) -> list:
    """lyrics.md → songs, split on '## Bài N: <title>'."""
    parts = re.split(r"(?m)^## Bài \d+:\s*(.+)$", md or "")
    songs = []
    for i in range(1, len(parts), 2):
        title = parts[i].strip()
        body = (parts[i + 1] if i + 1 < len(parts) else "").strip()
        songs.append({"title": title, "lyrics": body[:4000]})
    return songs


def _parse_ranking(md: str) -> dict:
    """score.md ranking lines ('🥇 <title> — <score> · <category> · …') → {title: {score, category}}."""
    out: dict = {}
    for line in (md or "").splitlines():
        m = re.match(r"^\s*\S+\s+(.+?)\s+—\s+([\d.]+)\s*·\s*([^·\n]+)", line)
        if m:
            out[m.group(1).strip()] = {"score": m.group(2).strip(), "category": m.group(3).strip()}
    return out


def read_batch() -> dict:
    """Surface the active music batch (songs + lyrics + hit-scores) for in-app review."""
    batch_dir = (_wsl_cat(f"{_MUSIC_WS}/output/.active_batch") or "").strip().split("\n")[0].strip()
    if not batch_dir:
        return {"week": "", "songs": [], "count": 0, "note": "Chưa có batch active — chạy batch tuần trước đã."}
    songs = _parse_lyrics(_wsl_cat(f"{batch_dir}/lyrics.md"))
    ranking = _parse_ranking(_wsl_cat(f"{batch_dir}/score.md"))
    try:
        state = json.loads(_wsl_cat(f"{batch_dir}/state.json") or "{}")
    except Exception:  # noqa: BLE001
        state = {}
    by_title = {(v.get("title") or "").strip(): (k, v) for k, v in state.items()}
    for s in songs:
        info = ranking.get(s["title"])
        if info:
            s.update(info)
        st = by_title.get(s["title"].strip())
        if st:
            slug, sv = st
            s["slug"] = slug
            s["generated"] = bool(sv.get("generated"))
            s["picked"] = sv.get("picked") or ""  # 'v1' | 'v2' | 'both' | 'skip' | ''
            s["clipped"] = bool(sv.get("clipped"))
    return {"week": batch_dir.rsplit("/", 1)[-1], "songs": songs, "count": len(songs)}


def _wsl_port_up(host: str, port: int) -> bool:
    try:
        r = subprocess.run(
            ["wsl.exe", "-e", "bash", "-lc", f"timeout 3 bash -c '</dev/tcp/{host}/{port}' 2>/dev/null && echo up || echo down"],
            capture_output=True, text=True, timeout=10,
        )
        return "up" in (r.stdout or "")
    except Exception:  # noqa: BLE001
        return False


def infra_health() -> dict:
    """Ping the music pipeline's external infra (Suno-bot on PC-B + ComfyUI on PC-A)."""
    return {"suno_bot": _wsl_port_up("192.168.1.3", 1243), "comfyui": _wsl_port_up("192.168.1.4", 8188)}


# ----------------------------- batch trigger -----------------------------
def run_batch(db: Session, *, prompt: str = "Chạy batch nhạc tuần này") -> str:
    """Trigger Beat (music-orchestrator) via OpenClaw → it runs the pipeline +
    delivers to Telegram; mirror the reply in-app. Long-running (pipeline ~15')."""
    from app.services import openclaw

    # Realtime per-stage card: a background watcher advances the workflow as WSL
    # stage files appear — works whether Beat blocks ~15' or spawns async & replies
    # immediately. It owns w.steps / runState / runs for the run.
    start_stage_watcher()

    reply, delivered = openclaw.send_agent(prompt, agent=MUSIC_AGENT, deliver=True, timeout=1200)
    via = "OpenClaw → Telegram ✓" if delivered else "OpenClaw (Telegram chưa gửi được)"
    body = reply or "(Beat đang chạy pipeline nền — kết quả sẽ tới Telegram khi xong.)"
    report = f"# 🎵 Batch nhạc tuần — {now_hm()}\n\n{body}\n\n> Gửi qua {via}."

    try:
        if db.get(Channel, CHANNEL_ID):
            db.add(Message(
                id=uid("m"), channel_id=CHANNEL_ID, authorName=_BOT[0], time=now_hm(),
                avatarInitial=_BOT[1], avatarColor=_BOT[2], isAgent=True, raw=rec.md_to_blocks(report),
                sort=next_sort(db, Message),
            ))
        db.add(Notification(
            id=uid("n"), group="Hôm nay", type="event", actor=_BOT[0], initial=_BOT[1], color=_BOT[2],
            action="đã chạy batch nhạc tuần này", preview=(reply or "")[:110].replace("\n", " "),
            time=now_hm(), unread=True, sort=rec._top_sort(db, Notification),
        ))
        if reply:
            db.add(KnowledgeEntry(
                id=uid("kn"), type="note", title=f"Batch nhạc ({now_hm()})", repo="music/vn", ver="v1",
                time="vừa xong", private=False, avatars=[{"i": _BOT[1], "c": _BOT[2]}], content=report,
                sort=rec._top_sort(db, KnowledgeEntry),
            ))
        db.commit()  # workflow card (steps / runState / runs) is owned by the stage watcher
    except Exception:  # noqa: BLE001
        db.rollback()
    return report


# ----------------------- Telegram ↔ #am-nhac sync (2 chiều) -----------------------
# Chiều đi đã có (/music/chat). Chiều VỀ: poller đọc transcript session của Beat
# (read-only qua wsl cat) → mirror tin Telegram của chủ + trả lời của Beat vào kênh,
# và kéo mp3 đã generate từ Suno-bot (PC-B) về backend/uploads làm tin nghe được.
import os as _os
import time as _time

_SESS_DIR = "/root/.openclaw/agents/music-orchestrator/sessions"
_SYNC_STATE = _os.path.join(_os.path.dirname(__file__), "..", "..", ".music_sync.json")
_SUNO_BOT = "http://192.168.1.3:1243"
_sync_guard = {"t": 0.0}


def _load_sync_state() -> dict:
    try:
        with open(_SYNC_STATE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return {}


def _save_sync_state(st: dict) -> None:
    try:
        with open(_SYNC_STATE, "w", encoding="utf-8") as f:
            json.dump(st, f)
    except Exception:  # noqa: BLE001
        pass


def _recent_channel_texts(db: Session, n: int = 30) -> set:
    out = set()
    for m in db.scalars(select(Message).where(Message.channel_id == CHANNEL_ID).order_by(Message.sort.desc()).limit(n)):
        txt = " ".join(s.get("v", "") for b in (m.raw or []) for s in b.get("rich", []) if isinstance(s, dict))
        out.add(txt.strip()[:120])
    return out


def _session_entries() -> tuple[str, list]:
    """Newest Beat session file + its parsed message entries (id, role, text)."""
    ls = subprocess.run(["wsl.exe", "-e", "bash", "-lc", f"ls -t {_SESS_DIR}/*.jsonl 2>/dev/null | head -1"],
                        capture_output=True, text=True, timeout=15)
    path = (ls.stdout or "").strip()
    if not path:
        return "", []
    raw = _wsl_cat(path)
    out = []
    for line in raw.split("\n"):
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except Exception:  # noqa: BLE001
            continue
        if d.get("type") != "message":
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


def sync_telegram(db: Session) -> dict:
    """One sync tick (throttled 20s): mirror new Telegram exchange + pull new mp3s."""
    if _time.time() - _sync_guard["t"] < 20:
        return {"skipped": "throttled"}
    _sync_guard["t"] = _time.time()
    ensure_music_channel(db)
    st = _load_sync_state()
    path, entries = _session_entries()
    added = 0
    if entries:
        if st.get("path") != path:
            # new session file: don't backfill history — start from its tail
            st = {"path": path, "last_id": entries[-1]["id"], "boot": True}
            _save_sync_state(st)
        else:
            seen = {e["id"]: i for i, e in enumerate(entries)}
            start = seen.get(st.get("last_id"), -1) + 1
            recent = _recent_channel_texts(db)
            owner = db.scalar(select(User).where(User.role == "owner")) or db.scalar(select(User))
            for e in entries[start:]:
                txt = e["text"]
                if txt.strip()[:120] in recent:  # already in the channel (sent from the app)
                    continue
                if e["role"] == "user" and any(k in txt for k in ("Viết báo cáo sáng", "TÓM TẮT batch week")):
                    continue  # our own outbound prompts, not the user's Telegram words
                if e["role"] == "user" and owner:
                    db.add(Message(id=uid("m"), channel_id=CHANNEL_ID, authorName=owner.name, time=now_hm(),
                                   avatarInitial=owner.initial, avatarColor=owner.color, isAgent=False,
                                   raw=[{"kind": "para", "rich": [{"v": txt, "isText": True}]}],
                                   sort=next_sort(db, Message)))
                    added += 1
                elif e["role"] == "assistant":
                    db.add(Message(id=uid("m"), channel_id=CHANNEL_ID, authorName=_BOT[0], time=now_hm(),
                                   avatarInitial=_BOT[1], avatarColor=_BOT[2], isAgent=True,
                                   raw=rec.md_to_blocks(txt), sort=next_sort(db, Message)))
                    added += 1
            if added:
                db.commit()
            st = {"path": path, "last_id": entries[-1]["id"]}
            _save_sync_state(st)
    tracks = sync_generated_tracks(db)
    clips = sync_clips(db)
    return {"mirrored": added, **tracks, **clips}


def sync_generated_tracks(db: Session) -> dict:
    """Pull <slug>-v1/v2.mp3 for generated songs from the Suno-bot into backend/uploads
    and post them into #am-nhac as playable attachments. Dedupe = file already saved."""
    import httpx

    from app.routers.uploads import UPLOAD_DIR

    fetched: list[str] = []
    try:
        batch = read_batch()
    except Exception:  # noqa: BLE001
        return {"tracks": 0}
    for s in batch.get("songs", []):
        slug = s.get("slug")
        if not slug or not s.get("generated"):
            continue
        atts = []
        for v in (1, 2):
            fname = f"{slug}-v{v}.mp3"
            dest = UPLOAD_DIR / fname
            if dest.exists():
                continue
            try:
                r = httpx.get(f"{_SUNO_BOT}/api/v1/suno/file", params={"name": fname}, timeout=90)
                if r.status_code != 200 or not r.content:
                    continue
                dest.write_bytes(r.content)
                atts.append({"kind": "attach", "icon": "🎵", "name": f"{s.get('title', slug)} — bản {v}",
                             "label": f"{len(r.content) / 1e6:.1f} MB · mp3", "url": f"/uploads/{fname}",
                             "mime": "audio/mpeg", "fileKind": "audio"})
                fetched.append(fname)
            except Exception:  # noqa: BLE001
                continue
        if atts:
            raw = [{"kind": "para", "rich": [{"v": f"🎧 {s.get('title', slug)} — bản nghe thử từ Suno:", "isText": True}]}, *atts]
            db.add(Message(id=uid("m"), channel_id=CHANNEL_ID, authorName=_BOT[0], time=now_hm(),
                           avatarInitial=_BOT[1], avatarColor=_BOT[2], isAgent=True, raw=raw,
                           sort=next_sort(db, Message)))
            db.commit()
    return {"tracks": len(fetched)}


def sync_clips(db: Session) -> dict:
    """Mirror finished Clipmaker videos (<batch>/clips/*.mp4) into #am-nhac as playable
    attachments — the pipeline only pushes them to Telegram. Skips speed-variant files
    (-1.2x/-0.8x) and anything already copied into backend/uploads."""
    from app.routers.uploads import UPLOAD_DIR

    batch_dir = (_wsl_cat(f"{_MUSIC_WS}/output/.active_batch") or "").strip().split("\n")[0].strip()
    if not batch_dir:
        return {"clips": 0}
    try:
        ls = subprocess.run(["wsl.exe", "-e", "bash", "-lc", f"ls {shlex.quote(batch_dir)}/clips/*.mp4 2>/dev/null"],
                            capture_output=True, text=True, timeout=20)
        paths = [p.strip() for p in (ls.stdout or "").split("\n") if p.strip()]
    except Exception:  # noqa: BLE001
        return {"clips": 0}
    titles = {}
    try:
        for s in read_batch().get("songs", []):
            if s.get("slug"):
                titles[s["slug"]] = s.get("title", s["slug"])
    except Exception:  # noqa: BLE001
        pass
    by_slug: dict[str, list] = {}
    copied = 0
    for path in paths:
        fname = path.rsplit("/", 1)[-1]
        if re.search(r"-\d(?:\.\d)?x\.mp4$", fname):  # -1.2x / -0.8x speed variants
            continue
        dest = UPLOAD_DIR / fname
        if dest.exists():
            continue
        try:  # binary-safe copy out of WSL
            proc = subprocess.run(["wsl.exe", "-e", "bash", "-lc", f"cat {shlex.quote(path)}"],
                                  capture_output=True, timeout=120)
            data = proc.stdout or b""
            if len(data) < 10_000:
                continue
            dest.write_bytes(data)
        except Exception:  # noqa: BLE001
            continue
        copied += 1
        m = re.match(r"(.+?)-(yt|canvas|clip\d+)\.mp4$", fname)
        slug, kind = (m.group(1), m.group(2)) if m else (fname[:-4], "clip")
        label = {"yt": "bản YouTube", "canvas": "canvas loop"}.get(kind, f"TikTok {kind}")
        by_slug.setdefault(slug, []).append({
            "kind": "attach", "icon": "🎬", "name": f"{titles.get(slug, slug)} — {label}",
            "label": f"{len(data) / 1e6:.1f} MB · mp4", "url": f"/uploads/{fname}",
            "mime": "video/mp4", "fileKind": "video",
        })
    for slug, atts in by_slug.items():
        raw = [{"kind": "para", "rich": [{"v": f"🎬 {titles.get(slug, slug)} — clip từ Clipmaker:", "isText": True}]}, *atts]
        db.add(Message(id=uid("m"), channel_id=CHANNEL_ID, authorName=_BOT[0], time=now_hm(),
                       avatarInitial=_BOT[1], avatarColor=_BOT[2], isAgent=True, raw=raw,
                       sort=next_sort(db, Message)))
        db.commit()
    return {"clips": copied}
