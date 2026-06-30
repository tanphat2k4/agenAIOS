import random
import socket

import httpx
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


# ── infra services shown as devices, with LIVE status (TCP probe) ──────────────
_INFRA = [
    {"id": "dev-9router", "name": "9Router", "port": 20128, "host": "localhost", "icon": "🧠", "addr": "localhost:20128",
     "role": "LLM Gateway (fast-chat)", "os": "WSL · Next.js", "router": True},
    {"id": "dev-openclaw", "name": "OpenClaw", "port": 18789, "host": "localhost", "icon": "🤖", "addr": "localhost:18789",
     "role": "Agent Gateway (Telegram)", "os": "WSL", "router": False},
    {"id": "dev-comfyui", "name": "ComfyUI", "port": 8188, "host": "192.168.1.4", "icon": "🎨", "addr": "192.168.1.4:8188",
     "role": "Tạo ảnh/clip (GPU)", "os": "PC-B", "router": False},
    {"id": "dev-sunobot", "name": "Suno-bot", "port": 1243, "host": "192.168.1.3", "icon": "🎵", "addr": "192.168.1.3:1243",
     "role": "Bot tạo nhạc Suno (PC-B)", "os": "PC-B", "router": False},
    {"id": "dev-arcreel", "name": "ArcReel", "port": 1242, "host": "localhost", "icon": "🎬", "addr": "localhost:1242",
     "role": "Xưởng làm phim AI", "os": "FastAPI", "router": False},
]
_INFRA_IDS = {s["id"] for s in _INFRA}


def _probe(port: int, host: str = "localhost", timeout: float = 1.5) -> bool:
    """True if something is listening on host:port (service up). Uses 'localhost' so WSL
    services bound to ::1 (not 127.0.0.1) are detected."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:  # noqa: BLE001
        return False


def _router_models() -> list:
    """Models 9Router is serving (OpenAI-compatible /v1/models), or [] if unreachable."""
    try:
        data = httpx.get("http://localhost:20128/v1/models", timeout=3).json().get("data", [])
        return [{"name": m.get("id", "?"), "vram": "—"} for m in data][:8]
    except Exception:  # noqa: BLE001
        return []


def _ensure_infra(db: Session) -> None:
    for i, spec in enumerate(_INFRA):
        d = db.get(Device, spec["id"])
        if d:  # keep static fields in sync (addr/role/icon)
            d.name, d.addr, d.os, d.role, d.icon, d.type = (
                spec["name"], spec["addr"], spec["os"], spec["role"], spec["icon"], "gateway")
        else:
            db.add(Device(
                id=spec["id"], name=spec["name"], type="gateway", icon=spec["icon"], status="offline",
                addr=spec["addr"], os=spec["os"], cpu="—", cpuPct=0, ram="—", ramPct=0,
                gpu="—", gpuPct=0, vram="—", uptime="—", lastSeen="—",
                role=spec["role"], models=[], sort=-100 + i,
            ))
    db.commit()


def _refresh_infra(db: Session) -> None:
    """Live-probe 9Router + OpenClaw and update their status/models."""
    for spec in _INFRA:
        d = db.get(Device, spec["id"])
        if not d:
            continue
        up = _probe(spec["port"], spec.get("host", "localhost"))
        d.status = "online" if up else "offline"
        d.uptime = "đang chạy" if up else "—"
        d.lastSeen = "vừa xong"
        if spec["router"]:
            models = _router_models() if up else []
            d.models = models
            d.gpu = "qua 9Router" if up else "—"
    db.commit()


class DeviceCreate(BaseModel):
    name: str
    type: str = "server"
    addr: str = ""
    role: str = ""


@router.get("")
def list_devices(db: Session = Depends(get_db)):
    _ensure_infra(db)
    _refresh_infra(db)  # live status for 9Router + OpenClaw
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
    _ensure_infra(db)
    _refresh_infra(db)  # live re-probe 9Router + OpenClaw
    for d in db.scalars(select(Device)):
        if d.status != "online" or d.id in _INFRA_IDS:
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
