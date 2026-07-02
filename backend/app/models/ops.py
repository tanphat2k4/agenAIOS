import time

from sqlalchemy import JSON, Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _now_epoch() -> int:
    return int(time.time())


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String, default="queued")  # queued|running|review|done
    assignee: Mapped[str] = mapped_column(String, default="Chưa giao")
    initial: Mapped[str] = mapped_column(String, default="?")
    color: Mapped[str] = mapped_column(String, default="#9AA8A1")
    room: Mapped[str] = mapped_column(String, default="")
    priority: Mapped[str] = mapped_column(String, default="med")  # high|med|low
    time: Mapped[str] = mapped_column(String, default="vừa xong")
    desc: Mapped[str] = mapped_column(Text, default="Chưa có mô tả.")
    sort: Mapped[int] = mapped_column(Integer, default=0)


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    type: Mapped[str] = mapped_column(String, default="server")  # server|gateway|desktop|phone
    icon: Mapped[str] = mapped_column(String, default="🖥")
    status: Mapped[str] = mapped_column(String, default="online")  # online|offline
    addr: Mapped[str] = mapped_column(String, default="")
    os: Mapped[str] = mapped_column(String, default="")
    cpu: Mapped[str] = mapped_column(String, default="")
    cpuPct: Mapped[int] = mapped_column(Integer, default=0)
    ram: Mapped[str] = mapped_column(String, default="")
    ramPct: Mapped[int] = mapped_column(Integer, default=0)
    gpu: Mapped[str] = mapped_column(String, default="—")
    gpuPct: Mapped[int] = mapped_column(Integer, default=0)
    vram: Mapped[str] = mapped_column(String, default="")
    uptime: Mapped[str] = mapped_column(String, default="")
    lastSeen: Mapped[str] = mapped_column(String, default="")
    role: Mapped[str] = mapped_column(String, default="")
    models: Mapped[list] = mapped_column(JSON, default=list)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class SessionLog(Base):
    __tablename__ = "session_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    agent: Mapped[str] = mapped_column(String, default="")
    initial: Mapped[str] = mapped_column(String, default="")
    color: Mapped[str] = mapped_column(String, default="")
    room: Mapped[str] = mapped_column(String, default="")
    model: Mapped[str] = mapped_column(String, default="")
    modelType: Mapped[str] = mapped_column(String, default="local")
    status: Mapped[str] = mapped_column(String, default="done")  # running|done|failed
    started: Mapped[str] = mapped_column(String, default="")
    duration: Mapped[str] = mapped_column(String, default="")
    tokens: Mapped[str] = mapped_column(String, default="")
    log: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[int] = mapped_column(Integer, default=_now_epoch)  # epoch — 7-day retention
    sort: Mapped[int] = mapped_column(Integer, default=0)


class KnowledgeEntry(Base):
    __tablename__ = "knowledge_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    type: Mapped[str] = mapped_column(String, default="knowledge")
    title: Mapped[str] = mapped_column(String, default="")
    repo: Mapped[str] = mapped_column(String, default="")
    ver: Mapped[str] = mapped_column(String, default="v1")
    time: Mapped[str] = mapped_column(String, default="")
    private: Mapped[bool] = mapped_column(Boolean, default=False)
    avatars: Mapped[list] = mapped_column(JSON, default=list)
    extra: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)  # full document text (e.g. analyze report)
    created_at: Mapped[int] = mapped_column(Integer, default=_now_epoch)  # epoch — 7-day retention
    sort: Mapped[int] = mapped_column(Integer, default=0)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    actor: Mapped[str] = mapped_column(String, default="")
    action: Mapped[str] = mapped_column(String, default="")
    target: Mapped[str] = mapped_column(String, default="")
    lvl: Mapped[str] = mapped_column(String, default="info")
    time: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[int] = mapped_column(Integer, default=_now_epoch)  # epoch — 7-day retention
    sort: Mapped[int] = mapped_column(Integer, default=0)


class ActivityLog(Base):
    __tablename__ = "activity_log"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    initial: Mapped[str] = mapped_column(String, default="")
    color: Mapped[str] = mapped_column(String, default="")
    actor: Mapped[str] = mapped_column(String, default="")
    action: Mapped[str] = mapped_column(Text, default="")
    time: Mapped[str] = mapped_column(String, default="")
    tag: Mapped[str] = mapped_column(String, default="")
    tagFg: Mapped[str] = mapped_column(String, default="")
    tagBg: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[int] = mapped_column(Integer, default=_now_epoch)  # epoch — 7-day retention
    sort: Mapped[int] = mapped_column(Integer, default=0)
