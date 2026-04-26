from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr, Field

from db import get_conn
from security import create_access_token, hash_password, verify_password, decode_access_token


router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr


class AuthResponse(BaseModel):
    token: str
    user: UserOut


def _user_by_email(email: str):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, email, password_hash FROM users WHERE email = %s",
                (email.strip().lower(),),
            )
            return cur.fetchone()
    finally:
        conn.close()


def _user_by_id(user_id: int):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, email FROM users WHERE id = %s",
                (user_id,),
            )
            return cur.fetchone()
    finally:
        conn.close()

def _user_by_username(username: str):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, email FROM users WHERE username = %s",
                (username.strip(),),
            )
            return cur.fetchone()
    finally:
        conn.close()


@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest):
    username = req.username.strip()
    email = req.email.strip().lower()

    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if not req.password:
        raise HTTPException(status_code=400, detail="Password is required")

    # Uniqueness checks with helpful errors
    if _user_by_username(username):
        raise HTTPException(status_code=409, detail="Username already exists")
    if _user_by_email(email):
        raise HTTPException(status_code=409, detail="Email already registered")

    conn = get_conn()
    try:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (username, email, password_hash)
                    VALUES (%s, %s, %s)
                    RETURNING id
                    """,
                    (username, email, hash_password(req.password)),
                )
                user_id = int(cur.fetchone()["id"])
            conn.commit()
        except Exception:
            # In case of race conditions, fall back to generic conflict
            conn.rollback()
            raise HTTPException(status_code=409, detail="Username or email already exists")

        token = create_access_token({"sub": str(user_id)})
        return {"token": token, "user": {"id": user_id, "username": username, "email": email}}
    finally:
        conn.close()


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest):
    row = _user_by_email(str(req.email))
    if not row or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = int(row["id"])
    token = create_access_token({"sub": str(user_id)})
    return {"token": token, "user": {"id": user_id, "username": row["username"], "email": row["email"]}}


def get_current_user(authorization: str | None = Header(default=None)) -> UserOut:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    row = _user_by_id(user_id)
    if not row:
        raise HTTPException(status_code=401, detail="User not found")
    return UserOut(id=int(row["id"]), username=row["username"], email=row["email"])


@router.get("/me", response_model=UserOut)
def me(user: UserOut = Depends(get_current_user)):
    return user
