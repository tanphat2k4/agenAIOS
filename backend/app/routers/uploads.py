"""Real file / image attachment uploads — saved to backend/uploads and served
as static files at /uploads/<name>. Auth required to upload."""

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.deps import get_current_user
from app.crud import uid

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

_MAX = 15 * 1024 * 1024  # 15 MB

router = APIRouter(tags=["uploads"], dependencies=[Depends(get_current_user)])


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Tệp rỗng")
    if len(raw) > _MAX:
        raise HTTPException(status_code=413, detail="Tệp quá lớn (tối đa 15MB)")
    ext = "".join(c for c in Path(file.filename or "").suffix if c.isalnum() or c == ".")[:10]
    stored = uid("up") + ext
    (UPLOAD_DIR / stored).write_bytes(raw)
    mime = file.content_type or ""
    return {
        "name": file.filename or stored,
        "url": f"/uploads/{stored}",
        "kind": "image" if mime.startswith("image/") else "file",
        "mime": mime,
        "size": len(raw),
    }
