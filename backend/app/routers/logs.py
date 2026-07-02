from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.crud import get_or_404, prune_old_logs
from app.models.ops import AuditLog, SessionLog
from app.serialize import rows_to_list

router = APIRouter(tags=["logs"], dependencies=[Depends(get_current_user)])


@router.get("/sessions")
def list_sessions(db: Session = Depends(get_db)):
    prune_old_logs(db, SessionLog)  # 7-day retention
    return rows_to_list(db.scalars(select(SessionLog).order_by(SessionLog.sort, SessionLog.id)))


@router.delete("/sessions")
def clear_sessions(db: Session = Depends(get_db)):
    db.execute(delete(SessionLog))
    db.commit()
    return {"detail": "cleared"}


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    sl = get_or_404(db, SessionLog, session_id)
    db.delete(sl)
    db.commit()
    return {"detail": "deleted"}


@router.get("/audit")
def list_audit(db: Session = Depends(get_db)):
    prune_old_logs(db, AuditLog)  # 7-day retention
    return rows_to_list(db.scalars(select(AuditLog).order_by(AuditLog.sort.desc())))


@router.delete("/audit")
def clear_audit(db: Session = Depends(get_db)):
    db.execute(delete(AuditLog))
    db.commit()
    return {"detail": "cleared"}
