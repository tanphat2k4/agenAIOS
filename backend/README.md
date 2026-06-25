# AgentAIOS — Backend (FastAPI + PostgreSQL)

Real backend for the AgentAIOS workspace. Replaces the frontend's in-memory mock
with persistent PostgreSQL data, JWT auth, and **real agent chat via 9Router**.

## Stack
- **FastAPI** + **SQLAlchemy 2.0** + **Alembic** (migrations)
- **PostgreSQL** (cluster lives on `D:\PostgreSQL\17\data`)
- **JWT** auth (PyJWT) + **bcrypt** password hashing
- **9Router** LLM gateway (OpenAI-compatible, `http://localhost:20128/v1`) for real agent replies

## Layout
```
backend/
  app/
    main.py              # FastAPI app + CORS + router mounting
    core/                # config, database, security (JWT/bcrypt), deps (auth)
    models/              # SQLAlchemy ORM — 19 tables, camelCase columns matching types.ts
    routers/             # 1 module per domain (auth, users, channels, agents, …, ai)
    services/ninerouter.py   # 9Router client (chat + model list)
    serialize.py         # ORM -> dict (camelCase, drops backend-only fields)
    crud.py              # uid / get_or_404 / next_sort helpers
    seed.py              # load seed_data.json -> Postgres (idempotent)
  alembic/               # migrations (initial schema)
  seed_data.json         # dumped from src/data/seed.ts via `npx tsx scripts/dump-seed.ts`
  .env                   # DATABASE_URL, SECRET_KEY, NINEROUTER_* (gitignored)
```

## Run
```bash
# from repo root, first time only:
py -3.11 -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt

# create DB + apply migrations + seed (run from backend/)
cd backend
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m app.seed

# start the API (from repo root)
backend/.venv/Scripts/python -m uvicorn app.main:app --port 8000 --app-dir backend --reload
```
- API: http://localhost:8000  ·  Swagger: http://localhost:8000/docs
- Re-dump seed after editing the prototype: `npx tsx scripts/dump-seed.ts`

## Login (seeded)
All seeded users share one password. The owner:
```
giang@zytech.vn / agentaios
```
Registration (`POST /auth/register`) also creates new owner accounts.

## 9Router
The backend calls 9Router's OpenAI-compatible API for agent replies. On the local
loopback no API key is needed; for remote/Tailscale set `NINEROUTER_API_KEY` in `.env`.
Default model is `fast-chat` (a 9Router combo) — change `NINEROUTER_DEFAULT_MODEL`.
Sending a message in a DM channel auto-triggers a real agent reply.
