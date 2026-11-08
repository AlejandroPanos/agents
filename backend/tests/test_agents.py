from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

import routers.agents as agents
from main import app
from routers.auth import UserProfile, get_current_user


class FakeCursor:
    def __init__(self, row: dict[str, Any] | list[dict[str, Any]] | None = None):
        self.row = row

    async def fetchone(self) -> dict[str, Any] | None:
        return self.row if isinstance(self.row, dict) else None

    async def fetchall(self) -> list[dict[str, Any]]:
        return self.row if isinstance(self.row, list) else []


class FakeDatabase:
    def __init__(self) -> None:
        self.rows: dict[UUID, dict[str, Any]] = {}
        self.queries: list[tuple[str, tuple[Any, ...]]] = []

    async def __aenter__(self) -> FakeDatabase:
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        return None

    async def execute(self, query: str, parameters: tuple[Any, ...] = ()) -> FakeCursor:
        normalized = " ".join(query.split())
        self.queries.append((normalized, parameters))

        if normalized.startswith("CREATE TABLE"):
            return FakeCursor()
        if normalized.startswith("INSERT INTO agents"):
            user_id, name, description, system_prompt, provider, model = parameters
            row = self.make_row(
                user_id,
                name,
                description,
                system_prompt,
                provider,
                model,
            )
            self.rows[row["id"]] = row
            return FakeCursor(row)
        if normalized.startswith("SELECT"):
            if "WHERE id = %s AND user_id = %s" in normalized:
                agent_id, user_id = parameters
                row = self.rows.get(agent_id)
                return FakeCursor(row if row and row["user_id"] == user_id else None)
            user_id, limit, offset = parameters
            matching = [row for row in self.rows.values() if row["user_id"] == user_id]
            return FakeCursor(matching[offset : offset + limit])
        if normalized.startswith("UPDATE agents"):
            agent_id, user_id = parameters[-2:]
            row = self.rows.get(agent_id)
            if row is None or row["user_id"] != user_id:
                return FakeCursor()
            set_clause = normalized.split(" SET ", 1)[1].split(" WHERE ", 1)[0]
            fields = [
                part.split(" = ", 1)[0]
                for part in set_clause.split(", ")
                if " = %s" in part
            ]
            for field, value in zip(fields, parameters[:-2], strict=True):
                row[field] = value
            row["updated_at"] = datetime.now(timezone.utc)
            return FakeCursor(row)
        if normalized.startswith("DELETE FROM agents"):
            agent_id, user_id = parameters
            row = self.rows.get(agent_id)
            if row is None or row["user_id"] != user_id:
                return FakeCursor()
            del self.rows[agent_id]
            return FakeCursor({"id": agent_id})

        raise AssertionError(f"Unexpected SQL query: {normalized}")

    @staticmethod
    def make_row(
        user_id: str,
        name: str,
        description: str | None,
        system_prompt: str,
        provider: str,
        model: str,
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        return {
            "id": uuid4(),
            "user_id": user_id,
            "name": name,
            "description": description,
            "system_prompt": system_prompt,
            "provider": provider,
            "model": model,
            "temperature": Decimal("1.00"),
            "max_tokens": 1024,
            "created_at": now,
            "updated_at": now,
        }


@pytest.fixture
def agent_client(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[tuple[TestClient, FakeDatabase]]:
    database = FakeDatabase()
    user = UserProfile(
        id="google-user-1",
        email="person@example.com",
        name="Test Person",
        picture=None,
    )
    monkeypatch.setattr(agents, "_connect_agents_db", lambda: database)
    app.dependency_overrides[get_current_user] = lambda: user

    with TestClient(app) as client:
        yield client, database

    app.dependency_overrides.pop(get_current_user, None)


def agent_payload(**overrides: Any) -> dict[str, Any]:
    return {
        "name": "Support assistant",
        "description": "Helps customers",
        "system_prompt": "Be helpful and accurate.",
        "provider": "openai",
        "model": "gpt-test",
        **overrides,
    }


def test_agent_crud_endpoints(
    agent_client: tuple[TestClient, FakeDatabase],
) -> None:
    client, database = agent_client

    created = client.post("/agents", json=agent_payload())

    assert created.status_code == 201
    assert created.json()["name"] == "Support assistant"
    assert created.json()["provider"] == "openai"
    agent_id = created.json()["id"]

    listed = client.get("/agents?limit=10&offset=0")
    assert listed.status_code == 200
    assert [agent["id"] for agent in listed.json()] == [agent_id]
    assert any("LIMIT %s OFFSET %s" in query for query, _ in database.queries)

    fetched = client.get(f"/agents/{agent_id}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == agent_id

    updated = client.patch(
        f"/agents/{agent_id}",
        json={"name": "Updated assistant", "description": None},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated assistant"
    assert updated.json()["description"] is None

    deleted = client.delete(f"/agents/{agent_id}")
    assert deleted.status_code == 204
    assert client.get(f"/agents/{agent_id}").status_code == 404

    scoped_queries = [
        (query, parameters)
        for query, parameters in database.queries
        if query.startswith(
            ("INSERT INTO agents", "SELECT", "UPDATE agents", "DELETE FROM agents")
        )
    ]
    assert all("user_id" in query for query, _ in scoped_queries)
    assert all("google-user-1" in parameters for _, parameters in scoped_queries)


def test_agent_routes_hide_agents_owned_by_other_users(
    agent_client: tuple[TestClient, FakeDatabase],
) -> None:
    client, database = agent_client
    other_agent = database.make_row(
        "another-google-user",
        "Private agent",
        None,
        "Do not expose me.",
        "anthropic",
        "claude-test",
    )
    database.rows[other_agent["id"]] = other_agent

    assert client.get("/agents").json() == []
    assert client.get(f"/agents/{other_agent['id']}").status_code == 404
    assert (
        client.patch(
            f"/agents/{other_agent['id']}", json={"name": "Changed"}
        ).status_code
        == 404
    )
    assert client.delete(f"/agents/{other_agent['id']}").status_code == 404
    assert other_agent["id"] in database.rows


@pytest.mark.parametrize(
    "payload",
    [
        {**agent_payload(), "provider": "unsupported"},
        {**agent_payload(), "name": ""},
    ],
)
def test_agent_create_validates_fields(
    agent_client: tuple[TestClient, FakeDatabase], payload: dict[str, Any]
) -> None:
    client, _ = agent_client

    assert client.post("/agents", json=payload).status_code == 422


def test_agent_patch_and_pagination_validate_input(
    agent_client: tuple[TestClient, FakeDatabase],
) -> None:
    client, _ = agent_client

    assert client.patch(f"/agents/{uuid4()}", json={}).status_code == 422
    assert client.patch(f"/agents/{uuid4()}", json={"name": None}).status_code == 422
    assert client.get("/agents?limit=0").status_code == 422
    assert client.get("/agents?offset=-1").status_code == 422


def test_agent_routes_require_authentication(
    agent_client: tuple[TestClient, FakeDatabase],
) -> None:
    client, _ = agent_client
    app.dependency_overrides.pop(get_current_user, None)

    response = client.get("/agents")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"
