import random
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.crud import get_or_404, next_sort, uid
from app.models.agents import Agent
from app.serialize import row_to_dict, rows_to_list

router = APIRouter(prefix="/agents", tags=["agents"], dependencies=[Depends(get_current_user)])

_COLORS = ["#C0392B", "#3B82C4", "#0EA5A0", "#E8A33D", "#8B5CF6", "#0E7490"]
_CLOUD = {"Claude Sonnet", "DeepSeek V3"}


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _initial(name: str) -> str:
    return next((ch for ch in name if ch.isalpha()), "A").upper()


class AgentCreate(BaseModel):
    name: str
    role: str = "Researcher"
    model: str = "Qwen3 35B"
    modelType: str = "local"
    status: str = "online"
    desc: str = ""
    skills: str = ""
    rooms: list[str] = []


class AgentConfig(BaseModel):
    model: str
    status: str


@router.get("")
def list_agents(db: Session = Depends(get_db)):
    return rows_to_list(db.scalars(select(Agent).order_by(Agent.sort, Agent.id)))


@router.post("", status_code=201)
def create_agent(body: AgentCreate, db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Thiếu tên agent")
    skills = [s.strip() for s in body.skills.split(",") if s.strip()]
    rooms = body.rooms or []
    agent = Agent(
        id=uid("ag"), name=name, handle="@" + _slug(name), role=body.role, roleType="research",
        initial=_initial(name), color=random.choice(_COLORS), status=body.status,
        model=body.model, modelType=body.modelType, tasks=0, rooms=len(rooms) or 1, success=100,
        skills=skills or ["Mới tạo"], lastActive="vừa xong",
        bio=body.desc.strip() or "Agent mới được tạo trong workspace.",
        roomsList=rooms or ["general"], recentTasks=[], sort=next_sort(db, Agent),
    )
    db.add(agent)
    db.commit()
    return row_to_dict(agent)


@router.patch("/{agent_id}/config")
def configure_agent(agent_id: str, body: AgentConfig, db: Session = Depends(get_db)):
    a = get_or_404(db, Agent, agent_id)
    a.model = body.model
    a.modelType = "cloud" if body.model in _CLOUD else "local"
    a.status = body.status
    db.commit()
    return row_to_dict(a)


@router.delete("/{agent_id}")
def delete_agent(agent_id: str, db: Session = Depends(get_db)):
    a = get_or_404(db, Agent, agent_id)
    db.delete(a)
    db.commit()
    return {"detail": "deleted"}
