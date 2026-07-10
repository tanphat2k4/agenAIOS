from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/  (config.py is at backend/app/core/config.py)
BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/agentaios"
    SECRET_KEY: str = "dev-secret-change-me-0123456789abcdef0123456789abcdef"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    ALGORITHM: str = "HS256"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    LOG_RETENTION_DAYS: int = 7  # workflow runs + session/audit/activity logs auto-expire after this

    # ComfyUI on PC-A (RTX 5090) — comic character sheets (P1) + panels (P2)
    COMFYUI_URL: str = "http://192.168.1.4:8188"
    COMFY_CKPT: str = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors"

    # 9Router LLM gateway (OpenAI-compatible). Loopback needs no key; set one if remote.
    NINEROUTER_BASE_URL: str = "http://localhost:20128/v1"
    NINEROUTER_API_KEY: str = ""
    NINEROUTER_DEFAULT_MODEL: str = "fast-chat"

    # TradingAgents-VN: call the existing vn_cli.py as a subprocess (no edits to that repo).
    TRADINGAGENTS_ENABLED: bool = True
    TRADINGAGENTS_PYTHON: str = r"C:\Users\tanph\AppData\Local\Microsoft\WindowsApps\python.exe"
    TRADINGAGENTS_CLI: str = r"D:\TradingAgents\repo\vn_cli.py"
    TRADINGAGENTS_CWD: str = r"D:\TradingAgents\repo"

    # OpenClaw — run its agents via WSL CLI; the gateway delivers replies to Telegram.
    OPENCLAW_ENABLED: bool = True
    OPENCLAW_AGENT: str = "trading"
    OPENCLAW_TELEGRAM_CHAT: str = "5389237483"

    # Telegram → AgentAIOS relay (option B): OpenClaw agents POST the user's Telegram message to
    # AgentAIOS (key-protected), which runs its pipeline + mirrors to the channel and returns the
    # reply to relay back to Telegram. Blank = relay disabled (endpoint rejects).
    RELAY_KEY: str = ""

    # ArcReel film engine (separate FastAPI service on :1242). Call over HTTP with an arc- API key.
    ARCREEL_BASE_URL: str = "http://127.0.0.1:1242"
    ARCREEL_API_KEY: str = ""
    ARCREEL_DIR: str = r"D:\ArcReel"  # same-host disk path → stream the finished mp4 directly

    # Bot PC (PC-B) remote power control — shared secret with tools/bot-pc-agent's
    # POST /power on that machine. Blank = reboot/shutdown disabled (fail-safe).
    AGENTAIOS_POWER_TOKEN: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
