from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.routers import api_router
from app.routers.uploads import UPLOAD_DIR

app = FastAPI(title="AgentAIOS API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}


app.include_router(api_router)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def _start_scheduler() -> None:
    from app.services.scheduler import start_scheduler

    start_scheduler()


@app.on_event("startup")
def _start_music_sync() -> None:
    # near-realtime Telegram↔app mirror for #am-nhac (~6s cadence; scheduler's 30s tick stays as backstop)
    from app.services.music import start_sync_daemon

    start_sync_daemon()
