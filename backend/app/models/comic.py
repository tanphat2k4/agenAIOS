from sqlalchemy import JSON, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Comic(Base):
    """A comic/webtoon project driven from #truyen-tranh. P1 holds the script (gate 1)
    and character sheets (gate 2); panel/page generation state arrives in P2.
    camelCase columns match src/types.ts conventions."""

    __tablename__ = "comics"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(Text, default="")
    idea: Mapped[str] = mapped_column(Text, default="")
    # scripting | awaiting_script_review | designing | awaiting_character_review | ready_p2 | error
    status: Mapped[str] = mapped_column(String, default="scripting")
    stage: Mapped[str] = mapped_column(String, default="scripting")
    style: Mapped[str] = mapped_column(Text, default="")
    script: Mapped[dict] = mapped_column(JSON, default=dict)      # {title, style, characters[], pages[]}
    characters: Mapped[list] = mapped_column(JSON, default=list)  # [{name, look, role}]
    sheets: Mapped[dict] = mapped_column(JSON, default=dict)      # {char_name: ["/uploads/..png", ...]}
    picks: Mapped[dict] = mapped_column(JSON, default=dict)       # {char_name: 1|2}
    errorMessage: Mapped[str | None] = mapped_column(Text, nullable=True)
    channelId: Mapped[str] = mapped_column(String, default="truyen-tranh")
    createdBy: Mapped[str] = mapped_column(String, default="")
    createdAt: Mapped[str] = mapped_column(String, default="")
    updatedAt: Mapped[str] = mapped_column(String, default="")
    sort: Mapped[int] = mapped_column(Integer, default=0)
