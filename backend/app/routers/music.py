import threading

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.core.deps import get_current_user
from app.crud import next_sort, now_hm, uid
from app.models.comms import Channel, Message
from app.serialize import row_to_dict
from app.services import music
from app.services import trading_record as rec

router = APIRouter(prefix="/music", tags=["music"], dependencies=[Depends(get_current_user)])

_jobs: dict[str, dict] = {}
_BOT = ("Beat", "B", "#8B5CF6")


@router.post("/ensure")
def ensure_music(db: Session = Depends(get_db)):
    """Bootstrap the music agents + Phòng Âm nhạc + #am-nhac channel + workflow."""
    music.ensure_music_all(db)
    from app.routers.channels import _channel_dict

    return _channel_dict(db, db.get(Channel, music.CHANNEL_ID))


@router.post("/batch")
def start_batch():
    """Trigger Beat to run this week's batch (background — pipeline ~15')."""
    key = "music|batch"
    job = _jobs.get(key)
    if job and job["status"] == "running":
        return {"status": "running"}
    _jobs[key] = {"status": "running", "result": None}

    def work() -> None:
        db = SessionLocal()
        try:
            _jobs[key] = {"status": "done", "result": music.run_batch(db)}
        except Exception as exc:  # noqa: BLE001
            _jobs[key] = {"status": "error", "result": f"Lỗi: {exc}"}
        finally:
            db.close()

    threading.Thread(target=work, daemon=True).start()
    return {"status": "running"}


@router.get("/batch")
def batch_status():
    return _jobs.get("music|batch") or {"status": "idle", "result": None}


# ----------------------- in-app chat with Beat -----------------------
class ChatIn(BaseModel):
    text: str


@router.post("/chat")
def music_chat(body: ChatIn):
    """Forward a #am-nhac message to Beat (music-orchestrator) and save its reply
    in the channel. Background — Beat's OpenClaw turn can take a while."""
    key = "music|chat"
    _jobs[key] = {"status": "running", "result": None}

    def work() -> None:
        from app.services import openclaw

        db = SessionLocal()
        try:
            reply, _delivered = openclaw.send_agent(body.text, agent=music.MUSIC_AGENT, deliver=False, timeout=600)
            text = reply or "(Beat chưa phản hồi — có thể đang bận chạy pipeline, thử lại sau giây lát.)"
            m = Message(
                id=uid("m"), channel_id=music.CHANNEL_ID, authorName=_BOT[0], time=now_hm(),
                avatarInitial=_BOT[1], avatarColor=_BOT[2], isAgent=True, raw=rec.md_to_blocks(text),
                sort=next_sort(db, Message),
            )
            db.add(m)
            db.commit()
            _jobs[key] = {"status": "done", "result": text}
        except Exception as exc:  # noqa: BLE001
            _jobs[key] = {"status": "error", "result": f"Lỗi: {exc}"}
        finally:
            db.close()

    threading.Thread(target=work, daemon=True).start()
    return {"status": "running"}


@router.get("/chat")
def music_chat_status():
    return _jobs.get("music|chat") or {"status": "idle", "result": None}


# ----------------------- batch review + generate (M2) -----------------------
@router.get("/batch/songs")
def batch_songs():
    """The active batch's songs (title + lyrics + hit-score) for in-app review."""
    return music.read_batch()


class GenIn(BaseModel):
    title: str


@router.post("/generate")
def start_generate(body: GenIn):
    """Relay 'generate bài <title>' to Beat — it runs run_generate.py (background, ~6'/song,
    burns Suno credit) and pushes audio + a variant-pick gate to Telegram."""
    key = "music|gen"
    if (_jobs.get(key) or {}).get("status") == "running":
        return {"status": "running"}
    _jobs[key] = {"status": "running", "result": None}

    def work() -> None:
        from app.services import openclaw

        db = SessionLocal()
        try:
            reply, _delivered = openclaw.send_agent(
                f"generate bài {body.title}", agent=music.MUSIC_AGENT, deliver=True, timeout=300,
            )
            text = reply or f"🎵 Đã gửi lệnh generate bài '{body.title}' cho Beat (đang tạo ~6 phút)."
            db.add(Message(
                id=uid("m"), channel_id=music.CHANNEL_ID, authorName=_BOT[0], time=now_hm(),
                avatarInitial=_BOT[1], avatarColor=_BOT[2], isAgent=True, raw=rec.md_to_blocks(text),
                sort=next_sort(db, Message),
            ))
            db.commit()
            _jobs[key] = {"status": "done", "result": text}
        except Exception as exc:  # noqa: BLE001
            _jobs[key] = {"status": "error", "result": f"Lỗi: {exc}"}
        finally:
            db.close()

    threading.Thread(target=work, daemon=True).start()
    return {"status": "running", "title": body.title}


@router.get("/generate")
def generate_status():
    return _jobs.get("music|gen") or {"status": "idle", "result": None}
