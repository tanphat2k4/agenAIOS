"""Bridge to OpenClaw — run its agents via the WSL CLI so the gateway delivers
the reply to Telegram. OpenClaw owns the bot, the chat binding, the Telegram
formatting, and the delivery/retry queue — we just trigger an agent turn.
"""

import json
import shlex
import subprocess

from app.core.config import settings


def send_agent(prompt: str, *, agent: str | None = None, deliver: bool = True, timeout: int = 300) -> tuple[str, bool]:
    """Run one OpenClaw agent turn (via WSL), optionally delivering the reply to
    Telegram. `agent` defaults to settings.OPENCLAW_AGENT. Returns (reply_text, delivered)."""
    if not settings.OPENCLAW_ENABLED:
        return "", False
    parts = [
        "openclaw agent",
        f"--agent {shlex.quote(agent or settings.OPENCLAW_AGENT)}",
        "--channel telegram",
        f"--to {shlex.quote(settings.OPENCLAW_TELEGRAM_CHAT)}",
        f"-m {shlex.quote(prompt)}",
        "--json",
        f"--timeout {int(timeout)}",
    ]
    if deliver:
        parts.append("--deliver")
    cmd = ["wsl.exe", "-e", "bash", "-lc", " ".join(parts) + " 2>/dev/null"]
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout + 60,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return "", False

    out = proc.stdout or ""
    i = out.find("{")
    if i < 0:
        return "", False
    try:
        data, _ = json.JSONDecoder().raw_decode(out[i:])
    except Exception:  # noqa: BLE001
        return "", False

    res = data.get("result") or {}
    meta = res.get("meta") or {}
    reply = meta.get("finalAssistantVisibleText") or ""
    if not reply:
        payloads = res.get("payloads") or []
        reply = payloads[0].get("text", "") if payloads else ""
    delivered = bool((res.get("deliveryStatus") or {}).get("succeeded"))
    return (reply or "").strip(), delivered
