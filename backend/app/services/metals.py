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

    gold_usd = (wld.get("gold_usd") or {}).get("price")
    silver_usd = (wld.get("silver_usd") or {}).get("price")
    usd_vnd = (wld.get("usd_vnd") or {}).get("price")

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
        "dxy": (wld.get("dxy") or {}).get("price"), "us10y": (wld.get("us10y") or {}).get("price"),
        "world_luong_vnd": world_luong_vnd, "premium_pct": premium_pct,
        "silver_world_kg_vnd": silver_world_kg_vnd, "silver_premium_pct": silver_premium_pct,
        "gold_silver_ratio": round(gold_usd / silver_usd, 1) if gold_usd and silver_usd else None,
        "errors": {k: v for k, v in dom.items() if k.endswith("_err")},
    }
    _cache.update(t=_t.time(), d=d)
    return d


def _tr(v: float | None) -> str:
    """VND → 'triệu' with 2 decimals."""
    return f"{v / 1e6:,.2f}" if v else "—"


def headline(snap: dict | None = None) -> str:
    """Deterministic price lines — ALWAYS prepended to Aurum's replies so the user
    sees machine-computed numbers even if a model drifts (mirror of price_headline)."""
    s = snap or snapshot()
    lines: list[str] = []
    bar, ring, sil = s.get("sjc_bar"), s.get("sjc_ring"), s.get("silver")
    if bar:
        prem = f" · **PREMIUM {s['premium_pct']:+.1f}%** vs TG" if s.get("premium_pct") is not None else ""
        lines.append(f"📍 Vàng SJC miếng **{_tr(bar['buy'])} – {_tr(bar['sell'])} tr/lượng**{prem}")
    if ring:
        rb, rs = ring.get("buy") or 0, ring.get("sell") or 0
        if rb and rb < 30e6:  # BTMC quotes rings per CHỈ (1/10 lượng) — normalize to lượng
            rb, rs = rb * 10, rs * 10
        lines.append(f"💍 Nhẫn 99,99: {_tr(rb)} – {_tr(rs)} tr/lượng")
    if s.get("gold_usd"):
        w = f" ≈ {_tr(s['world_luong_vnd'])} tr/lượng" if s.get("world_luong_vnd") else ""
        lines.append(f"🌍 Vàng TG **{s['gold_usd']:,.0f} $/oz**{w}")
    if sil:
        up = sil["name"].upper()
        brand = "Phú Quý" if "PHÚ QUÝ" in up else ("Rồng Thăng Long" if "RỒNG" in up else "miếng")
        sp = f" · premium {s['silver_premium_pct']:+.1f}%" if s.get("silver_premium_pct") is not None else ""
        lines.append(f"🥈 Bạc {brand} **{_tr(sil['buy'])} – {_tr(sil['sell'])} tr/kg** · TG {s['silver_usd']:,.2f} $/oz{sp}" if s.get("silver_usd")
                     else f"🥈 Bạc {brand} **{_tr(sil['buy'])} – {_tr(sil['sell'])} tr/kg**{sp}")
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
