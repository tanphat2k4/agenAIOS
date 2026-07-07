"""Comic P2 builder — sinh khung (ComfyUI) + ghép trang + bong bóng thoại tiếng Việt.

Consistency v1 = textual anchoring: every panel prompt re-injects the story style +
the FULL look of each character present + a deterministic per-panel seed (regen bumps
a nonce). IPAdapter/PuLID conditioning is the planned upgrade once the model files on
PC-A are verified. Speech bubbles are drawn by CODE (Pillow + Segoe UI — full Vietnamese
diacritics), never by the image model.
"""
import hashlib
import re

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy.orm import Session

from app.services import comfy_client

_W = 832
_SHOT_H = {"wide": 640, "medium": 832, "closeup": 1040}
_MARGIN = 24
_GUTTER = 16
_FONT_PATH = r"C:\Windows\Fonts\segoeui.ttf"
_FONT_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"


def _seed(comic_id: str, page: int, panel: int, nonce: int) -> int:
    h = hashlib.md5(f"{comic_id}|{page}|{panel}|{nonce}".encode()).hexdigest()
    return int(h[:8], 16) % (2**31)


def _chars_in_panel(comic_chars: list, panel: dict) -> list:
    """Characters referenced by the panel's desc or dialogue — their looks get re-injected."""
    text = (panel.get("desc", "") + " " + " ".join(d.get("char", "") for d in panel.get("dialogue", []))).lower()
    return [c for c in comic_chars if c.get("name", "").lower() in text]


def panel_prompt(style: str, comic_chars: list, panel: dict) -> str:
    shot = {"wide": "wide establishing shot", "medium": "medium shot", "closeup": "close-up shot"}.get(
        panel.get("shot", "medium"), "medium shot")
    parts = [style, shot, panel.get("desc", "")]
    for c in _chars_in_panel(comic_chars, panel):
        parts.append(f"({c.get('name')}: {c.get('look', '')})")
    parts.append("consistent character design, same face as reference, comic panel, full head visible")
    if panel.get("dialogue"):  # reserve breathing room so bubbles don't fight the subject
        parts.append("subject in lower two thirds of frame, negative space at the top")
    return ", ".join(p for p in parts if p)


_ref_cache: dict = {}  # (comic_id, char_name) -> ComfyUI input filename


def _ref_for_panel(comic, panel: dict) -> str | None:
    """Upload (once) the PICKED character sheet of the panel's primary character to
    ComfyUI and return its input filename — the IPAdapter identity anchor."""
    from app.routers.uploads import UPLOAD_DIR

    chars = _chars_in_panel(comic.characters or [], panel)
    if not chars or not (comic.sheets or {}):
        return None
    name = chars[0].get("name", "")
    urls = (comic.sheets or {}).get(name) or []
    if not urls:
        return None
    pick = int((comic.picks or {}).get(name, 1))
    url = urls[min(pick, len(urls)) - 1]
    key = (comic.id, name)
    if key in _ref_cache:
        return _ref_cache[key]
    path = UPLOAD_DIR / url.rsplit("/", 1)[-1]
    if not path.exists():
        return None
    ref_name = comfy_client.upload_image(path.read_bytes(), f"ref-{comic.id}-{_slugify(name)}.png")
    _ref_cache[key] = ref_name
    return ref_name


def _slugify(s: str) -> str:
    import unicodedata
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "nv"


def gen_panel(comic, page_no: int, panel: dict, nonce: int = 0) -> str:
    """Render one panel on ComfyUI (IPAdapter-anchored to the picked character sheet
    when available; graceful fallback to plain txt2img) → save + return url."""
    from app.routers.uploads import UPLOAD_DIR

    h = _SHOT_H.get(panel.get("shot", "medium"), 832)
    prompt = panel_prompt(comic.style or "", comic.characters or [], panel)
    seed = _seed(comic.id, page_no, panel.get("panel", 0), nonce)
    ref = None
    try:
        ref = _ref_for_panel(comic, panel)
    except comfy_client.ComfyError:
        ref = None
    try:
        data = comfy_client.txt2img(prompt, width=_W, height=h, steps=24, cfg=6.0, seed=seed,
                                    ref_image=ref, ref_weight=0.6,
                                    timeout=600 if ref else 180)  # first ref call may download the ipadapter model
    except comfy_client.ComfyError:
        if not ref:
            raise
        data = comfy_client.txt2img(prompt, width=_W, height=h, steps=24, cfg=6.0, seed=seed)  # fallback: no anchor
    fname = f"comic-{comic.id}-p{page_no}k{panel.get('panel', 0)}.png"
    (UPLOAD_DIR / fname).write_bytes(data)
    return f"/uploads/{fname}"


# ───────────────────────── speech bubbles + page compose ─────────────────────────
def _wrap(draw: ImageDraw.ImageDraw, text: str, font, max_w: int) -> list[str]:
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


_yunet = None
_YUNET_PATH = __import__("os").path.join(__import__("os").path.dirname(__file__), "..", "..", "assets", "face_yunet.onnx")


def _face_boxes(img: Image.Image) -> list[tuple[int, int, int, int]]:
    """Detect faces with OpenCV YuNet (cv2 5.x dropped CascadeClassifier; YuNet also
    handles stylized/cropped faces far better). Empty list on any failure."""
    global _yunet
    try:
        import cv2
        import numpy as np

        if _yunet is None:
            _yunet = cv2.FaceDetectorYN_create(_YUNET_PATH, "", (0, 0), score_threshold=0.6)
        mat = cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2BGR)
        _yunet.setInputSize((mat.shape[1], mat.shape[0]))
        _n, faces = _yunet.detect(mat)
        return [tuple(map(int, f[:4])) for f in (faces if faces is not None else [])]
    except Exception:  # noqa: BLE001
        return []


def _overlap(a: tuple, b: tuple) -> int:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return max(0, min(ax + aw, bx + bw) - max(ax, bx)) * max(0, min(ay + ah, by + bh) - max(ay, by))


_font_cache: dict = {}


def _fonts(fsize: int):
    if fsize not in _font_cache:
        try:
            _font_cache[fsize] = (ImageFont.truetype(_FONT_PATH, fsize), ImageFont.truetype(_FONT_BOLD, fsize))
        except Exception:  # noqa: BLE001
            d = ImageFont.load_default()
            _font_cache[fsize] = (d, d)
    return _font_cache[fsize]


def _bubble_layout(draw: ImageDraw.ImageDraw, cell_w: int, cell_h: int, dialogue: list,
                   faces: list, override: list | None = None, include_hidden: bool = False) -> list[dict]:
    """Compute each bubble's box + tail target in CELL coordinates. Shared by the
    renderer and the visual editor. `override[i]` (aligned to dialogue[i]) may carry
    `nx/ny` (normalized top-left → manual position), `tnx/tny` (tail target), and
    `text` (edited copy). Without an override the box is auto-scored to dodge faces +
    other bubbles and the tail points at the nearest face."""
    if not dialogue:
        return []
    fsize = 24 if cell_w >= 700 else 19
    font, _bold = _fonts(fsize)
    line_h = fsize + 7
    max_text_w = int(cell_w * 0.52)
    ov = override or []
    out: list[dict] = []
    placed: list[tuple] = []

    for i, d in enumerate(dialogue[:4]):
        o = ov[i] if i < len(ov) and isinstance(ov[i], dict) else {}
        hidden = bool(o.get("hidden"))
        if hidden and not include_hidden:  # deleted in the editor → skip when composing
            continue
        name = (d.get("char") or "").strip()
        text = (o["text"] if o.get("text") is not None else (d.get("text") or "")).strip()
        if not text:
            continue
        lines = _wrap(draw, text, font, max_text_w)
        pad = 13
        box_w = min(max_text_w, max(int(draw.textlength(x, font=font)) for x in lines) if lines else 50) + pad * 2
        box_h = (line_h if name else 0) + line_h * len(lines) + pad * 2

        if o.get("nx") is not None:  # manual position from the editor
            x = int(round(o["nx"] * cell_w))
            y = int(round(o["ny"] * cell_h))
            x = max(0, min(x, cell_w - box_w))
            y = max(0, min(y, cell_h - box_h))
        else:                        # auto: score candidate anchors in reading order
            m = 14
            xs = [m, (cell_w - box_w) // 2, cell_w - box_w - m]
            ys = [m, int(cell_h * 0.36), cell_h - box_h - m - 30]
            cands = [(cx, cy) for cy in ys for cx in xs]
            best, best_cost = cands[0], None
            for j, (cx, cy) in enumerate(cands):
                box = (cx, cy, box_w, box_h)
                cost = sum(_overlap(box, f) for f in faces) * 4       # NEVER sit on a face
                cost += sum(_overlap(box, p) for p in placed) * 3     # don't stack on other bubbles
                cost += j * 900                                       # prefer earlier (top) zones — reading flow
                cost += 0 if (i % 2 == 0) == (cx <= xs[1]) else 400   # alternate sides as a soft tiebreak
                if best_cost is None or cost < best_cost:
                    best, best_cost = (cx, cy), cost
            x, y = best
        if not hidden:  # hidden bubbles don't push visible ones around
            placed.append((x, y, box_w, box_h + 30))

        if o.get("tnx") is not None:  # manual tail target
            tgt = (o["tnx"] * cell_w, o["tny"] * cell_h)
        elif faces:                   # point at the nearest face
            fx, fy, fw, fh = min(faces, key=lambda f: abs((f[0] + f[2] / 2) - (x + box_w / 2)) + abs((f[1] + f[3] / 2) - (y + box_h / 2)))
            tgt = (fx + fw / 2, fy + fh / 2)
        else:
            tgt = (x + box_w / 2 + (40 if i % 2 == 0 else -40), y + box_h + 60)

        out.append({"i": i, "name": name, "text": text, "lines": lines, "fsize": fsize, "hidden": hidden,
                    "x": x, "y": y, "w": box_w, "h": box_h, "tail": (tgt[0], tgt[1])})
    return out


def _render_bubble(draw: ImageDraw.ImageDraw, b: dict) -> None:
    """Paint one bubble (box + tail + text) from a _bubble_layout entry."""
    x, y, box_w, box_h = b["x"], b["y"], b["w"], b["h"]
    font, bold = _fonts(b["fsize"])
    line_h = b["fsize"] + 7
    pad = 13
    draw.rounded_rectangle([x, y, x + box_w, y + box_h], radius=16, fill=(255, 255, 255, 235), outline=(20, 20, 20), width=3)
    tgt = b["tail"]
    from_bottom = tgt[1] >= y + box_h / 2
    base_y = (y + box_h - 2) if from_bottom else (y + 2)
    tx = min(max(tgt[0], x + 24), x + box_w - 24)
    tip = (tx + (18 if tgt[0] > tx else -18), base_y + (26 if from_bottom else -26))
    draw.polygon([(tx - 12, base_y), (tx + 12, base_y), tip], fill=(255, 255, 255), outline=(20, 20, 20))
    draw.line([(tx - 11, base_y), (tx + 11, base_y)], fill=(255, 255, 255), width=4)  # seam
    ty = y + pad
    if b["name"]:
        draw.text((x + pad, ty), b["name"] + ":", font=bold, fill=(160, 60, 10))
        ty += line_h
    for ln in b["lines"]:
        draw.text((x + pad, ty), ln, font=font, fill=(15, 15, 15))
        ty += line_h


def _draw_bubbles(img: Image.Image, dialogue: list, override: list | None = None) -> None:
    """Face-aware bubble placement drawn onto a panel cell. `override` (per bubble)
    lets the visual editor pin exact positions/tails/text; otherwise fully automatic."""
    if not dialogue:
        return
    draw = ImageDraw.Draw(img)
    for b in _bubble_layout(draw, img.width, img.height, dialogue, _face_boxes(img), override):
        _render_bubble(draw, b)


def _auto_layout(panels: list) -> list:
    """Old scripts have no layout field — build comic-like rows automatically:
    wide shots get a full row, consecutive non-wide panels pair up side by side."""
    rows: list[list[int]] = []
    buf: list[int] = []
    for pn in panels:
        no = pn.get("panel", 0)
        if pn.get("shot") == "wide":
            if buf:
                rows.append(buf)
                buf = []
            rows.append([no])
        else:
            buf.append(no)
            if len(buf) == 2:
                rows.append(buf)
                buf = []
    if buf:
        rows.append(buf)
    return rows or [[pn.get("panel", 0)] for pn in panels]


def _bubble_override(comic, page_no: int, panel_no: int) -> list | None:
    return (comic.script or {}).get("_bubble", {}).get(f"{page_no}-{panel_no}")


def set_bubble_overrides(comic, page_no: int, panel_map: dict) -> None:
    """Store manual bubble positions (from the editor). panel_map = {panel_no: [items]}."""
    script = dict(comic.script or {})
    store = dict(script.get("_bubble", {}))
    for pno, items in panel_map.items():
        store[f"{page_no}-{pno}"] = items
    script["_bubble"] = store
    comic.script = script


def clear_bubble_overrides(comic, page_no: int) -> None:
    """Drop every manual override on a page → bubbles go back to auto-placement."""
    script = dict(comic.script or {})
    store = {k: v for k, v in script.get("_bubble", {}).items() if not k.startswith(f"{page_no}-")}
    script["_bubble"] = store
    comic.script = script


def _layout(comic, page: dict) -> dict:
    """Shared page geometry: load rendered panels, resize into the script's row layout
    ([[1],[2,3]] → full-width rows + side-by-side pairs), and return each cell's final
    rect on the canvas (bubbles NOT yet drawn). Feeds both compose_page and the editor."""
    from app.routers.uploads import UPLOAD_DIR

    page_no = page.get("page", 1)
    panels = page.get("panels", [])
    by_no: dict[int, dict] = {pn.get("panel", i + 1): pn for i, pn in enumerate(panels)}
    loaded: dict[int, Image.Image] = {}
    for no in by_no:
        path = UPLOAD_DIR / f"comic-{comic.id}-p{page_no}k{no}.png"
        if path.exists():
            loaded[no] = Image.open(path).convert("RGB")
    if not loaded:
        raise RuntimeError(f"trang {page_no} chưa có khung nào")

    layout = page.get("layout") or _auto_layout(panels)
    rows: list[list[int]] = [[n for n in (row if isinstance(row, list) else [row]) if n in loaded] for row in layout]
    rows = [r for r in rows if r]
    placed = {n for r in rows for n in r}
    rows += [[n] for n in sorted(loaded) if n not in placed]  # panels the layout forgot

    row_cells: list[list[tuple[int, Image.Image]]] = []
    row_heights: list[int] = []
    for row in rows:
        if len(row) == 1:
            im = loaded[row[0]].copy()
            if im.width != _W:
                im = im.resize((_W, int(im.height * _W / im.width)))
            row_cells.append([(row[0], im)])
            row_heights.append(im.height)
        else:
            half = (_W - _GUTTER) // 2
            pair, hmax = [], 0
            for n in row[:2]:
                im = loaded[n].resize((half, int(loaded[n].height * half / loaded[n].width)))
                pair.append((n, im))
                hmax = max(hmax, im.height)
            row_cells.append(pair)
            row_heights.append(hmax)

    total_h = _MARGIN * 2 + sum(row_heights) + _GUTTER * (len(row_cells) - 1) + 48
    cells: list[dict] = []
    y = _MARGIN
    for row, rh in zip(row_cells, row_heights):
        x = _MARGIN
        for no, im in row:
            cells.append({"panel_no": no, "img": im, "panel": by_no[no],
                          "x": x, "y": y + (rh - im.height) // 2, "w": im.width, "h": im.height})
            x += im.width + _GUTTER
        y += rh + _GUTTER
    return {"page_no": page_no, "canvas_w": _W + _MARGIN * 2, "canvas_h": total_h, "cells": cells}


def _footer(canvas: Image.Image, page_no: int, title: str) -> None:
    draw = ImageDraw.Draw(canvas)
    f, _b = _fonts(22)
    footer = f"— Trang {page_no} · {title} —"
    draw.text(((canvas.width - draw.textlength(footer, font=f)) / 2, canvas.height - 40), footer, font=f, fill=(90, 80, 60))


def compose_page(comic, page: dict) -> str:
    """Compose the page from its rendered panels, drawing bubbles (auto or manual
    override) onto each cell, paper background + footer → versioned page PNG url.

    Every render writes a NEW versioned file (…-page-2-r142530.png): reusing one
    filename made every past message show the latest bytes + browsers cached it."""
    import time as _t

    from app.routers.uploads import UPLOAD_DIR

    lay = _layout(comic, page)
    canvas = Image.new("RGB", (lay["canvas_w"], lay["canvas_h"]), (245, 240, 228))
    for c in lay["cells"]:
        _draw_bubbles(c["img"], c["panel"].get("dialogue", []), _bubble_override(comic, lay["page_no"], c["panel_no"]))
        canvas.paste(c["img"], (c["x"], c["y"]))
    _footer(canvas, lay["page_no"], comic.title)
    out = f"comic-{comic.id}-page-{lay['page_no']}-r{_t.strftime('%H%M%S')}.png"
    canvas.save(UPLOAD_DIR / out, optimize=True)
    return f"/uploads/{out}"


def page_edit_data(comic, page: dict) -> dict:
    """Data for the visual bubble editor: a bubble-LESS page background + every bubble's
    box + tail in page-pixel coords (with its owning cell's rect so the client can
    normalize on save). Positions reflect current overrides, else auto-placement."""
    import time as _t

    from app.routers.uploads import UPLOAD_DIR

    lay = _layout(comic, page)
    canvas = Image.new("RGB", (lay["canvas_w"], lay["canvas_h"]), (245, 240, 228))
    scratch = ImageDraw.Draw(canvas)
    bubbles: list[dict] = []
    for c in lay["cells"]:
        canvas.paste(c["img"], (c["x"], c["y"]))  # clean background — no bubbles baked in
        ov = _bubble_override(comic, lay["page_no"], c["panel_no"])
        faces = _face_boxes(c["img"])
        for b in _bubble_layout(scratch, c["w"], c["h"], c["panel"].get("dialogue", []), faces, ov, include_hidden=True):
            bubbles.append({
                "panelNo": c["panel_no"], "i": b["i"], "name": b["name"], "text": b["text"], "hidden": b["hidden"],
                "x": c["x"] + b["x"], "y": c["y"] + b["y"], "w": b["w"], "h": b["h"],
                "tailX": c["x"] + b["tail"][0], "tailY": c["y"] + b["tail"][1],
                "cellX": c["x"], "cellY": c["y"], "cellW": c["w"], "cellH": c["h"],
            })
    _footer(canvas, lay["page_no"], comic.title)
    import glob as _glob
    import os as _os
    # STABLE filename + atomic replace: StrictMode double-fetches /edit; a versioned name let the
    # 2nd request delete the file the 1st response still pointed at → broken image. One name, always valid.
    bg = f"comic-{comic.id}-page-{lay['page_no']}-editbg.png"
    tmp = UPLOAD_DIR / f".{bg}.{_os.getpid()}.tmp"
    canvas.save(tmp, format="PNG", optimize=True)  # explicit format — .tmp ext can't be sniffed
    _os.replace(tmp, UPLOAD_DIR / bg)  # atomic on the same filesystem
    for old in _glob.glob(str(UPLOAD_DIR / f"comic-{comic.id}-page-{lay['page_no']}-editbg-r*.png")):
        try:
            _os.remove(old)  # sweep the old versioned editbg files
        except OSError:
            pass
    return {"bgUrl": f"/uploads/{bg}?v={_t.strftime('%H%M%S')}", "pageW": lay["canvas_w"], "pageH": lay["canvas_h"], "bubbles": bubbles}


def regen_nonce(comic, page_no: int, panel_no: int) -> int:
    """Bump + return the regen nonce for one panel (stored inside script['_regen'])."""
    script = dict(comic.script or {})
    regen = dict(script.get("_regen", {}))
    key = f"{page_no}-{panel_no}"
    regen[key] = int(regen.get(key, 0)) + 1
    script["_regen"] = regen
    comic.script = script
    return regen[key]


def get_nonce(comic, page_no: int, panel_no: int) -> int:
    return int((comic.script or {}).get("_regen", {}).get(f"{page_no}-{panel_no}", 0))


# ───────────────────────── P3: xuất bản ─────────────────────────
def _latest_pages(comic) -> list[tuple[int, str]]:
    """Newest rendered file per page number (versioned names win by mtime)."""
    import glob
    import os
    import re as _re

    from app.routers.uploads import UPLOAD_DIR

    per: dict[int, tuple[float, str]] = {}
    for f in glob.glob(str(UPLOAD_DIR / f"comic-{comic.id}-page-*.png")):
        m = _re.search(r"page-(\d+)", os.path.basename(f))
        if not m:
            continue
        no, mt = int(m.group(1)), os.path.getmtime(f)
        if no not in per or mt > per[no][0]:
            per[no] = (mt, f)
    return [(no, per[no][1]) for no in sorted(per)]


def export_webtoon(comic) -> tuple[str, str, int]:
    """Join the latest render of every page into ONE vertical webtoon strip (JPEG)
    + a PDF of the pages. Returns (strip_url, pdf_url, n_pages)."""
    import time as _t

    from app.routers.uploads import UPLOAD_DIR

    pages = _latest_pages(comic)
    if not pages:
        raise RuntimeError("chưa có trang nào được render")
    imgs = [Image.open(p).convert("RGB") for _no, p in pages]
    width = max(im.width for im in imgs)
    imgs = [im if im.width == width else im.resize((width, int(im.height * width / im.width))) for im in imgs]
    strip = Image.new("RGB", (width, sum(im.height for im in imgs)), (245, 240, 228))
    y = 0
    for im in imgs:
        strip.paste(im, (0, y))
        y += im.height
    ts = _t.strftime("%H%M%S")
    strip_name = f"comic-{comic.id}-webtoon-r{ts}.jpg"
    strip.save(UPLOAD_DIR / strip_name, quality=90, optimize=True)
    pdf_name = f"comic-{comic.id}-chuong-r{ts}.pdf"
    imgs[0].save(UPLOAD_DIR / pdf_name, save_all=True, append_images=imgs[1:], format="PDF")
    return f"/uploads/{strip_name}", f"/uploads/{pdf_name}", len(pages)
