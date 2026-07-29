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
def _single_instance_guard() -> None:
    # 29/07: launcher cũ AgentAIOS.cmd + vbs mới cùng chạy lúc logon → 2 backend
    # chung sống (một bind 0.0.0.0, một 127.0.0.1) → scheduler bắn ĐÔI báo cáo sáng,
    # Vệ sĩ giá nhân đôi cảnh báo. Khóa độc quyền: instance thứ hai THOÁT NGAY
    # trước khi bất kỳ daemon nào kịp khởi động. (Hook này phải đứng ĐẦU TIÊN.)
    import msvcrt
    import os as _os

    global _INSTANCE_LOCK_FH
    path = _os.path.join(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))), ".instance.lock")
    try:
        _INSTANCE_LOCK_FH = open(path, "w")
        msvcrt.locking(_INSTANCE_LOCK_FH.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        print("AgentAIOS backend đã chạy ở process khác — instance này tự thoát để tránh chạy đôi.")
        _os._exit(0)


@app.on_event("startup")
def _start_scheduler() -> None:
    from app.services.scheduler import start_scheduler

    start_scheduler()


@app.on_event("startup")
def _start_music_sync() -> None:
    # near-realtime Telegram↔app mirror for #am-nhac (~6s cadence; scheduler's 30s tick stays as backstop)
    from app.services.music import start_sync_daemon

    start_sync_daemon()


@app.on_event("startup")
def _start_trading_tg_sync() -> None:
    # parity Telegram↔#chung-khoan/#vang-bac VÔ ĐIỀU KIỆN: tail transcript phiên OpenClaw
    # (bot bỏ relay vẫn không mất tin) — thêm 21/07 sau sự cố bot "nhớ" relay hỏng
    from app.services.trading_tg_sync import start_trading_tg_sync

    start_trading_tg_sync()


@app.on_event("startup")
def _start_price_guard() -> None:
    # Vệ sĩ giá: cảnh báo rủi ro trong phiên (60s/lần, chỉ giờ giao dịch) — user duyệt 16/07
    from app.services.price_guard import start_price_guard

    start_price_guard()


@app.on_event("startup")
def _warm_price_cache() -> None:
    # vnstock price_board cold-start mất tới ~30s (import trong system python) — hâm nóng
    # sẵn giá cho danh mục + watchlist của owner để màn Chứng khoán mở lên là có ngay.
    import threading

    def _warm() -> None:
        try:
            from app.core.database import SessionLocal
            from app.services import tradingagents as ta
            from app.services import trading_record as rec
            from sqlalchemy import select
            from app.models.user import User

            db = SessionLocal()
            try:
                owner = db.scalar(select(User).where(User.role == "owner")) or db.scalar(select(User))
                holdings = [h["ticker"] for h in ((owner.settings or {}).get("holdings") or [])] if owner else []
                tickers = sorted(set(holdings) | set(rec.get_watchlist(db)))
            finally:
                db.close()
            if tickers:
                ta._price_board_batch(tickers)  # đổ cache 20s + trả giá cold-start ngay lúc boot
        except Exception:  # noqa: BLE001
            pass

    threading.Thread(target=_warm, daemon=True).start()
