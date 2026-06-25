from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class Msg(BaseModel):
    detail: str = "ok"
