import random
import socket
import subprocess
from concurrent.futures import ThreadPoolExecutor

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
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
     "role": "Tạo ảnh/clip/voice (RTX 5090)", "os": "PC-A", "router": False,
     "stats_url": "http://192.168.1.4:9998/stats"},  # stats agent deployed on PC-A (D:\agentaios\stats_agent.py)
    {"id": "dev-sunobot", "name": "Bot PC", "port": 1243, "host": "192.168.1.3", "ports": [3389, 1243], "icon": "🖥", "addr": "192.168.1.3",
     "role": "Suno (nhạc) + làm phim · PC-B", "os": "PC-B", "router": False,
     "stats_url": "http://192.168.1.3:9998/stats",  # run tools/bot-pc-agent/stats_agent.py on that PC
     "mac": "74:56:3C:C5:F9:51", "power_url": "http://192.168.1.3:9998/power"},  # remote start(WoL)/reboot/shutdown
    {"id": "dev-arcreel", "name": "ArcReel", "port": 1242, "host": "localhost", "icon": "🎬", "addr": "localhost:1242",
     "role": "Xưởng làm phim AI", "os": "FastAPI", "router": False},
]
_INFRA_IDS = {s["id"] for s in _INFRA}

# Devices with real remote power control: start via Wake-on-LAN (needs a MAC +
# BIOS WoL), reboot/shutdown via the on-device agent (needs a shared token).
_POWER_TOKEN = settings.AGENTAIOS_POWER_TOKEN
_POWER_SPECS = {s["id"]: s for s in _INFRA if s.get("mac") or s.get("power_url")}

# Devices whose GPU VRAM we can reclaim on demand. PC-A (192.168.1.4, RTX 5090) hosts BOTH
# ComfyUI and ollama on the same card — "Clean VRAM" unloads the idle LLM + frees ComfyUI.
_VRAM_CLEAN_IDS = {"dev-comfyui"}
_COMFY_FREE_URL = "http://192.168.1.4:8188/free"


def _gpu_used_mb() -> int | None:
    """This machine's GPU VRAM currently used (MiB) via nvidia-smi; None if unavailable."""
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=8,
        )
        return int(out.stdout.strip().splitlines()[0])
    except Exception:  # noqa: BLE001
        return None


def _clean_vram() -> dict:
    """Reclaim the PC-A GPU's VRAM: unload every model ollama holds resident (usually the
    biggest chunk, ~25GB for qwen) + ask ComfyUI to unload its models and free cache.
    Returns before/after MiB and what actually ran."""
    before = _gpu_used_mb()
    ollama_unloaded: list[str] = []
    try:  # 1) unload each resident ollama model (ollama runs in WSL) — `ollama stop` frees it
        ps = subprocess.run(
            ["wsl.exe", "-e", "bash", "-lc", "ollama ps | tail -n +2 | awk '{print $1}'"],
            capture_output=True, text=True, timeout=15,
        )
        for name in [x.strip() for x in ps.stdout.splitlines() if x.strip()]:
            subprocess.run(["wsl.exe", "-e", "bash", "-lc", f"ollama stop {name}"],
                           capture_output=True, text=True, timeout=20)
            ollama_unloaded.append(name)
    except Exception:  # noqa: BLE001
        pass
    comfy_freed = False
    try:  # 2) ComfyUI: unload models + free memory cache
        rc = httpx.post(_COMFY_FREE_URL, json={"unload_models": True, "free_memory": True}, timeout=10)
        comfy_freed = rc.status_code < 400
    except Exception:  # noqa: BLE001
        comfy_freed = False
    import time as _t
    after = _gpu_used_mb()  # the driver reclaims VRAM over several seconds → poll until it settles
    if after is not None:
        stable = 0
        for _ in range(7):  # up to ~10.5s; exit early once two readings agree (<200MB apart)
            _t.sleep(1.5)
            cur = _gpu_used_mb()
            if cur is None:
                break
            stable = stable + 1 if abs(cur - after) < 200 else 0
            after = cur
            if stable >= 2:
                break
    freed = (before - after) if (before is not None and after is not None) else None
    return {"before_mb": before, "after_mb": after, "freed_mb": freed,
            "ollama_unloaded": ollama_unloaded, "comfy_freed": comfy_freed}


def _send_wol(mac: str, host: str = "") -> None:
    """Send a Wake-on-LAN magic packet for `mac` to the LAN broadcast(s)."""
    m = mac.replace(":", "").replace("-", "").replace(".", "").strip()
    if len(m) != 12:
        raise ValueError(f"MAC không hợp lệ: {mac}")
    packet = b"\xff" * 6 + bytes.fromhex(m) * 16
    bcasts = {"255.255.255.255"}
    parts = (host or "").split(".")
    if len(parts) == 4:
        bcasts.add(".".join(parts[:3]) + ".255")  # /24 directed broadcast
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    try:
        for b in bcasts:
            for port in (9, 7):
                sock.sendto(packet, (b, port))
    finally:
        sock.close()


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


def _probe_spec(spec: dict) -> bool:
    """Online if ANY of a device's ports is reachable. A device may list several "ports":
    e.g. the Bot PC is alive whenever the PC answers (RDP :3389) OR Suno (:1243) is up, so
    it stays online even when used only for film (Suno off)."""
    return any(_probe(p, spec.get("host", "localhost"), timeout=1.0) for p in (spec.get("ports") or [spec["port"]]))


def _host_cpu_ram() -> tuple[int | None, int | None]:
    """This machine's live CPU% + RAM% (the services bound to localhost run here)."""
    try:
        import psutil
        return round(psutil.cpu_percent(interval=None)), round(psutil.virtual_memory().percent)
    except Exception:  # noqa: BLE001
        return None, None


def _refresh_infra(db: Session) -> None:
    """Live-probe every infra device CONCURRENTLY (so /devices stays snappy for real-time
    polling even when several hosts are down) and update status + real metrics."""
    specs = [s for s in _INFRA if db.get(Device, s["id"])]
    if not specs:
        return
    with ThreadPoolExecutor(max_workers=len(specs)) as ex:
        ups = dict(zip((s["id"] for s in specs), ex.map(_probe_spec, specs)))
    hcpu, hram = _host_cpu_ram()
    for spec in specs:
        d = db.get(Device, spec["id"])
        up = ups.get(spec["id"], False)
        d.status = "online" if up else "offline"
        d.uptime = "đang chạy" if up else "—"
        d.lastSeen = "vừa xong"
        # localhost services share THIS machine's CPU/RAM → show real host usage.
        # Remote hosts (ComfyUI/Bot PC) have no agent here → leave "—".
        local = spec.get("host", "localhost") in ("localhost", "127.0.0.1")
        if up and local and hcpu is not None:
            d.cpu, d.cpuPct, d.ram, d.ramPct = f"{hcpu}%", hcpu, f"{hram}%", hram
        elif up and spec.get("stats_url"):
            # remote host running our stats agent (tools/bot-pc-agent) → pull its real metrics
            try:
                st = httpx.get(spec["stats_url"], timeout=1.5).json()
                if st.get("cpu") is not None:
                    d.cpu, d.cpuPct = f"{st['cpu']}%", st["cpu"]
                if st.get("ram") is not None:
                    d.ram, d.ramPct = f"{st['ram']}%", st["ram"]
                g = st.get("gpu") or {}
                if g.get("vram_pct") is not None:
                    d.gpu, d.gpuPct = "VRAM", g["vram_pct"]
            except Exception:  # noqa: BLE001
                pass  # agent not running on that host yet → leave 0/— (device still shows online)
        elif not up:
            d.cpuPct = d.ramPct = d.gpuPct = 0
        if spec["router"]:
            d.models = _router_models() if up else []
            d.gpu = "qua 9Router" if up else "—"
    db.commit()


class DeviceCreate(BaseModel):
    name: str
    type: str = "server"
    addr: str = ""
    role: str = ""


def _list_with_power(db: Session) -> list:
    """Serialize devices + flag which support real remote power control (start/reboot/shutdown)."""
    rows = rows_to_list(db.scalars(select(Device).order_by(Device.sort, Device.id)))
    for d in rows:
        d["canPower"] = d.get("id") in _POWER_SPECS
        d["canCleanVram"] = d.get("id") in _VRAM_CLEAN_IDS
    return rows


@router.get("")
def list_devices(db: Session = Depends(get_db)):
    _ensure_infra(db)
    _refresh_infra(db)  # live status for 9Router + OpenClaw
    return _list_with_power(db)


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
    return _list_with_power(db)


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


@router.post("/{device_id}/power/{action}")
def power_action(device_id: str, action: str):
    """Real remote power control for capable infra devices (Bot PC / PC-B):
    start = Wake-on-LAN magic packet; reboot|shutdown = call the on-device agent
    (token-authenticated). The soft `/power` toggle above only flips the UI status."""
    if action not in ("start", "reboot", "shutdown"):
        raise HTTPException(status_code=400, detail="action phải là start | reboot | shutdown")
    spec = _POWER_SPECS.get(device_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Thiết bị này không hỗ trợ điều khiển nguồn")
    if action == "start":
        mac = spec.get("mac")
        if not mac:
            raise HTTPException(status_code=400, detail="Thiếu MAC — không Wake-on-LAN được")
        try:
            _send_wol(mac, spec.get("host", ""))
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Gửi Wake-on-LAN lỗi: {exc}")
        return {"detail": "Đã gửi Wake-on-LAN. Máy sẽ bật nếu BIOS đã bật Wake-on-LAN.", "action": action}
    # reboot / shutdown → the on-device agent
    purl = spec.get("power_url")
    if not purl:
        raise HTTPException(status_code=400, detail="Thiết bị không hỗ trợ reboot/shutdown từ xa")
    if not _POWER_TOKEN:
        raise HTTPException(status_code=503, detail="Server chưa cấu hình AGENTAIOS_POWER_TOKEN")
    try:
        r = httpx.post(purl, json={"action": action}, headers={"X-Power-Token": _POWER_TOKEN}, timeout=8)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Không gọi được agent trên máy: {exc}")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Agent từ chối ({r.status_code}): {r.text[:160]}")
    return {"detail": f"Đã gửi lệnh {action} tới máy.", "action": action}


@router.post("/{device_id}/vram/clean")
def clean_vram(device_id: str, db: Session = Depends(get_db)):
    """Reclaim the PC-A GPU's VRAM (RTX 5090): unload idle ollama LLM(s) + ComfyUI free.
    Offered only for the GPU-host device (dev-comfyui)."""
    if device_id not in _VRAM_CLEAN_IDS:
        raise HTTPException(status_code=404, detail="Thiết bị này không hỗ trợ dọn VRAM")
    res = _clean_vram()
    freed = res.get("freed_mb")
    parts = []
    if res["ollama_unloaded"]:
        parts.append("unload " + ", ".join(res["ollama_unloaded"]))
    if res["comfy_freed"]:
        parts.append("ComfyUI free")
    how = (" (" + " + ".join(parts) + ")") if parts else ""
    if freed is None:
        res["detail"] = "Đã gửi lệnh dọn VRAM" + how + " (không đọc được nvidia-smi)."
    elif freed > 50:  # ignore sub-50MB noise
        res["detail"] = f"Đã thu hồi {freed / 1024:.1f} GB VRAM{how}."
    else:
        res["detail"] = "VRAM đã sạch sẵn — không có gì để thu hồi" + how + "."
    return res


@router.delete("/{device_id}")
def delete_device(device_id: str, db: Session = Depends(get_db)):
    d = get_or_404(db, Device, device_id)
    db.delete(d)
    db.commit()
    return {"detail": "deleted"}
