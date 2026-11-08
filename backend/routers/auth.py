import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, AsyncIterator

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from google.auth.exceptions import TransportError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from pydantic import BaseModel, Field
from psycopg import AsyncConnection
from psycopg.rows import dict_row
from starlette.concurrency import run_in_threadpool
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

SESSION_COOKIE_NAME = "session"
SESSION_ISSUER = "backend"
DEFAULT_SESSION_TTL_SECONDS = 60 * 60


class GoogleLoginRequest(BaseModel):
    id_token: str = Field(min_length=1)


class UserProfile(BaseModel):
    id: str
    email: str | None
    name: str | None
    picture: str | None


def _session_secret() -> str:
    secret = os.getenv("SESSION_SECRET")
    if not secret or len(secret.encode("utf-8")) < 32:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Session authentication requires a SESSION_SECRET of at least 32 bytes",
        )
    return secret


def _session_ttl() -> int:
    try:
        ttl = int(os.getenv("SESSION_TOKEN_TTL_SECONDS", DEFAULT_SESSION_TTL_SECONDS))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SESSION_TOKEN_TTL_SECONDS must be a positive integer",
        ) from exc
    if ttl <= 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SESSION_TOKEN_TTL_SECONDS must be a positive integer",
        )
    return ttl


def _cookie_secure() -> bool:
    return os.getenv("SESSION_COOKIE_SECURE", "true").lower() not in {
        "0",
        "false",
        "no",
    }


@asynccontextmanager
async def _connect_db() -> AsyncIterator[AsyncConnection[dict[str, Any]]]:
    database_connection = os.getenv("DATABASE_CONNECTION")
    if not database_connection:
        raise RuntimeError("DATABASE_CONNECTION is not configured")

    connection = await AsyncConnection.connect(
        database_connection, row_factory=dict_row
    )
    try:
        await connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                google_sub TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                name TEXT,
                picture_url TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                last_login_at TIMESTAMPTZ
            )
            """)
        yield connection
        await connection.commit()
    except Exception:
        await connection.rollback()
        raise
    finally:
        await connection.close()


def _user_profile(user: Any) -> UserProfile:
    return UserProfile(
        id=user["google_sub"],
        email=user["email"],
        name=user["name"],
        picture=user["picture_url"],
    )


def _set_session_cookie(response: Response, token: str, max_age: int) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=_cookie_secure(),
        samesite="lax",
        path="/",
    )


def _decode_session(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            _session_secret(),
            algorithms=["HS256"],
            issuer=SESSION_ISSUER,
            options={"require": ["exp", "iat", "iss", "sub"]},
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def get_current_user(
    session: Annotated[str | None, Cookie(alias=SESSION_COOKIE_NAME)] = None,
) -> UserProfile:
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = _decode_session(session)
    async with _connect_db() as db:
        cursor = await db.execute(
            "SELECT google_sub, email, name, picture_url FROM users WHERE google_sub = %s",
            (claims["sub"],),
        )
        user = await cursor.fetchone()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )
    return _user_profile(user)


@router.post("/google", response_model=UserProfile)
async def login_with_google(
    body: GoogleLoginRequest,
    response: Response,
) -> UserProfile:
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google authentication is not configured",
        )

    # Fail before verifying the Google token if we cannot issue a session.
    secret = _session_secret()
    try:
        claims = await run_in_threadpool(
            id_token.verify_oauth2_token,
            body.id_token,
            GoogleRequest(),
            client_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google ID token",
        ) from exc
    except TransportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not verify Google ID token",
        ) from exc

    google_sub = claims.get("sub")
    if not isinstance(google_sub, str) or not google_sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google ID token is missing a subject",
        )

    now = datetime.now(timezone.utc)
    timestamp = now.isoformat()
    async with _connect_db() as db:
        await db.execute(
            """
            INSERT INTO users (google_sub, email, name, picture_url, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT(google_sub) DO UPDATE SET
                email = excluded.email,
                name = excluded.name,
                picture_url = excluded.picture_url,
                updated_at = excluded.updated_at
            """,
            (
                google_sub,
                claims.get("email"),
                claims.get("name"),
                claims.get("picture"),
                timestamp,
                timestamp,
            ),
        )
        cursor = await db.execute(
            "SELECT google_sub, email, name, picture_url FROM users WHERE google_sub = %s",
            (google_sub,),
        )
        user = await cursor.fetchone()

    ttl = _session_ttl()
    issued_at = datetime.now(timezone.utc)
    session_token = jwt.encode(
        {
            "sub": google_sub,
            "iss": SESSION_ISSUER,
            "iat": issued_at,
            "exp": issued_at + timedelta(seconds=ttl),
        },
        secret,
        algorithm="HS256",
    )
    _set_session_cookie(response, session_token, ttl)
    return _user_profile(user)


@router.get("/me", response_model=UserProfile)
async def get_me(
    user: Annotated[UserProfile, Depends(get_current_user)],
) -> UserProfile:
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=_cookie_secure(),
        samesite="lax",
    )
