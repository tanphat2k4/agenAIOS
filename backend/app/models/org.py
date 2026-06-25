from sqlalchemy import JSON, Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    icon: Mapped[str] = mapped_column(String, default="🛡")
    color: Mapped[str] = mapped_column(String, default="#3B5BDB")
    system: Mapped[bool] = mapped_column(Boolean, default=False)
    desc: Mapped[str] = mapped_column(Text, default="")
    members: Mapped[list] = mapped_column(JSON, default=list)  # RoleMember[]
    permissions: Mapped[dict] = mapped_column(JSON, default=dict)  # {permId: bool}
    sort: Mapped[int] = mapped_column(Integer, default=0)


class Invite(Base):
    __tablename__ = "invites"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, default="")
    role: Mapped[str] = mapped_column(String, default="staff")
    by: Mapped[str] = mapped_column(String, default="")
    time: Mapped[str] = mapped_column(String, default="")
    sort: Mapped[int] = mapped_column(Integer, default=0)


class Signup(Base):
    __tablename__ = "signups"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    email: Mapped[str] = mapped_column(String, default="")
    initial: Mapped[str] = mapped_column(String, default="")
    color: Mapped[str] = mapped_column(String, default="")
    role: Mapped[str] = mapped_column(String, default="staff")
    via: Mapped[str] = mapped_column(String, default="")
    time: Mapped[str] = mapped_column(String, default="")
    sort: Mapped[int] = mapped_column(Integer, default=0)


class BillingMonth(Base):
    __tablename__ = "billing_months"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    m: Mapped[str] = mapped_column(String, default="")
    v: Mapped[int] = mapped_column(Integer, default=0)
    sort: Mapped[int] = mapped_column(Integer, default=0)
