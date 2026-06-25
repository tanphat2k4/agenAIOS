"""Surface TradingAgents activity across AgentAIOS.

Every tool call / analysis is recorded into the existing domains so the
integration is visible beyond the chat:
  - MCP screen   -> a real ``tradingagents-vn`` server with recent calls
  - Workflow     -> a "Phân tích cổ phiếu" workflow whose runs accumulate
  - Session logs -> one entry per full analysis
  - Knowledge    -> one catalog entry per analysis report

All writers are defensive: a logging failure must never break the actual
trading response, so callers wrap nothing — we swallow errors here.
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
_AGENT = ("Phân tích CK", "T", "#0A7B52")  # name, initial, color
_TOOLS = ["analyze_vn_stock", "get_vn_stock_snapshot", "get_vn_news", "get_vn_extras", "get_vn_macro"]
_STEPS = [
    ("Analyst", "Thu thập giá / tin / cơ bản (vnstock, FireAnt)"),
    ("Research", "Tranh luận bull vs bear"),
    ("Trader", "Đề xuất quyết định giao dịch"),
    ("Risk", "Đánh giá rủi ro nhiều góc"),
    ("Portfolio", "Chốt khuyến nghị cuối"),
]

# tool name shown in MCP for each CLI command
TOOL_OF = {
    "snapshot": "get_vn_stock_snapshot",
    "news": "get_vn_news",
    "extras": "get_vn_extras",
    "macro": "get_vn_macro",
    "analyze": "analyze_vn_stock",
}


def _top_sort(db: Session, model) -> int:
    """Newest-first: a sort value below the current minimum."""
    return (db.scalar(select(func.min(model.sort))) or 0) - 1


def ensure_mcp_server(db: Session) -> McpServer:
    m = db.get(McpServer, MCP_ID)
    if m:
        return m
    m = McpServer(
        id=MCP_ID, name="tradingagents-vn", icon="📈",
        desc="Phân tích chứng khoán VN đa-agent (vnstock/FireAnt) qua vn_cli.py — không sửa repo gốc.",
        transport="stdio (subprocess)", status="connected", tools=_TOOLS,
        agents=1, calls24=0, lastSync=now_hm(), endpoint="D:/TradingAgents/repo/vn_cli.py",
        recentCalls=[], sort=-1,
    )
    db.add(m)
    db.commit()
    return m


def ensure_analysis_workflow(db: Session) -> Workflow:
    w = db.get(Workflow, WF_ID)
    if w:
        return w
    steps = [{"agent": _AGENT[0], "initial": _AGENT[1], "color": _AGENT[2], "title": t, "io": io, "status": "idle", "dur": ""} for t, io in _STEPS]
    w = Workflow(
        id=WF_ID, name="Phân tích cổ phiếu (TradingAgents)",
        desc="Pipeline đa-agent: analyst → tranh luận → trader → rủi ro → danh mục.",
        trigger="manual", triggerLabel="Khi chạy phân tích đầy đủ", enabled=True,
        lastRun="", runs24=0, success=100, steps=steps, runs=[], runState="idle", sort=-1,
    )
    db.add(w)
    db.commit()
    return w


def ensure_trading_agent(db: Session) -> Agent:
    """The "Phân tích CK" agent shown in chat/members/workflow is a real Agent row."""
    a = db.scalar(select(Agent).where(Agent.name == _AGENT[0]))
    if a:
        return a
    a = Agent(
        id="agent-trading-vn", name=_AGENT[0], handle="@phan-tich-ck",
        role="Phân tích chứng khoán VN", roleType="research", initial=_AGENT[1], color=_AGENT[2],
        status="online", model="deep_think", modelType="local", tasks=0, rooms=1, success=100,
        skills=["analyze_vn_stock", "snapshot", "news", "macro"], lastActive="vừa xong",
        bio="Phân tích cổ phiếu VN đa-agent qua TradingAgents (vnstock/FireAnt). Công cụ nghiên cứu — không phải lời khuyên đầu tư.",
        roomsList=["#chung-khoan"], recentTasks=[], sort=-1,
    )
    db.add(a)
    db.commit()
    return a


def ensure_trading_room(db: Session) -> Room:
    """A 'Chứng khoán' project room grouping the #chung-khoan channel + the analyst agent.

    Created once; members = workspace owner (lead) + the analyst agent (staff). Does not
    add whoever happens to log in, so logins don't pollute the room.
    """
    r = db.get(Room, "room-chung-khoan")
    if r:
        return r
    owner = db.scalar(select(User).where(User.role == "owner")) or db.scalar(select(User))
    members: list = []
    if owner:
        members.append({
            "name": owner.name, "handle": "@" + (owner.name.split()[0].lower() if owner.name else "owner"),
            "type": "user", "role": "lead", "initial": owner.initial, "color": owner.color,
        })
    members.append({
        "name": _AGENT[0], "handle": "@phan-tich-ck", "type": "agent", "role": "staff",
        "initial": _AGENT[1], "color": _AGENT[2],
    })
    r = Room(id="room-chung-khoan", name="Chứng khoán", slug="chung-khoan", channel="chung-khoan", members=members, sort=-1)
    db.add(r)
    db.commit()
    return r


def record_mcp_call(db: Session, command: str, ok: bool = True) -> None:
    try:
        m = ensure_mcp_server(db)
        calls = [{"tool": TOOL_OF.get(command, command), "time": now_hm(), "ok": ok}, *(m.recentCalls or [])]
        m.recentCalls = calls[:8]
        m.calls24 = (m.calls24 or 0) + 1
        m.lastSync = now_hm()
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()


_HEADER_RE = re.compile(r"^#{1,4}\s+(.+)$", re.M)
_REC_RE = re.compile(r"(MUA|BÁN|GIỮ|NẮM GIỮ|HOLD|BUY|SELL|TÍCH LŨY|GIẢM TỶ TRỌNG|KHUYẾN NGHỊ)[^\n]{0,70}", re.I)


def _log_from_report(report: str, ticker: str, ok: bool) -> list:
    """Build genuine session-log lines from the real analyze output."""
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
    ticker = ticker.upper()
    try:
        # 1) workflow run
        w = ensure_analysis_workflow(db)
        w.runs = [{"time": now_hm(), "status": "success" if ok else "failed", "dur": duration}, *(w.runs or [])][:12]
        w.lastRun = now_hm()
        w.runs24 = (w.runs24 or 0) + 1
        w.runState = "idle"
        w.steps = [{**s, "status": "done" if ok else "idle"} for s in (w.steps or [])]
        # 2) session log — lines derived from the real report
        db.add(SessionLog(
            id=uid("s"), agent=_AGENT[0], initial=_AGENT[1], color=_AGENT[2], room="#chung-khoan",
            model=model, modelType="local", status="done" if ok else "failed",
            started=now_hm(), duration=duration, tokens=(f"~{len(report) // 4:,}" if report and ok else "—"),
            log=_log_from_report(report, ticker, ok), sort=_top_sort(db, SessionLog),
        ))
        # 3) knowledge entry — stores the FULL report text
        if ok and report:
            db.add(KnowledgeEntry(
                id=uid("kn"), type="knowledge", title=f"Phân tích {ticker} ({now_hm()})",
                repo="trading/vn", ver="v1", time="vừa xong", private=False,
                avatars=[{"i": _AGENT[1], "c": _AGENT[2]}], content=report, sort=_top_sort(db, KnowledgeEntry),
            ))
        # 4) the analyze tool call on the MCP server
        m = ensure_mcp_server(db)
        m.recentCalls = [{"tool": "analyze_vn_stock", "time": now_hm(), "ok": ok}, *(m.recentCalls or [])][:8]
        m.calls24 = (m.calls24 or 0) + 1
        m.lastSync = now_hm()
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
