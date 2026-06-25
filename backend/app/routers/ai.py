import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.services import ninerouter

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(get_current_user)])


class ChatMsg(BaseModel):
    role: str
    content: str


class ChatIn(BaseModel):
    messages: list[ChatMsg]
    model: str | None = None
    temperature: float = 0.7
    max_tokens: int | None = None


@router.get("/models")
def models():
    """Live model list from 9Router (combos + providers + local Ollama)."""
    try:
        return ninerouter.list_models()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Không gọi được 9Router: {e}")


@router.post("/chat")
def chat(body: ChatIn):
    try:
        return ninerouter.chat(
            [m.model_dump() for m in body.messages],
            body.model,
            temperature=body.temperature,
            max_tokens=body.max_tokens,
        )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Không gọi được 9Router: {e}")
