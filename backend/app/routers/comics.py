"""Truyện tranh (comic/webtoon) P1 — #truyen-tranh channel + the "Họa" agent.

Flow (mirror of the film cockpit): idea → scriptwriter (9Router, strict JSON:
characters + pages/panels + style) → GATE 1 "duyệt" script → character sheets
(ComfyUI txt2img on PC-A, 2 variants per character) → GATE 2 pick faces
("chọn <tên> 1|2" rồi "duyệt") → ready for P2 (panel generation).
"""
import json
import re
import threading
import unicodedata
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.core.deps import get_current_user
from app.crud import next_sort, now_hm, uid
from app.models.agents import Agent, Workflow
from app.models.comic import Comic
from app.models.comms import Channel, Message, Room
from app.models.user import User
from app.serialize import row_to_dict
from app.services import comfy_client, comic_builder, ninerouter
from app.services import trading_record as rec

router = APIRouter(prefix="/comics", tags=["comics"], dependencies=[Depends(get_current_user)])

COMIC_CHANNEL_ID = "truyen-tranh"
WF_ID = "wf-comic"
ROOM_ID = "room-truyen-tranh"
HOA = {
    "id": "agent-hoa", "name": "Họa", "handle": "@hoa", "initial": "H", "color": "#E8590C",
    "persona": ("Họa — hoạ sĩ AI dựng truyện tranh webtoon dọc từ ý tưởng: biên kịch từng trang/khung, "
                "thiết kế nhân vật đồng nhất (ComfyUI), bong bóng thoại tiếng Việt đè bằng code."),
}
_STEPS = [
    {"agent": "Biên kịch", "initial": "B", "color": "#3B5BDB", "title": "Truyện → trang/khung (JSON)", "io": "Cổng 1: duyệt kịch bản"},
    {"agent": "Thiết kế NV", "initial": "T", "color": "#E8590C", "title": "Character sheet (ComfyUI)", "io": "Cổng 2: chọn mặt nhân vật"},
    {"agent": "Sinh khung", "initial": "S", "color": "#0A7B52", "title": "Từng khung + PuLID (P2)", "io": "—"},
    {"agent": "Ghép trang", "initial": "G", "color": "#8B5CF6", "title": "Trang + bong bóng thoại (P2)", "io": "—"},
    {"agent": "Xuất bản", "initial": "X", "color": "#C0392B", "title": "Webtoon dọc / FB / PDF (P3)", "io": "—"},
]
_jobs: dict = {}
_JOB = "comics"

_STYLE_DEFAULT = ("vintage sepia copper-engraving comic art, intricate crosshatch shading, "
                  "dramatic cinematic lighting, highly detailed, masterpiece")


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def _slug(s: str) -> str:
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "nv"


def _save_hoa_msg(db: Session, cid: str, text: str, extra_blocks: list | None = None) -> dict:
    raw = rec.md_to_blocks(text)
    if extra_blocks:
        raw += extra_blocks
    m = Message(id=uid("m"), channel_id=cid, authorName=HOA["name"], time=now_hm(),
                avatarInitial=HOA["initial"], avatarColor=HOA["color"], isAgent=True,
                raw=raw, sort=next_sort(db, Message))
    db.add(m)
    db.commit()
    return row_to_dict(m, exclude={"channel_id"})


# ─────────────────────────── ensure scaffolding ───────────────────────────
def ensure_comic_channel(db: Session) -> Channel:
    ch = db.get(Channel, COMIC_CHANNEL_ID)
    if not ch:
        ch = Channel(
            id=COMIC_CHANNEL_ID, kind="public", name="Truyện tranh 📚",
            desc="Ý tưởng → Họa biên kịch + vẽ nhân vật + dựng webtoon — gõ ý tưởng để bắt đầu",
            visibility="PUBLIC", members=1, tasks=[], wfTotal=0,
            wfNote="Pipeline truyện tranh (P1: kịch bản + nhân vật).", sort=next_sort(db, Channel),
        )
        db.add(ch)
        db.commit()
    return ch


def ensure_hoa_agent(db: Session) -> Agent:
    ag = db.get(Agent, HOA["id"])
    if not ag:
        ag = Agent(
            id=HOA["id"], name=HOA["name"], handle=HOA["handle"], role="Hoạ sĩ truyện tranh AI",
            roleType="research", initial=HOA["initial"], color=HOA["color"], status="online",
            model="fast-chat", modelType="local", tasks=0, rooms=1, success=100,
            skills=["Biên kịch trang/khung", "Character sheet ComfyUI", "Webtoon dọc"],
            lastActive="vừa xong", bio=HOA["persona"], roomsList=["#truyen-tranh"], recentTasks=[], sort=-1,
        )
        db.add(ag)
        db.commit()
    return ag


def ensure_comic_workflow(db: Session) -> Workflow:
    template = [{"agent": s["agent"], "initial": s["initial"], "color": s["color"], "title": s["title"],
                 "io": s["io"], "status": "idle", "dur": ""} for s in _STEPS]
    w = db.get(Workflow, WF_ID)
    if not w:
        w = Workflow(
            id=WF_ID, name="Làm truyện tranh (Họa)",
            desc="Biên kịch → thiết kế nhân vật → sinh khung → ghép trang + thoại → xuất bản. 2 cổng duyệt (P1).",
            trigger="manual", triggerLabel="Khi gõ ý tưởng trong #truyen-tranh", enabled=True,
            lastRun="", runs24=0, success=100, steps=template, runs=[], runState="idle", sort=-1,
        )
        db.add(w)
        db.commit()
        return w
    if not w.steps or len(w.steps) != len(template):
        w.steps = template
        db.commit()
    return w


def ensure_comic_room(db: Session) -> Room:
    owner = db.scalar(select(User).where(User.role == "owner")) or db.scalar(select(User))
    want: list = []
    if owner:
        want.append({"name": owner.name, "handle": "@" + (owner.name.split()[0].lower() if owner.name else "owner"),
                     "type": "user", "role": "lead", "initial": owner.initial, "color": owner.color})
    want.append({"name": HOA["name"], "handle": HOA["handle"], "type": "agent", "role": "staff",
                 "initial": HOA["initial"], "color": HOA["color"]})
    for s in _STEPS:
        want.append({"name": s["agent"], "handle": "@" + _slug(s["agent"]), "type": "agent", "role": "staff",
                     "initial": s["initial"], "color": s["color"]})
    r = db.get(Room, ROOM_ID)
    if not r:
        r = Room(id=ROOM_ID, name="Truyện tranh", slug="truyen-tranh", channel=COMIC_CHANNEL_ID,
                 members=want, sort=-2)
        db.add(r)
    else:
        r.members = want
    db.commit()
    return r


@router.post("/ensure")
def ensure(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    from app.routers.channels import _channel_dict, add_channel_member

    ch = ensure_comic_channel(db)
    ensure_hoa_agent(db)
    ensure_comic_workflow(db)
    ensure_comic_room(db)
    add_channel_member(db, ch.id, name=current.name, initial=current.initial, color=current.color,
                       role="Owner" if getattr(current, "role", "") == "owner" else "Member", userId=current.id)
    add_channel_member(db, ch.id, name=HOA["name"], initial=HOA["initial"], color=HOA["color"],
                       role="Agent", isAgent=True)
    return _channel_dict(db, ch)


# ─────────────────────────── stage 1: scriptwriter ───────────────────────────
def _write_script(idea: str) -> dict:
    """Idea → strict-JSON comic script: characters (looks for drawing) + pages/panels + style."""
    system = {"role": "system", "content": (
        "Bạn là biên kịch truyện tranh webtoon dọc 9:16 tiếng Việt. Từ ý tưởng, viết kịch bản chương 1 "
        "NGẮN (thử nghiệm): 3-4 trang, mỗi trang 3-4 khung. TRẢ VỀ DUY NHẤT MỘT JSON object: "
        '{"title": "tên truyện", "style": "mô tả style vẽ bằng tiếng Anh cho Stable Diffusion (vd: vintage sepia engraving...)", '
        '"characters": [{"name": "Tên", "role": "vai", "look": "mô tả ngoại hình CHI TIẾT bằng tiếng Anh để vẽ: tuổi, tóc, mặt, trang phục, vóc dáng"}] (tối đa 3 nhân vật), '
        '"pages": [{"page": 1, "panels": [{"panel": 1, "desc": "mô tả hình bằng tiếng Anh (cảnh, hành động, nhân vật nào)", '
        '"shot": "wide|medium|closeup", "dialogue": [{"char": "Tên", "text": "thoại tiếng Việt NGẮN"}]}]}]. '
        "Thoại tự nhiên, mỗi khung tối đa 2 câu thoại. Hook mạnh ở trang 1 khung 1.")}
    res = ninerouter.chat([system, {"role": "user", "content": f"Ý tưởng: {idea}"}], temperature=0.6, max_tokens=2400)
    text = res.get("content") or ""
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("model không trả JSON")
    data = json.loads(m.group(0))
    if not data.get("characters") or not data.get("pages"):
        raise ValueError("JSON thiếu characters/pages")
    return data


def _script_digest(c: Comic) -> str:
    s = c.script or {}
    pages = s.get("pages", [])
    n_panels = sum(len(p.get("panels", [])) for p in pages)
    lines = [f"📚 **{c.title}** — kịch bản chương 1 xong: {len(pages)} trang · {n_panels} khung."]
    lines.append(f"🎨 Style: _{(c.style or '')[:120]}_")
    lines.append("👥 Nhân vật: " + " · ".join(f"**{ch['name']}** ({ch.get('role', '')})" for ch in c.characters))
    p1 = pages[0] if pages else {}
    if p1:
        lines.append("")
        lines.append(f"**Trang 1** ({len(p1.get('panels', []))} khung) — trích:")
        for pn in p1.get("panels", [])[:3]:
            dlg = " / ".join(f"{d['char']}: “{d['text']}”" for d in pn.get("dialogue", [])[:2])
            lines.append(f"• K{pn.get('panel')}: {pn.get('desc', '')[:90]}{(' — ' + dlg) if dlg else ''}")
    lines.append("")
    lines.append("👉 Gõ **duyệt** để em vẽ character sheet (2 bản/nhân vật, ~1 phút) · **hủy** để bỏ.")
    return "\n".join(lines)


# ─────────────────────────── stage 2: character sheets ───────────────────────────
def _bg_sheets(comic_id: str, cid: str) -> None:
    from app.routers.uploads import UPLOAD_DIR

    db = SessionLocal()
    try:
        c = db.get(Comic, comic_id)
        if not c:
            return
        style = c.style or _STYLE_DEFAULT
        sheets: dict = {}
        for ch in (c.characters or [])[:3]:
            name = ch.get("name", "NV")
            urls, atts = [], []
            for v in (1, 2):
                prompt = (f"{style}, character reference sheet, full body standing pose and face close-up, "
                          f"{ch.get('look', '')}, neutral plain background, single character")
                try:
                    data = comfy_client.txt2img(prompt, width=832, height=1216, steps=26, cfg=6.0)
                except comfy_client.ComfyError as exc:
                    _save_hoa_msg(db, cid, f"⚠️ ComfyUI lỗi khi vẽ **{name}** bản {v}: {exc}")
                    continue
                fname = f"comic-{comic_id}-{_slug(name)}-v{v}.png"
                (UPLOAD_DIR / fname).write_bytes(data)
                urls.append(f"/uploads/{fname}")
                atts.append({"kind": "attach", "icon": "🎨", "name": f"{name} — bản {v}",
                             "label": f"{len(data) / 1e6:.1f} MB · png", "url": f"/uploads/{fname}",
                             "mime": "image/png", "fileKind": "image"})
            sheets[name] = urls
            if atts:
                _save_hoa_msg(db, cid, f"🎨 **{name}** — {ch.get('look', '')[:100]}…", extra_blocks=atts)
        c.sheets = sheets
        c.status = c.stage = "awaiting_character_review"
        c.updatedAt = _now()
        db.commit()
        _save_hoa_msg(db, cid, "👉 Chọn mặt cho từng nhân vật: gõ **chọn <tên> 1** hoặc **chọn <tên> 2** — xong gõ **duyệt** để chốt hồ sơ (P2 sẽ dùng vẽ toàn truyện). Không chọn = mặc định bản 1.")
        w = db.get(Workflow, WF_ID)
        if w:
            w.steps = [{**s, "status": ("done" if i <= 1 else "idle")} for i, s in enumerate(w.steps or [])]
            w.runState = "idle"
            db.commit()
        _jobs[_JOB] = {"status": "done"}
    except Exception as exc:  # noqa: BLE001
        _jobs[_JOB] = {"status": "error", "result": str(exc)}
    finally:
        db.close()


def _bg_script(idea: str, cid: str, user_id: str) -> None:
    from app.crud import today_ymd

    db = SessionLocal()
    try:
        try:
            data = _write_script(idea)
        except Exception as exc:  # noqa: BLE001
            _save_hoa_msg(db, cid, f"Không viết được kịch bản (9Router: {str(exc)[:120]}) — thử lại nhé.")
            _jobs[_JOB] = {"status": "error"}
            return
        c = Comic(
            id=uid("cm"), title=data.get("title", idea[:50]), idea=idea, style=data.get("style", _STYLE_DEFAULT),
            script=data, characters=data.get("characters", []), status="awaiting_script_review",
            stage="awaiting_script_review", channelId=cid, createdBy=user_id,
            createdAt=_now(), updatedAt=_now(), sort=next_sort(db, Comic),
        )
        db.add(c)
        db.commit()
        w = db.get(Workflow, WF_ID)
        if w:
            w.steps = [{**s, "status": ("done" if i == 0 else "idle")} for i, s in enumerate(w.steps or [])]
            w.runs = [{"time": now_hm(), "date": today_ymd(), "status": "success", "dur": ""}, *(w.runs or [])][:200]
            w.lastRun = now_hm()
            w.runs24 = (w.runs24 or 0) + 1
            db.commit()
        _save_hoa_msg(db, cid, _script_digest(c))
        _jobs[_JOB] = {"status": "done"}
    except Exception as exc:  # noqa: BLE001
        _jobs[_JOB] = {"status": "error", "result": str(exc)}
    finally:
        db.close()


# ─────────────────────────── stage 3 (P2): panels + pages ───────────────────────────
def _post_page(db: Session, cid: str, comic, page: dict, tag: str = "") -> None:
    url = comic_builder.compose_page(comic, page)
    att = [{"kind": "attach", "icon": "🖼", "name": f"Trang {page.get('page')} — {comic.title}",
            "label": f"{len(page.get('panels', []))} khung · png", "url": url,
            "mime": "image/png", "fileKind": "image"}]
    _save_hoa_msg(db, cid, f"🖼 **Trang {page.get('page')}**{tag}", extra_blocks=att)


def _bg_pages(comic_id: str, cid: str) -> None:
    db = SessionLocal()
    try:
        c = db.get(Comic, comic_id)
        if not c:
            return
        pages = (c.script or {}).get("pages", [])
        total = len(pages)
        for i, page in enumerate(pages, 1):
            for pn in page.get("panels", []):
                nonce = comic_builder.get_nonce(c, page.get("page", i), pn.get("panel", 0))
                try:
                    comic_builder.gen_panel(c, page.get("page", i), pn, nonce)
                except comfy_client.ComfyError as exc:
                    _save_hoa_msg(db, cid, f"⚠️ Khung {pn.get('panel')} trang {page.get('page')} lỗi ComfyUI: {exc}")
            try:
                _post_page(db, cid, c, page, tag=f" ({i}/{total})")
            except Exception as exc:  # noqa: BLE001
                _save_hoa_msg(db, cid, f"⚠️ Không ghép được trang {page.get('page')}: {str(exc)[:100]}")
        c.status = c.stage = "awaiting_page_review"
        c.updatedAt = _now()
        db.commit()
        _save_hoa_msg(db, cid, "👉 Xem từng trang: khung nào lệch gõ **gen lại trang <số> khung <số>** — ưng hết gõ **duyệt** để chốt chương.")
        w = db.get(Workflow, WF_ID)
        if w:
            w.steps = [{**s, "status": ("done" if i2 <= 3 else "idle")} for i2, s in enumerate(w.steps or [])]
            w.runState = "idle"
            db.commit()
        _jobs[_JOB] = {"status": "done"}
    except Exception as exc:  # noqa: BLE001
        _jobs[_JOB] = {"status": "error", "result": str(exc)}
    finally:
        db.close()


def _bg_regen(comic_id: str, cid: str, page_no: int, panel_no: int) -> None:
    db = SessionLocal()
    try:
        c = db.get(Comic, comic_id)
        if not c:
            return
        page = next((p for p in (c.script or {}).get("pages", []) if p.get("page") == page_no), None)
        pn = next((k for k in (page or {}).get("panels", []) if k.get("panel") == panel_no), None)
        if not page or not pn:
            _save_hoa_msg(db, cid, f"Không thấy trang {page_no} khung {panel_no}.")
            _jobs[_JOB] = {"status": "done"}
            return
        nonce = comic_builder.regen_nonce(c, page_no, panel_no)
        db.commit()
        comic_builder.gen_panel(c, page_no, pn, nonce)
        _post_page(db, cid, c, page, tag=f" — đã vẽ lại khung {panel_no}")
        _jobs[_JOB] = {"status": "done"}
    except Exception as exc:  # noqa: BLE001
        _save_hoa_msg(db, cid, f"⚠️ Gen lại lỗi: {str(exc)[:120]}")
        _jobs[_JOB] = {"status": "error", "result": str(exc)}
    finally:
        db.close()


# ─────────────────────────── chat ───────────────────────────
class ChatIn(BaseModel):
    channel_id: str = COMIC_CHANNEL_ID
    text: str


def _active_comic(db: Session, cid: str) -> Comic | None:
    return db.scalars(select(Comic).where(Comic.channelId == cid).order_by(Comic.sort.desc()).limit(1)).first()


@router.get("/chat")
def chat_status():
    return _jobs.get(_JOB) or {"status": "idle"}


@router.post("/chat")
def comics_chat(body: ChatIn, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    cid = body.channel_id or COMIC_CHANNEL_ID
    ensure_comic_channel(db)
    t = (body.text or "").strip()
    low = t.lower().replace("@họa", "").replace("@hoa", "").strip()
    c = _active_comic(db, cid)

    if any(k in low for k in ("trạng thái", "trang thai", "status")):
        if not c:
            return {"messages": [_save_hoa_msg(db, cid, "Chưa có truyện nào — gõ ý tưởng để em bắt đầu.")], "job": None}
        vi = {"awaiting_script_review": "chờ DUYỆT kịch bản", "designing": "đang vẽ nhân vật",
              "awaiting_character_review": "chờ CHỌN mặt nhân vật", "ready_p2": "hồ sơ chốt — gõ DUYỆT để sinh khung",
              "generating_pages": "đang sinh khung + ghép trang", "awaiting_page_review": "chờ DUYỆT trang (gen lại khung nếu cần)",
              "done_p2": "chương HOÀN TẤT 🎉", "scripting": "đang biên kịch", "error": "lỗi"}
        return {"messages": [_save_hoa_msg(db, cid, f"📚 **{c.title}** — {vi.get(c.status, c.status)}.")], "job": None}

    if any(k in low for k in ("hủy", "huy bo", "cancel")) and low in ("hủy", "huy", "cancel", "hủy truyện", "huy truyen"):
        if c and c.status not in ("ready_p2",):
            c.status = c.stage = "error"
            c.errorMessage = "Đã hủy"
            c.updatedAt = _now()
            db.commit()
            return {"messages": [_save_hoa_msg(db, cid, f"Đã hủy **{c.title}**.")], "job": None}
        return {"messages": [_save_hoa_msg(db, cid, "Không có truyện nào đang làm để hủy.")], "job": None}

    # pick a face: "chọn <tên> 1|2"
    pick = re.match(r"(?:chọn|chon)\s+(.+?)\s+([12])\s*$", low)
    if pick and c and c.status == "awaiting_character_review":
        want, v = pick.group(1).strip(), int(pick.group(2))
        target = next((ch["name"] for ch in (c.characters or []) if _slug(ch["name"]) == _slug(want)), None)
        if not target:
            names = " · ".join(ch["name"] for ch in (c.characters or []))
            return {"messages": [_save_hoa_msg(db, cid, f"Không thấy nhân vật «{want}». Có: {names}.")], "job": None}
        c.picks = {**(c.picks or {}), target: v}
        c.updatedAt = _now()
        db.commit()
        return {"messages": [_save_hoa_msg(db, cid, f"✅ **{target}** → bản {v}. ({len(c.picks)}/{len(c.characters)} đã chọn — gõ **duyệt** khi xong.)")], "job": None}

    # regen one panel: "gen lại trang 2 khung 3"
    rg = re.search(r"(?:gen lại|gen lai|làm lại|lam lai|vẽ lại|ve lai)\s*trang\s*(\d+)\s*khung\s*(\d+)", low)
    if rg and c and c.status == "awaiting_page_review":
        job = _jobs.get(_JOB)
        if job and job.get("status") == "running":
            return {"messages": [_save_hoa_msg(db, cid, "Em đang vẽ dở, chờ chút nhé.")], "job": "running"}
        _jobs[_JOB] = {"status": "running"}
        interim = _save_hoa_msg(db, cid, f"🖌 Vẽ lại trang {rg.group(1)} khung {rg.group(2)} (seed mới, ~15 giây)…")
        threading.Thread(target=_bg_regen, args=(c.id, cid, int(rg.group(1)), int(rg.group(2))), daemon=True).start()
        return {"messages": [interim], "job": "running"}

    # gates
    if low in ("duyệt", "duyet", "ok", "approve"):
        if c and c.status == "awaiting_script_review":
            job = _jobs.get(_JOB)
            if job and job.get("status") == "running":
                return {"messages": [_save_hoa_msg(db, cid, "Em đang chạy việc trước đó, chờ chút nhé.")], "job": "running"}
            c.status = c.stage = "designing"
            c.updatedAt = _now()
            db.commit()
            w = db.get(Workflow, WF_ID)
            if w:
                w.runState = "running"
                db.commit()
            _jobs[_JOB] = {"status": "running"}
            interim = _save_hoa_msg(db, cid, f"✅ Kịch bản chốt. 🎨 Đang vẽ character sheet cho {len(c.characters)} nhân vật × 2 bản trên ComfyUI (RTX 5090, ~1 phút)…")
            threading.Thread(target=_bg_sheets, args=(c.id, cid), daemon=True).start()
            return {"messages": [interim], "job": "running"}
        if c and c.status == "awaiting_character_review":
            picks = dict(c.picks or {})
            for ch in c.characters or []:
                picks.setdefault(ch["name"], 1)
            c.picks = picks
            c.status = c.stage = "ready_p2"
            c.updatedAt = _now()
            db.commit()
            chosen = " · ".join(f"{k}: bản {v}" for k, v in picks.items())
            return {"messages": [_save_hoa_msg(db, cid, f"✅ **Hồ sơ nhân vật chốt** ({chosen}). Gõ **duyệt** lần nữa để em sinh khung + ghép trang toàn chương (~3-5 phút).")], "job": None}
        if c and c.status == "ready_p2":
            job = _jobs.get(_JOB)
            if job and job.get("status") == "running":
                return {"messages": [_save_hoa_msg(db, cid, "Em đang chạy việc trước, chờ chút nhé.")], "job": "running"}
            n_panels = sum(len(p.get("panels", [])) for p in (c.script or {}).get("pages", []))
            c.status = c.stage = "generating_pages"
            c.updatedAt = _now()
            db.commit()
            w = db.get(Workflow, WF_ID)
            if w:
                w.runState = "running"
                w.steps = [{**s, "status": ("done" if i <= 1 else ("running" if i == 2 else "idle"))} for i, s in enumerate(w.steps or [])]
                db.commit()
            _jobs[_JOB] = {"status": "running"}
            interim = _save_hoa_msg(db, cid, f"🖌 Bắt đầu sinh **{n_panels} khung** trên RTX 5090 (~{max(1, n_panels * 15 // 60)}-{max(2, n_panels * 20 // 60)} phút) — xong trang nào em đăng trang đó.")
            threading.Thread(target=_bg_pages, args=(c.id, cid), daemon=True).start()
            return {"messages": [interim], "job": "running"}
        if c and c.status == "awaiting_page_review":
            from app.crud import today_ymd

            c.status = c.stage = "done_p2"
            c.updatedAt = _now()
            db.commit()
            w = db.get(Workflow, WF_ID)
            if w:
                w.steps = [{**s, "status": ("done" if i <= 3 else "idle")} for i, s in enumerate(w.steps or [])]
                w.runs = [{"time": now_hm(), "date": today_ymd(), "status": "success", "dur": ""}, *(w.runs or [])][:200]
                w.lastRun = now_hm()
                w.runs24 = (w.runs24 or 0) + 1
                w.runState = "idle"
                db.commit()
            return {"messages": [_save_hoa_msg(db, cid, f"🎉 **{c.title} — chương 1 HOÀN TẤT!** Toàn bộ trang đã chốt. (P3 sẽ xuất webtoon dọc/PDF + đăng kênh.)")], "job": None}
        return {"messages": [_save_hoa_msg(db, cid, "Hiện không có cổng nào chờ duyệt.")], "job": None}

    # new comic from an idea
    if len(t) >= 8:
        job = _jobs.get(_JOB)
        if job and job.get("status") == "running":
            return {"messages": [_save_hoa_msg(db, cid, "Em đang bận việc trước — chờ xong rồi gửi ý tưởng nhé.")], "job": "running"}
        _jobs[_JOB] = {"status": "running"}
        interim = _save_hoa_msg(db, cid, "✍️ Nhận ý tưởng — em biên kịch chương 1 (trang/khung/thoại), ~30 giây…")
        threading.Thread(target=_bg_script, args=(t, cid, current.id), daemon=True).start()
        return {"messages": [interim], "job": "running"}

    return {"messages": [_save_hoa_msg(db, cid, "Gõ **Ý TƯỞNG truyện** (1-2 câu) để em biên kịch. Lệnh: **duyệt** · **chọn <tên> 1|2** · **trạng thái** · **hủy**.")], "job": None}
