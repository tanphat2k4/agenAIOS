from sqlalchemy import JSON, Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    handle: Mapped[str] = mapped_column(String, default="")
    role: Mapped[str] = mapped_column(String, default="")
    roleType: Mapped[str] = mapped_column(String, default="research")
    initial: Mapped[str] = mapped_column(String, default="A")
    color: Mapped[str] = mapped_column(String, default="#3B5BDB")
    status: Mapped[str] = mapped_column(String, default="online")  # online|busy|idle|offline
    model: Mapped[str] = mapped_column(String, default="")
    modelType: Mapped[str] = mapped_column(String, default="local")  # local|cloud
    tasks: Mapped[int] = mapped_column(Integer, default=0)
    rooms: Mapped[int] = mapped_column(Integer, default=0)
    success: Mapped[int] = mapped_column(Integer, default=100)
    skills: Mapped[list] = mapped_column(JSON, default=list)
    lastActive: Mapped[str] = mapped_column(String, default="")
    bio: Mapped[str] = mapped_column(Text, default="")
    roomsList: Mapped[list] = mapped_column(JSON, default=list)
    recentTasks: Mapped[list] = mapped_column(JSON, default=list)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class McpServer(Base):
    __tablename__ = "mcp_servers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    icon: Mapped[str] = mapped_column(String, default="🔌")
    desc: Mapped[str] = mapped_column(Text, default="")
    transport: Mapped[str] = mapped_column(String, default="HTTP")
    status: Mapped[str] = mapped_column(String, default="connected")  # connected|disabled|error
    tools: Mapped[list] = mapped_column(JSON, default=list)
    agents: Mapped[int] = mapped_column(Integer, default=0)
    calls24: Mapped[int] = mapped_column(Integer, default=0)
    lastSync: Mapped[str] = mapped_column(String, default="")
    endpoint: Mapped[str] = mapped_column(String, default="")
    recentCalls: Mapped[list] = mapped_column(JSON, default=list)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    desc: Mapped[str] = mapped_column(Text, default="")
    trigger: Mapped[str] = mapped_column(String, default="cron")  # cron|event|manual
    triggerLabel: Mapped[str] = mapped_column(String, default="")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    lastRun: Mapped[str] = mapped_column(String, default="")
    runs24: Mapped[int] = mapped_column(Integer, default=0)
    success: Mapped[int] = mapped_column(Integer, default=100)
    steps: Mapped[list] = mapped_column(JSON, default=list)
    runs: Mapped[list] = mapped_column(JSON, default=list)
    runState: Mapped[str | None] = mapped_column(String, nullable=True)  # running|paused|idle
    sort: Mapped[int] = mapped_column(Integer, default=0)


class CronJob(Base):
    __tablename__ = "cron_jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    target: Mapped[str] = mapped_column(String, default="")
    expr: Mapped[str] = mapped_column(String, default="")
    last: Mapped[str] = mapped_column(String, default="")
    next: Mapped[str] = mapped_column(String, default="")
    creator: Mapped[str] = mapped_column(String, default="")
    creatorInitial: Mapped[str] = mapped_column(String, default="")
    creatorColor: Mapped[str] = mapped_column(String, default="#3B5BDB")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    spark: Mapped[list] = mapped_column(JSON, default=list)
    sort: Mapped[int] = mapped_column(Integer, default=0)
