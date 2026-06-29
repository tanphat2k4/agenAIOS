"""Film cockpit — proxy the ArcReel film engine + keep a light mirror row per film.

AgentAIOS holds one arc- API key (backend/.env) and acts for the signed-in user;
ArcReel does the heavy GPU pipeline. See app/services/arcreel_client.py + docs.

Also hosts **Reel** — a chat-callable film agent (mirrors the Sage/Beat pattern):
a dedicated "phim" channel + POST /films/chat + a background watcher that posts
gate/done prompts back into the channel.
"""
import os
import threading
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal, get_db
from app.core.deps import get_current_user
from app.core.security import decode_access_token
from app.crud import get_or_404, next_sort, now_hm, uid
from app.models.comms import Channel, Message
from app.models.film import Film
from app.models.user import User
from app.serialize import row_to_dict, rows_to_list
from app.services import arcreel_client
from app.services import trading_record as rec
from app.services.arcreel_client import ArcReelError

router = APIRouter(prefix="/films", tags=["films"], dependencies=[Depends(get_current_user)])

# ArcReel default local backends (ComfyUI on the GPU box). Held server-side.
_DEFAULTS = {
    "image_backend": "comfyui/flux2_dev_fp8mixed.safetensors",
    "video_backend": "comfyui/ltx-2.3-22b-distilled-Q5_K_M.gguf",
}
_REVIEW_STAGES = {"awaiting_script_review", "awaiting_asset_review", "awaiting_review", "awaiting_video_review"}


def _status_of(stage: str) -> str:
    if stage == "done":
        return "done"
    if stage in ("error", "cancelled"):
        return "error"
    if stage in _REVIEW_STAGES:
        return "needs_review"
    if stage in ("", "queued"):
        return "queued"
    return "running"


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def _sync(db: Session, f: Film) -> dict:
    """Refresh the mirror row from ArcReel + return serialized row plus live fields."""
    if not f.arcTaskId:
        return {**row_to_dict(f), "progress": [], "review": None}
    try:
        st = arcreel_client.film_status(f.arcTaskId)
    except ArcReelError:
        return {**row_to_dict(f), "progress": [], "review": None, "offline": True}
    f.stage = st.get("stage", f.stage)
    f.status = _status_of(f.stage)
    f.projectSlug = st.get("project_name") or f.projectSlug
    f.publicUrl = st.get("public_url") or f.publicUrl
    f.errorMessage = st.get("error") or ""
    f.updatedAt = _now()
    db.commit()
    return {
        **row_to_dict(f),
        "progress": st.get("progress", []),
        "subStage": st.get("sub_stage"),
        "review": st.get("review"),
        "scriptSegments": st.get("script_segments"),
        "elapsedSeconds": st.get("elapsed_seconds"),
    }


class FilmCreate(BaseModel):
    title: str = ""
    novel: str
    aspectRatio: str = "9:16"
    contentMode: str = "narration"
    channelId: str = ""


class ApproveBody(BaseModel):
    selections: dict[str, int] | None = None


@router.get("")
def list_films(db: Session = Depends(get_db)):
    for f in db.scalars(select(Film).order_by(Film.sort.desc())):
        if f.arcTaskId and f.status not in ("done", "error"):
            try:
                _sync(db, f)
            except Exception:  # noqa: BLE001
                pass
    return rows_to_list(db.scalars(select(Film).order_by(Film.sort.desc())))


@router.post("", status_code=201)
def create_film(body: FilmCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    novel = (body.novel or "").strip()
    if not novel:
        raise HTTPException(status_code=400, detail="Thiếu nội dung truyện")
    title = (body.title or "").strip() or novel.splitlines()[0][:60]
    payload = {
        "novel_text": novel,
        "title": title,
        "content_mode": body.contentMode,
        "aspect_ratio": body.aspectRatio,
        "review_before_storyboard": True,
        "review_before_video": True,
        "review_before_compose": True,
        **_DEFAULTS,
    }
    try:
        res = arcreel_client.run_film(payload)
    except ArcReelError as exc:
        raise HTTPException(status_code=503, detail=f"ArcReel không phản hồi: {exc}") from exc
    f = Film(
        id=uid("film"),
        title=title,
        arcTaskId=res.get("task_id", ""),
        stage=res.get("stage", "queued"),
        status=_status_of(res.get("stage", "queued")),
        aspectRatio=body.aspectRatio,
        contentMode=body.contentMode,
        channelId=body.channelId,
        createdBy=current.id,
        createdAt=_now(),
        updatedAt=_now(),
        sort=next_sort(db, Film),
    )
    db.add(f)
    db.commit()
    return _sync(db, f)


@router.get("/{film_id}")
def get_film(film_id: str, db: Session = Depends(get_db)):
    return _sync(db, get_or_404(db, Film, film_id))


@router.post("/{film_id}/approve")
def approve_film(film_id: str, body: ApproveBody | None = None, db: Session = Depends(get_db)):
    f = get_or_404(db, Film, film_id)
    try:
        arcreel_client.approve_film(f.arcTaskId, body.selections if body else None)
    except ArcReelError as exc:
        raise HTTPException(status_code=503, detail=f"ArcReel không phản hồi: {exc}") from exc
    return _sync(db, f)


@router.post("/{film_id}/cancel")
def cancel_film(film_id: str, db: Session = Depends(get_db)):
    f = get_or_404(db, Film, film_id)
    try:
        arcreel_client.cancel_film(f.arcTaskId)
    except ArcReelError:
        pass
    f.stage, f.status, f.errorMessage, f.updatedAt = "cancelled", "error", "Đã hủy", _now()
    db.commit()
    return row_to_dict(f)


@router.delete("/{film_id}")
def delete_film(film_id: str, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, Film, film_id))
    db.commit()
    return {"detail": "deleted"}


@router.get("/{film_id}/video")
def film_video(film_id: str, db: Session = Depends(get_db)):
    f = get_or_404(db, Film, film_id)
    try:
        st = arcreel_client.film_status(f.arcTaskId)
    except ArcReelError as exc:
        raise HTTPException(status_code=503, detail=f"ArcReel không phản hồi: {exc}") from exc
    path = st.get("output_path") or ""
    if path and not os.path.isabs(path):
        path = os.path.join(settings.ARCREEL_DIR, path)
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Phim chưa sẵn sàng")
    return FileResponse(path, media_type="video/mp4", filename=f"{f.title or 'film'}.mp4")


# ───────────────────────── Reel — chat-callable film agent ─────────────────────────
FILM_CHANNEL_ID = "phim"
REEL = {
    "id": "agent-reel", "name": "Reel", "handle": "@reel", "initial": "R", "color": "#D4537E",
    "persona": "Reel — đạo diễn AI biến truyện thành phim ngắn qua pipeline ArcReel.",
}
_GATE_VI = {
    "awaiting_script_review": "Cần duyệt kịch bản",
    "awaiting_asset_review": "Cần duyệt thiết kế nhân vật",
    "awaiting_review": "Cần duyệt phân cảnh",
    "awaiting_video_review": "Cần duyệt video / chọn bản",
}
_CMD_APPROVE = ("duyệt", "duyet", "approve", "đồng ý", "dong y", "ok tiếp", "ok tiep")
_CMD_STATUS = ("tới đâu", "toi dau", "trạng thái", "trang thai", "status", "xong chưa", "xong chua", "tiến độ", "tien do")
_CMD_CANCEL = ("hủy phim", "huy phim", "hủy", "huy", "cancel", "dừng lại", "dung lai")


def ensure_film_channel(db: Session) -> Channel:
    ch = db.get(Channel, FILM_CHANNEL_ID)
    if ch:
        return ch
    ch = Channel(
        id=FILM_CHANNEL_ID, kind="public", name="Phim 🎬",
        desc='Làm phim từ truyện — dán truyện để Reel dựng phim, gõ "duyệt" qua từng cổng',
        visibility="PUBLIC", members=1, tasks=[], wfTotal=0,
        wfNote="Reel — đạo diễn AI (ArcReel).", unread=0, sort=-1,
    )
    db.add(ch)
    db.commit()
    return ch


def _save_reel_msg(db: Session, channel_id: str, text: str) -> dict:
    m = Message(
        id=uid("m"), channel_id=channel_id, authorName=REEL["name"], time=now_hm(),
        avatarInitial=REEL["initial"], avatarColor=REEL["color"], isAgent=True,
        raw=rec.md_to_blocks(text), sort=next_sort(db, Message),
    )
    db.add(m)
    db.commit()
    return row_to_dict(m, exclude={"channel_id"})


def _active_film(db: Session, channel_id: str) -> Film | None:
    return db.scalars(select(Film).where(Film.channelId == channel_id).order_by(Film.sort.desc())).first()


def _status_line(f: Film) -> str:
    if f.status == "needs_review":
        return f"🚪 **{f.title}** — {_GATE_VI.get(f.stage, 'Cần duyệt')}. Gõ **duyệt** để tiếp."
    if f.status == "done":
        return f"✅ **{f.title}** đã xong — mở màn Phim để xem."
    if f.status == "error":
        return f"❌ **{f.title}** lỗi: {f.errorMessage or 'không rõ'}"
    return f"⏳ **{f.title}** — {f.stage or 'đang chạy'}…"


def _bg_reel_watch(channel_id: str, film_id: str) -> None:
    """Watch a film's ArcReel state; post gate / done / error into the channel as Reel.
    Long-lived daemon (≈2h cap); dies on backend restart — the Film screen stays authoritative."""
    import time as _t

    last = None
    for _ in range(360):  # 360 × 20s ≈ 2h
        _t.sleep(20)
        db = SessionLocal()
        try:
            f = db.get(Film, film_id)
            if not f or not f.arcTaskId:
                return
            try:
                st = arcreel_client.film_status(f.arcTaskId)
            except ArcReelError:
                continue
            stage = st.get("stage", f.stage)
            f.stage = stage
            f.status = _status_of(stage)
            f.publicUrl = st.get("public_url") or f.publicUrl
            f.projectSlug = st.get("project_name") or f.projectSlug
            f.errorMessage = st.get("error") or ""
            f.updatedAt = _now()
            db.commit()
            if stage == last:
                continue
            last = stage
            if f.status == "needs_review":
                _save_reel_msg(db, channel_id, f"🚪 **{_GATE_VI.get(stage, 'Cần duyệt')}** cho phim *{f.title}* — gõ **duyệt** để tiếp tục.")
            elif f.status == "done":
                _save_reel_msg(db, channel_id, f"✅ Phim **{f.title}** đã xong! Mở màn **Phim** để xem.")
                return
            elif f.status == "error":
                _save_reel_msg(db, channel_id, f"❌ Phim *{f.title}* gặp lỗi: {f.errorMessage or 'không rõ'}")
                return
        finally:
            db.close()


class FilmChatIn(BaseModel):
    channel_id: str = FILM_CHANNEL_ID
    text: str = ""


@router.post("/channel/ensure")
def ensure_film_chat_channel(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    from app.routers.channels import _channel_dict, add_channel_member

    ch = ensure_film_channel(db)
    add_channel_member(db, ch.id, name=current.name, initial=current.initial, color=current.color,
                       role="Owner" if getattr(current, "role", "") == "owner" else "Member", userId=current.id)
    add_channel_member(db, ch.id, name=REEL["name"], initial=REEL["initial"], color=REEL["color"], role="Agent", isAgent=True)
    return _channel_dict(db, ch)


@router.post("/chat")
def film_chat(body: FilmChatIn, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    cid = body.channel_id or FILM_CHANNEL_ID
    ensure_film_channel(db)
    t = (body.text or "").strip()
    low = t.lower().replace("@reel", "").strip()
    f = _active_film(db, cid)

    # approve the current gate
    if any(k in low for k in _CMD_APPROVE):
        if f and f.status == "needs_review":
            try:
                arcreel_client.approve_film(f.arcTaskId)
            except ArcReelError as exc:
                return {"messages": [_save_reel_msg(db, cid, f"Không duyệt được: {exc}")], "filmId": f.id}
            f.status, f.stage, f.updatedAt = "running", "running", _now()
            db.commit()
            threading.Thread(target=_bg_reel_watch, args=(cid, f.id), daemon=True).start()
            return {"messages": [_save_reel_msg(db, cid, "✅ Đã duyệt — pipeline tiếp tục. Em sẽ báo ở cổng kế.")], "filmId": f.id}
        return {"messages": [_save_reel_msg(db, cid, "Hiện không có phim nào đang chờ duyệt.")], "filmId": f.id if f else None}

    # status of the latest film
    if any(k in low for k in _CMD_STATUS):
        if not f:
            return {"messages": [_save_reel_msg(db, cid, "Chưa có phim nào. Dán nội dung truyện để em bắt đầu nhé.")], "filmId": None}
        try:
            _sync(db, f)
        except Exception:  # noqa: BLE001
            pass
        return {"messages": [_save_reel_msg(db, cid, _status_line(f))], "filmId": f.id}

    # cancel the running film
    if any(k in low for k in _CMD_CANCEL):
        if f and f.status not in ("done", "error"):
            try:
                arcreel_client.cancel_film(f.arcTaskId)
            except ArcReelError:
                pass
            f.status, f.stage, f.errorMessage, f.updatedAt = "error", "cancelled", "Đã hủy", _now()
            db.commit()
            return {"messages": [_save_reel_msg(db, cid, f"Đã hủy phim **{f.title}**.")], "filmId": f.id}
        return {"messages": [_save_reel_msg(db, cid, "Không có phim nào đang chạy để hủy.")], "filmId": f.id if f else None}

    # make a film from a story (needs enough text)
    if len(t) >= 40:
        title = t.splitlines()[0][:60]
        payload = {
            "novel_text": t, "title": title, "content_mode": "narration", "aspect_ratio": "9:16",
            "review_before_storyboard": True, "review_before_video": True, "review_before_compose": True,
            **_DEFAULTS,
        }
        try:
            res = arcreel_client.run_film(payload)
        except ArcReelError as exc:
            return {"messages": [_save_reel_msg(db, cid, f"ArcReel không phản hồi: {exc}. Kiểm tra mục Thiết bị.")], "filmId": None}
        nf = Film(
            id=uid("film"), title=title, arcTaskId=res.get("task_id", ""),
            stage=res.get("stage", "queued"), status=_status_of(res.get("stage", "queued")),
            aspectRatio="9:16", contentMode="narration", channelId=cid, createdBy=current.id,
            createdAt=_now(), updatedAt=_now(), sort=next_sort(db, Film),
        )
        db.add(nf)
        db.commit()
        threading.Thread(target=_bg_reel_watch, args=(cid, nf.id), daemon=True).start()
        interim = _save_reel_msg(db, cid, f"🎬 Đã nhận **{title}** · mã `{nf.id}` — đang chạy pipeline. Em sẽ báo khi tới cổng cần anh **duyệt**. (Gõ **trạng thái** để xem tiến độ.)")
        return {"messages": [interim], "filmId": nf.id}

    # too short / general
    return {"messages": [_save_reel_msg(db, cid, "Dán **nội dung truyện** (vài câu trở lên) để em dựng phim. Lệnh: **duyệt** · **trạng thái** · **hủy**.")], "filmId": f.id if f else None}


# ───────────────────────── Phase 3: gate review (assets + variants) ─────────────────────────
_ASSET_DIRS = ("storyboards", "characters", "scenes", "props", "videos", "output", "audio", "thumbnails")
_IMG = (".png", ".jpg", ".jpeg", ".webp")


def _proj_dir(f: Film, db: Session) -> str:
    """Absolute path to the ArcReel project dir on disk (same machine), or '' if unknown."""
    slug = f.projectSlug
    if not slug and f.arcTaskId:
        try:
            slug = arcreel_client.film_status(f.arcTaskId).get("project_name") or ""
            if slug:
                f.projectSlug = slug
                db.commit()
        except ArcReelError:
            slug = ""
    return os.path.join(settings.ARCREEL_DIR, "projects", slug) if slug else ""


def _ls(base: str, sub: str, exts: tuple) -> list:
    d = os.path.join(base, sub)
    if not base or not os.path.isdir(d):
        return []
    return sorted(fn for fn in os.listdir(d) if fn.lower().endswith(exts))


@router.get("/{film_id}/review")
def film_review(film_id: str, db: Session = Depends(get_db)):
    """Items to show at the current gate: script segments (text), asset/storyboard
    images, or video variants — from script_segments + on-disk files."""
    f = get_or_404(db, Film, film_id)
    stage = f.stage
    if stage == "awaiting_script_review":
        try:
            segs = arcreel_client.film_status(f.arcTaskId).get("script_segments") or []
        except ArcReelError:
            segs = []
        items = [{
            "id": s.get("segment_id") or str(i),
            "label": s.get("segment_id") or f"Cảnh {i + 1}",
            "text": s.get("novel_text") or ((s.get("image_prompt") or {}).get("scene") or ""),
        } for i, s in enumerate(segs)]
        return {"kind": "script", "items": items}
    base = _proj_dir(f, db)
    if stage == "awaiting_asset_review":
        items = []
        for kind, sub in (("character", "characters"), ("scene", "scenes"), ("prop", "props")):
            for fn in _ls(base, sub, _IMG):
                items.append({"id": f"{kind}:{os.path.splitext(fn)[0]}", "label": os.path.splitext(fn)[0], "kind": kind, "image": f"{sub}/{fn}"})
        return {"kind": "asset", "items": items}
    if stage == "awaiting_review":
        items = [{"id": os.path.splitext(fn)[0].replace("scene_", ""), "label": os.path.splitext(fn)[0].replace("scene_", ""), "image": f"storyboards/{fn}"} for fn in _ls(base, "storyboards", _IMG)]
        return {"kind": "storyboard", "items": items}
    if stage in ("awaiting_video_review", "done"):
        scenes: dict = {}
        for fn in _ls(base, "videos", (".mp4",)):
            name = os.path.splitext(fn)[0]
            sc, variant = name, 1
            if "_v" in name:
                head, _, vn = name.rpartition("_v")
                if vn.isdigit():
                    sc, variant = head, int(vn)
            scenes.setdefault(sc, []).append({"variant": variant, "video": f"videos/{fn}"})
        items = [{"id": sc.replace("scene_", ""), "sceneId": sc.replace("scene_", ""), "label": sc.replace("scene_", ""),
                  "variants": sorted(vs, key=lambda x: x["variant"])} for sc, vs in sorted(scenes.items())]
        return {"kind": "video", "items": items}
    return {"kind": stage, "items": []}


class RegenBody(BaseModel):
    sceneId: str
    instructions: str = ""


@router.post("/{film_id}/regenerate")
def regenerate_scene(film_id: str, body: RegenBody, db: Session = Depends(get_db)):
    f = get_or_404(db, Film, film_id)
    instr = {body.sceneId: body.instructions} if body.instructions.strip() else None
    try:
        arcreel_client.regenerate_film(f.arcTaskId, [body.sceneId], instr, "edit")
    except ArcReelError as exc:
        raise HTTPException(status_code=503, detail=f"ArcReel không phản hồi: {exc}") from exc
    return _sync(db, f)


class PickBody(BaseModel):
    sceneId: str
    variant: int


@router.post("/{film_id}/pick")
def pick_scene_variant(film_id: str, body: PickBody, db: Session = Depends(get_db)):
    f = get_or_404(db, Film, film_id)
    try:
        arcreel_client.pick_variant(f.arcTaskId, body.sceneId, body.variant)
    except ArcReelError as exc:
        raise HTTPException(status_code=503, detail=f"ArcReel không phản hồi: {exc}") from exc
    return {"ok": True}


class AssetActionBody(BaseModel):
    kind: str  # character | scene | prop
    name: str


class SceneOkBody(BaseModel):
    sceneId: str


class RecomposeBody(BaseModel):
    selections: dict[str, int] | None = None


@router.post("/{film_id}/regenerate-asset")
def regenerate_asset_sheet(film_id: str, body: AssetActionBody, db: Session = Depends(get_db)):
    f = get_or_404(db, Film, film_id)
    try:
        arcreel_client.regenerate_asset(f.arcTaskId, body.kind, body.name)
    except ArcReelError as exc:
        raise HTTPException(status_code=503, detail=f"ArcReel không phản hồi: {exc}") from exc
    return _sync(db, f)


@router.post("/{film_id}/asset-ok")
def asset_ok(film_id: str, body: AssetActionBody, db: Session = Depends(get_db)):
    f = get_or_404(db, Film, film_id)
    try:
        return arcreel_client.asset_ok(f.arcTaskId, body.kind, body.name)
    except ArcReelError as exc:
        raise HTTPException(status_code=503, detail=f"ArcReel không phản hồi: {exc}") from exc


@router.post("/{film_id}/scene-ok")
def scene_ok(film_id: str, body: SceneOkBody, db: Session = Depends(get_db)):
    f = get_or_404(db, Film, film_id)
    try:
        return arcreel_client.scene_ok(f.arcTaskId, body.sceneId)
    except ArcReelError as exc:
        raise HTTPException(status_code=503, detail=f"ArcReel không phản hồi: {exc}") from exc


@router.post("/{film_id}/retry-videos")
def retry_videos(film_id: str, db: Session = Depends(get_db)):
    f = get_or_404(db, Film, film_id)
    try:
        arcreel_client.retry_videos(f.arcTaskId)
    except ArcReelError as exc:
        raise HTTPException(status_code=503, detail=f"ArcReel không phản hồi: {exc}") from exc
    return _sync(db, f)


@router.post("/{film_id}/recompose")
def recompose_film(film_id: str, body: RecomposeBody, db: Session = Depends(get_db)):
    f = get_or_404(db, Film, film_id)
    try:
        arcreel_client.recompose(f.arcTaskId, body.selections)
    except ArcReelError as exc:
        raise HTTPException(status_code=503, detail=f"ArcReel không phản hồi: {exc}") from exc
    return _sync(db, f)


# Media proxy — <img>/<video> can't send a Bearer header, so validate a ?token= query
# param instead. Serves files from the ArcReel project dir on disk, with path guards.
media_router = APIRouter(prefix="/films", tags=["films-media"])


@media_router.get("/{film_id}/asset")
def film_asset(film_id: str, path: str = Query(...), token: str = Query(...), db: Session = Depends(get_db)):
    if not decode_access_token(token):
        raise HTTPException(status_code=401, detail="Token không hợp lệ")
    f = get_or_404(db, Film, film_id)
    base = _proj_dir(f, db)
    p = path.replace("\\", "/").lstrip("/")
    if not base or ".." in p or (p.split("/")[0] not in _ASSET_DIRS):
        raise HTTPException(status_code=400, detail="Đường dẫn không hợp lệ")
    full = os.path.join(base, *p.split("/"))
    if not os.path.realpath(full).startswith(os.path.realpath(base)) or not os.path.isfile(full):
        raise HTTPException(status_code=404, detail="Không thấy file")
    pl = p.lower()
    mt = ("video/mp4" if pl.endswith(".mp4") else "image/jpeg" if pl.endswith((".jpg", ".jpeg"))
          else "image/webp" if pl.endswith(".webp") else "image/png")
    return FileResponse(full, media_type=mt)
