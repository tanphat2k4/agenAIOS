"""Seed Postgres from the prototype's mock data (backend/seed_data.json, produced
by `npx tsx scripts/dump-seed.ts`). Idempotent: clears every table, then inserts.

Run from the backend/ dir:  python -m app.seed
"""

import json

from app.core.config import BASE_DIR
from app.core.database import SessionLocal, engine
from app.core.security import hash_password
from app.crud import uid
from app.models.agents import Agent, CronJob, McpServer, Workflow
from app.models.comms import Channel, Message, Notification, Room
from app.models.ops import (
    ActivityLog,
    AuditLog,
    Device,
    KnowledgeEntry,
    SessionLog,
    Task,
)
from app.models.org import BillingMonth, Invite, Role, Signup
from app.models.user import User

DEFAULT_PASSWORD = "agentaios"

# wipe order: children before parents (messages reference channels)
_WIPE_ORDER = [
    Message, ActivityLog, AuditLog, Notification, Task, KnowledgeEntry, SessionLog,
    Device, CronJob, Workflow, McpServer, Agent, Invite, Signup, BillingMonth,
    Room, Channel, Role, User,
]


def _make(model, data: dict, **overrides):
    """Build a model from a dict, keeping only real columns; overrides win."""
    cols = set(model.__table__.columns.keys())
    merged = {**data, **overrides}
    return model(**{k: v for k, v in merged.items() if k in cols})


def run() -> None:
    data = json.loads((BASE_DIR / "seed_data.json").read_text(encoding="utf-8"))
    db = SessionLocal()
    try:
        for model in _WIPE_ORDER:
            db.query(model).delete()
        db.commit()

        # ---- roles (+ permission matrix) ----
        perms = data["initialRolePerms"]
        for i, r in enumerate(data["rolesData"]):
            db.add(_make(Role, r, permissions=perms.get(r["id"], {}), sort=i))

        # ---- users (with login password); enrich the owner from profileData ----
        prof = data["profileData"]
        sessions = data["profileSessions"]
        pw = hash_password(DEFAULT_PASSWORD)
        for i, u in enumerate(data["usersData"]):
            extra = {}
            if u["email"] == prof["email"]:
                extra = {
                    "phone": prof.get("phone", ""), "title": prof.get("title", ""),
                    "bio": prof.get("bio", ""), "location": prof.get("location", ""),
                    "sessions": sessions,
                }
            db.add(_make(User, u, hashed_password=pw, sort=i, **extra))

        # ---- agents / mcp / workflows / cron / tasks / devices / sessions ----
        for i, a in enumerate(data["agentsData"]):
            db.add(_make(Agent, a, sort=i))
        for i, m in enumerate(data["mcpData"]):
            db.add(_make(McpServer, m, sort=i))
        for i, w in enumerate(data["workflows"]):
            db.add(_make(Workflow, w, sort=i))
        for i, j in enumerate(data["cronJobsData"]):
            db.add(_make(CronJob, j, sort=i))
        for i, t in enumerate(data["tasksData"]):
            db.add(_make(Task, t, sort=i))
        for i, d in enumerate(data["devicesData"]):
            db.add(_make(Device, d, sort=i))
        for i, s in enumerate(data["sessionsData"]):
            db.add(_make(SessionLog, s, sort=i))

        # ---- audit / invites / signups / notifs / billing / knowledge ----
        for i, a in enumerate(data["auditLog"]):
            db.add(_make(AuditLog, a, id=uid("au"), sort=i))
        for i, iv in enumerate(data["invitesData"]):
            db.add(_make(Invite, iv, sort=i))
        for i, sg in enumerate(data["signupsData"]):
            db.add(_make(Signup, sg, sort=i))
        for i, n in enumerate(data["notifsData"]):
            db.add(_make(Notification, n, sort=i))
        for i, b in enumerate(data["billMonths"]):
            db.add(_make(BillingMonth, b, sort=i))
        for i, k in enumerate(data["knowledgeData"]):
            db.add(_make(KnowledgeEntry, k, id=uid("kn"), sort=i))

        # ---- channels (3 kinds) then messages (FK) ----
        order = 0
        for kind, key in (("public", "publicData"), ("private", "privateData"), ("direct", "directData")):
            for c in data[key]:
                unread = 4 if c["id"] == "room-zy-novel" else 0
                db.add(_make(Channel, c, kind=kind, unread=unread, sort=order))
                order += 1
        db.flush()  # ensure channels exist before messages reference them

        for channel_id, msgs in data["messages"].items():
            for j, m in enumerate(msgs):
                db.add(_make(Message, m, id=uid("m"), channel_id=channel_id, sort=j))

        # ---- rooms (+ members) ----
        members_by_id = data["roomMembersById"]
        for i, r in enumerate(data["rooms"]):
            db.add(_make(Room, r, members=members_by_id.get(r["id"], []), sort=i))

        db.commit()
        print("✓ Seed complete.")
        print(f"  login: {prof['email']} / {DEFAULT_PASSWORD}  (all seeded users share this password)")
    finally:
        db.close()


if __name__ == "__main__":
    # ensure the engine is reachable before seeding
    engine.connect().close()
    run()
