from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.crud import get_or_404, next_sort, uid
from app.models.ops import KnowledgeEntry
from app.serialize import row_to_dict, rows_to_list

router = APIRouter(prefix="/knowledge", tags=["knowledge"], dependencies=[Depends(get_current_user)])


class KnowledgeIn(BaseModel):
    type: str = "knowledge"
    title: str
    repo: str = "zy-novel"
    ver: str = "v1"
    private: bool = False
    avatars: list = []
    extra: int | None = None


@router.get("")
def list_knowledge(db: Session = Depends(get_db)):
    return rows_to_list(db.scalars(select(KnowledgeEntry).order_by(KnowledgeEntry.sort, KnowledgeEntry.id)))


@router.post("", status_code=201)
def create_knowledge(body: KnowledgeIn, db: Session = Depends(get_db)):
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Thiếu tiêu đề")
    k = KnowledgeEntry(
        id=uid("kn"), type=body.type, title=title, repo=body.repo, ver=body.ver, time="vừa xong",
        private=body.private, avatars=body.avatars, extra=body.extra, sort=next_sort(db, KnowledgeEntry),
    )
    db.add(k)
    db.commit()
    return row_to_dict(k)


@router.patch("/{entry_id}")
def update_knowledge(entry_id: str, body: KnowledgeIn, db: Session = Depends(get_db)):
    k = get_or_404(db, KnowledgeEntry, entry_id)
    k.type, k.title, k.repo = body.type, body.title.strip() or k.title, body.repo
    k.ver, k.private = body.ver, body.private
    k.time = "vừa xong"
    db.commit()
    return row_to_dict(k)


@router.post("/{entry_id}/duplicate", status_code=201)
def duplicate_knowledge(entry_id: str, db: Session = Depends(get_db)):
    src = get_or_404(db, KnowledgeEntry, entry_id)
    copy = KnowledgeEntry(
        id=uid("kn"), type=src.type, title=f"{src.title} (bản sao)", repo=src.repo, ver="v1",
        time="vừa xong", private=src.private, avatars=src.avatars, extra=src.extra,
        sort=next_sort(db, KnowledgeEntry),
    )
    db.add(copy)
    db.commit()
    return row_to_dict(copy)


@router.delete("/{entry_id}")
def delete_knowledge(entry_id: str, db: Session = Depends(get_db)):
    k = get_or_404(db, KnowledgeEntry, entry_id)
    db.delete(k)
    db.commit()
    return {"detail": "deleted"}
