from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.org import BillingMonth
from app.serialize import rows_to_list

router = APIRouter(prefix="/billing", tags=["billing"], dependencies=[Depends(get_current_user)])


@router.get("/months")
def list_months(db: Session = Depends(get_db)):
    return rows_to_list(db.scalars(select(BillingMonth).order_by(BillingMonth.sort, BillingMonth.id)))
