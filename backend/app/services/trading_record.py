"""Surface TradingAgents activity across AgentAIOS + the 5-agent pipeline.

Two analysis paths, both recorded into the existing domains (MCP / Workflow /
Session / Knowledge):
  - record_analysis(): the deep TradingAgents black-box (`vn_cli.py analyze`)
  - run_pipeline():    AgentAIOS's own 5 distinct agents, one real 9Router call
                       each (Analyst -> Research -> Trader -> Risk -> Portfolio)

All writers are defensive: a logging failure must never break the response.
"""

import re

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.crud import now_hm, uid
from app.models.agents import Agent, McpServer, Workflow
from app.models.comms import Room
from app.models.ops import KnowledgeEntry, SessionLog
from app.models.user import User

MCP_ID = "tradingagents-vn"
WF_ID = "wf-trading-analysis"
ROOM_ID = "room-chung-khoan"
_AGENT = ("Phân tích CK", "T", "#0A7B52")  # the chat assistant (P2)
_TOOLS = ["analyze_vn_stock", "get_vn_stock_snapshot", "get_vn_news", "get_vn_extras", "get_vn_macro"]

# Full TradingAgents-style pipeline (ảnh 1): 4 data agents (parallel) → Bull/Bear debate (parallel)
# → Backtest (deterministic) → Risk → Trader → Portfolio (sequential). Each LLM agent = 1 real 9Router call.
_PIPELINE = [
    # --- data layer (chạy song song, mỗi agent 1 mảng dữ liệu) ---
    {"id": "agent-ck-market", "name": "Market Data", "role": "Dữ liệu thị trường", "initial": "M", "color": "#3B5BDB", "group": "data",
     "io": "Giá/KL/khối ngoại real-time",
     "persona": "Bạn là Market Data Agent — tóm tắt giá khớp, biến động, thanh khoản và dòng tiền khối ngoại real-time. Nêu các con số chính + nhận xét dòng tiền. KHÔNG bịa số."},
    {"id": "agent-ck-fund", "name": "Fundamental", "role": "Phân tích cơ bản", "initial": "F", "color": "#0CA678", "group": "data",
     "io": "P/E, P/B, ROE, định giá",
     "persona": "Bạn là Fundamental Agent — phân tích định giá (P/E, P/B, ROE, EPS): cổ phiếu đang rẻ hay đắt, chất lượng doanh nghiệp ra sao. KHÔNG bịa số; nếu thiếu dữ liệu thì nói rõ."},
    {"id": "agent-ck-tech", "name": "Technical", "role": "Phân tích kỹ thuật", "initial": "K", "color": "#E8A33D", "group": "data",
     "io": "RSI/MACD/MA/mẫu hình",
     "persona": "Bạn là Technical Agent — đọc tín hiệu kỹ thuật (RSI, MACD, MA, hỗ trợ/kháng cự, xu hướng, mẫu hình, breakout). Kết luận: tín hiệu kỹ thuật đang nghiêng mua hay bán. KHÔNG bịa số."},
    {"id": "agent-ck-news", "name": "News/Sentiment", "role": "Tin tức & tâm lý", "initial": "N", "color": "#9C36B5", "group": "data",
     "io": "Tin + chấm điểm tâm lý",
     "persona": "Bạn là News/Sentiment Agent — tóm tắt tin tức chính và CHẤM ĐIỂM TÂM LÝ thị trường: Tích cực / Trung tính / Tiêu cực, kèm lý do ngắn. KHÔNG bịa tin."},
    # --- debate (chạy song song, đối lập) ---
    {"id": "agent-ck-bull", "name": "Bull", "role": "Phe Mua", "initial": "Bu", "color": "#0A7B52", "group": "debate",
     "io": "Luận điểm MUA",
     "persona": "Bạn là Bull Researcher (phe MUA) — nêu các luận điểm MẠNH NHẤT để MUA dựa trên phân tích. CHỈ tranh luận chiều mua, thuyết phục, có dẫn chứng số."},
    {"id": "agent-ck-bear", "name": "Bear", "role": "Phe Bán", "initial": "Be", "color": "#C92A2A", "group": "debate",
     "io": "Luận điểm BÁN",
     "persona": "Bạn là Bear Researcher (phe BÁN) — nêu các luận điểm MẠNH NHẤT để BÁN/TRÁNH dựa trên phân tích + rủi ro. CHỈ tranh luận chiều bán, có dẫn chứng số."},
    # --- decision (tuần tự) ---
    {"id": "agent-ck-risk", "name": "Risk", "role": "Quản trị rủi ro", "initial": "Rk", "color": "#C94F3D", "group": "decision",
     "io": "Rủi ro + cắt lỗ",
     "persona": "Bạn là Risk Manager — đánh giá rủi ro (biến động, thanh khoản, khối ngoại, vĩ mô), đề xuất position sizing (tỷ trọng) và mức cắt lỗ cụ thể."},
    {"id": "agent-ck-trader", "name": "Trader", "role": "Quyết định giao dịch", "initial": "Tr", "color": "#1971C2", "group": "decision",
     "io": "MUA/BÁN/GIỮ",
     "persona": "Bạn là Trader/Decision — cân nhắc tranh luận Bull/Bear + rủi ro + backtest, ra quyết định rõ ràng: MUA / BÁN / GIỮ + vùng giá vào/chốt/cắt + lý do chính."},
    {"id": "agent-ck-portfolio", "name": "Portfolio", "role": "Quản lý danh mục", "initial": "P", "color": "#8B5CF6", "group": "decision",
     "io": "Tỷ trọng + chốt",
     "persona": "Bạn là Portfolio Manager — chốt khuyến nghị cuối: Rating (Mua/Giữ/Bán), hành động cụ thể và tỷ trọng đề xuất (không all-in). Kết bằng: 'Nghiên cứu, không phải lời khuyên đầu tư.'"},
]

TOOL_OF = {"snapshot": "get_vn_stock_snapshot", "news": "get_vn_news", "extras": "get_vn_extras", "macro": "get_vn_macro", "analyze": "analyze_vn_stock"}


def _top_sort(db: Session, model) -> int:
    return (db.scalar(select(func.min(model.sort))) or 0) - 1


def _md_inline(text: str) -> list:
    """Parse **bold** into rich spans; drop stray * (italic) markers."""
    spans: list = []
    for part in re.split(r"(\*\*[^*]+\*\*)", text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            spans.append({"v": part[2:-2], "isBold": True})
        else:
            spans.append({"v": part.replace("*", ""), "isText": True})
    return spans or [{"v": "", "isText": True}]


# LLM-internal directives that leak from TradingAgents tool output — never shown to the user.
_DROP_PHRASES = (
    "use this snapshot", "as the source of truth", "do not claim historical",
    "flag the discrepancy", "inventing a reconciled number",
    "rows after the requested analysis date",
)


def md_to_blocks(text: str) -> list:
    """Lightweight markdown -> chat blocks: headers/bold/quote tidied, `| a | b |`
    tables become real table blocks, and LLM-internal directives are dropped.
    Used for agent messages posted to channels.
    """
    lines = (text or "").split("\n")
    blocks: list = []
    i, n = 0, len(lines)
    while i < n:
        raw = lines[i].rstrip()
        low = raw.strip().lower()
        if low and any(p in low for p in _DROP_PHRASES):
            i += 1
            continue
        # markdown table: consecutive "| … |" lines (skip the |---|---| separator row)
        if raw.strip().startswith("|") and raw.strip().endswith("|"):
            rows: list = []
            while i < n and lines[i].strip().startswith("|") and lines[i].strip().endswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{2,}:?", c or "x") for c in cells):
                    rows.append(cells)
                i += 1
            if rows:
                blocks.append({"kind": "table", "rows": rows})
            continue
        h = re.match(r"^#{1,4}\s+(.*)", raw)
        if h:
            blocks.append({"kind": "para", "rich": [{"v": h.group(1).replace("*", ""), "isBold": True}]})
            i += 1
            continue
        t = raw
        if t.startswith(">"):
            t = t.lstrip("> ").rstrip()
        blocks.append({"kind": "para", "rich": _md_inline(t)})
        i += 1
    return blocks


# ----------------------------- ensure scaffolding -----------------------------
def ensure_mcp_server(db: Session) -> McpServer:
    m = db.get(McpServer, MCP_ID)
    if m:
        return m
    m = McpServer(
        id=MCP_ID, name="tradingagents-vn", icon="📈",
        desc="Phân tích chứng khoán VN đa-agent (vnstock/FireAnt) qua vn_cli.py — không sửa repo gốc.",
        transport="stdio (subprocess)", status="connected", tools=_TOOLS,
        agents=6, calls24=0, lastSync=now_hm(), endpoint="D:/TradingAgents/repo/vn_cli.py",
        recentCalls=[], sort=-1,
    )
    db.add(m)
    db.commit()
    return m


def ensure_trading_agent(db: Session) -> Agent:
    """The 'Phân tích CK' chat assistant (P2)."""
    a = db.scalar(select(Agent).where(Agent.name == _AGENT[0]))
    if a:
        return a
    a = Agent(
        id="agent-trading-vn", name=_AGENT[0], handle="@phan-tich-ck", role="Trợ lý chứng khoán VN",
        roleType="research", initial=_AGENT[1], color=_AGENT[2], status="online", model="fast-chat",
        modelType="local", tasks=0, rooms=1, success=100, skills=["snapshot", "news", "macro", "analyze"],
        lastActive="vừa xong", bio="Trợ lý chat chứng khoán VN qua TradingAgents. Không phải lời khuyên đầu tư.",
        roomsList=["#chung-khoan"], recentTasks=[], sort=-1,
    )
    db.add(a)
    db.commit()
    return a


def ensure_pipeline_agents(db: Session) -> list:
    """The pipeline agents as real Agent rows (+ remove rows from the old 5-agent layout)."""
    for old_id in ("agent-ck-analyst", "agent-ck-research"):  # split into market/fund/tech/news + bull/bear
        o = db.get(Agent, old_id)
        if o:
            db.delete(o)
    out = []
    for i, a in enumerate(_PIPELINE):
        ag = db.get(Agent, a["id"])  # dedup by id so renames are handled
        if not ag:
            ag = Agent(
                id=a["id"], name=a["name"], handle="@" + a["id"].replace("agent-ck-", ""), role=a["role"],
                roleType="research", initial=a["initial"], color=a["color"], status="online", model="fast-chat",
                modelType="local", tasks=0, rooms=1, success=100, skills=[a["io"]], lastActive="vừa xong",
                bio=a["persona"], roomsList=["#chung-khoan"], recentTasks=[], sort=-2 - i,
            )
            db.add(ag)
        else:
            ag.name, ag.role, ag.initial, ag.color, ag.bio = a["name"], a["role"], a["initial"], a["color"], a["persona"]
        out.append(ag)
    db.commit()
    return out


# Sage — the chat-callable advisor that runs the pipeline on real-time data
# and answers follow-up questions. The pipeline agents above are its workers.
ADVISOR = {
    "id": "agent-ck-covan", "name": "Sage", "handle": "@sage", "initial": "S", "color": "#0E9F6E",
    "persona": ("Bạn là Sage — cố vấn đầu tư cá nhân. Anh @gọi em trong chat; em chạy pipeline "
                "(Analyst → Bull/Bear → Trader → Risk → Portfolio) trên dữ liệu real-time rồi tổng hợp "
                "thành lời khuyên rõ ràng (mua/bán/giữ, vùng giá, tỷ trọng vốn, rủi ro) và giải đáp thắc mắc."),
}


def ensure_advisor_agent(db: Session) -> Agent:
    ag = db.get(Agent, ADVISOR["id"])
    if not ag:
        ag = Agent(
            id=ADVISOR["id"], name=ADVISOR["name"], handle=ADVISOR["handle"], role="Cố vấn đầu tư",
            roleType="research", initial=ADVISOR["initial"], color=ADVISOR["color"], status="online",
            model="fast-chat", modelType="local", tasks=0, rooms=1, success=100,
            skills=["Tư vấn real-time", "Pipeline 5-agent"], lastActive="vừa xong",
            bio=ADVISOR["persona"], roomsList=["#chung-khoan"], recentTasks=[], sort=-1,
        )
        db.add(ag)
    else:
        ag.name, ag.handle, ag.role, ag.initial, ag.color, ag.bio = (
            ADVISOR["name"], ADVISOR["handle"], "Cố vấn đầu tư", ADVISOR["initial"], ADVISOR["color"], ADVISOR["persona"])
    db.commit()
    return ag


def ensure_analysis_workflow(db: Session) -> Workflow:
    template = [{"agent": a["name"], "initial": a["initial"], "color": a["color"], "title": a["role"], "io": a["io"], "status": "idle", "dur": ""} for a in _PIPELINE]
    w = db.get(Workflow, WF_ID)
    if not w:
        w = Workflow(
            id=WF_ID, name="Phân tích cổ phiếu (đa-agent)",
            desc="Pipeline: 4 data agent (Market/Fundamental/Technical/News) → Bull/Bear → Risk → Trader → Portfolio.",
            trigger="manual", triggerLabel="Khi chạy pipeline 5-agent", enabled=True,
            lastRun="", runs24=0, success=100, steps=template, runs=[], runState="idle", sort=-1,
        )
        db.add(w)
        db.commit()
        return w
    # migrate older single-agent steps to the 5 distinct agents (once)
    if not w.steps or w.steps[0].get("agent") != template[0]["agent"] or len(w.steps) != len(template):
        w.steps = template
        w.name = "Phân tích cổ phiếu (đa-agent)"
        db.commit()
    return w


def ensure_trading_room(db: Session) -> Room:
    """'Chứng khoán' room — owner (lead) + the 5 pipeline agents (staff)."""
    owner = db.scalar(select(User).where(User.role == "owner")) or db.scalar(select(User))
    want: list = []
    if owner:
        want.append({"name": owner.name, "handle": "@" + (owner.name.split()[0].lower() if owner.name else "owner"),
                     "type": "user", "role": "lead", "initial": owner.initial, "color": owner.color})
    for a in _PIPELINE:
        want.append({"name": a["name"], "handle": "@" + a["id"].replace("agent-ck-", ""),
                     "type": "agent", "role": "staff", "initial": a["initial"], "color": a["color"]})
    r = db.get(Room, ROOM_ID)
    if not r:
        r = Room(id=ROOM_ID, name="Chứng khoán", slug="chung-khoan", channel="chung-khoan", members=want, sort=-1)
        db.add(r)
    else:
        r.members = want  # keep room membership = owner + 5 pipeline agents
    db.commit()
    return r


def ensure_all(db: Session) -> None:
    ensure_mcp_server(db)
    ensure_trading_agent(db)
    ensure_pipeline_agents(db)
    ensure_advisor_agent(db)
    ensure_analysis_workflow(db)
    ensure_trading_room(db)


# ----------------------------- recording -----------------------------
def record_mcp_call(db: Session, command: str, ok: bool = True) -> None:
    try:
        m = ensure_mcp_server(db)
        m.recentCalls = [{"tool": TOOL_OF.get(command, command), "time": now_hm(), "ok": ok}, *(m.recentCalls or [])][:8]
        m.calls24 = (m.calls24 or 0) + 1
        m.lastSync = now_hm()
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()


_HEADER_RE = re.compile(r"^#{1,4}\s+(.+)$", re.M)
_REC_RE = re.compile(r"(MUA|BÁN|GIỮ|NẮM GIỮ|HOLD|BUY|SELL|TÍCH LŨY|GIẢM TỶ TRỌNG|KHUYẾN NGHỊ)[^\n]{0,70}", re.I)


def _log_from_report(report: str, ticker: str, ok: bool) -> list:
    t = now_hm()
    out = [{"t": t, "lvl": "info", "msg": f"tradingagents-vn · analyze {ticker} (subprocess vn_cli.py)"}]
    if not ok or not report:
        out.append({"t": t, "lvl": "error", "msg": "Pipeline lỗi hoặc không trả kết quả"})
        return out
    for h in _HEADER_RE.findall(report)[:6]:
        out.append({"t": t, "lvl": "debug", "msg": "§ " + h.strip()[:80]})
    rec = _REC_RE.search(report)
    if rec:
        out.append({"t": t, "lvl": "info", "msg": "→ " + rec.group(0).strip()[:80]})
    out.append({"t": t, "lvl": "info", "msg": f"Báo cáo {len(report):,} ký tự — đã lưu vào Kiến thức"})
    return out


def record_analysis(db: Session, ticker: str, *, report: str = "", duration: str = "", model: str = "deep_think", ok: bool = True) -> None:
    """Records the deep TradingAgents (vn_cli analyze) run."""
    ticker = ticker.upper()
    try:
        w = ensure_analysis_workflow(db)
        w.runs = [{"time": now_hm(), "status": "success" if ok else "failed", "dur": duration}, *(w.runs or [])][:12]
        w.lastRun = now_hm()
        w.runs24 = (w.runs24 or 0) + 1
        w.runState = "idle"
        w.steps = [{**s, "status": "done" if ok else "idle"} for s in (w.steps or [])]
        db.add(SessionLog(
            id=uid("s"), agent=_AGENT[0], initial=_AGENT[1], color=_AGENT[2], room="#chung-khoan",
            model=model, modelType="local", status="done" if ok else "failed", started=now_hm(),
            duration=duration, tokens=(f"~{len(report) // 4:,}" if report and ok else "—"),
            log=_log_from_report(report, ticker, ok), sort=_top_sort(db, SessionLog),
        ))
        if ok and report:
            db.add(KnowledgeEntry(
                id=uid("kn"), type="knowledge", title=f"Phân tích {ticker} ({now_hm()})", repo="trading/vn",
                ver="v1", time="vừa xong", private=False, avatars=[{"i": _AGENT[1], "c": _AGENT[2]}],
                content=report, sort=_top_sort(db, KnowledgeEntry),
            ))
        m = ensure_mcp_server(db)
        m.recentCalls = [{"tool": "analyze_vn_stock", "time": now_hm(), "ok": ok}, *(m.recentCalls or [])][:8]
        m.calls24 = (m.calls24 or 0) + 1
        m.lastSync = now_hm()
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()


# ----------------------- anti-hallucination grounding (ALL models) -----------------------
# Every LLM that comments on a stock must reason ONLY from fetched data, must
# never invent numbers, and must not confuse the current price with target
# levels. This rule + the deterministic price line below are shared by every
# trading LLM path (chat, 5-agent pipeline, analyze TL;DR, morning briefing).
ANTI_HALLUCINATION = (
    "TUYỆT ĐỐI KHÔNG bịa số: chỉ dùng giá / chỉ báo / con số CÓ trong dữ liệu được cung cấp bên dưới. "
    "Không suy đoán số liệu thiếu — nếu thiếu thì nói rõ 'không đủ dữ liệu', KHÔNG đoán bừa. "
    "GIÁ HIỆN TẠI = giá đóng cửa mới nhất trong dữ liệu; KHÔNG nhầm nó với vùng mua / hỗ trợ / mục tiêu (thường thấp hơn)."
)


def _snap_field(snap: str, label: str) -> str | None:
    m = re.search(rf"{re.escape(label)}\s*\|\s*([\d.,]+)", snap or "")
    return m.group(1) if m else None


def price_headline(ticker: str, snap: str) -> str:
    """Deterministic, always-correct current-price line — prepended to single-ticker
    outputs so the user sees the right price even if a model drifts."""
    close = _snap_field(snap, "Close")
    if not close:
        return ""
    rsi, sma50, sma200 = _snap_field(snap, "rsi"), _snap_field(snap, "close_50_sma"), _snap_field(snap, "close_200_sma")
    trend = ""
    try:
        c = float(close.replace(",", "."))
        if sma50 and sma200:
            s50, s200 = float(sma50.replace(",", ".")), float(sma200.replace(",", "."))
            trend = ("dưới SMA50 & SMA200 (xu hướng giảm)" if c < s50 and c < s200
                     else "trên SMA50 & SMA200 (xu hướng tăng)" if c > s50 and c > s200
                     else "đan xen quanh SMA (đi ngang)")
    except ValueError:
        pass
    bits = [f"📍 {ticker} đang ở {close}"] + ([f"RSI {rsi}"] if rsi else []) + ([trend] if trend else [])
    return " · ".join(bits)


def live_directive(ticker: str, snap: str) -> str:
    """A forceful, parsed price fact that overrides stale numbers in the context."""
    close = _snap_field(snap, "Close")
    if not close:
        return ""
    rsi, sma50, sma200 = _snap_field(snap, "rsi"), _snap_field(snap, "close_50_sma"), _snap_field(snap, "close_200_sma")
    extra = " ".join(filter(None, [f"RSI {rsi}." if rsi else "", f"SMA50 {sma50}." if sma50 else "", f"SMA200 {sma200}." if sma200 else ""]))
    return (
        f"⚠️ GIÁ HIỆN TẠI của {ticker} = {close} (đóng cửa gần nhất). {extra} "
        f"BẮT BUỘC: mọi nhận định 'giá hiện tại' / 'đang ở vùng' phải dùng đúng {close}. "
        f"Các mức THẤP HƠN {close} (vùng mua / hỗ trợ / đáy) KHÔNG phải giá hiện tại — "
        f"TUYỆT ĐỐI không nói {ticker} 'đang ở đáy' tại mức thấp hơn {close}. Số cũ lệch thì sửa theo {close}."
    )


def ground(ticker: str) -> tuple[str, str, str, float | None]:
    """Ground a stock answer → (snapshot, headline, directive, live_price). Prefers the LIVE
    intraday price (vnstock price_board) over the EOD close so the analyst has today's price;
    falls back to the EOD snapshot if real-time is unavailable. live_price (thousands) is the
    real-time match price or None. Returns ('','','',None) if no data at all."""
    from app.services import tradingagents as ta

    snap = ta.snapshot(ticker)
    if not snap or snap.startswith(("Lỗi", "Hết", "Không", "Tích hợp", "(")):
        return "", "", "", None
    rt = ta.realtime_quote(ticker)
    if rt and rt.get("price"):
        rsi = _snap_field(snap, "rsi")
        sma50, sma200 = _snap_field(snap, "close_50_sma"), _snap_field(snap, "close_200_sma")
        chs = f"{rt['change']:+}" if rt.get("change") is not None else "?"
        headline = f"📍 {ticker} đang ở {rt['price']} (real-time, {chs}% từ tham chiếu {rt['ref']})" + (f" · RSI {rsi}" if rsi else "")
        directive = (
            f"⚠️ GIÁ REAL-TIME ({ticker}) TRONG PHIÊN HÔM NAY: khớp {rt['price']} ({chs}% so với tham chiếu {rt['ref']}). "
            f"Mở {rt['open']} · Cao {rt['high']} · Thấp {rt['low']} · Trần {rt['ceiling']} / Sàn {rt['floor']} · "
            f"KL {rt['vol']:,} · khối ngoại ròng {rt['foreign_net']:+,} cp. "
            f"Chỉ báo (phiên gần nhất): RSI {rsi}, SMA50 {sma50}, SMA200 {sma200}. "
            f"BẮT BUỘC: GIÁ HIỆN TẠI = {rt['price']} (real-time trong phiên hôm nay — TUYỆT ĐỐI KHÔNG nói 'không có dữ liệu hôm nay'). "
            f"Các mức thấp hơn {rt['price']} là vùng mua/hỗ trợ, không phải giá hiện tại. Đưa ra khuyến nghị vùng giá rõ ràng."
        )
        return snap, headline, directive, rt["price"]
    return snap, price_headline(ticker, snap), live_directive(ticker, snap), None


# ----------------------- the full TradingAgents-style pipeline -----------------------
_BACKTEST_STEP = {"id": "agent-ck-backtest", "name": "Backtest", "role": "Kiểm chứng lịch sử",
                  "initial": "BT", "color": "#495057", "group": "support", "io": "SMA-cross vs mua&giữ"}


def run_pipeline(db: Session, ticker: str) -> tuple[list, bool, str]:
    """Full pipeline (ảnh 1): 4 data agents (song song) → Bull/Bear (song song) → Backtest
    (deterministic) → Risk → Trader → Portfolio (tuần tự). Each LLM agent = 1 real 9Router call.
    Returns ([(agent_dict, output_text), ...], ok, headline)."""
    import time
    from concurrent.futures import ThreadPoolExecutor

    from app.services import ninerouter
    from app.services import tradingagents as ta

    ticker = ticker.upper()
    t0 = time.time()
    ok = {"v": True}
    snap, headline, directive, price = ground(ticker)  # prefer LIVE intraday price over EOD close
    if not snap:
        snap = ta.snapshot(ticker)
        headline, directive, price = price_headline(ticker, snap), "", None

    # ---- data bundle (fetch in parallel) ----
    with ThreadPoolExecutor(max_workers=4) as ex:
        ff, fn, fe, ftec = (ex.submit(ta.fundamentals_text, ticker, price), ex.submit(ta.news, ticker),
                            ex.submit(ta.extras, ticker), ex.submit(ta.tech_analysis, ticker))
    fund, news_txt, extras_txt, tech = ff.result(), (fn.result() or "")[:1100], (fe.result() or "")[:800], (ftec.result() or {})
    mkt = ta.market_overview_text()
    bt = ta.backtest_text(tech)
    slice_of = {
        "Market Data": f"{directive or headline}\n\nKHỐI NGOẠI:\n{extras_txt}",
        "Fundamental": fund or "(không lấy được dữ liệu cơ bản)",
        "Technical": ta.tech_text(tech) or snap,
        "News/Sentiment": news_txt or "(không có tin gần đây)",
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

    # ---- STAGE 1: data agents (parallel) ----
    data_agents = [a for a in _PIPELINE if a["group"] == "data"]
    with ThreadPoolExecutor(max_workers=4) as ex:
        data_out = list(ex.map(lambda a: _call(a, f"Mã {ticker}\n\nDỮ LIỆU (chỉ dùng số trong đây):\n{slice_of.get(a['name'], '')}\n\nVN-Index: {mkt}"), data_agents))
    analyses = "\n".join(f"[{a['name']}]: {r}" for a, r in data_out)

    # ---- STAGE 2: Bull/Bear debate (parallel) ----
    debate_agents = [a for a in _PIPELINE if a["group"] == "debate"]
    with ThreadPoolExecutor(max_workers=2) as ex:
        debate_out = list(ex.map(lambda a: _call(a, f"Mã {ticker}\n\nPHÂN TÍCH:\n{analyses}\n\nBACKTEST: {bt}\n\nNêu luận điểm phe mình."), debate_agents))
    debate = "\n".join(f"[{a['name']}]: {r}" for a, r in debate_out)

    # ---- STAGE 3: Risk → Trader → Portfolio (sequential, sees everything) ----
    prior = f"PHÂN TÍCH:\n{analyses}\n\nTRANH LUẬN MUA/BÁN:\n{debate}\n\n{bt}"
    decision_out = []
    for a in [x for x in _PIPELINE if x["group"] == "decision"]:
        _, r = _call(a, f"Mã {ticker}\n\n{prior[:3000]}\n\nVN-Index: {mkt}", mx=480)
        decision_out.append((a, r))
        prior += f"\n[{a['name']}]: {r}"

    outputs = data_out + debate_out + [(_BACKTEST_STEP, bt or "(không backtest được)")] + decision_out
    _record_pipeline(db, ticker, outputs, f"{int(time.time() - t0)}s", ok["v"], headline)
    return outputs, ok["v"], headline


def _record_pipeline(db: Session, ticker: str, outputs: list, dur: str, ok: bool, headline: str = "") -> None:
    try:
        # workflow: each step shows its agent's real output excerpt
        w = ensure_analysis_workflow(db)
        by_name = {a["name"]: txt for a, txt in outputs}
        w.steps = [{**s, "status": "done", "dur": "", "io": (by_name.get(s["agent"], "")[:70].replace("\n", " ") or s.get("io", ""))} for s in (w.steps or [])]
        w.runs = [{"time": now_hm(), "status": "success" if ok else "failed", "dur": dur}, *(w.runs or [])][:12]
        w.lastRun = now_hm()
        w.runs24 = (w.runs24 or 0) + 1
        w.runState = "idle"
        # one session log per agent — Logs screen shows 5 distinct agents working
        for a, txt in outputs:
            db.add(SessionLog(
                id=uid("s"), agent=a["name"], initial=a["initial"], color=a["color"], room="#chung-khoan",
                model="fast-chat", modelType="local", status="done" if ok else "failed", started=now_hm(),
                duration="", tokens=f"~{max(1, len(txt) // 4)}",
                log=[{"t": now_hm(), "lvl": "info", "msg": f"{a['role']} · {ticker}"},
                     {"t": now_hm(), "lvl": "debug", "msg": txt[:140].replace(chr(10), ' ')}],
                sort=_top_sort(db, SessionLog),
            ))
        # knowledge: the full chained 5-agent report
        report = f"# Pipeline 5-agent — {ticker}\n\n" + (headline + "\n\n" if headline else "") + "\n\n".join(f"## {a['name']} · {a['role']}\n\n{txt}" for a, txt in outputs)
        db.add(KnowledgeEntry(
            id=uid("kn"), type="knowledge", title=f"Pipeline {ticker} ({now_hm()})", repo="trading/vn",
            ver="v1", time="vừa xong", private=False,
            avatars=[{"i": a["initial"], "c": a["color"]} for a, _ in outputs[:4]], content=report,
            sort=_top_sort(db, KnowledgeEntry),
        ))
        m = ensure_mcp_server(db)
        m.recentCalls = [{"tool": "pipeline_5_agent", "time": now_hm(), "ok": ok}, *(m.recentCalls or [])][:8]
        m.calls24 = (m.calls24 or 0) + 1
        m.lastSync = now_hm()
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
