"""Music Trend pipeline ("Beat" / `music-orchestrator`) integration.

Twin of the trading integration: AgentAIOS triggers the OpenClaw `music-orchestrator`
agent (which runs the 9-stage batch pipeline + delivers to Telegram), and mirrors
the result in-app. M1 = scaffolding (agents/room/channel/workflow) + batch trigger.
We do NOT touch the live music-system in WSL — only trigger + mirror.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud import next_sort, now_hm, uid
from app.models.agents import Agent, Workflow
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
    {"id": "agent-mu-producer", "name": "Producer", "role": "Gọi Suno generate", "initial": "Pr", "color": "#3B82C4", "io": "Payload → Suno (~6'/bài)"},
    {"id": "agent-mu-clipmaker", "name": "Clipmaker", "role": "Audio → video clip", "initial": "Cl", "color": "#C0392B", "io": "YT / TikTok / Canvas (ffmpeg + ComfyUI)"},
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


def ensure_music_workflow(db: Session) -> Workflow:
    steps = [{"agent": a["name"], "initial": a["initial"], "color": a["color"], "title": a["role"], "io": a["io"], "status": "idle", "dur": ""} for a in _PIPELINE]
    w = db.get(Workflow, WF_ID)
    if not w:
        w = Workflow(
            id=WF_ID, name="Làm nhạc bắt trend (Beat)",
            desc="Pipeline 9 khâu: Research → Strategy → Songwriter → Fact-check → Arrangement → Reviewer → Scorer → Producer → Clipmaker.",
            trigger="manual", triggerLabel="Khi chạy batch tuần", enabled=True, lastRun="", runs24=0,
            success=100, steps=steps, runs=[], runState="idle", sort=-2,
        )
        db.add(w)
        db.commit()
        return w
    if not w.steps or w.steps[0].get("agent") != steps[0]["agent"]:
        w.steps = steps
        db.commit()
    return w


def ensure_music_all(db: Session) -> None:
    ensure_music_agents(db)
    ensure_music_channel(db)
    ensure_music_room(db)
    ensure_music_workflow(db)


# ----------------------------- batch trigger -----------------------------
def run_batch(db: Session, *, prompt: str = "Chạy batch nhạc tuần này") -> str:
    """Trigger Beat (music-orchestrator) via OpenClaw → it runs the pipeline +
    delivers to Telegram; mirror the reply in-app. Long-running (pipeline ~15')."""
    from app.services import openclaw

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
        w = ensure_music_workflow(db)
        w.runs = [{"time": now_hm(), "status": "success", "dur": ""}, *(w.runs or [])][:12]
        w.lastRun = now_hm()
        w.runs24 = (w.runs24 or 0) + 1
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
    return report
