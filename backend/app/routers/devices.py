import random

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.crud import get_or_404, next_sort, uid
from app.models.ops import Device
from app.serialize import row_to_dict, rows_to_list

router = APIRouter(prefix="/devices", tags=["devices"], dependencies=[Depends(get_current_user)])

_ICONS = {"server": "🖥", "gateway": "🌐", "desktop": "💻", "phone": "📱"}


def _jit(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v + round((random.random() - 0.5) * 16)))


class DeviceCreate(BaseModel):
    name: str
    type: str = "server"
    addr: str = ""
    role: str = ""


@router.get("")
def list_devices(db: Session = Depends(get_db)):
    return rows_to_list(db.scalars(select(Device).order_by(Device.sort, Device.id)))


@router.post("", status_code=201)
def create_device(body: DeviceCreate, db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Thiếu tên thiết bị")
    d = Device(
        id=uid("dev"), name=name, type=body.type, icon=_ICONS.get(body.type, "🖥"), status="online",
        addr=body.addr.strip() or "100.84.0.0", os="—", cpu="—", cpuPct=14, ram="—", ramPct=30,
        gpu="—", gpuPct=0, vram="—", uptime="vừa bật", lastSeen="vừa xong",
        role=body.role.strip() or "Thiết bị mới", models=[], sort=next_sort(db, Device),
    )
    db.add(d)
    db.commit()
    return row_to_dict(d)


@router.post("/refresh")
def refresh_devices(db: Session = Depends(get_db)):
    for d in db.scalars(select(Device)):
        if d.status != "online":
            continue
        d.cpuPct = _jit(d.cpuPct, 4, 97)
        d.ramPct = _jit(d.ramPct, 20, 95)
        d.gpuPct = 0 if d.gpu == "—" else _jit(d.gpuPct, 5, 96)
        d.lastSeen = "vừa xong"
    db.commit()
    return rows_to_list(db.scalars(select(Device).order_by(Device.sort, Device.id)))


@router.post("/{device_id}/power")
def toggle_power(device_id: str, db: Session = Depends(get_db)):
    d = get_or_404(db, Device, device_id)
    if d.status == "online":
        d.status, d.cpuPct, d.ramPct, d.gpuPct = "offline", 0, 0, 0
        d.uptime, d.lastSeen = "—", "vừa xong"
    else:
        d.status, d.cpuPct, d.ramPct = "online", 18, 42
        d.gpuPct = 0 if d.gpu == "—" else 20
        d.uptime, d.lastSeen = "vừa bật", "vừa xong"
    db.commit()
    return row_to_dict(d)


@router.delete("/{device_id}")
def delete_device(device_id: str, db: Session = Depends(get_db)):
    d = get_or_404(db, Device, device_id)
    db.delete(d)
    db.commit()
    return {"detail": "deleted"}
