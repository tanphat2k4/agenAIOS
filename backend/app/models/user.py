from sqlalchemy import JSON, Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String, default="")  # backend-only

    initial: Mapped[str] = mapped_column(String, default="?")
    color: Mapped[str] = mapped_column(String, default="#3B5BDB")
    role: Mapped[str] = mapped_column(String, default="staff")  # owner|lead|staff|viewer
    status: Mapped[str] = mapped_column(String, default="active")  # active|suspended
    last: Mapped[str] = mapped_column(String, default="vừa xong")

    # profile
    phone: Mapped[str] = mapped_column(String, default="")
    title: Mapped[str] = mapped_column(String, default="")
    bio: Mapped[str] = mapped_column(Text, default="")
    location: Mapped[str] = mapped_column(String, default="")
    twoFA: Mapped[bool] = mapped_column(Boolean, default=True)

    # language/region settings + revocable display sessions (UI-faithful)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    sessions: Mapped[list] = mapped_column(JSON, default=list)
    sort: Mapped[int] = mapped_column(Integer, default=0)
