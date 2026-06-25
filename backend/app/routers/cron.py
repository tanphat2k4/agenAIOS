from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.crud import get_or_404, next_sort, uid
from app.models.agents import CronJob
from app.models.user import User
from app.serialize import row_to_dict, rows_to_list

router = APIRouter(prefix="/cron", tags=["cron"], dependencies=[Depends(get_current_user)])


def _expr(freq: str, time: str, dow: int, interval: int) -> str:
    parts = (time or "08:00").split(":")
    hh = int(parts[0]) if parts[0].isdigit() else 0
    mm = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
    if freq == "daily":
        return f"{mm} {hh} * * *"
    if freq == "weekly":
        return f"{mm} {hh} * * {dow}"
    if freq == "hourly":
        return f"{mm} * * * *"
    if freq == "interval":
        return f"*/{interval} * * * *"
    return f"{mm} {hh} * * *"


class CronForm(BaseModel):
    name: str
    target: str = "Sabo - Facebook Research"
    freq: str = "daily"
    time: str = "08:00"
    dow: int = 1
    interval: int = 30
    enabled: bool = True


@router.get("")
def list_cron(db: Session = Depends(get_db)):
    return rows_to_list(db.scalars(select(CronJob).order_by(CronJob.sort, CronJob.id)))


@router.post("", status_code=201)
def create_cron(
    body: CronForm,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Thiếu tên cron job")
    job = CronJob(
        id=uid("j"), name=name, target=body.target, expr=_expr(body.freq, body.time, body.dow, body.interval),
        last="chưa chạy", next="in 30m", creator=current.name, creatorInitial=current.initial,
        creatorColor=current.color, enabled=body.enabled, spark=[20, 30, 25, 35, 28, 32, 30],
        sort=next_sort(db, CronJob),
    )
    db.add(job)
    db.commit()
    return row_to_dict(job)


@router.patch("/{job_id}")
def update_cron(job_id: str, body: CronForm, db: Session = Depends(get_db)):
    j = get_or_404(db, CronJob, job_id)
    j.name = body.name.strip() or j.name
    j.target = body.target
    j.expr = _expr(body.freq, body.time, body.dow, body.interval)
    j.enabled = body.enabled
    db.commit()
    return row_to_dict(j)


@router.post("/{job_id}/toggle")
def toggle_cron(job_id: str, db: Session = Depends(get_db)):
    j = get_or_404(db, CronJob, job_id)
    j.enabled = not j.enabled
    db.commit()
    return row_to_dict(j)


@router.post("/{job_id}/run-now")
def run_cron(job_id: str, db: Session = Depends(get_db)):
    j = get_or_404(db, CronJob, job_id)
    j.last = "vừa xong"
    db.commit()
    return row_to_dict(j)


@router.delete("/{job_id}")
def delete_cron(job_id: str, db: Session = Depends(get_db)):
    j = get_or_404(db, CronJob, job_id)
    db.delete(j)
    db.commit()
    return {"detail": "deleted"}
