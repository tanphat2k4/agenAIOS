"""Vàng – bạc multi-agent pipeline (P2) — mirror of the stock run_pipeline.

4 data agents (parallel) → Bull/Bear REAL debate (Bear rebuts Bull) → deterministic
SMA50-cross backtest → Risk → Aurum final advisory. Each LLM agent = one 9Router
call grounded in metals.snapshot()/tech_text()/news_headlines(); the workflow card
`wf-metals-analysis` records live runs/steps/logs/knowledge exactly like trading.
"""
import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud import now_hm, today_ymd, uid
from app.models.agents import Agent, Workflow
from app.models.comms import Room
from app.models.user import User
from app.services import metals, ninerouter
from app.models.ops import KnowledgeEntry, SessionLog
from app.services.trading_record import ANTI_HALLUCINATION, _top_sort

WF_ID = "wf-metals-analysis"
ROOM_ID = "room-vang-bac"

_PIPELINE = [
    # --- data layer (parallel) ---
    {"id": "agent-au-price", "name": "Giá & Premium", "role": "Giá trong nước & premium", "initial": "G", "color": "#B8860B", "group": "data",
     "io": "SJC/nhẫn/bạc + premium vs TG",
     "persona": ("Bạn là Price Agent — tóm tắt giá vàng SJC/nhẫn, bạc trong nước, giá thế giới quy đổi và "
                 "PREMIUM trong nước vs thế giới. Nhấn mạnh premium đang cao hay thấp so với vùng bình thường "
                 "5–10%: premium cao = người mua VN đang trả đắt, rủi ro premium xẹp. KHÔNG bịa số.")},
    {"id": "agent-au-macro", "name": "Vĩ mô", "role": "DXY · lợi suất · tỷ giá", "initial": "V", "color": "#3B5BDB", "group": "data",
     "io": "DXY, US10Y, USD/VND",
     "persona": ("Bạn là Macro Agent — phân tích tác động của DXY, lợi suất Mỹ 10Y và tỷ giá USD/VND lên vàng & bạc "
                 "(vàng thường NGHỊCH chiều DXY và lợi suất thực; tỷ giá tăng đẩy giá quy đổi trong nước lên). KHÔNG bịa số.")},
    {"id": "agent-au-news", "name": "Tin tức", "role": "Tin & tâm lý", "initial": "T", "color": "#9C36B5", "group": "data",
     "io": "Headline + chấm điểm tâm lý",
     "persona": ("Bạn là News/Sentiment Agent — đọc các TIÊU ĐỀ TIN được cung cấp, tóm ý chính và CHẤM ĐIỂM tâm lý "
                 "với vàng-bạc: Tích cực / Trung tính / Tiêu cực kèm lý do 1 câu. CHỈ dùng tin trong danh sách, KHÔNG bịa tin.")},
    {"id": "agent-au-tech", "name": "Kỹ thuật", "role": "RSI/MACD/SMA + G/S", "initial": "K", "color": "#E8A33D", "group": "data",
     "io": "Chỉ báo GC=F, SI=F, tỷ số G/S",
     "persona": ("Bạn là Technical Agent — đọc RSI, MACD, SMA50/200 của vàng & bạc thế giới và tỷ số Gold/Silver "
                 "(>80: bạc rẻ tương đối; <65: vàng rẻ tương đối). Kết luận tín hiệu đang nghiêng MUA hay BÁN. KHÔNG bịa số.")},
    # --- debate ---
    {"id": "agent-au-bull", "name": "Bull", "role": "Phe Mua", "initial": "Bu", "color": "#0A7B52", "group": "debate",
     "io": "Luận điểm MUA",
     "persona": "Bạn là Bull Researcher (phe MUA vàng/bạc) — nêu các luận điểm MẠNH NHẤT để MUA lúc này, có dẫn chứng số. CHỈ tranh luận chiều mua."},
    {"id": "agent-au-bear", "name": "Bear", "role": "Phe Bán", "initial": "Be", "color": "#C92A2A", "group": "debate",
     "io": "Phản biện + luận điểm BÁN",
     "persona": "Bạn là Bear Researcher (phe BÁN) — PHẢN BIỆN trực tiếp từng lý lẽ của phe Mua (trích lại ý họ khi bác), rồi nêu luận điểm BÁN/đứng ngoài mạnh nhất kèm số."},
    # --- decision (sequential) ---
    {"id": "agent-au-risk", "name": "Risk", "role": "Quản trị rủi ro", "initial": "R", "color": "#C92A2A", "group": "decision",
     "io": "Premium xẹp · spread bạc · chính sách",
     "persona": ("Bạn là Risk Manager — đánh giá rủi ro RIÊNG của vàng-bạc VN: (1) premium co giãn — mua lúc premium cao "
                 "có thể lỗ dù giá thế giới đứng im; (2) spread mua–bán bạc ~3%; (3) rủi ro chính sách độc quyền vàng miếng "
                 "(Nghị định 24 sửa đổi); (4) biến động DXY/Fed. Chốt: mức rủi ro Thấp/Vừa/Cao + cách phòng. KHÔNG bịa số.")},
    {"id": "agent-au-final", "name": "Aurum", "role": "Cố vấn trưởng — kết luận", "initial": "Au", "color": "#B8860B", "group": "decision",
     "io": "MUA/BÁN/GIỮ từng loại + tỷ trọng",
     "persona": ("Bạn là Aurum — cố vấn trưởng. Tổng hợp mọi phân tích thành khuyến nghị CUỐI, TRẢ LỜI ĐÚNG câu hỏi "
                 "người dùng. Định dạng bắt buộc: **Khuyến nghị:** dòng riêng cho VÀNG MIẾNG / NHẪN / BẠC — mỗi loại "
                 "MUA / BÁN / GIỮ / ĐỨNG NGOÀI + 1 lý do; rồi **Tỷ trọng gợi ý** (% tài sản, nêu rõ khẩu vị rủi ro); "
                 "rồi **Hành động** cụ thể; rồi **Rủi ro chính** 1 câu. Gọn, có số dẫn chứng.")},
]

_BACKTEST_STEP = {"id": "agent-au-backtest", "name": "Backtest", "role": "SMA50-cross GC=F (máy tính)", "initial": "Bt", "color": "#0CA678", "io": "Deterministic, không LLM"}


def ensure_metals_workflow(db: Session) -> Workflow:
    seq: list = []
    for a in _PIPELINE:
        seq.append(a)
        if a["id"] == "agent-au-bear":  # Backtest step right after the debate, like trading
            seq.append(_BACKTEST_STEP)
    template = [{"agent": a["name"], "initial": a["initial"], "color": a["color"], "title": a["role"],
                 "io": a.get("io", ""), "status": "idle", "dur": ""} for a in seq]
    w = db.get(Workflow, WF_ID)
    if not w:
        w = Workflow(
            id=WF_ID, name="Phân tích vàng – bạc (đa-agent)",
            desc="Pipeline: Giá&Premium / Vĩ mô / Tin tức / Kỹ thuật → Bull/Bear → Backtest → Risk → Aurum.",
            trigger="manual", triggerLabel="Khi hỏi khuyến nghị trong #vang-bac", enabled=True,
            lastRun="", runs24=0, success=100, steps=template, runs=[], runState="idle", sort=-1,
        )
        db.add(w)
        db.commit()
        return w
    if not w.steps or len(w.steps) != len(template) or w.steps[0].get("agent") != template[0]["agent"]:
        w.steps = template
        db.commit()
    return w


def ensure_metals_agents(db: Session) -> None:
    """Register every pipeline agent in the Agents screen (Aurum already exists via the router)."""
    for a in _PIPELINE:
        if a["id"] == "agent-au-final":  # Aurum — ensured by routers/metals.ensure_aurum_agent
            continue
        ag = db.get(Agent, a["id"])
        if not ag:
            db.add(Agent(
                id=a["id"], name=a["name"], handle="@" + a["id"].replace("agent-au-", "au-"),
                role=a["role"], roleType="research", initial=a["initial"], color=a["color"],
                status="online", model="fast-chat", modelType="local", tasks=0, rooms=1, success=100,
                skills=[a.get("io", "")], lastActive="vừa xong", bio=a["persona"],
                roomsList=["Giá vàng bạc"], recentTasks=[], sort=-1,
            ))
    db.commit()


def ensure_metals_room(db: Session) -> Room:
    """'Giá vàng bạc' room: owner (lead) + Aurum + the whole pipeline team (staff)."""
    owner = db.scalar(select(User).where(User.role == "owner")) or db.scalar(select(User))
    want: list = []
    if owner:
        want.append({"name": owner.name, "handle": "@" + (owner.name.split()[0].lower() if owner.name else "owner"),
                     "type": "user", "role": "lead", "initial": owner.initial, "color": owner.color})
    for a in _PIPELINE:
        want.append({"name": a["name"], "handle": "@" + a["id"].replace("agent-au-", "au-"),
                     "type": "agent", "role": "staff", "initial": a["initial"], "color": a["color"]})
    want.append({"name": "Backtest", "handle": "@au-backtest", "type": "agent", "role": "staff",
                 "initial": _BACKTEST_STEP["initial"], "color": _BACKTEST_STEP["color"]})
    r = db.get(Room, ROOM_ID)
    if not r:
        r = Room(id=ROOM_ID, name="Giá vàng bạc", slug="vang-bac", channel="vang-bac", members=want, sort=-2)
        db.add(r)
    else:
        r.name, r.channel, r.members = "Giá vàng bạc", "vang-bac", want
    db.commit()
    return r


def run_pipeline(db: Session, question: str = "") -> tuple[list, bool, str]:
    """Returns ([(agent, output), ...], ok, headline). Marks the workflow running while it works."""
    from concurrent.futures import ThreadPoolExecutor

    t0 = time.time()
    ok = {"v": True}
    w = ensure_metals_workflow(db)
    w.runState = "running"
    db.commit()

    snap = metals.snapshot()
    headline = metals.headline(snap)
    news = metals.news_headlines()
    tech = metals.tech_text()
    bt = metals.backtest_sma50("GC=F")
    price_detail = headline + (
        f"\nChi tiết premium: vàng {snap.get('premium_pct')}% · bạc {snap.get('silver_premium_pct')}%"
        f" · TG quy đổi {round((snap.get('world_luong_vnd') or 0) / 1e6, 2)} tr/lượng")
    macro_txt = (f"DXY {snap.get('dxy')} · US10Y {snap.get('us10y')}% · USD/VND {snap.get('usd_vnd'):,.0f}"
                 if snap.get("usd_vnd") else "DXY/US10Y/tỷ giá: thiếu dữ liệu")
    slice_of = {
        "Giá & Premium": price_detail,
        "Vĩ mô": macro_txt,
        "Tin tức": ("\n".join(f"- {h}" for h in news) or "(không lấy được tin — nói rõ là thiếu tin, đừng bịa)"),
        "Kỹ thuật": tech or "(thiếu dữ liệu kỹ thuật)",
    }

    def _call(a: dict, ctx: str, mx: int = 380) -> tuple:
        try:
            r = ninerouter.chat(
                [{"role": "system", "content": a["persona"] + " " + ANTI_HALLUCINATION + " Trả lời ngắn gọn bằng tiếng Việt, tối đa 5 câu."},
                 {"role": "user", "content": ctx}], temperature=0.3, max_tokens=mx)["content"] or "(trống)"
        except Exception as exc:  # noqa: BLE001
            ok["v"] = False
            r = f"Lỗi 9Router: {exc}"
        return a, r

    # STAGE 1: data agents (parallel)
    data_agents = [a for a in _PIPELINE if a["group"] == "data"]
    with ThreadPoolExecutor(max_workers=4) as ex:
        data_out = list(ex.map(lambda a: _call(a, f"DỮ LIỆU (chỉ dùng số/tin trong đây):\n{slice_of.get(a['name'], '')}"), data_agents))
    analyses = "\n".join(f"[{a['name']}]: {r}" for a, r in data_out)

    # STAGE 2: Bull → Bear (real debate — Bear reads Bull)
    bull = next(a for a in _PIPELINE if a["id"] == "agent-au-bull")
    bear = next(a for a in _PIPELINE if a["id"] == "agent-au-bear")
    _, bull_r = _call(bull, f"PHÂN TÍCH:\n{analyses}\n\n{bt}\n\nNêu luận điểm MUA vàng/bạc mạnh nhất lúc này.")
    _, bear_r = _call(bear, f"PHÂN TÍCH:\n{analyses}\n\n{bt}\n\nPHE MUA lập luận:\n«{bull_r}»\n\nMở đầu BẮT BUỘC bằng 'Phản biện phe Mua:' rồi bác bỏ từng lý lẽ, sau đó nêu luận điểm BÁN/đứng ngoài mạnh nhất.")
    debate = f"[Bull]: {bull_r}\n[Bear (phản biện Bull)]: {bear_r}"

    # STAGE 3: Risk → Aurum final (sequential, sees everything; final answers the user's question)
    prior = f"PHÂN TÍCH:\n{analyses}\n\nTRANH LUẬN:\n{debate}\n\n{bt}"
    decision_out = []
    for a in [x for x in _PIPELINE if x["group"] == "decision"]:
        ctx = f"{prior[:3000]}"
        if a["id"] == "agent-au-final" and question:
            ctx += f"\n\nCÂU HỎI CỦA NGƯỜI DÙNG (trả lời đúng ý): {question}"
        _, r = _call(a, ctx, mx=520)
        decision_out.append((a, r))
        prior += f"\n[{a['name']}]: {r}"

    outputs = data_out + [(bull, bull_r), (bear, bear_r), (_BACKTEST_STEP, bt)] + decision_out
    _record(db, outputs, f"{int(time.time() - t0)}s", ok["v"])
    return outputs, ok["v"], headline


def _record(db: Session, outputs: list, dur: str, ok: bool) -> None:
    try:
        w = ensure_metals_workflow(db)
        by_name = {a["name"]: txt for a, txt in outputs}
        w.steps = [{**s, "status": "done", "dur": "", "io": (by_name.get(s["agent"], "")[:70].replace("\n", " ") or s.get("io", ""))} for s in (w.steps or [])]
        w.runs = [{"time": now_hm(), "date": today_ymd(), "status": "success" if ok else "failed", "dur": dur}, *(w.runs or [])][:200]
        w.lastRun = now_hm()
        w.runs24 = (w.runs24 or 0) + 1
        w.runState = "idle"
        for a, txt in outputs:  # one session log per agent, like trading
            db.add(SessionLog(
                id=uid("s"), agent=a["name"], initial=a["initial"], color=a["color"], room="#vang-bac",
                model="fast-chat" if a.get("persona") else "deterministic", modelType="local",
                status="done" if ok else "failed", started=now_hm(), duration=dur, tokens="—",
                log=[{"t": now_hm(), "lvl": "info", "msg": (txt or "")[:160]}], sort=_top_sort(db, SessionLog),
            ))
        final = by_name.get("Aurum", "")
        if ok and final:
            db.add(KnowledgeEntry(
                id=uid("kn"), type="knowledge", title=f"Pipeline Vàng–Bạc ({now_hm()})", repo="metals",
                ver="v1", time="vừa xong", private=False, avatars=[{"i": "Au", "c": "#B8860B"}],
                content="\n\n".join(f"### {a['name']} · {a['role']}\n{txt}" for a, txt in outputs),
                sort=_top_sort(db, KnowledgeEntry),
            ))
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
