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

# The 5 distinct pipeline agents — each owns one workflow step and runs one real 9Router call.
_PIPELINE = [
    {"id": "agent-ck-analyst", "name": "Analyst", "role": "Phân tích dữ liệu", "initial": "A", "color": "#3B5BDB",
     "io": "Thu thập + tóm tắt giá/tin/khối ngoại",
     "persona": "Bạn là Analyst — thu thập và tóm tắt dữ liệu thị trường (giá, chỉ báo kỹ thuật, tin tức, khối ngoại) từ dữ liệu được cung cấp. Nêu súc tích các điểm chính, KHÔNG bịa số."},
    {"id": "agent-ck-research", "name": "Researcher", "role": "Tranh luận Bull/Bear", "initial": "R", "color": "#E8A33D",
     "io": "Tranh luận mua vs bán",
     "persona": "Bạn là Researcher — tranh luận hai chiều: phe Mua (bull) và phe Bán (bear) dựa trên phần phân tích dữ liệu. Nêu luận điểm mạnh nhất mỗi phe."},
    {"id": "agent-ck-trader", "name": "Trader", "role": "Quyết định giao dịch", "initial": "Tr", "color": "#0A7B52",
     "io": "Đề xuất quyết định",
     "persona": "Bạn là Trader — dựa trên tranh luận, đề xuất quyết định rõ ràng: MUA / BÁN / GIỮ, kèm vùng giá tham chiếu."},
    {"id": "agent-ck-risk", "name": "Risk", "role": "Quản trị rủi ro", "initial": "Rk", "color": "#C94F3D",
     "io": "Đánh giá rủi ro",
     "persona": "Bạn là Risk Manager — đánh giá rủi ro của quyết định Trader (thanh khoản, biến động, vĩ mô) và đề xuất mức cắt lỗ."},
    {"id": "agent-ck-portfolio", "name": "Portfolio", "role": "Quản lý danh mục", "initial": "P", "color": "#8B5CF6",
     "io": "Chốt khuyến nghị cuối",
     "persona": "Bạn là Portfolio Manager — chốt khuyến nghị cuối: Rating (Mua/Giữ/Bán), hành động cụ thể và tỷ trọng đề xuất. Kết bằng: 'Nghiên cứu, không phải lời khuyên đầu tư.'"},
]

TOOL_OF = {"snapshot": "get_vn_stock_snapshot", "news": "get_vn_news", "extras": "get_vn_extras", "macro": "get_vn_macro", "analyze": "analyze_vn_stock"}


def _top_sort(db: Session, model) -> int:
    return (db.scalar(select(func.min(model.sort))) or 0) - 1


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
    """The 5 distinct pipeline agents as real Agent rows."""
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


def ensure_analysis_workflow(db: Session) -> Workflow:
    template = [{"agent": a["name"], "initial": a["initial"], "color": a["color"], "title": a["role"], "io": a["io"], "status": "idle", "dur": ""} for a in _PIPELINE]
    w = db.get(Workflow, WF_ID)
    if not w:
        w = Workflow(
            id=WF_ID, name="Phân tích cổ phiếu (5 agent)",
            desc="Pipeline 5 agent riêng: Analyst → Researcher → Trader → Risk → Portfolio.",
            trigger="manual", triggerLabel="Khi chạy pipeline 5-agent", enabled=True,
            lastRun="", runs24=0, success=100, steps=template, runs=[], runState="idle", sort=-1,
        )
        db.add(w)
        db.commit()
        return w
    # migrate older single-agent steps to the 5 distinct agents (once)
    if not w.steps or w.steps[0].get("agent") != template[0]["agent"]:
        w.steps = template
        w.name = "Phân tích cổ phiếu (5 agent)"
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


# ----------------------- the real 5-agent pipeline -----------------------
def run_pipeline(db: Session, ticker: str) -> tuple[list, bool]:
    """Run the 5 distinct agents in sequence via 9Router, each a real LLM call.

    Returns ([(agent_dict, output_text), ...], ok). Records workflow steps,
    one session log per agent, and one chained knowledge report.
    """
    import time

    from app.services import ninerouter
    from app.services import tradingagents as ta

    ticker = ticker.upper()
    t0 = time.time()
    data = f"GIÁ + CHỈ BÁO:\n{ta.snapshot(ticker)}\n\nTIN TỨC:\n{ta.news(ticker)}\n\nKHỐI NGOẠI:\n{ta.extras(ticker)}"

    outputs: list = []
    prior = ""
    ok = True
    for a in _PIPELINE:
        ctx = f"Mã cổ phiếu: {ticker}\n\nDỮ LIỆU THỊ TRƯỜNG:\n{data[:2400]}"
        if prior:
            ctx += f"\n\nKẾT QUẢ CÁC BƯỚC TRƯỚC:\n{prior[:2600]}"
        try:
            reply = ninerouter.chat(
                [{"role": "system", "content": a["persona"] + " Trả lời ngắn gọn bằng tiếng Việt, tối đa 6 câu."},
                 {"role": "user", "content": ctx}],
                max_tokens=420,
            )["content"] or "(không có nội dung)"
        except Exception as exc:  # noqa: BLE001
            reply = f"Lỗi 9Router: {exc}"
            ok = False
        outputs.append((a, reply))
        prior += f"\n[{a['name']} — {a['role']}]:\n{reply}\n"

    _record_pipeline(db, ticker, outputs, f"{int(time.time() - t0)}s", ok)
    return outputs, ok


def _record_pipeline(db: Session, ticker: str, outputs: list, dur: str, ok: bool) -> None:
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
        report = f"# Pipeline 5-agent — {ticker}\n\n" + "\n\n".join(f"## {a['name']} · {a['role']}\n\n{txt}" for a, txt in outputs)
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
