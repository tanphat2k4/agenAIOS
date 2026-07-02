from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.crud import prune_old_logs
from app.models.agents import Agent, Workflow
from app.models.comms import Channel, Message
from app.models.ops import ActivityLog, Task
from app.serialize import rows_to_list

router = APIRouter(prefix="/overview", tags=["overview"], dependencies=[Depends(get_current_user)])


@router.get("")
def overview(db: Session = Depends(get_db)):
    def count(model) -> int:
        return db.scalar(select(func.count()).select_from(model)) or 0

    open_tasks = db.scalar(
        select(func.count()).select_from(Task).where(Task.status != "done")
    ) or 0
    wf_running = db.scalar(
        select(func.count()).select_from(Workflow).where(Workflow.runState == "running")
    ) or 0
    prune_old_logs(db, ActivityLog)  # 7-day retention
    activity = list(db.scalars(select(ActivityLog).order_by(ActivityLog.sort.desc())))[:10]

    return {
        "kpis": {
            "agents": count(Agent),
            "channels": count(Channel),
            "messages": count(Message),
            "openTasks": open_tasks,
        },
        "workflowsRunning": wf_running,
        "activity": rows_to_list(activity),
    }
