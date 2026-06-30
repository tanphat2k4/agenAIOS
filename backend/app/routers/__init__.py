from fastapi import APIRouter

from app.routers import (
    agents,
    ai,
    auth,
    billing,
    channels,
    cron,
    devices,
    films,
    knowledge,
    logs,
    mcp,
    music,
    notifs,
    overview,
    profile,
    roles,
    rooms,
    tasks,
    trading,
    uploads,
    users,
    workflows,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(profile.router)
api_router.include_router(users.router)
api_router.include_router(roles.router)
api_router.include_router(channels.router)
api_router.include_router(rooms.router)
api_router.include_router(agents.router)
api_router.include_router(mcp.router)
api_router.include_router(workflows.router)
api_router.include_router(cron.router)
api_router.include_router(tasks.router)
api_router.include_router(devices.router)
api_router.include_router(films.router)
api_router.include_router(films.media_router)
api_router.include_router(logs.router)
api_router.include_router(knowledge.router)
api_router.include_router(notifs.router)
api_router.include_router(billing.router)
api_router.include_router(overview.router)
api_router.include_router(trading.router)
api_router.include_router(trading.relay_router)
api_router.include_router(music.router)
api_router.include_router(uploads.router)
api_router.include_router(ai.router)
