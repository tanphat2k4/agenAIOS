"""Gold & silver (vàng – bạc) data layer — P1 of the metals pipeline.

Domestic prices come from the vnstock library (SJC gold + BTMC feed, which also
carries Phú Quý SILVER bars) run in the SYSTEM python — the same interpreter the
stock pipeline / vn_cli.py uses; the backend venv does NOT have vnstock. World
spot + macro come from the Yahoo Finance chart API (no key needed).

Everything is cached ~60s per process and degrades gracefully to partial data:
every consumer must handle missing fields ("không đủ dữ liệu" beats a made-up number).
"""
import json
import os
import subprocess
import time as _t

import httpx

from app.core.config import settings

# Strip venv vars so the system Python that has vnstock is used (mirror tradingagents.py).
_CLEAN_ENV = {k: v for k, v in os.environ.items() if k not in ("VIRTUAL_ENV", "PYTHONHOME", "PYTHONPATH")}

OZ_PER_LUONG = 1.20565   # 1 lượng = 37.5g = 1.20565 troy oz
OZ_PER_KG = 32.1507      # troy oz per kilogram

_DOMESTIC_SCRIPT = r"""
import json, warnings
warnings.filterwarnings("ignore")
out = {"sjc": [], "btmc_gold": [], "silver": []}
try:
    from vnstock.explorer.misc.gold_price import sjc_gold_price
    for r in sjc_gold_price().to_dict("records"):
        out["sjc"].append({"name": str(r.get("name", "")), "branch": str(r.get("branch", "")),
                           "buy": float(r.get("buy_price") or 0), "sell": float(r.get("sell_price") or 0)})
except Exception as e:  # noqa: BLE001
    out["sjc_err"] = str(e)[:150]
try:
    from vnstock.explorer.misc.gold_price import btmc_goldprice
    for r in btmc_goldprice().to_dict("records"):
        name = str(r.get("name", ""))
        row = {"name": name,
               "buy": float(str(r.get("buy_price") or 0).replace(",", "") or 0),
               "sell": float(str(r.get("sell_price") or 0).replace(",", "") or 0),
               "time": str(r.get("time", ""))}
        target = "silver" if ("BẠC" in name.upper() or "SILVER" in name.upper()) else "btmc_gold"
        out[target].append(row)
except Exception as e:  # noqa: BLE001
    out["btmc_err"] = str(e)[:150]
print(json.dumps(out, ensure_ascii=False))
"""

_YAHOO_SYMBOLS = {
    "GC=F": "gold_usd",      # COMEX gold futures $/oz
    "SI=F": "silver_usd",    # COMEX silver futures $/oz
    "USDVND=X": "usd_vnd",
    "DX-Y.NYB": "dxy",
    "^TNX": "us10y",
}


def _domestic() -> dict:
    """SJC + BTMC (incl. Phú Quý silver) via vnstock in the system python."""
    try:
        proc = subprocess.run(
            [settings.TRADINGAGENTS_PYTHON, "-c", _DOMESTIC_SCRIPT],
            cwd=settings.TRADINGAGENTS_CWD, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=90, env=_CLEAN_ENV,
        )
        line = (proc.stdout or "").strip().splitlines()
        return json.loads(line[-1]) if line else {}
    except Exception:  # noqa: BLE001
        return {}


def _world() -> dict:
    """Spot/macro from Yahoo chart API — best-effort per symbol."""
    out: dict = {}
    try:
        with httpx.Client(timeout=8, headers={"User-Agent": "Mozilla/5.0"}) as client:
            for sym, key in _YAHOO_SYMBOLS.items():
                try:
                    j = client.get(
                        f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}",
                        params={"range": "1d", "interval": "1d"},
                    ).json()
                    meta = j["chart"]["result"][0]["meta"]
                    out[key] = {"price": meta.get("regularMarketPrice"),
                                "prev": meta.get("chartPreviousClose") or meta.get("previousClose")}
                except Exception:  # noqa: BLE001
                    continue
    except Exception:  # noqa: BLE001
        pass
    return out


_cache: dict = {}
_LAST_SILVER: dict = {}  # last silver row seen — the BTMC feed is intermittent about silver


def snapshot(max_age: float = 60.0) -> dict:
    """Combined domestic + world + derived premium/ratio. Cached per process."""
    if _cache and _t.time() - _cache.get("t", 0) < max_age:
        return _cache["d"]
    dom, wld = _domestic(), _world()

    sjc_rows = dom.get("sjc") or []
    btmc_rows = dom.get("btmc_gold") or []
    bar = next((r for r in sjc_rows if "1L" in r["name"] or "MIẾNG" in r["name"].upper()), sjc_rows[0] if sjc_rows else None)
    # the SJC feed sometimes only carries bar rows — fall back to BTMC's ring row
    ring = next((r for r in sjc_rows if "NHẪN" in r["name"].upper()), None) \
        or next((r for r in btmc_rows if "NHẪN" in r["name"].upper()), None)
    silver_rows = dom.get("silver") or []
    silver = next((r for r in silver_rows if "1 KG" in r["name"].upper() or "1KG" in r["name"].upper()),
                  silver_rows[0] if silver_rows else None)
    # the BTMC feed drops its silver rows on and off — keep the last good quote (it carries
    # its own BTMC timestamp in row["time"]) and flag it stale so the card can say so
    silver_stale = False
    if silver:
        _LAST_SILVER["row"] = silver
    elif _LAST_SILVER.get("row"):
        silver, silver_stale = _LAST_SILVER["row"], True

    gold_usd = (wld.get("gold_usd") or {}).get("price")
    silver_usd = (wld.get("silver_usd") or {}).get("price")
    usd_vnd = (wld.get("usd_vnd") or {}).get("price")

    def _chg(key: str) -> float | None:
        cur, prev = (wld.get(key) or {}).get("price"), (wld.get(key) or {}).get("prev")
        return round((cur - prev) / prev * 100, 2) if cur and prev else None

    world_luong_vnd = gold_usd * usd_vnd * OZ_PER_LUONG if gold_usd and usd_vnd else None
    premium_pct = None
    if world_luong_vnd and bar and bar.get("sell"):
        premium_pct = round((bar["sell"] - world_luong_vnd) / world_luong_vnd * 100, 1)

    silver_world_kg_vnd = silver_usd * usd_vnd * OZ_PER_KG if silver_usd and usd_vnd else None
    silver_premium_pct = None
    if silver_world_kg_vnd and silver and silver.get("sell"):
        silver_premium_pct = round((silver["sell"] - silver_world_kg_vnd) / silver_world_kg_vnd * 100, 1)

    d = {
        "sjc_bar": bar, "sjc_ring": ring, "silver": silver,
        "btmc_gold": (dom.get("btmc_gold") or [])[:4],
        "gold_usd": gold_usd, "silver_usd": silver_usd, "usd_vnd": usd_vnd,
        "gold_chg_pct": _chg("gold_usd"), "silver_chg_pct": _chg("silver_usd"),
        "dxy": (wld.get("dxy") or {}).get("price"), "us10y": (wld.get("us10y") or {}).get("price"),
        "world_luong_vnd": world_luong_vnd, "premium_pct": premium_pct,
        "silver_world_kg_vnd": silver_world_kg_vnd, "silver_premium_pct": silver_premium_pct,
        "silver_stale": silver_stale,
        "gold_silver_ratio": round(gold_usd / silver_usd, 1) if gold_usd and silver_usd else None,
        "errors": {k: v for k, v in dom.items() if k.endswith("_err")},
    }
    _cache.update(t=_t.time(), d=d)
    return d


def _tr(v: float | None) -> str:
    """VND → 'triệu' with 2 decimals."""
    return f"{v / 1e6:,.2f}" if v else "—"


def unit_conversion_line(snap: dict | None, asset: str | None, question_lower: str) -> str:
    """Deterministic unit conversion when the question asks for one — 'bạc 1 lượng bao nhiêu?'
    → '💡 Bạc 1 lượng (37,5g): ≈ 2.36 – 2.43 tr (mua–bán)'. Empty string when no unit is asked.
    Silver is quoted per KG, gold per LƯỢNG — everything derives from those.
    """
    import re as _re

    q = question_lower
    for phrase in ("khối lượng", "trọng lượng", "số lượng", "dung lượng", "lưu lượng", "khoi luong", "so luong"):
        q = q.replace(phrase, " ")  # "lượng" as part of these words is NOT the unit
    unit = None
    if _re.search(r"lượng|\bluong\b|\bcây\b|\bcay\b", q):
        unit = "lượng"
    elif _re.search(r"(\d+|một|mot|mấy|may|nửa|nua)\s*chỉ|chỉ vàng|/chỉ|\bchi vang\b", q):
        unit = "chỉ"
    elif _re.search(r"\bgram\b|\bgam\b|\bgr\b", q):
        unit = "gram"
    elif _re.search(r"\boz\b|ounce", q):
        unit = "oz"
    elif _re.search(r"\bkg\b|\bký\b|\bky\b|kilo", q):
        unit = "kg"
    if not unit:
        return ""
    s = snap or snapshot()
    per_kg = {"lượng": 0.0375, "chỉ": 0.00375, "gram": 0.001, "oz": 0.0311034768, "kg": 1.0}[unit]
    per_luong = {"lượng": 1.0, "chỉ": 0.1, "gram": 1 / 37.5, "oz": 1 / 1.20565, "kg": 1000 / 37.5}[unit]
    label = {"lượng": "1 lượng (37,5g)", "chỉ": "1 chỉ (3,75g)", "gram": "1 gram",
             "oz": "1 oz (31,1g)", "kg": "1 kg"}[unit]

    def fmt(v: float) -> str:
        return f"{v / 1e6:,.2f} tr" if v >= 1e5 else f"{v / 1e3:,.0f}k"

    out: list[str] = []
    sil, bar = s.get("silver"), s.get("sjc_bar")
    if asset in (None, "silver") and unit != "kg":  # kg = native silver unit
        if sil and sil.get("buy"):
            out.append(f"💡 Bạc {label}: ≈ **{fmt(sil['buy'] * per_kg)} – {fmt(sil['sell'] * per_kg)}** (mua–bán)")
        elif s.get("silver_world_kg_vnd"):
            out.append(f"💡 Bạc {label}: ≈ **{fmt(s['silver_world_kg_vnd'] * per_kg)}** (theo giá TG quy đổi)")
    if asset in (None, "gold") and bar and bar.get("buy") and unit != "lượng":  # lượng = native gold unit
        out.append(f"💡 Vàng SJC {label}: ≈ **{fmt(bar['buy'] * per_luong)} – {fmt(bar['sell'] * per_luong)}** (mua–bán)")
    return "\n".join(out)


# ---------------------------------------------------------------- P2: history / indicators / news
_hist_cache: dict = {}


def history(symbol: str, rng: str = "1y") -> list[float]:
    """Daily closes from Yahoo (cache 10 min). Empty list on failure."""
    key = f"{symbol}:{rng}"
    hit = _hist_cache.get(key)
    if hit and _t.time() - hit["t"] < 600:
        return hit["d"]
    closes: list[float] = []
    try:
        with httpx.Client(timeout=10, headers={"User-Agent": "Mozilla/5.0"}) as client:
            j = client.get(f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
                           params={"range": rng, "interval": "1d"}).json()
            raw = j["chart"]["result"][0]["indicators"]["quote"][0]["close"]
            closes = [float(c) for c in raw if c is not None]
    except Exception:  # noqa: BLE001
        pass
    _hist_cache[key] = {"t": _t.time(), "d": closes}
    return closes


def _ema(vals: list[float], n: int) -> list[float]:
    if not vals:
        return []
    k, out = 2 / (n + 1), [vals[0]]
    for v in vals[1:]:
        out.append(v * k + out[-1] * (1 - k))
    return out


def indicators(symbol: str) -> dict:
    """Wilder RSI(14), MACD(12,26,9), SMA50/200 on daily closes — pure python, no pandas."""
    closes = history(symbol)
    if len(closes) < 60:
        return {}
    gains, losses = [], []
    for a, b in zip(closes[:-1], closes[1:]):
        d = b - a
        gains.append(max(d, 0.0))
        losses.append(max(-d, 0.0))
    ag, al = sum(gains[:14]) / 14, sum(losses[:14]) / 14
    for g, l in zip(gains[14:], losses[14:]):  # Wilder smoothing = ewm(alpha=1/14)
        ag, al = (ag * 13 + g) / 14, (al * 13 + l) / 14
    rsi = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    macd_line = [a - b for a, b in zip(_ema(closes, 12), _ema(closes, 26))]
    signal = _ema(macd_line, 9)
    return {
        "price": round(closes[-1], 2), "rsi": round(rsi, 1),
        "macd": round(macd_line[-1], 2), "macd_sig": round(signal[-1], 2),
        "sma50": round(sum(closes[-50:]) / 50, 2),
        "sma200": round(sum(closes[-200:]) / 200, 2) if len(closes) >= 200 else None,
    }


def tech_text() -> str:
    """Formatted world-technical block for gold + silver (+ G/S ratio)."""
    parts = []
    for sym, label in (("GC=F", "VÀNG (GC=F)"), ("SI=F", "BẠC (SI=F)")):
        i = indicators(sym)
        if not i:
            parts.append(f"{label}: không đủ dữ liệu lịch sử")
            continue
        trend = "TRÊN" if i["sma200"] and i["price"] > i["sma200"] else "DƯỚI"
        parts.append(
            f"{label}: giá {i['price']:,} · RSI(14) {i['rsi']} · MACD {i['macd']} (signal {i['macd_sig']}) · "
            f"SMA50 {i['sma50']:,}" + (f" · SMA200 {i['sma200']:,} (giá {trend} SMA200)" if i["sma200"] else ""))
    s = snapshot()
    if s.get("gold_silver_ratio"):
        parts.append(f"Tỷ số GOLD/SILVER: {s['gold_silver_ratio']} (tham chiếu: >80 bạc rẻ tương đối, <65 vàng rẻ tương đối)")
    return "\n".join(parts)


def trend_outlook() -> str:
    """Deterministic short-term trend read for gold + silver — scored from real
    indicators (SMA50/200, RSI, MACD), NOT an LLM guess. Empty string if no data."""
    lines: list[str] = []
    for sym, label in (("GC=F", "Vàng"), ("SI=F", "Bạc")):
        i = indicators(sym)
        if not i:
            continue
        score = 0
        why: list[str] = []
        if i.get("sma50"):
            above = i["price"] > i["sma50"]
            score += 1 if above else -1
            why.append(("trên" if above else "dưới") + f" SMA50 ({i['sma50']:,.0f})")
        if i.get("sma200"):
            score += 1 if i["price"] > i["sma200"] else -1
        if i.get("rsi") is not None:
            if i["rsi"] >= 55:
                score += 1
            elif i["rsi"] <= 45:
                score -= 1
            why.append(f"RSI {i['rsi']:.0f}")
        if i.get("macd") is not None and i.get("macd_sig") is not None:
            up = i["macd"] > i["macd_sig"]
            score += 1 if up else -1
            why.append("MACD " + ("cải thiện" if up else "yếu"))
        verdict = "📈 TĂNG" if score >= 2 else ("📉 GIẢM" if score <= -2 else "➡️ ĐI NGANG")
        lines.append(f"• {label}: **{verdict}** ngắn hạn — giá {why[0]} · {' · '.join(why[1:])}")
    return ("🧭 **Xu hướng** (chấm điểm từ chỉ báo, không phải dự đoán LLM):\n" + "\n".join(lines)) if lines else ""


def morning_card() -> str:
    """The daily '☀️ Vàng & bạc sáng nay' card: prices + silver-per-lượng + trend read."""
    s = snapshot()
    parts = [headline(s)]
    sil = s.get("silver")
    if sil and sil.get("buy"):
        parts.append(f"💡 Bạc 1 lượng (37,5g) ≈ **{sil['buy'] * 0.0375 / 1e6:,.2f} – {sil['sell'] * 0.0375 / 1e6:,.2f} tr** (mua–bán)")
    elif s.get("silver_world_kg_vnd"):
        parts.append(f"💡 Bạc 1 lượng (37,5g) ≈ **{s['silver_world_kg_vnd'] * 0.0375 / 1e6:,.2f} tr** (theo giá TG quy đổi)")
    trend = trend_outlook()
    if trend:
        parts.append("")
        parts.append(trend)
    return "\n".join(parts)


def backtest_sma50(symbol: str = "GC=F") -> str:
    """Deterministic SMA50-cross backtest on ~1y of daily closes (long above SMA50)."""
    closes = history(symbol)
    if len(closes) < 60:
        return "(không đủ dữ liệu backtest)"
    strat, bh, pos = 1.0, closes[-1] / closes[50], False
    for i in range(50, len(closes) - 1):
        sma = sum(closes[i - 49:i + 1]) / 50
        pos = closes[i] > sma
        if pos:
            strat *= closes[i + 1] / closes[i]
    return (f"BACKTEST {symbol} ~1 năm (máy tính, không LLM): chiến lược SMA50-cross "
            f"{(strat - 1) * 100:+.1f}% vs mua-giữ {(bh - 1) * 100:+.1f}% · "
            f"trạng thái hiện tại: {'TRÊN SMA50 (đang giữ)' if pos else 'DƯỚI SMA50 (đứng ngoài)'}")


_news_cache: dict = {}


def news_headlines() -> list[str]:
    """Top headlines from Google News RSS — VN 'giá vàng' + world 'gold price' (cache 10 min)."""
    import re as _re
    if _news_cache and _t.time() - _news_cache.get("t", 0) < 600:
        return _news_cache["d"]
    out: list[str] = []
    feeds = [
        ("https://news.google.com/rss/search?q=gi%C3%A1%20v%C3%A0ng&hl=vi&gl=VN&ceid=VN:vi", 4),
        ("https://news.google.com/rss/search?q=gold%20price%20fed&hl=en-US&gl=US&ceid=US:en", 3),
    ]
    try:
        with httpx.Client(timeout=8, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True) as client:
            for url, n in feeds:
                try:
                    xml = client.get(url).text
                    titles = _re.findall(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", xml)
                    titles = [t.strip() for t in titles if t.strip() and not t.strip().startswith(("Google Tin", "Google News"))]
                    out += titles[:n]
                except Exception:  # noqa: BLE001
                    continue
    except Exception:  # noqa: BLE001
        pass
    _news_cache.update(t=_t.time(), d=out)
    return out


def headline(snap: dict | None = None, asset: str | None = None) -> str:
    """Deterministic price lines — ALWAYS prepended to Aurum's replies so the user
    sees machine-computed numbers even if a model drifts (mirror of price_headline).

    asset: "gold" → only gold lines, "silver" → only silver lines, None → both.
    """
    s = snap or snapshot()
    show_gold, show_silver = asset in (None, "gold"), asset in (None, "silver")
    lines: list[str] = []
    bar, ring, sil = s.get("sjc_bar"), s.get("sjc_ring"), s.get("silver")
    if show_gold and bar:
        prem = f" · **PREMIUM {s['premium_pct']:+.1f}%** vs TG" if s.get("premium_pct") is not None else ""
        lines.append(f"📍 Vàng SJC miếng **{_tr(bar['buy'])} – {_tr(bar['sell'])} tr/lượng**{prem}")
    if show_gold and ring:
        rb, rs = ring.get("buy") or 0, ring.get("sell") or 0
        if rb and rb < 30e6:  # BTMC quotes rings per CHỈ (1/10 lượng) — normalize to lượng
            rb, rs = rb * 10, rs * 10
        lines.append(f"💍 Nhẫn 99,99: {_tr(rb)} – {_tr(rs)} tr/lượng")
    if show_gold and s.get("gold_usd"):
        w = f" ≈ {_tr(s['world_luong_vnd'])} tr/lượng" if s.get("world_luong_vnd") else ""
        c = f" ({s['gold_chg_pct']:+.1f}% hôm nay)" if s.get("gold_chg_pct") is not None else ""
        lines.append(f"🌍 Vàng TG **{s['gold_usd']:,.0f} $/oz**{w}{c}")
    if show_silver:
        if sil:
            up = sil["name"].upper()
            brand = "Phú Quý" if "PHÚ QUÝ" in up else ("Rồng Thăng Long" if "RỒNG" in up else "miếng")
            sp = f" · **premium {s['silver_premium_pct']:+.1f}%** vs TG" if s.get("silver_premium_pct") is not None else ""
            stale = f" (BTMC lúc {sil['time'][-5:]})" if s.get("silver_stale") and sil.get("time") else ""
            lines.append(f"🥈 Bạc {brand} **{_tr(sil['buy'])} – {_tr(sil['sell'])} tr/kg**{sp}{stale}")
        if s.get("silver_usd"):  # world silver prints on its own — even when the BTMC feed drops silver
            w = f" ≈ {_tr(s['silver_world_kg_vnd'])} tr/kg" if s.get("silver_world_kg_vnd") else ""
            c = f" ({s['silver_chg_pct']:+.1f}% hôm nay)" if s.get("silver_chg_pct") is not None else ""
            lines.append(f"🌍 Bạc TG **{s['silver_usd']:,.2f} $/oz**{w}{c}")
    macro = []
    if s.get("gold_silver_ratio"):
        macro.append(f"Gold/Silver {s['gold_silver_ratio']}")
    if s.get("dxy"):
        macro.append(f"DXY {s['dxy']:,.1f}")
    if s.get("us10y"):
        macro.append(f"US10Y {s['us10y']:.2f}%")
    if s.get("usd_vnd"):
        macro.append(f"USD/VND {s['usd_vnd']:,.0f}")
    if macro:
        lines.append("💵 " + " · ".join(macro))
    return "\n".join(lines) if lines else "⚠️ Chưa lấy được dữ liệu giá (nguồn SJC/BTMC/Yahoo đều lỗi) — thử lại sau ít phút."
