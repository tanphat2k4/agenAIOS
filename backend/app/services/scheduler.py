"""Lightweight cron scheduler — a daemon thread that fires due cron jobs.

Catch-up aware: the morning report fires on the first tick within its window
(scheduled time .. +WINDOW_HOURS) once per day — so you can start the app any
time that morning (not exactly at 08:00) and still get it. Restart-safe via a
small state file so a mid-day restart doesn't re-fire. Runs only while the app
is up (in-process).
"""

import os
import threading
import time
from datetime import datetime, timedelta

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.agents import CronJob
from app.services import morning_report

# backend/.scheduler_state — remembers the last date the morning report ran
_STATE_FILE = os.path.join(os.path.dirname(__file__), "..", "..", ".scheduler_state")
_WINDOW_HOURS = 3


def _last_run_date() -> str:
    try:
        with open(_STATE_FILE, encoding="utf-8") as f:
            return f.read().strip()
    except Exception:  # noqa: BLE001
        return ""


def _set_last_run_date(d: str) -> None:
    try:
        with open(_STATE_FILE, "w", encoding="utf-8") as f:
            f.write(d)
    except Exception:  # noqa: BLE001
        pass


def _due(expr: str, now: datetime) -> bool:
    """True if `now` is within [today's scheduled time, +WINDOW_HOURS]."""
    parts = (expr or "").split()
    if len(parts) < 2:
        return False
    try:
        minute = 0 if parts[0] == "*" else int(parts[0])
        hour = now.hour if parts[1] == "*" else int(parts[1])
    except ValueError:
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


def _tick() -> None:
    db = SessionLocal()
    try:
        now = datetime.now()
        today = now.strftime("%Y-%m-%d")
        for c in db.scalars(select(CronJob).where(CronJob.enabled.is_(True))):
            if c.id == morning_report.CRON_ID and _due(c.expr, now) and _last_run_date() != today:
                _set_last_run_date(today)
                threading.Thread(target=_run_morning, daemon=True).start()
    finally:
        db.close()


def start_scheduler() -> None:
    def loop() -> None:
        while True:
            try:
                _tick()  # run immediately on startup (catch-up), then every 30s
            except Exception:  # noqa: BLE001
                pass
            time.sleep(30)

    threading.Thread(target=loop, daemon=True).start()
