"""Minimal ComfyUI client (PC-A, RTX 5090) — submit a txt2img graph, wait for the
result, return the image bytes. Used by the comic pipeline for character sheets (P1)
and panels (P2). Plain SDXL txt2img; identity conditioning (PuLID) arrives in P2.
"""
import time
import uuid

import httpx

from app.core.config import settings

_NEG_DEFAULT = ("text, watermark, signature, speech bubble, lowres, bad anatomy, bad hands, "
                "extra fingers, deformed face, blurry, jpeg artifacts, duplicate")


class ComfyError(RuntimeError):
    pass


def _graph(prompt: str, negative: str, width: int, height: int, steps: int, cfg: float, seed: int) -> dict:
    """Standard 7-node SDXL txt2img graph."""
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": settings.COMFY_CKPT}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": prompt}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": negative}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "5": {"class_type": "KSampler", "inputs": {
            "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["4", 0],
            "seed": seed, "steps": steps, "cfg": cfg, "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0,
        }},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": "agentaios-comic"}},
    }


def txt2img(prompt: str, *, negative: str = "", width: int = 832, height: int = 1216,
            steps: int = 28, cfg: float = 6.0, seed: int | None = None, timeout: float = 180.0) -> bytes:
    """Generate one image; blocks until done (RTX 5090: ~6-12s). Raises ComfyError."""
    base = settings.COMFYUI_URL.rstrip("/")
    seed = seed if seed is not None else int(uuid.uuid4().int % 2**31)
    graph = _graph(prompt, negative or _NEG_DEFAULT, width, height, steps, cfg, seed)
    try:
        with httpx.Client(timeout=30) as client:
            r = client.post(f"{base}/prompt", json={"prompt": graph, "client_id": uuid.uuid4().hex})
            r.raise_for_status()
            pid = r.json().get("prompt_id")
            if not pid:
                raise ComfyError(f"không nhận prompt_id: {r.text[:200]}")
            t0 = time.time()
            while time.time() - t0 < timeout:
                h = client.get(f"{base}/history/{pid}").json()
                entry = h.get(pid)
                if entry:
                    if entry.get("status", {}).get("status_str") == "error":
                        raise ComfyError(f"ComfyUI báo lỗi: {str(entry.get('status'))[:300]}")
                    outputs = entry.get("outputs", {})
                    for node_out in outputs.values():
                        for img in node_out.get("images", []):
                            v = client.get(f"{base}/view", params={
                                "filename": img["filename"], "subfolder": img.get("subfolder", ""),
                                "type": img.get("type", "output")})
                            v.raise_for_status()
                            return v.content
                time.sleep(1.5)
            raise ComfyError(f"quá {int(timeout)}s chưa xong (queue PC-A đang bận?)")
    except httpx.HTTPError as exc:
        raise ComfyError(f"không gọi được ComfyUI {base}: {exc}") from exc
