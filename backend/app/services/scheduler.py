"""Lightweight cron scheduler — a daemon thread that fires due cron jobs.

Generalized (2026-07-03): fires EVERY runnable cron, not just the morning report.
Catch-up aware: a job fires on the first tick within its window (scheduled time ..
+WINDOW_HOURS) once per day — start the app any time that morning and it still runs.
Day-of-week aware: "0 8 * * 1" fires Mondays only (cron dow: 0/7=CN, 1=T2 … 6=T7).
Restart-safe via a JSON state file {cron_id: last-run-date}. Runs in-process only.
"""

import json
import os
import threading
import time
from datetime import datetime, timedelta

from sqlalchemy import select

from app.core.database import SessionLocal
from app.crud import now_hm
from app.models.agents import CronJob
from app.services import morning_report

# backend/.scheduler_state — JSON {cron_id: "YYYY-MM-DD"} (legacy: a bare date line = morning's)
_STATE_FILE = os.path.join(os.path.dirname(__file__), "..", "..", ".scheduler_state")
_WINDOW_HOURS = 3


def _load_state() -> dict:
    try:
        with open(_STATE_FILE, encoding="utf-8") as f:
            raw = f.read().strip()
        if raw.startswith("{"):
            return json.loads(raw)
        return {morning_report.CRON_ID: raw} if raw else {}
    except Exception:  # noqa: BLE001
        return {}


def _mark_ran(cron_id: str, date: str) -> None:
    state = _load_state()
    state[cron_id] = date
    try:
        with open(_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f)
    except Exception:  # noqa: BLE001
        pass


def _due(expr: str, now: datetime) -> bool:
    """True if `now` is within [today's scheduled time, +WINDOW_HOURS] AND the
    day-of-week field (5th) matches. Supports numbers, '*' and comma lists."""
    parts = (expr or "").split()
    if len(parts) < 2:
        return False
    try:
        minute = 0 if parts[0] == "*" else int(parts[0])
        hour = now.hour if parts[1] == "*" else int(parts[1])
    except ValueError:
        return False
    if len(parts) >= 5 and parts[4] != "*":
        try:
            want = {int(x) % 7 for x in parts[4].split(",")}  # 7 → 0 (CN)
        except ValueError:
            return False
        if (now.weekday() + 1) % 7 not in want:  # python T2=0 → cron T2=1; CN → 0
            return False
    sched = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return sched <= now <= sched + timedelta(hours=_WINDOW_HOURS)


def _run_morning() -> None:
    db = SessionLocal()
    try:
        morning_report.run_morning_report(db)
    except Exception:  # noqa: BLE001
        pass
    finally:
        db.close()


def _run_music_batch() -> None:
    """Weekly Beat batch (lyrics/score pipeline — does NOT fire Suno generate;
    picking/generating songs stays a manual, credit-burning click)."""
    db = SessionLocal()
    try:
        from app.services import music

        music.run_batch(db)
        c = db.get(CronJob, music.MUSIC_CRON_ID)
        if c:
            c.last = now_hm()
            c.spark = (list(c.spark or [0, 0, 0, 0, 0, 0, 0]) + [1])[-7:]
            db.commit()
    except Exception:  # noqa: BLE001
        pass
    finally:
        db.close()


# cron id → action. Rows not listed here are display/Run-now only.
_RUNNABLE = {
    morning_report.CRON_ID: _run_morning,
    "cron-music-weekly": _run_music_batch,
}


def _tick() -> None:
    db = SessionLocal()
    try:
        now = datetime.now()
        today = now.strftime("%Y-%m-%d")
        state = _load_state()
        for c in db.scalars(select(CronJob).where(CronJob.enabled.is_(True))):
            runner = _RUNNABLE.get(c.id)
            if runner and _due(c.expr, now) and state.get(c.id) != today:
                _mark_ran(c.id, today)
                threading.Thread(target=runner, daemon=True).start()
    finally:
        db.close()


def _music_sync_tick() -> None:
    """Mirror the Telegram ↔ Beat conversation + freshly generated mp3s into #am-nhac."""
    db = SessionLocal()
    try:
        from app.services import music

        music.sync_telegram(db)
    except Exception:  # noqa: BLE001
        pass
    finally:
        db.close()


def start_scheduler() -> None:
    def loop() -> None:
        while True:
            try:
                _tick()  # run immediately on startup (catch-up), then every 30s
            except Exception:  # noqa: BLE001
                pass
            try:
                _music_sync_tick()  # self-throttled (20s) inside
            except Exception:  # noqa: BLE001
                pass
            time.sleep(30)

    threading.Thread(target=loop, daemon=True).start()
