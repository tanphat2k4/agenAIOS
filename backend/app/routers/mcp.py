import random

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.crud import get_or_404, next_sort, uid
from app.models.agents import McpServer
from app.serialize import row_to_dict, rows_to_list

router = APIRouter(prefix="/mcp", tags=["mcp"], dependencies=[Depends(get_current_user)])

_ICONS = ["🔌", "🧩", "⚙️", "🛰", "📦", "🔗"]


class McpCreate(BaseModel):
    name: str
    transport: str = "HTTP"
    endpoint: str = ""
    desc: str = ""
    tools: str = ""


@router.get("")
def list_mcp(db: Session = Depends(get_db)):
    return rows_to_list(db.scalars(select(McpServer).order_by(McpServer.sort, McpServer.id)))


@router.post("", status_code=201)
def create_mcp(body: McpCreate, db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Thiếu tên MCP")
    tools = [t.strip() for t in body.tools.split(",") if t.strip()]
    m = McpServer(
        id=uid("mcp"), name=name, icon=random.choice(_ICONS),
        desc=body.desc.strip() or "MCP server mới được kết nối vào workspace.",
        transport=body.transport, status="connected", tools=tools or ["ping"], agents=0,
        calls24=0, lastSync="vừa xong", endpoint=body.endpoint.strip() or "—",
        recentCalls=[], sort=next_sort(db, McpServer),
    )
    db.add(m)
    db.commit()
    return row_to_dict(m)


@router.post("/sync")
def sync_mcp(db: Session = Depends(get_db)):
    for m in db.scalars(select(McpServer)):
        if m.status != "error":
            m.lastSync = "vừa xong"
    db.commit()
    return {"detail": "Đã đồng bộ MCP servers"}


@router.post("/{mcp_id}/test")
def test_mcp(mcp_id: str, db: Session = Depends(get_db)):
    m = get_or_404(db, McpServer, mcp_id)
    ok = m.status != "error"
    return {"ok": ok, "detail": (f"✓ Kết nối {m.name} OK" if ok else f"✕ Không kết nối được {m.name}")}


@router.post("/{mcp_id}/toggle")
def toggle_mcp(mcp_id: str, db: Session = Depends(get_db)):
    m = get_or_404(db, McpServer, mcp_id)
    m.status = "connected" if m.status == "disabled" else "disabled"
    db.commit()
    return row_to_dict(m)


@router.delete("/{mcp_id}")
def delete_mcp(mcp_id: str, db: Session = Depends(get_db)):
    m = get_or_404(db, McpServer, mcp_id)
    db.delete(m)
    db.commit()
    return {"detail": "deleted"}
