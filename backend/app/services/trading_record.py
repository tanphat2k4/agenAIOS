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

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.crud import now_hm, uid
from app.models.agents import McpServer, Workflow
from app.models.ops import KnowledgeEntry, SessionLog

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


def record_analysis(db: Session, ticker: str, *, duration: str = "", model: str = "deep_think", ok: bool = True) -> None:
    ticker = ticker.upper()
    try:
        # 1) workflow run
        w = ensure_analysis_workflow(db)
        w.runs = [{"time": now_hm(), "status": "done" if ok else "failed", "dur": duration}, *(w.runs or [])][:12]
        w.lastRun = now_hm()
        w.runs24 = (w.runs24 or 0) + 1
        w.runState = "idle"
        w.steps = [{**s, "status": "done" if ok else "idle"} for s in (w.steps or [])]
        # 2) session log
        db.add(SessionLog(
            id=uid("s"), agent=_AGENT[0], initial=_AGENT[1], color=_AGENT[2], room="#chung-khoan",
            model=model, modelType="local", status="done" if ok else "failed",
            started=now_hm(), duration=duration, tokens="—",
            log=[
                {"t": now_hm(), "lvl": "info", "msg": f"Phân tích {ticker} qua tradingagents-vn"},
                {"t": now_hm(), "lvl": "debug", "msg": "analyst → research → trader → risk → portfolio"},
                {"t": now_hm(), "lvl": "info", "msg": "Hoàn tất — đã lưu báo cáo vào Kiến thức"},
            ],
            sort=_top_sort(db, SessionLog),
        ))
        # 3) knowledge catalog entry
        db.add(KnowledgeEntry(
            id=uid("kn"), type="knowledge", title=f"Phân tích {ticker} ({now_hm()})",
            repo="trading/vn", ver="v1", time="vừa xong", private=False,
            avatars=[{"i": _AGENT[1], "c": _AGENT[2]}], sort=_top_sort(db, KnowledgeEntry),
        ))
        # 4) the analyze tool call on the MCP server
        m = ensure_mcp_server(db)
        m.recentCalls = [{"tool": "analyze_vn_stock", "time": now_hm(), "ok": ok}, *(m.recentCalls or [])][:8]
        m.calls24 = (m.calls24 or 0) + 1
        m.lastSync = now_hm()
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
