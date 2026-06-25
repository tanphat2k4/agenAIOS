import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.common import Token
from app.serialize import row_to_dict

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    name: str = ""
    email: EmailStr
    password: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def _initial(name: str, email: str) -> str:
    base = (name or email or "?").strip()
    parts = [p for p in base.split() if p]
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return base[0].upper() if base else "?"


def _issue(user: User) -> Token:
    return Token(access_token=create_access_token(user.id))


@router.post("/register", response_model=Token)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email đã được đăng ký")
    name = body.name.strip() or email.split("@")[0]
    user = User(
        id="u" + uuid.uuid4().hex[:8],
        name=name,
        email=email,
        hashed_password=hash_password(body.password),
        initial=_initial(name, email),
        color="#3B5BDB",
        role="owner",  # single-workspace app: the signed-in user is the Owner
        status="active",
        last="vừa xong",
    )
    db.add(user)
    db.commit()
    return _issue(user)


@router.post("/login", response_model=Token)
def login(body: LoginIn, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Email hoặc mật khẩu không đúng"
        )
    return _issue(user)


@router.post("/token", response_model=Token, include_in_schema=True)
def token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 password flow — powers the Swagger 'Authorize' button (username = email)."""
    email = (form.username or "").lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Email hoặc mật khẩu không đúng"
        )
    return _issue(user)


@router.get("/me")
def me(current: User = Depends(get_current_user)):
    return row_to_dict(current)
