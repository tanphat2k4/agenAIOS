from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.crud import get_or_404, next_sort, today_ymd, uid
from app.models.agents import Workflow
from app.serialize import row_to_dict, rows_to_list

router = APIRouter(prefix="/workflows", tags=["workflows"], dependencies=[Depends(get_current_user)])

_PALETTE = {
    "Dragon - CEO": "#C0392B", "Sabo - Facebook Research": "#3B82C4",
    "Sanji - Xào nấu content": "#0EA5A0", "Nami - Quản lý Fanpage": "#E8A33D",
    "Morgans - Social Leader": "#8B5CF6", "Brook - Báo Cáo Zy Novel": "#3B5BDB",
    "Robin - Biên tập": "#8B5CF6", "Usopp - Group Seeding": "#C94F3D",
    "Franky - Thiết kế": "#0EA5A0", "Tim - Trợ Lý Zypage": "#E8A33D",
}


def _step_initial(agent: str) -> str:
    cleaned = agent.lstrip("0123456789 -·")
    return next((ch for ch in cleaned if ch.isalpha()), "A").upper()


class WfStep(BaseModel):
    agent: str
    title: str = ""
    io: str = ""


class WorkflowCreate(BaseModel):
    name: str
    desc: str = ""
    trigger: str = "cron"
    triggerLabel: str = "*/30 * * * *"
    steps: list[WfStep] = []


@router.get("")
def list_workflows(db: Session = Depends(get_db)):
    return rows_to_list(db.scalars(select(Workflow).order_by(Workflow.sort, Workflow.id)))


@router.post("", status_code=201)
def create_workflow(body: WorkflowCreate, db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Thiếu tên workflow")
    steps = [
        {
            "agent": s.agent, "initial": _step_initial(s.agent),
            "color": _PALETTE.get(s.agent, "#3B5BDB"),
            "title": s.title.strip() or "Bước chưa đặt tên",
            "io": s.io.strip() or "→ output", "status": "idle", "dur": "—",
        }
        for s in body.steps
    ]
    wf = Workflow(
        id=uid("wf"), name=name, desc=body.desc.strip() or "Workflow mới", trigger=body.trigger,
        triggerLabel=body.triggerLabel, enabled=True, lastRun="chưa chạy", runs24=0, success=100,
        steps=steps, runs=[], sort=next_sort(db, Workflow),
    )
    db.add(wf)
    db.commit()
    return row_to_dict(wf)


@router.post("/{wf_id}/toggle")
def toggle_workflow(wf_id: str, db: Session = Depends(get_db)):
    w = get_or_404(db, Workflow, wf_id)
    w.enabled = not w.enabled
    db.commit()
    return row_to_dict(w)


@router.post("/{wf_id}/run")
def run_workflow(wf_id: str, db: Session = Depends(get_db)):
    w = get_or_404(db, Workflow, wf_id)
    w.steps = [{**st, "status": ("running" if i == 0 else "idle")} for i, st in enumerate(w.steps)]
    w.runs = [{"time": "vừa xong", "date": today_ymd(), "status": "running", "dur": "…"}, *w.runs]
    w.runState = "running"
    w.lastRun = "vừa xong"
    w.runs24 = w.runs24 + 1
    db.commit()
    return row_to_dict(w)


@router.post("/{wf_id}/pause")
def pause_workflow(wf_id: str, db: Session = Depends(get_db)):
    w = get_or_404(db, Workflow, wf_id)
    ns = "paused" if w.runState == "running" else "running"
    new_steps = []
    for st in w.steps:
        s = st["status"]
        if s == "running" and ns == "paused":
            s = "paused"
        elif s == "paused" and ns == "running":
            s = "running"
        new_steps.append({**st, "status": s})
    w.steps = new_steps
    if w.runs:
        w.runs = [{**w.runs[0], "status": ns}, *w.runs[1:]]
    w.runState = ns
    db.commit()
    return row_to_dict(w)


@router.post("/{wf_id}/stop")
def stop_workflow(wf_id: str, db: Session = Depends(get_db)):
    w = get_or_404(db, Workflow, wf_id)
    w.steps = [
        {**st, "status": ("idle" if st["status"] in ("running", "paused") else st["status"])}
        for st in w.steps
    ]
    if w.runs:
        first = w.runs[0]
        dur = "đã dừng" if first.get("dur") == "…" else first.get("dur")
        w.runs = [{**first, "status": "stopped", "dur": dur}, *w.runs[1:]]
    w.runState = "idle"
    db.commit()
    return row_to_dict(w)


@router.delete("/{wf_id}")
def delete_workflow(wf_id: str, db: Session = Depends(get_db)):
    w = get_or_404(db, Workflow, wf_id)
    db.delete(w)
    db.commit()
    return {"detail": "deleted"}
