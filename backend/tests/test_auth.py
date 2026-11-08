from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import Mock

import jwt
import pytest
from fastapi.testclient import TestClient

import routers.auth as auth
from main import app


class FakeCursor:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row

    async def fetchone(self) -> dict[str, Any] | None:
        return self.row


class FakeDatabase:
    def __init__(self) -> None:
        self.users: dict[str, dict[str, Any]] = {}
        self.insert_parameters: list[tuple[Any, ...]] = []

    async def __aenter__(self) -> FakeDatabase:
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        return None

    async def execute(self, query: str, parameters: tuple[Any, ...] = ()) -> FakeCursor:
        if query.lstrip().startswith("INSERT INTO users"):
            self.insert_parameters.append(parameters)
            google_sub, email, name, picture_url, created_at, updated_at = parameters
            previous = self.users.get(google_sub)
            self.users[google_sub] = {
                "google_sub": google_sub,
                "email": email,
                "name": name,
                "picture_url": picture_url,
                "created_at": previous["created_at"] if previous else created_at,
                "updated_at": updated_at,
            }
            return FakeCursor(None)

        if query.lstrip().startswith("SELECT"):
            return FakeCursor(self.users.get(parameters[0]))

        raise AssertionError(f"Unexpected SQL query: {query}")


@pytest.fixture
def auth_client(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[tuple[TestClient, FakeDatabase]]:
    database = FakeDatabase()
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-google-client")
    monkeypatch.setenv("SESSION_SECRET", "s" * 32)
    monkeypatch.setenv("SESSION_TOKEN_TTL_SECONDS", "900")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    monkeypatch.setattr(auth, "_connect_db", lambda: database)

    with TestClient(app) as client:
        yield client, database


def stub_google_verification(
    monkeypatch: pytest.MonkeyPatch, result: dict[str, Any] | Exception
) -> Mock:
    verifier = Mock()
    if isinstance(result, Exception):
        verifier.side_effect = result
    else:
        verifier.return_value = result
    monkeypatch.setattr(auth.id_token, "verify_oauth2_token", verifier)
    return verifier


def login(client: TestClient, token: str = "google-token"):
    return client.post("/auth/google", json={"id_token": token})


def test_google_login_creates_user_and_session(
    auth_client: tuple[TestClient, FakeDatabase], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, database = auth_client
    claims = {
        "sub": "google-user-1",
        "email": "person@example.com",
        "name": "Test Person",
        "picture": "https://example.com/avatar.png",
    }
    verifier = stub_google_verification(monkeypatch, claims)

    response = login(client)

    assert response.status_code == 200
    assert response.json() == {
        "id": "google-user-1",
        "email": "person@example.com",
        "name": "Test Person",
        "picture": "https://example.com/avatar.png",
    }
    verifier.assert_called_once()
    assert verifier.call_args.args[0] == "google-token"
    assert verifier.call_args.args[2] == "test-google-client"
    assert len(database.insert_parameters) == 1

    cookie = response.cookies[auth.SESSION_COOKIE_NAME]
    session = jwt.decode(
        cookie,
        "s" * 32,
        algorithms=["HS256"],
        issuer=auth.SESSION_ISSUER,
    )
    assert session["sub"] == "google-user-1"
    assert session["exp"] - session["iat"] == 900
    set_cookie = response.headers["set-cookie"].lower()
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    assert "path=/" in set_cookie
    assert "max-age=900" in set_cookie
    assert "secure" not in set_cookie


def test_google_login_updates_existing_user(
    auth_client: tuple[TestClient, FakeDatabase], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, database = auth_client
    stub_google_verification(
        monkeypatch,
        {"sub": "google-user-1", "email": "old@example.com", "name": "Old"},
    )
    assert login(client).status_code == 200
    created_at = database.users["google-user-1"]["created_at"]

    stub_google_verification(
        monkeypatch,
        {
            "sub": "google-user-1",
            "email": "new@example.com",
            "name": "New",
            "picture": "https://example.com/new.png",
        },
    )
    response = login(client)

    assert response.status_code == 200
    assert response.json()["email"] == "new@example.com"
    assert response.json()["name"] == "New"
    assert database.users["google-user-1"]["created_at"] == created_at
    assert len(database.insert_parameters) == 2


def test_google_login_requires_configured_client_id(
    auth_client: tuple[TestClient, FakeDatabase], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, _ = auth_client
    monkeypatch.delenv("GOOGLE_CLIENT_ID")
    verifier = stub_google_verification(monkeypatch, {"sub": "unused"})

    response = login(client)

    assert response.status_code == 503
    assert response.json()["detail"] == "Google authentication is not configured"
    verifier.assert_not_called()


@pytest.mark.parametrize("secret", [None, "short"])
def test_google_login_requires_a_strong_session_secret(
    auth_client: tuple[TestClient, FakeDatabase],
    monkeypatch: pytest.MonkeyPatch,
    secret: str | None,
) -> None:
    client, _ = auth_client
    if secret is None:
        monkeypatch.delenv("SESSION_SECRET")
    else:
        monkeypatch.setenv("SESSION_SECRET", secret)
    verifier = stub_google_verification(monkeypatch, {"sub": "unused"})

    response = login(client)

    assert response.status_code == 503
    assert "SESSION_SECRET" in response.json()["detail"]
    verifier.assert_not_called()


@pytest.mark.parametrize(
    ("error", "expected_status", "expected_detail"),
    [
        (ValueError("bad token"), 401, "Invalid Google ID token"),
        (
            auth.TransportError("network unavailable"),
            503,
            "Could not verify Google ID token",
        ),
    ],
)
def test_google_login_handles_verification_errors(
    auth_client: tuple[TestClient, FakeDatabase],
    monkeypatch: pytest.MonkeyPatch,
    error: Exception,
    expected_status: int,
    expected_detail: str,
) -> None:
    client, database = auth_client
    stub_google_verification(monkeypatch, error)

    response = login(client)

    assert response.status_code == expected_status
    assert response.json()["detail"] == expected_detail
    assert database.insert_parameters == []
    assert auth.SESSION_COOKIE_NAME not in response.cookies


@pytest.mark.parametrize("subject", [None, "", 42])
def test_google_login_requires_a_nonempty_string_subject(
    auth_client: tuple[TestClient, FakeDatabase],
    monkeypatch: pytest.MonkeyPatch,
    subject: Any,
) -> None:
    client, database = auth_client
    stub_google_verification(monkeypatch, {"sub": subject})

    response = login(client)

    assert response.status_code == 401
    assert response.json()["detail"] == "Google ID token is missing a subject"
    assert database.insert_parameters == []


@pytest.mark.parametrize("ttl", ["invalid", "0", "-1"])
def test_google_login_rejects_invalid_session_ttl(
    auth_client: tuple[TestClient, FakeDatabase],
    monkeypatch: pytest.MonkeyPatch,
    ttl: str,
) -> None:
    client, _ = auth_client
    monkeypatch.setenv("SESSION_TOKEN_TTL_SECONDS", ttl)
    stub_google_verification(monkeypatch, {"sub": "google-user-1"})

    response = login(client)

    assert response.status_code == 503
    assert response.json()["detail"] == (
        "SESSION_TOKEN_TTL_SECONDS must be a positive integer"
    )


def test_google_login_requires_an_id_token(
    auth_client: tuple[TestClient, FakeDatabase], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, _ = auth_client
    verifier = stub_google_verification(monkeypatch, {"sub": "unused"})

    missing_token = client.post("/auth/google", json={})
    empty_token = client.post("/auth/google", json={"id_token": ""})

    assert missing_token.status_code == 422
    assert empty_token.status_code == 422
    verifier.assert_not_called()


def test_me_returns_the_authenticated_user(
    auth_client: tuple[TestClient, FakeDatabase], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, _ = auth_client
    stub_google_verification(
        monkeypatch,
        {"sub": "google-user-1", "email": "person@example.com", "name": "Person"},
    )
    assert login(client).status_code == 200

    response = client.get("/auth/me")

    assert response.status_code == 200
    assert response.json() == {
        "id": "google-user-1",
        "email": "person@example.com",
        "name": "Person",
        "picture": None,
    }


def test_me_rejects_a_missing_session(
    auth_client: tuple[TestClient, FakeDatabase],
) -> None:
    client, _ = auth_client

    response = client.get("/auth/me")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize(
    ("token", "expected_detail"),
    [
        ("not-a-jwt", "Invalid or expired session"),
        ("", "Not authenticated"),
        (None, "Not authenticated"),
    ],
)
def test_me_rejects_invalid_or_missing_session_tokens(
    auth_client: tuple[TestClient, FakeDatabase],
    token: str | None,
    expected_detail: str,
) -> None:
    client, _ = auth_client
    if token is not None:
        client.cookies.set(auth.SESSION_COOKIE_NAME, token, path="/auth")

    response = client.get("/auth/me")

    assert response.status_code == 401
    assert response.json()["detail"] == expected_detail


def test_me_rejects_an_expired_session(
    auth_client: tuple[TestClient, FakeDatabase],
) -> None:
    client, _ = auth_client
    expired_token = jwt.encode(
        {
            "sub": "google-user-1",
            "iss": auth.SESSION_ISSUER,
            "iat": 1,
            "exp": 2,
        },
        "s" * 32,
        algorithm="HS256",
    )
    client.cookies.set(auth.SESSION_COOKIE_NAME, expired_token, path="/auth")

    response = client.get("/auth/me")

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired session"


def test_me_rejects_a_user_missing_from_the_database(
    auth_client: tuple[TestClient, FakeDatabase],
) -> None:
    client, _ = auth_client
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": "deleted-user",
            "iss": auth.SESSION_ISSUER,
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        "s" * 32,
        algorithm="HS256",
    )
    client.cookies.set(auth.SESSION_COOKIE_NAME, token, path="/auth")

    response = client.get("/auth/me")

    assert response.status_code == 401
    assert response.json()["detail"] == "User no longer exists"


def test_logout_clears_the_session_cookie(
    auth_client: tuple[TestClient, FakeDatabase],
) -> None:
    client, _ = auth_client

    response = client.post("/auth/logout")

    assert response.status_code == 204
    set_cookie = response.headers["set-cookie"].lower()
    assert f"{auth.SESSION_COOKIE_NAME}=" in set_cookie
    assert "max-age=0" in set_cookie
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    assert "path=/" in set_cookie


def test_session_cookie_is_secure_by_default(
    auth_client: tuple[TestClient, FakeDatabase], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, _ = auth_client
    monkeypatch.delenv("SESSION_COOKIE_SECURE")
    stub_google_verification(monkeypatch, {"sub": "google-user-1"})

    response = login(client)

    assert response.status_code == 200
    assert "secure" in response.headers["set-cookie"].lower()
