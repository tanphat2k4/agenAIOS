import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.crud import get_or_404, next_sort, uid
from app.models.agents import Agent
from app.models.ops import ActivityLog, Task
from app.serialize import row_to_dict, rows_to_list

router = APIRouter(tags=["tasks"], dependencies=[Depends(get_current_user)])


def _next_task_id(db: Session) -> str:
    nums = []
    for (tid,) in db.execute(select(Task.id)):
        m = re.match(r"T-(\d+)", tid or "")
        if m:
            nums.append(int(m.group(1)))
    return f"T-{(max(nums) + 1) if nums else 2600}"


def _assignee_avatar(db: Session, name: str) -> tuple[str, str]:
    ag = db.scalar(select(Agent).where(Agent.name == name)) if name else None
    return (ag.initial, ag.color) if ag else ("?", "#9AA8A1")


class TaskCreate(BaseModel):
    title: str
    desc: str = ""
    assignee: str = ""
    room: str = "Zy Novel"
    priority: str = "med"
    status: str = "queued"


class TaskMove(BaseModel):
    status: str


@router.get("/tasks")
def list_tasks(db: Session = Depends(get_db)):
    return rows_to_list(db.scalars(select(Task).order_by(Task.sort, Task.id)))


@router.post("/tasks", status_code=201)
def create_task(body: TaskCreate, db: Session = Depends(get_db)):
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Thiếu tiêu đề tác vụ")
    assignee = body.assignee or "Chưa giao"
    initial, color = _assignee_avatar(db, body.assignee)
    tid = _next_task_id(db)
    t = Task(
        id=tid, title=title, status=body.status, assignee=assignee, initial=initial, color=color,
        room=body.room, priority=body.priority, time="vừa xong",
        desc=body.desc.strip() or "Chưa có mô tả.", sort=next_sort(db, Task),
    )
    db.add(t)
    db.add(ActivityLog(
        id=uid("act"), initial=initial, color=color, actor=assignee,
        action=f"được giao tác vụ {tid} · {title}", time="vừa xong",
        tag="task", tagFg="#0A7B52", tagBg="#E2F3EC", sort=next_sort(db, ActivityLog),
    ))
    db.commit()
    return row_to_dict(t)


@router.patch("/tasks/{task_id}")
def update_task(task_id: str, body: TaskCreate, db: Session = Depends(get_db)):
    t = get_or_404(db, Task, task_id)
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Thiếu tiêu đề tác vụ")
    initial, color = _assignee_avatar(db, body.assignee)
    t.title = title
    t.desc = body.desc.strip() or "Chưa có mô tả."
    t.assignee = body.assignee or "Chưa giao"
    t.initial, t.color = initial, color
    t.room, t.priority, t.status = body.room, body.priority, body.status
    db.commit()
    return row_to_dict(t)


@router.post("/tasks/{task_id}/move")
def move_task(task_id: str, body: TaskMove, db: Session = Depends(get_db)):
    t = get_or_404(db, Task, task_id)
    t.status = body.status
    db.commit()
    return row_to_dict(t)


@router.delete("/tasks/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db)):
    t = get_or_404(db, Task, task_id)
    db.delete(t)
    db.commit()
    return {"detail": "deleted"}


@router.get("/activity")
def list_activity(db: Session = Depends(get_db)):
    return rows_to_list(db.scalars(select(ActivityLog).order_by(ActivityLog.sort.desc())))
