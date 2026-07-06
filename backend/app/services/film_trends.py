"""Weekly film trend survey — Reel posts 5 trend-grounded short-film ideas into #phim
every Monday morning; the user picks one ("làm phim 2") and Reel writes the story +
builds it end-to-end. In-app mirror of the music weekly batch: real Google News RSS
headlines ground a 9Router ideation pass — no invented "trends".
"""
import json
import os
import re

import httpx
from sqlalchemy.orm import Session

from app.crud import next_sort, now_hm, today_ymd, uid
from app.models.agents import CronJob
from app.models.comms import Message, Notification
from app.models.ops import KnowledgeEntry
from app.services import ninerouter
from app.services import trading_record as rec

FILM_CRON_ID = "cron-film-weekly"
FILM_CHANNEL_ID = "phim"
_REEL = ("Reel", "R", "#D4537E")  # keep in sync with routers/films.REEL
_TRENDS_FILE = os.path.join(os.path.dirname(__file__), "..", "..", ".film_trends.json")

_FEEDS = [
    ("https://news.google.com/rss/search?q=trend%20TikTok%20Vi%E1%BB%87t%20Nam&hl=vi&gl=VN&ceid=VN:vi", 4),
    ("https://news.google.com/rss/search?q=phim%20ng%E1%BA%AFn%20viral&hl=vi&gl=VN&ceid=VN:vi", 3),
    ("https://news.google.com/rss/search?q=drama%20m%E1%BA%A1ng%20x%C3%A3%20h%E1%BB%99i%20Vi%E1%BB%87t&hl=vi&gl=VN&ceid=VN:vi", 3),
]


def ensure_film_cron(db: Session) -> CronJob:
    c = db.get(CronJob, FILM_CRON_ID)
    if c:
        return c
    c = CronJob(
        id=FILM_CRON_ID, name="Khảo sát trend phim", target="Reel · 5 ý tưởng phim ngắn / tuần",
        expr="30 8 * * 1", last="—", next="T2 08:30", creator="Hệ thống", creatorInitial="H",
        creatorColor="#D4537E", enabled=True, spark=[0, 0, 0, 0, 0, 0, 0], sort=-1,
    )
    db.add(c)
    db.commit()
    return c


def _headlines() -> list[str]:
    out: list[str] = []
    try:
        with httpx.Client(timeout=8, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True) as client:
            for url, n in _FEEDS:
                try:
                    xml = client.get(url).text
                    titles = re.findall(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", xml)
                    titles = [t.strip() for t in titles if t.strip() and not t.strip().startswith(("Google Tin", "Google News"))]
                    out += titles[:n]
                except Exception:  # noqa: BLE001
                    continue
    except Exception:  # noqa: BLE001
        pass
    return out


def load_ideas() -> dict:
    try:
        with open(_TRENDS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return {}


def run_survey(db: Session) -> str:
    """Generate + post this week's 5 film ideas. Returns the posted text."""
    heads = _headlines()
    head_block = "\n".join(f"- {h}" for h in heads) or "(không lấy được tin — dựa trên hiểu biết trend chung, nói rõ điều đó)"
    system = {"role": "system", "content": (
        "Bạn là Reel — đạo diễn phim ngắn AI cho TikTok/YouTube VN (dọc 9:16, 1-3 phút, dựng bằng ArcReel). "
        + rec.ANTI_HALLUCINATION
        + " Từ các TIÊU ĐỀ TIN thật bên dưới + khuôn trend bền (tình cảm nghẹn, gia đình, twist báo thù, chữa lành, học đường), "
        "đề xuất ĐÚNG 5 ý tưởng phim ngắn. TRẢ VỀ DUY NHẤT một JSON array, mỗi phần tử: "
        '{"title": "tên phim ngắn gọn", "logline": "2 câu tóm cốt truyện có mở-thắt-twist", "vibe": "tông/cảm xúc", "why": "1 câu vì sao hợp trend tuần này"}')}
    user = {"role": "user", "content": f"TIN TUẦN NÀY:\n{head_block}"}
    try:
        res = ninerouter.chat([system, user], temperature=0.6, max_tokens=1200)["content"] or ""
    except Exception as exc:  # noqa: BLE001
        return f"(Khảo sát trend lỗi 9Router: {exc})"
    m = re.search(r"\[.*\]", res, re.S)
    try:
        ideas = json.loads(m.group(0)) if m else []
    except Exception:  # noqa: BLE001
        ideas = []
    ideas = [i for i in ideas if isinstance(i, dict) and i.get("title")][:5]
    if not ideas:
        return "(Khảo sát trend: model không trả JSON hợp lệ — thử lại tuần sau hoặc gõ 'khảo sát trend' để chạy lại)"

    with open(_TRENDS_FILE, "w", encoding="utf-8") as f:
        json.dump({"date": today_ymd(), "ideas": ideas}, f, ensure_ascii=False)

    lines = [f"🎬 **Khảo sát trend phim tuần này** ({today_ymd()}) — chọn 1 để em viết truyện + dựng luôn:"]
    for i, it in enumerate(ideas, 1):
        lines.append(f"**{i}. {it['title']}** — {it.get('logline', '')}")
        extra = " · ".join(x for x in (it.get("vibe"), it.get("why")) if x)
        if extra:
            lines.append(f"    _{extra}_")
    lines.append("")
    lines.append("👉 Gõ **làm phim <số>** (vd `làm phim 2`) — em tự viết truyện rồi chạy pipeline, anh chỉ cần duyệt các cổng.")
    text = "\n".join(lines)

    db.add(Message(id=uid("m"), channel_id=FILM_CHANNEL_ID, authorName=_REEL[0], time=now_hm(),
                   avatarInitial=_REEL[1], avatarColor=_REEL[2], isAgent=True,
                   raw=rec.md_to_blocks(text), sort=next_sort(db, Message)))
    db.add(Notification(
        id=uid("n"), group="Hôm nay", type="cron", cronId=FILM_CRON_ID, actor=_REEL[0], initial=_REEL[1],
        color=_REEL[2], action="đã đăng khảo sát trend phim tuần này", preview=ideas[0]["title"][:100],
        time=now_hm(), unread=True, sort=rec._top_sort(db, Notification),
    ))
    db.add(KnowledgeEntry(
        id=uid("kn"), type="note", title=f"Khảo sát trend phim ({today_ymd()})", repo="film/trend", ver="v1",
        time="vừa xong", private=False, avatars=[{"i": _REEL[1], "c": _REEL[2]}], content=text,
        sort=rec._top_sort(db, KnowledgeEntry),
    ))
    c = ensure_film_cron(db)
    c.last = now_hm()
    c.spark = (list(c.spark or [0, 0, 0, 0, 0, 0, 0]) + [1])[-7:]
    db.commit()
    return text
