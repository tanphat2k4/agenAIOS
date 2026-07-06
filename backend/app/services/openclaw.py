"""Bridge to OpenClaw — run its agents via the WSL CLI so the gateway delivers
the reply to Telegram. OpenClaw owns the bot, the chat binding, the Telegram
formatting, and the delivery/retry queue — we just trigger an agent turn.
"""

import json
import shlex
import subprocess

from app.core.config import settings


# Outbound deliveries MUST pin the right bot: without --reply-account the gateway
# falls back to the DEFAULT telegram account (@Anna_Kute_bot) — a music batch once
# landed in Diamond's chat (and strays hit the trading bot) because of this.
_ACCOUNT_OF = {
    "trading": "trading",
    "music-orchestrator": "music",
    "content-orchestrator": "content",
    "metals": "metals",
}


def send_agent(prompt: str, *, agent: str | None = None, deliver: bool = True, timeout: int = 300,
               account: str | None = None) -> tuple[str, bool]:
    """Run one OpenClaw agent turn (via WSL), optionally delivering the reply to
    Telegram. `agent` defaults to settings.OPENCLAW_AGENT; the delivery account is
    derived from the agent (see _ACCOUNT_OF) unless given. Returns (reply_text, delivered)."""
    if not settings.OPENCLAW_ENABLED:
        return "", False
    agent_name = agent or settings.OPENCLAW_AGENT
    account = account or _ACCOUNT_OF.get(agent_name)
    parts = [
        "openclaw agent",
        f"--agent {shlex.quote(agent_name)}",
        "--channel telegram",
        f"--to {shlex.quote(settings.OPENCLAW_TELEGRAM_CHAT)}",
        f"-m {shlex.quote(prompt)}",
        "--json",
        f"--timeout {int(timeout)}",
    ]
    if deliver:
        parts.append("--deliver")
        if account:
            parts.append(f"--reply-account {shlex.quote(account)}")
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
    out = (reply or "").strip()
    # OpenClaw emits the sentinel "NO_REPLY" when the agent chose not to answer. Treat it as
    # empty so callers fall back (e.g. the morning report builds its own 9Router briefing)
    # instead of posting the literal "NO_REPLY".
    if out.upper() == "NO_REPLY":
        out = ""
    return out, delivered
