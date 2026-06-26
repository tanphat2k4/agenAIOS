"""Thin bridge to the external TradingAgents-VN stack.

We DO NOT import or modify that project. We invoke its existing CLI
(``vn_cli.py``) as a subprocess — the exact entry point OpenClaw/Telegram
already uses — and capture its Vietnamese text output. Paths + interpreter
come from TRADINGAGENTS_* settings.

Commands (per vn_cli.py): analyze | snapshot | extras | macro | news
"""

import json
import os
import re
import subprocess

from app.core.config import settings

# ---- intent routing for the in-app trading chat (keyword-based, no LLM) ----
_STOP = {
    "GIA", "TIN", "TUC", "PHAN", "TICH", "KHOI", "NGOAI", "ROOM", "LAI", "SUAT",
    "MACRO", "VND", "USD", "RSI", "MACD", "CUA", "CHO", "NHE", "VOI", "NAO",
    "SAO", "BAO", "CAO", "EM", "ANH", "VND", "CK",  # CK = chứng khoán, not a ticker
    "SAGE", "MUA", "BAN", "GIU", "NEN",  # advisor name + buy/sell/hold verbs — never tickers
    "ROE", "ROA", "EPS", "NIM", "BVPS", "NAY", "PE", "PB",  # metric names + "nay" — never tickers
}

# Opinion / advice keywords — shared so the Sage agent can detect advice requests.
_OPINION_KW = (
    "hợp lý", "hop ly", "nên mua", "nen mua", "nên bán", "nen ban", "nên giữ", "nen giu",
    "có nên", "co nen", "giá nào", "gia nao", "vào giá", "vao gia", "định giá", "dinh gia",
    "đánh giá", "danh gia", "nhận định", "nhan dinh", "mục tiêu", "muc tieu", "vùng mua", "vung mua",
    "tư vấn", "tu van", "khuyến nghị", "khuyen nghi", "có ăn", "co an", "ôm", "bắt đáy", "bat day",
)


def is_opinion(text: str) -> bool:
    """True if the text asks for an opinion/recommendation (vs a raw-data request)."""
    t = text.lower()
    return any(k in t for k in _OPINION_KW)


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
    opinion = is_opinion(text)
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


# Live intraday quote via vnstock price_board — the EOD snapshot lacks today's
# in-session price, so this fills the "không có dữ liệu hôm nay" gap.
_REALTIME_SCRIPT = (
    "import json,warnings,io,contextlib,sys\n"
    "warnings.filterwarnings('ignore')\n"
    "tk=sys.argv[1]; buf=io.StringIO()\n"
    "try:\n"
    "    with contextlib.redirect_stdout(buf),contextlib.redirect_stderr(buf):\n"
    "        from vnstock import Trading\n"
    "        df=Trading(source='VCI').price_board([tk])\n"
    "    r=df.iloc[0]\n"
    "    def g(a,b):\n"
    "        try:\n"
    "            v=r[(a,b)]; return float(v) if v is not None else None\n"
    "        except Exception: return None\n"
    "    out={'match':g('match','match_price'),'ref':g('listing','ref_price'),'ceiling':g('listing','ceiling'),"
    "'floor':g('listing','floor'),'open':g('match','open_price'),'high':g('match','highest'),'low':g('match','lowest'),"
    "'vol':g('match','accumulated_volume'),'fbuy':g('match','foreign_buy_volume'),'fsell':g('match','foreign_sell_volume')}\n"
    "    print('JSON:'+json.dumps(out))\n"
    "except Exception as e: print('ERR:'+str(e)[:200])\n"
)


def realtime_quote(ticker: str) -> dict | None:
    """Live intraday quote (prices in thousands) via vnstock price_board, or None
    if unavailable (off-hours data issue / network). Robust: never raises."""
    if not settings.TRADINGAGENTS_ENABLED:
        return None
    ticker = ticker.upper()
    try:
        proc = subprocess.run(
            [settings.TRADINGAGENTS_PYTHON, "-c", _REALTIME_SCRIPT, ticker],
            cwd=settings.TRADINGAGENTS_CWD, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=45, env=_CLEAN_ENV,
        )
    except Exception:  # noqa: BLE001
        return None
    line = next((ln for ln in (proc.stdout or "").splitlines() if ln.startswith("JSON:")), None)
    if not line:
        return None
    try:
        d = json.loads(line[5:])
    except Exception:  # noqa: BLE001
        return None
    if not d.get("match") or not d.get("ref"):
        return None

    def thou(v: float | None) -> float | None:
        return round(v / 1000, 2) if v else None

    price, ref = thou(d["match"]), thou(d["ref"])
    change = round((price - ref) / ref * 100, 2) if price and ref else None
    return {
        "price": price, "ref": ref, "change": change,
        "open": thou(d.get("open")), "high": thou(d.get("high")), "low": thou(d.get("low")),
        "ceiling": thou(d.get("ceiling")), "floor": thou(d.get("floor")),
        "vol": int(d.get("vol") or 0), "foreign_net": int((d.get("fbuy") or 0) - (d.get("fsell") or 0)),
    }


# ---- fundamentals (P/E, P/B, ROE, ROA, EPS) via vnstock KBS — yearly, cached ----
# The KBS source returns clean year-labelled columns (VCI's are corrupt: all "2018").
_FUNDAMENTAL_SCRIPT = (
    "import json,warnings,io,contextlib,sys\n"
    "warnings.filterwarnings('ignore')\n"
    "tk=sys.argv[1]; buf=io.StringIO()\n"
    "try:\n"
    "    with contextlib.redirect_stdout(buf),contextlib.redirect_stderr(buf):\n"
    "        from vnstock import Finance\n"
    "        r=Finance(symbol=tk,source='KBS').ratio(period='year',lang='en')\n"
    "    cols=[str(c) for c in r.columns]\n"
    "    yrs=sorted([c for c in cols if 'Năm' in c])\n"
    "    latest=yrs[-1] if yrs else cols[-1]\n"
    "    want={'pe_ratio':'pe','pb_ratio':'pb','roe':'roe','roa':'roa','trailing_eps':'eps','net_interest_margin_ni':'nim','dividend_yield':'divy'}\n"
    "    out={'year':str(latest).split('-')[0]}\n"
    "    for _,row in r.iterrows():\n"
    "        iid=str(row.get('item_id',''))\n"
    "        if iid in want:\n"
    "            v=row.get(latest)\n"
    "            try: out[want[iid]]=round(float(v),2) if v==v else None\n"
    "            except Exception: out[want[iid]]=None\n"
    "    print('JSON:'+json.dumps(out))\n"
    "except Exception as e: print('ERR:'+str(e)[:200])\n"
)

_fund_cache: dict[str, dict] = {}  # ticker -> dict (stable intraday; cleared on restart)


def fundamentals(ticker: str) -> dict | None:
    """Latest-year fundamentals (pe, pb, roe, roa, eps, nim) via vnstock KBS, or None.
    Cached per-process (fundamentals don't change intraday). Never raises."""
    if not settings.TRADINGAGENTS_ENABLED:
        return None
    ticker = ticker.upper()
    if ticker in _fund_cache:
        return _fund_cache[ticker]
    try:
        proc = subprocess.run(
            [settings.TRADINGAGENTS_PYTHON, "-c", _FUNDAMENTAL_SCRIPT, ticker],
            cwd=settings.TRADINGAGENTS_CWD, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=60, env=_CLEAN_ENV,
        )
    except Exception:  # noqa: BLE001
        return None
    line = next((ln for ln in (proc.stdout or "").splitlines() if ln.startswith("JSON:")), None)
    if not line:
        return None
    try:
        d = json.loads(line[5:])
    except Exception:  # noqa: BLE001
        return None
    if d.get("pe") is None and d.get("roe") is None:
        return None
    _fund_cache[ticker] = d
    return d


def fundamentals_text(ticker: str) -> str:
    """One-line fundamentals summary, or '' if unavailable."""
    f = fundamentals(ticker)
    if not f:
        return ""
    parts = []
    if f.get("pe") is not None:
        parts.append(f"P/E {f['pe']}")
    if f.get("pb") is not None:
        parts.append(f"P/B {f['pb']}")
    if f.get("roe") is not None:
        parts.append(f"ROE {f['roe']}%")
    if f.get("roa") is not None:
        parts.append(f"ROA {f['roa']}%")
    if f.get("eps") is not None:
        parts.append(f"EPS {int(f['eps']):,}đ")
    if f.get("nim") is not None:
        parts.append(f"NIM {f['nim']}%")
    return (f"Cơ bản (năm {f.get('year', '?')}): " + " · ".join(parts)) if parts else ""


# ---- market overview (VN-Index) via vnstock ----
_VNINDEX_SCRIPT = (
    "import json,warnings,io,contextlib\n"
    "warnings.filterwarnings('ignore')\n"
    "buf=io.StringIO()\n"
    "try:\n"
    "    with contextlib.redirect_stdout(buf),contextlib.redirect_stderr(buf):\n"
    "        from vnstock import Quote\n"
    "        from datetime import date,timedelta\n"
    "        end=date.today().isoformat(); start=(date.today()-timedelta(days=20)).isoformat()\n"
    "        h=Quote(symbol='VNINDEX',source='VCI').history(start=start,end=end,interval='1D')\n"
    "    r=h.iloc[-1]; p=h.iloc[-2]\n"
    "    out={'close':round(float(r['close']),2),'prev':round(float(p['close']),2),"
    "'high':round(float(r['high']),2),'low':round(float(r['low']),2),'vol':int(r['volume'])}\n"
    "    print('JSON:'+json.dumps(out))\n"
    "except Exception as e: print('ERR:'+str(e)[:200])\n"
)

_mkt_cache: dict = {}  # {'t': epoch, 'd': dict} — short TTL


def market_overview() -> dict | None:
    """VN-Index latest close + change% (cached ~5 min), or None. Never raises."""
    if not settings.TRADINGAGENTS_ENABLED:
        return None
    import time as _t
    if _mkt_cache and _t.time() - _mkt_cache.get("t", 0) < 300:
        return _mkt_cache["d"]
    try:
        proc = subprocess.run(
            [settings.TRADINGAGENTS_PYTHON, "-c", _VNINDEX_SCRIPT],
            cwd=settings.TRADINGAGENTS_CWD, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=45, env=_CLEAN_ENV,
        )
    except Exception:  # noqa: BLE001
        return None
    line = next((ln for ln in (proc.stdout or "").splitlines() if ln.startswith("JSON:")), None)
    if not line:
        return None
    try:
        d = json.loads(line[5:])
    except Exception:  # noqa: BLE001
        return None
    if not d.get("close") or not d.get("prev"):
        return None
    d["change"] = round((d["close"] - d["prev"]) / d["prev"] * 100, 2)
    _mkt_cache.update(t=_t.time(), d=d)
    return d


def market_overview_text() -> str:
    """One-line VN-Index summary, or '' if unavailable."""
    m = market_overview()
    if not m:
        return ""
    chg = m.get("change", 0)
    arrow = "🔺" if chg > 0 else ("🔻" if chg < 0 else "▪")
    return f"VN-Index {m['close']:.2f} {arrow}{abs(chg)}% (cao {m['high']:.2f} · thấp {m['low']:.2f} · KL {m['vol'] / 1e6:.0f} triệu cp)"


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
