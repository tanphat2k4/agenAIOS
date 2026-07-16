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
import time

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
    "    want={'pe_ratio':'pe','pb_ratio':'pb','roe':'roe','roa':'roa','trailing_eps':'eps','book_value_per_share_b':'bvps','net_interest_margin_ni':'nim','dividend_yield':'divy'}\n"
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


def fundamentals_text(ticker: str, price: float | None = None) -> str:
    """One-line fundamentals summary. If `price` (live, in thousands) is given, P/E & P/B are
    computed LIVE from it (price×1000 / EPS or BVPS); otherwise the reported annual ratios."""
    f = fundamentals(ticker)
    if not f:
        return ""
    live = bool(price and price > 0)
    parts = []
    if live and f.get("eps"):
        parts.append(f"P/E {round(price * 1000 / f['eps'], 2)} (live)")
    elif f.get("pe") is not None:
        parts.append(f"P/E {f['pe']}")
    if live and f.get("bvps"):
        parts.append(f"P/B {round(price * 1000 / f['bvps'], 2)} (live)")
    elif f.get("pb") is not None:
        parts.append(f"P/B {f['pb']}")
    if f.get("roe") is not None:
        parts.append(f"ROE {f['roe']}%")
    if f.get("roa") is not None:
        parts.append(f"ROA {f['roa']}%")
    if f.get("eps") is not None:
        parts.append(f"EPS {int(f['eps']):,}đ")
    if f.get("nim") is not None:
        parts.append(f"NIM {f['nim']}%")
    base = "Cơ bản" if live else f"Cơ bản (năm {f.get('year', '?')})"
    return (f"{base}: " + " · ".join(parts)) if parts else ""


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


# ---- watchlist screening ("nên mua mã nào") — one price_board call + parallel fundamentals ----
SCREEN_LIST = ["FPT", "VCB", "HPG", "VNM", "MWG", "SSI", "VHM", "VIB", "TCB", "MBB"]

_PRICEBOARD_SCRIPT = (
    "import json,warnings,io,contextlib,sys\n"
    "warnings.filterwarnings('ignore')\n"
    "tks=sys.argv[1].split(','); buf=io.StringIO()\n"
    "try:\n"
    "    with contextlib.redirect_stdout(buf),contextlib.redirect_stderr(buf):\n"
    "        from vnstock import Trading\n"
    "        pb=Trading(source='VCI').price_board(tks)\n"
    "    def g(r,a,b):\n"
    "        try:\n"
    "            v=r[(a,b)]; return float(v) if v==v and v is not None else None\n"
    "        except Exception: return None\n"
    "    out={}\n"
    "    for i in range(len(pb)):\n"
    "        r=pb.iloc[i]\n"
    "        try: tk=str(r[('listing','symbol')])\n"
    "        except Exception: tk=tks[i] if i<len(tks) else str(i)\n"
    "        m=g(r,'match','match_price'); ref=g(r,'listing','ref_price')\n"
    "        ce=g(r,'listing','ceiling'); fl=g(r,'listing','floor')\n"
    "        fb=g(r,'match','foreign_buy_volume') or 0; fs=g(r,'match','foreign_sell_volume') or 0\n"
    "        out[tk]={'price':round(m/1000,2) if m else None,'change':round((m-ref)/ref*100,2) if m and ref else None,"
    "'ref':round(ref/1000,2) if ref else None,'ceiling':round(ce/1000,2) if ce else None,'floor':round(fl/1000,2) if fl else None,"
    "'vol':int(g(r,'match','accumulated_volume') or 0),'foreign_net':int(fb-fs)}\n"
    "    print('JSON:'+json.dumps(out))\n"
    "except Exception as e: print('ERR:'+str(e)[:200])\n"
)


_PB_CACHE: dict = {}     # {ticker: (epoch, quote)} — subprocess+vnstock mất 2-30s/lần gọi
_PB_TTL = 20.0           # trong 20s: dùng thẳng (reload/Lưu liên tiếp = 0 subprocess)
_PB_STALE_OK = 600.0     # 20s-10ph: trả giá cũ NGAY + làm tươi ở NỀN (mở trang không bao giờ ì)
_PB_INFLIGHT: set = set()  # chống 2 luồng cùng fetch một rổ mã


def _pb_fetch(tickers: list[str], wait_if_busy: bool = False) -> dict:
    """Blocking fetch 1 call gộp + đổ cache. Dùng bởi cả đường chính lẫn refresh nền.
    wait_if_busy (nút ⟳): nếu đúng rổ mã này đang được luồng khác fetch thì ĐỢI nó xong
    rồi lấy kết quả từ cache (cũng là giá vừa khớp) — không lặng lẽ trả rỗng."""
    key = ",".join(sorted(tickers))
    if key in _PB_INFLIGHT:
        if not wait_if_busy:
            return {}
        for _ in range(300):  # tối đa ~60s, khớp timeout subprocess
            time.sleep(0.2)
            if key not in _PB_INFLIGHT:
                break
        return {t: _PB_CACHE[t][1] for t in tickers if t in _PB_CACHE}
    _PB_INFLIGHT.add(key)
    try:
        proc = subprocess.run(
            [settings.TRADINGAGENTS_PYTHON, "-c", _PRICEBOARD_SCRIPT, ",".join(tickers)],
            cwd=settings.TRADINGAGENTS_CWD, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=60, env=_CLEAN_ENV,
        )
        line = next((ln for ln in (proc.stdout or "").splitlines() if ln.startswith("JSON:")), None)
        out = json.loads(line[5:]) if line else {}
    except Exception:  # noqa: BLE001
        out = {}
    finally:
        _PB_INFLIGHT.discard(key)
    now = time.time()
    for t, q in out.items():
        _PB_CACHE[t] = (now, q)
    return out


def _price_board_batch(tickers: list[str], fresh: bool = False) -> dict:
    """All tickers' live quote → {ticker: {price,change,vol,foreign_net}}.
    Per-ticker cache: <20s dùng thẳng; 20s-10ph trả NGAY giá cũ + refresh nền
    (stale-while-revalidate); chỉ mã CHƯA TỪNG có mới phải chờ subprocess.
    fresh=True (nút ⟳): bỏ qua cache, CHỜ giá khớp mới nhất (~5-10s)."""
    if not settings.TRADINGAGENTS_ENABLED or not tickers:
        return {}
    if fresh:
        out = _pb_fetch(sorted(set(tickers)), wait_if_busy=True)
        # mã nào fetch lỗi thì đành trả giá cache cũ (còn hơn trống)
        res = {}
        for t in tickers:
            q = out.get(t) or (_PB_CACHE.get(t) or (0.0, {}))[1]
            if q:
                res[t] = q
        return res
    import threading as _th

    now = time.time()
    fresh, stale, missing = {}, {}, []
    for t in tickers:
        hit = _PB_CACHE.get(t)
        age = (now - hit[0]) if hit else None
        if age is not None and age < _PB_TTL:
            fresh[t] = hit[1]
        elif age is not None and age < _PB_STALE_OK:
            stale[t] = hit[1]
        else:
            missing.append(t)
    if not missing:
        if stale:  # đủ dữ liệu hiển thị → trả ngay, làm tươi sau
            _th.Thread(target=_pb_fetch, args=(sorted(set(tickers)),), daemon=True).start()
        return {**stale, **fresh}
    out = _pb_fetch(sorted(set(missing) | set(stale)))  # mã chưa từng có → đành chờ 1 lần
    return {**stale, **fresh, **{t: q for t, q in out.items() if t in tickers}}


def screen_watchlist(tickers: list[str] | None = None) -> list[dict]:
    """Screen the watchlist: live quote (1 call) + fundamentals (parallel, cached) per ticker.
    Returns [{ticker, price, change, vol, foreign_net, pe, roe}, ...]. Never raises."""
    tickers = tickers or SCREEN_LIST
    quotes = _price_board_batch(tickers)
    valid = [tk for tk in tickers if quotes.get(tk) and quotes[tk].get("price") is not None]
    funds: dict = {}
    if valid:
        from concurrent.futures import ThreadPoolExecutor
        try:
            with ThreadPoolExecutor(max_workers=6) as ex:
                funds = dict(zip(valid, ex.map(lambda t: fundamentals(t) or {}, valid)))
        except Exception:  # noqa: BLE001
            funds = {}
    return [
        {"ticker": tk, **quotes[tk], "pe": funds.get(tk, {}).get("pe"), "roe": funds.get(tk, {}).get("roe")}
        for tk in valid
    ]


# ---- whole-market screen (toàn sàn HOSE + ngành + RSI/SMA) ----
_HOSE_UNIVERSE_SCRIPT = (
    "import json,warnings,io,contextlib\n"
    "warnings.filterwarnings('ignore')\n"
    "buf=io.StringIO()\n"
    "try:\n"
    "    with contextlib.redirect_stdout(buf),contextlib.redirect_stderr(buf):\n"
    "        from vnstock import Listing\n"
    "        bx=Listing().symbols_by_exchange(); ind=Listing().symbols_by_industries()\n"
    "    hose=bx[(bx['exchange']=='HOSE') & (bx['type']=='stock')]['symbol'].tolist()\n"
    "    im=dict(zip(ind['symbol'], ind['industry_name']))\n"
    "    print('JSON:'+json.dumps({s: im.get(s,'Khác') for s in hose}, ensure_ascii=False))\n"
    "except Exception as e: print('ERR:'+str(e)[:200])\n"
)

_INDICATORS_SCRIPT = (
    "import json,warnings,io,contextlib,sys\n"
    "warnings.filterwarnings('ignore')\n"
    "tk=sys.argv[1]; buf=io.StringIO()\n"
    "try:\n"
    "    with contextlib.redirect_stdout(buf),contextlib.redirect_stderr(buf):\n"
    "        from vnstock import Quote\n"
    "        from datetime import date,timedelta\n"
    "        end=date.today().isoformat(); start=(date.today()-timedelta(days=420)).isoformat()\n"
    "        h=Quote(symbol=tk,source='VCI').history(start=start,end=end,interval='1D')\n"
    "    c=h['close']\n"
    "    if str(h['time'].iloc[-1])[:10]==end: c=c.iloc[:-1]\n"   # drop today's incomplete bar → match snapshot
    "    if len(c)<20: print('ERR:short'); sys.exit()\n"
    "    d=c.diff(); g=d.clip(lower=0).ewm(alpha=1/14,adjust=False).mean(); l=(-d.clip(upper=0)).ewm(alpha=1/14,adjust=False).mean()\n"
    "    rsi=100-100/(1+g/l)\n"
    "    out={'rsi':round(float(rsi.iloc[-1]),1),'sma50':round(float(c.tail(50).mean()),2),'sma200':round(float(c.tail(200).mean()),2) if len(c)>=200 else None}\n"
    "    print('JSON:'+json.dumps(out))\n"
    "except Exception as e: print('ERR:'+str(e)[:200])\n"
)

_universe_cache: dict = {}


def _hose_universe() -> dict:
    """{symbol: industry_name} for HOSE stocks, cached per-process (stable intraday)."""
    if _universe_cache:
        return _universe_cache
    if not settings.TRADINGAGENTS_ENABLED:
        return {}
    try:
        proc = subprocess.run([settings.TRADINGAGENTS_PYTHON, "-c", _HOSE_UNIVERSE_SCRIPT],
                              cwd=settings.TRADINGAGENTS_CWD, capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=60, env=_CLEAN_ENV)
    except Exception:  # noqa: BLE001
        return {}
    line = next((ln for ln in (proc.stdout or "").splitlines() if ln.startswith("JSON:")), None)
    try:
        _universe_cache.update(json.loads(line[5:]) if line else {})
    except Exception:  # noqa: BLE001
        return {}
    return _universe_cache


def indicators(ticker: str) -> dict | None:
    """RSI(14, Wilder) + SMA50/SMA200 to the last CLOSED session (matches the snapshot), or None."""
    if not settings.TRADINGAGENTS_ENABLED:
        return None
    try:
        proc = subprocess.run([settings.TRADINGAGENTS_PYTHON, "-c", _INDICATORS_SCRIPT, ticker.upper()],
                              cwd=settings.TRADINGAGENTS_CWD, capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=45, env=_CLEAN_ENV)
    except Exception:  # noqa: BLE001
        return None
    line = next((ln for ln in (proc.stdout or "").splitlines() if ln.startswith("JSON:")), None)
    try:
        return json.loads(line[5:]) if line else None
    except Exception:  # noqa: BLE001
        return None


_TECH_SCRIPT = (
    "import json,warnings,io,contextlib,sys\n"
    "warnings.filterwarnings('ignore')\n"
    "tk=sys.argv[1]; buf=io.StringIO()\n"
    "try:\n"
    "    with contextlib.redirect_stdout(buf),contextlib.redirect_stderr(buf):\n"
    "        from vnstock import Quote\n"
    "        from datetime import date,timedelta\n"
    "        end=date.today().isoformat(); start=(date.today()-timedelta(days=560)).isoformat()\n"
    "        h=Quote(symbol=tk,source='VCI').history(start=start,end=end,interval='1D')\n"
    "    c=h['close'].astype(float); hi=h['high'].astype(float)\n"
    "    if str(h['time'].iloc[-1])[:10]==end: c=c.iloc[:-1]; hi=hi.iloc[:-1]\n"
    "    if len(c)<60: print('ERR:short'); sys.exit()\n"
    "    dd=c.diff(); g=dd.clip(lower=0).ewm(alpha=1/14,adjust=False).mean(); l=(-dd.clip(upper=0)).ewm(alpha=1/14,adjust=False).mean()\n"
    "    rsi=float((100-100/(1+g/l)).iloc[-1])\n"
    "    sma50=float(c.tail(50).mean()); sma200=float(c.tail(200).mean()) if len(c)>=200 else None\n"
    "    ema12=c.ewm(span=12,adjust=False).mean(); ema26=c.ewm(span=26,adjust=False).mean(); macd=float((ema12-ema26).iloc[-1])\n"
    "    cur=float(c.iloc[-1]); w=c.tail(250); hi52=float(w.max()); lo52=float(w.min())\n"
    "    breakout=bool(cur>float(hi.iloc[-21:-1].max())) if len(hi)>21 else False\n"
    "    trend='tăng' if c.tail(10).mean()>c.iloc[-20:-10].mean() else 'giảm'\n"
    "    s50=c.rolling(50).mean(); inpos=(c>s50).shift(1).fillna(False); dr=c.pct_change().fillna(0)\n"
    "    strat=float((1+dr[inpos]).prod()-1); bh=float(c.iloc[-1]/c.iloc[0]-1); trades=int(((inpos)&(~inpos.shift(1).fillna(False))).sum())\n"
    "    out={'rsi':round(rsi,1),'sma50':round(sma50,2),'sma200':round(sma200,2) if sma200 else None,'macd':round(macd,3),'price':round(cur,2),"
    "'near_high':round((cur-hi52)/hi52*100,1),'near_low':round((cur-lo52)/lo52*100,1),'breakout':breakout,'trend20':trend,"
    "'bt_strat':round(strat*100,1),'bt_bh':round(bh*100,1),'bt_trades':trades,'bt_days':len(c)}\n"
    "    print('JSON:'+json.dumps(out))\n"
    "except Exception as e: print('ERR:'+str(e)[:200])\n"
)


def tech_analysis(ticker: str) -> dict | None:
    """Full technical read from history (1 fetch): RSI(Wilder)/SMA50/200/MACD + pattern
    (trend, 52w high/low, breakout) + SMA50-cross backtest vs buy&hold. None on failure."""
    if not settings.TRADINGAGENTS_ENABLED:
        return None
    try:
        proc = subprocess.run([settings.TRADINGAGENTS_PYTHON, "-c", _TECH_SCRIPT, ticker.upper()],
                              cwd=settings.TRADINGAGENTS_CWD, capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=45, env=_CLEAN_ENV)
    except Exception:  # noqa: BLE001
        return None
    line = next((ln for ln in (proc.stdout or "").splitlines() if ln.startswith("JSON:")), None)
    try:
        return json.loads(line[5:]) if line else None
    except Exception:  # noqa: BLE001
        return None


def tech_text(t: dict) -> str:
    """Technical-analysis line for the Technical agent."""
    if not t:
        return ""
    cur, s50, s200 = t.get("price"), t.get("sma50"), t.get("sma200")
    pos = []
    if cur and s50:
        pos.append("trên SMA50" if cur > s50 else "dưới SMA50")
    if cur and s200:
        pos.append("trên SMA200" if cur > s200 else "dưới SMA200")
    bits = [f"RSI {t.get('rsi')}", f"MACD {t.get('macd')}", f"SMA50 {s50}", f"SMA200 {s200}"]
    extra = [f"xu hướng 20 phiên: {t.get('trend20')}", f"cách đỉnh 52w {t.get('near_high')}%", f"cách đáy 52w {t.get('near_low'):+}%"]
    if t.get("breakout"):
        extra.append("VỪA breakout đỉnh 20 phiên")
    return " · ".join(bits + pos) + " · " + " · ".join(extra)


def backtest_text(t: dict) -> str:
    """Backtest summary line for the Backtest step."""
    if not t or t.get("bt_strat") is None:
        return ""
    verdict = "trend-following ăn hơn mua&giữ" if t["bt_strat"] > t["bt_bh"] else "mua&giữ ăn hơn trend-following (cổ phiếu đi ngang/khó lướt)"
    return (f"Backtest SMA50-cross {t['bt_days']} phiên: chiến lược {t['bt_strat']:+}% vs mua&giữ {t['bt_bh']:+}% "
            f"({t['bt_trades']} lần vào lệnh) → {verdict}")


def market_screen(top_n: int = 16, min_vol: int = 300_000) -> dict:
    """Screen the WHOLE HOSE board: 1 price_board call → liquid filter + first-pass rank
    (momentum + foreign flow) → sector ranking → top-N finalists enriched with live P/E + RSI/SMA
    (parallel). Returns {sectors, weakSectors, finalists, nLiquid}. Never raises."""
    uni = _hose_universe()
    if not uni:
        return {}
    quotes = _price_board_batch(list(uni.keys()))
    rows = []
    for tk, q in quotes.items():
        if not q.get("price") or (q.get("vol") or 0) < min_vol:
            continue
        score = (q.get("change") or 0) + (q.get("foreign_net") or 0) / 500_000.0
        rows.append({"ticker": tk, "industry": uni.get(tk, "Khác"), **q, "score": round(score, 2)})
    if not rows:
        return {}
    rows.sort(key=lambda r: r["score"], reverse=True)
    # sectors: avg change + total foreign per industry (≥2 mã)
    sec: dict = {}
    for r in rows:
        s = sec.setdefault(r["industry"], {"industry": r["industry"], "n": 0, "chg": 0.0, "fnet": 0})
        s["n"] += 1
        s["chg"] += r.get("change") or 0
        s["fnet"] += r.get("foreign_net") or 0
    sectors = sorted(
        ({"industry": s["industry"], "avgChange": round(s["chg"] / s["n"], 2), "foreignNet": s["fnet"], "n": s["n"]}
         for s in sec.values() if s["n"] >= 2),
        key=lambda x: x["avgChange"], reverse=True,
    )
    # finalists: top-N by first-pass score → enrich with live P/E + RSI/SMA (parallel)
    from concurrent.futures import ThreadPoolExecutor

    def _enrich(r: dict) -> dict:
        f = fundamentals(r["ticker"]) or {}
        ind = indicators(r["ticker"]) or {}
        live_pe = round(r["price"] * 1000 / f["eps"], 2) if r.get("price") and f.get("eps") else f.get("pe")
        return {**r, "pe": live_pe, "roe": f.get("roe"), "rsi": ind.get("rsi"), "sma50": ind.get("sma50"), "sma200": ind.get("sma200")}

    try:
        with ThreadPoolExecutor(max_workers=8) as ex:
            finalists = list(ex.map(_enrich, rows[:top_n]))
    except Exception:  # noqa: BLE001
        finalists = rows[:top_n]
    return {"sectors": sectors[:6], "weakSectors": sectors[-3:], "finalists": finalists, "nLiquid": len(rows)}


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
