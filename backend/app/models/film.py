from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Film(Base):
    """Light mirror of an ArcReel film job. ArcReel owns the heavy state on :1242;
    this row gives AgentAIOS its own list + per-user attribution. camelCase columns
    match src/types.ts so a column dump serializes straight to the Zustand store."""

    __tablename__ = "films"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(Text, default="")
    arcTaskId: Mapped[str] = mapped_column(String, default="")  # ArcReel task_id
    projectSlug: Mapped[str] = mapped_column(String, default="")
    stage: Mapped[str] = mapped_column(String, default="queued")  # raw ArcReel stage
    status: Mapped[str] = mapped_column(String, default="queued")  # queued|running|needs_review|done|error
    publicUrl: Mapped[str] = mapped_column(String, default="")
    aspectRatio: Mapped[str] = mapped_column(String, default="9:16")
    contentMode: Mapped[str] = mapped_column(String, default="narration")  # narration|drama
    channelId: Mapped[str] = mapped_column(String, default="")
    createdBy: Mapped[str] = mapped_column(String, default="")
    errorMessage: Mapped[str] = mapped_column(Text, default="")
    createdAt: Mapped[str] = mapped_column(String, default="")
    updatedAt: Mapped[str] = mapped_column(String, default="")
    sort: Mapped[int] = mapped_column(Integer, default=0)
