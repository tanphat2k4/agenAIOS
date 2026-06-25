from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Channel(Base):
    __tablename__ = "channels"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    kind: Mapped[str] = mapped_column(String, default="public")  # public|private|direct
    name: Mapped[str] = mapped_column(String, default="")
    desc: Mapped[str] = mapped_column(Text, default="")
    visibility: Mapped[str] = mapped_column(String, default="PUBLIC")
    icon: Mapped[str | None] = mapped_column(String, nullable=True)
    color: Mapped[str | None] = mapped_column(String, nullable=True)
    initial: Mapped[str | None] = mapped_column(String, nullable=True)
    members: Mapped[int] = mapped_column(Integer, default=1)
    database: Mapped[str | None] = mapped_column(String, nullable=True)
    files: Mapped[str | None] = mapped_column(String, nullable=True)
    tasks: Mapped[list] = mapped_column(JSON, default=list)
    wfTotal: Mapped[int] = mapped_column(Integer, default=0)
    wfNote: Mapped[str] = mapped_column(Text, default="")
    unread: Mapped[int] = mapped_column(Integer, default=0)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class ChannelMember(Base):
    __tablename__ = "channel_members"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    channel_id: Mapped[str] = mapped_column(
        String, ForeignKey("channels.id", ondelete="CASCADE"), index=True
    )
    userId: Mapped[str | None] = mapped_column(String, nullable=True)  # real user link (null for agents)
    name: Mapped[str] = mapped_column(String, default="")
    initial: Mapped[str] = mapped_column(String, default="")
    color: Mapped[str] = mapped_column(String, default="#3B5BDB")
    role: Mapped[str] = mapped_column(String, default="Member")  # Owner|Lead|Member|Agent
    isAgent: Mapped[bool] = mapped_column(Boolean, default=False)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    channel_id: Mapped[str] = mapped_column(
        String, ForeignKey("channels.id", ondelete="CASCADE"), index=True
    )
    authorName: Mapped[str] = mapped_column(String, default="")
    time: Mapped[str] = mapped_column(String, default="")
    avatarInitial: Mapped[str] = mapped_column(String, default="")
    avatarColor: Mapped[str] = mapped_column(String, default="#3B5BDB")
    isAgent: Mapped[bool] = mapped_column(Boolean, default=False)
    raw: Mapped[list] = mapped_column(JSON, default=list)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    slug: Mapped[str] = mapped_column(String, default="")
    channel: Mapped[str] = mapped_column(String, default="")
    members: Mapped[list] = mapped_column(JSON, default=list)  # RoomMember[]
    sort: Mapped[int] = mapped_column(Integer, default=0)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    group: Mapped[str] = mapped_column(String, default="")
    type: Mapped[str] = mapped_column(String, default="")
    taskId: Mapped[str | None] = mapped_column(String, nullable=True)
    cronId: Mapped[str | None] = mapped_column(String, nullable=True)
    actor: Mapped[str] = mapped_column(String, default="")
    initial: Mapped[str] = mapped_column(String, default="")
    color: Mapped[str] = mapped_column(String, default="")
    action: Mapped[str] = mapped_column(String, default="")
    preview: Mapped[str] = mapped_column(Text, default="")
    time: Mapped[str] = mapped_column(String, default="")
    unread: Mapped[bool] = mapped_column(Boolean, default=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)
