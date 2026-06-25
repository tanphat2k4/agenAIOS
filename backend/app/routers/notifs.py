from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.crud import get_or_404
from app.models.comms import Notification
from app.serialize import row_to_dict, rows_to_list

router = APIRouter(prefix="/notifs", tags=["notifs"], dependencies=[Depends(get_current_user)])


@router.get("")
def list_notifs(db: Session = Depends(get_db)):
    return rows_to_list(db.scalars(select(Notification).order_by(Notification.sort, Notification.id)))


@router.post("/{notif_id}/read")
def mark_read(notif_id: str, db: Session = Depends(get_db)):
    n = get_or_404(db, Notification, notif_id)
    n.unread = False
    db.commit()
    return row_to_dict(n)


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    for n in db.scalars(select(Notification).where(Notification.unread.is_(True))):
        n.unread = False
    db.commit()
    return {"detail": "ok"}


@router.delete("")
def clear_notifs(db: Session = Depends(get_db)):
    db.execute(delete(Notification))
    db.commit()
    return {"detail": "cleared"}


@router.delete("/{notif_id}")
def delete_notif(notif_id: str, db: Session = Depends(get_db)):
    n = get_or_404(db, Notification, notif_id)
    db.delete(n)
    db.commit()
    return {"detail": "deleted"}
