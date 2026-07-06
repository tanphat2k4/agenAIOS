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


def gen_panel(comic, page_no: int, panel: dict, nonce: int = 0) -> str:
    """Render one panel on ComfyUI → save uploads/comic-<id>-p<page>k<panel>.png, return url."""
    from app.routers.uploads import UPLOAD_DIR

    h = _SHOT_H.get(panel.get("shot", "medium"), 832)
    prompt = panel_prompt(comic.style or "", comic.characters or [], panel)
    data = comfy_client.txt2img(prompt, width=_W, height=h, steps=24, cfg=6.0,
                                seed=_seed(comic.id, page_no, panel.get("panel", 0), nonce))
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
    """White rounded bubbles with 'Tên: thoại' — alternating left/right, stacked from the top."""
    if not dialogue:
        return
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype(_FONT_PATH, 24)
        bold = ImageFont.truetype(_FONT_BOLD, 24)
    except Exception:  # noqa: BLE001
        font = bold = ImageFont.load_default()
    y = 14
    max_text_w = int(img.width * 0.58)
    for i, d in enumerate(dialogue[:3]):
        name, text = (d.get("char") or "").strip(), (d.get("text") or "").strip()
        if not text:
            continue
        lines = _wrap(draw, text, font, max_text_w)
        line_h = 30
        pad = 14
        box_w = min(max_text_w, max(int(draw.textlength(x, font=font)) for x in lines) if lines else 50) + pad * 2
        name_h = (line_h if name else 0)
        box_h = name_h + line_h * len(lines) + pad * 2
        x = 16 if i % 2 == 0 else img.width - box_w - 16
        draw.rounded_rectangle([x, y, x + box_w, y + box_h], radius=16, fill=(255, 255, 255, 235), outline=(20, 20, 20), width=3)
        ty = y + pad
        if name:
            draw.text((x + pad, ty), name + ":", font=bold, fill=(160, 60, 10))
            ty += line_h
        for ln in lines:
            draw.text((x + pad, ty), ln, font=font, fill=(15, 15, 15))
            ty += line_h
        y += box_h + 10


def compose_page(comic, page: dict) -> str:
    """Stack the page's rendered panels vertically + bubbles + footer → page PNG url."""
    from app.routers.uploads import UPLOAD_DIR

    page_no = page.get("page", 1)
    panels = page.get("panels", [])
    imgs: list[tuple[Image.Image, dict]] = []
    for pn in panels:
        fname = f"comic-{comic.id}-p{page_no}k{pn.get('panel', 0)}.png"
        path = UPLOAD_DIR / fname
        if not path.exists():
            continue
        imgs.append((Image.open(path).convert("RGB"), pn))
    if not imgs:
        raise RuntimeError(f"trang {page_no} chưa có khung nào")
    total_h = _MARGIN * 2 + sum(im.height for im, _ in imgs) + _GUTTER * (len(imgs) - 1) + 48
    canvas = Image.new("RGB", (_W + _MARGIN * 2, total_h), (245, 240, 228))
    y = _MARGIN
    for im, pn in imgs:
        _draw_bubbles(im, pn.get("dialogue", []))
        canvas.paste(im, (_MARGIN, y))
        y += im.height + _GUTTER
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
