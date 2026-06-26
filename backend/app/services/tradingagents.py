"""Thin bridge to the external TradingAgents-VN stack.

We DO NOT import or modify that project. We invoke its existing CLI
(``vn_cli.py``) as a subprocess — the exact entry point OpenClaw/Telegram
already uses — and capture its Vietnamese text output. Paths + interpreter
come from TRADINGAGENTS_* settings.

Commands (per vn_cli.py): analyze | snapshot | extras | macro | news
"""

import os
import re
import subprocess

from app.core.config import settings

# ---- intent routing for the in-app trading chat (keyword-based, no LLM) ----
_STOP = {
    "GIA", "TIN", "TUC", "PHAN", "TICH", "KHOI", "NGOAI", "ROOM", "LAI", "SUAT",
    "MACRO", "VND", "USD", "RSI", "MACD", "CUA", "CHO", "NHE", "VOI", "NAO",
    "SAO", "BAO", "CAO", "EM", "ANH", "VND",
}


def _extract_ticker(text: str) -> str | None:
    """Best-effort VN ticker from free text. Prefers ALL-CAPS 2-4 letter tokens."""
    caps = [c for c in re.findall(r"\b[A-Z]{2,4}\b", text) if c not in _STOP]
    if caps:
        return caps[-1]
    for tok in reversed(re.findall(r"\b[A-Za-z]{3,4}\b", text)):
        if tok.upper() not in _STOP:
            return tok.upper()
    return None


def classify(text: str) -> tuple[str | None, str | None]:
    """Return (command, ticker). command in {analyze,news,extras,macro,snapshot} or None (chat)."""
    t = text.lower()
    # Opinion / recommendation questions ("giá nào hợp lý", "nên mua không"…) must NOT dump
    # raw data — they go to the analyst (_llm_reply, grounded) which reasons + recommends.
    opinion = any(k in t for k in (
        "hợp lý", "hop ly", "nên mua", "nen mua", "nên bán", "nen ban", "nên giữ", "nen giu",
        "có nên", "co nen", "giá nào", "gia nao", "vào giá", "vao gia", "định giá", "dinh gia",
        "đánh giá", "danh gia", "nhận định", "nhan dinh", "mục tiêu", "muc tieu", "vùng mua", "vung mua",
    ))
    if any(k in t for k in ("phân tích", "phan tich", "khuyến nghị", "khuyen nghi", "analyze", "báo cáo", "bao cao")):
        cmd = "analyze"
    elif opinion:
        cmd = None  # conversational analyst → grounded recommendation, not a raw table
    elif any(k in t for k in ("tin tức", "tin tuc", "news", "tin ")):
        cmd = "news"
    elif any(k in t for k in ("khối ngoại", "khoi ngoai", "room", "thanh khoản", "thanh khoan")):
        cmd = "extras"
    elif any(k in t for k in ("tỷ giá", "ty gia", "lãi suất", "lai suat", "vĩ mô", "vi mo", "macro", "usd/vnd")):
        cmd = "macro"
    elif any(k in t for k in ("snapshot", "ohlc", "dữ liệu", "du lieu", "chỉ báo", "chi bao", "bảng giá", "bang gia")):
        cmd = "snapshot"  # explicit raw-data request only — bare "giá"/price questions go to the analyst
    else:
        cmd = None
    return cmd, (None if cmd == "macro" else _extract_ticker(text))

# The CLI prints UTF-8 (Vietnamese). Strip venv vars so the system Python that
# has vnstock/tradingagents is used, not the backend's venv.
_CLEAN_ENV = {k: v for k, v in os.environ.items() if k not in ("VIRTUAL_ENV", "PYTHONHOME", "PYTHONPATH")}


def _run(args: list[str], timeout: int) -> str:
    if not settings.TRADINGAGENTS_ENABLED:
        return "Tích hợp TradingAgents đang tắt (TRADINGAGENTS_ENABLED=false)."
    try:
        proc = subprocess.run(
            [settings.TRADINGAGENTS_PYTHON, settings.TRADINGAGENTS_CLI, *args],
            cwd=settings.TRADINGAGENTS_CWD,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            env=_CLEAN_ENV,
        )
    except subprocess.TimeoutExpired:
        return f"Hết thời gian chờ ({timeout}s) — pipeline có thể đang chạy nặng."
    except FileNotFoundError:
        return "Không tìm thấy Python hoặc vn_cli.py của TradingAgents (kiểm tra TRADINGAGENTS_* trong backend/.env)."
    out = (proc.stdout or "").strip()
    if not out:
        err = (proc.stderr or "").strip()
        return ("Lỗi TradingAgents: " + err[-600:]) if err else "(không có kết quả)"
    return out


def snapshot(ticker: str) -> str:
    return _run(["snapshot", ticker], timeout=150)


def news(ticker: str, days: int = 7) -> str:
    return _run(["news", ticker, str(days)], timeout=150)


def extras(ticker: str) -> str:
    return _run(["extras", ticker], timeout=150)


def macro() -> str:
    return _run(["macro"], timeout=150)


def analyze(ticker: str, trade_date: str | None = None) -> str:
    """Full multi-agent analysis (slow, minutes; cached per ticker+date by the CLI)."""
    args = ["analyze", ticker] + ([trade_date] if trade_date else [])
    return _run(args, timeout=900)


def healthcheck() -> tuple[bool, str]:
    """Real, fast check: the configured Python can import the TradingAgents deps."""
    if not settings.TRADINGAGENTS_ENABLED:
        return False, "TRADINGAGENTS_ENABLED=false"
    try:
        proc = subprocess.run(
            [settings.TRADINGAGENTS_PYTHON, "-c", "import vnstock, tradingagents; print('ok')"],
            cwd=settings.TRADINGAGENTS_CWD, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=40, env=_CLEAN_ENV,
        )
    except subprocess.TimeoutExpired:
        return False, "healthcheck quá hạn (>40s)"
    except FileNotFoundError:
        return False, "không tìm thấy Python của TradingAgents (kiểm tra TRADINGAGENTS_PYTHON)"
    if proc.returncode == 0 and "ok" in (proc.stdout or ""):
        return True, "vnstock + tradingagents import OK"
    return False, (proc.stderr or proc.stdout or "import lỗi").strip()[-200:]
