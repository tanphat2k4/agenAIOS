"""Lightweight cron scheduler — a daemon thread that fires due cron jobs.

Checks enabled cron jobs every 30s; when one matches the current minute it
runs its action in a worker thread (deduped per minute). Real but in-process:
it only fires while the app is running.
"""

import threading
import time
from datetime import datetime

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.agents import CronJob
from app.services import morning_report


def _cron_matches(expr: str, now: datetime) -> bool:
    parts = (expr or "").split()
    if len(parts) < 2:
        return False
    minute, hour = parts[0], parts[1]
    ok_m = minute in ("*", str(now.minute)) or (minute.startswith("*/") and now.minute % max(1, int(minute[2:] or 1)) == 0)
    ok_h = hour in ("*", str(now.hour))
    return ok_m and ok_h


def _run_morning() -> None:
    db = SessionLocal()
    try:
        morning_report.run_morning_report(db)
    except Exception:  # noqa: BLE001
        pass
    finally:
        db.close()


def _tick(last_fired: dict) -> None:
    db = SessionLocal()
    try:
        now = datetime.now()
        key = now.strftime("%Y%m%d%H%M")
        for c in db.scalars(select(CronJob).where(CronJob.enabled.is_(True))):
            if c.id == morning_report.CRON_ID and _cron_matches(c.expr, now) and last_fired.get(c.id) != key:
                last_fired[c.id] = key
                threading.Thread(target=_run_morning, daemon=True).start()
    finally:
        db.close()


def start_scheduler() -> None:
    def loop() -> None:
        last_fired: dict = {}
        while True:
            time.sleep(30)
            try:
                _tick(last_fired)
            except Exception:  # noqa: BLE001
                pass

    threading.Thread(target=loop, daemon=True).start()
