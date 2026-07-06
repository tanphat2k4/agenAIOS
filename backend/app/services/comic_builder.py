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
    parts.append("consistent character design, same face as reference, comic panel")
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


def _draw_bubbles(img: Image.Image, dialogue: list) -> None:
    """White rounded bubbles with 'Tên: thoại' + a TAIL pointing down into the panel
    toward the speaker's side — alternating left/right, stacked from the top."""
    if not dialogue:
        return
    draw = ImageDraw.Draw(img)
    fsize = 24 if img.width >= 700 else 19  # half-width grid cells get a smaller font
    try:
        font = ImageFont.truetype(_FONT_PATH, fsize)
        bold = ImageFont.truetype(_FONT_BOLD, fsize)
    except Exception:  # noqa: BLE001
        font = bold = ImageFont.load_default()
    y = 14
    line_h = fsize + 7
    max_text_w = int(img.width * 0.58)
    for i, d in enumerate(dialogue[:4]):
        name, text = (d.get("char") or "").strip(), (d.get("text") or "").strip()
        if not text:
            continue
        lines = _wrap(draw, text, font, max_text_w)
        pad = 13
        box_w = min(max_text_w, max(int(draw.textlength(x, font=font)) for x in lines) if lines else 50) + pad * 2
        name_h = (line_h if name else 0)
        box_h = name_h + line_h * len(lines) + pad * 2
        left = i % 2 == 0
        x = 16 if left else img.width - box_w - 16
        draw.rounded_rectangle([x, y, x + box_w, y + box_h], radius=16, fill=(255, 255, 255, 235), outline=(20, 20, 20), width=3)
        # tail: triangle from the bubble's bottom edge pointing down-inward (speaker side)
        tx = x + (box_w * 0.28 if left else box_w * 0.72)
        tip_dx = 26 if left else -26
        draw.polygon([(tx - 12, y + box_h - 2), (tx + 12, y + box_h - 2), (tx + tip_dx, y + box_h + 26)],
                     fill=(255, 255, 255), outline=(20, 20, 20))
        draw.line([(tx - 11, y + box_h - 2), (tx + 11, y + box_h - 2)], fill=(255, 255, 255), width=4)  # seam
        ty = y + pad
        if name:
            draw.text((x + pad, ty), name + ":", font=bold, fill=(160, 60, 10))
            ty += line_h
        for ln in lines:
            draw.text((x + pad, ty), ln, font=font, fill=(15, 15, 15))
            ty += line_h
        y += box_h + 34  # room for the tail before the next bubble


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


def compose_page(comic, page: dict) -> str:
    """Compose the page from its rendered panels using the script's row layout
    ([[1],[2,3],[4]] → full-width rows and side-by-side pairs, like a real comic page),
    bubbles drawn at final cell size, paper background + footer → page PNG url."""
    from app.routers.uploads import UPLOAD_DIR

    page_no = page.get("page", 1)
    panels = page.get("panels", [])
    by_no: dict[int, dict] = {pn.get("panel", i + 1): pn for i, pn in enumerate(panels)}
    loaded: dict[int, Image.Image] = {}
    for no, pn in by_no.items():
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

    cells: list[list[tuple[Image.Image, dict]]] = []
    row_heights: list[int] = []
    for row in rows:
        if len(row) == 1:
            im = loaded[row[0]].copy()
            if im.width != _W:
                im = im.resize((_W, int(im.height * _W / im.width)))
            _draw_bubbles(im, by_no[row[0]].get("dialogue", []))
            cells.append([(im, by_no[row[0]])])
            row_heights.append(im.height)
        else:
            half = (_W - _GUTTER) // 2
            pair = []
            hmax = 0
            for n in row[:2]:
                im = loaded[n].copy()
                im = im.resize((half, int(im.height * half / im.width)))
                _draw_bubbles(im, by_no[n].get("dialogue", []))
                pair.append((im, by_no[n]))
                hmax = max(hmax, im.height)
            cells.append(pair)
            row_heights.append(hmax)

    total_h = _MARGIN * 2 + sum(row_heights) + _GUTTER * (len(cells) - 1) + 48
    canvas = Image.new("RGB", (_W + _MARGIN * 2, total_h), (245, 240, 228))
    y = _MARGIN
    for row, rh in zip(cells, row_heights):
        x = _MARGIN
        for im, _pn in row:
            canvas.paste(im, (x, y + (rh - im.height) // 2))
            x += im.width + _GUTTER
        y += rh + _GUTTER
    draw = ImageDraw.Draw(canvas)
    try:
        f = ImageFont.truetype(_FONT_PATH, 22)
    except Exception:  # noqa: BLE001
        f = ImageFont.load_default()
    footer = f"— Trang {page_no} · {comic.title} —"
    draw.text(((canvas.width - draw.textlength(footer, font=f)) / 2, total_h - 40), footer, font=f, fill=(90, 80, 60))
    out = f"comic-{comic.id}-page-{page_no}.png"
    canvas.save(UPLOAD_DIR / out, optimize=True)
    return f"/uploads/{out}"


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
