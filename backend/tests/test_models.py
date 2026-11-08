from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

import routers.models as models
from main import app


class FakeCursor:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    async def fetchall(self) -> list[dict[str, Any]]:
        return self.rows


class FakeDatabase:
    def __init__(self) -> None:
        self.query = ""
        self.rows = [
            {
                "provider": "openai",
                "model_id": "gpt-test",
                "display_name": "Test GPT",
                "max_output_tokens": 4096,
                "max_temperature": 2.0,
                "enabled": True,
            },
            {
                "provider": "google",
                "model_id": "disabled-model",
                "display_name": "Disabled model",
                "max_output_tokens": 2048,
                "max_temperature": 1.0,
                "enabled": False,
            },
        ]

    async def __aenter__(self) -> FakeDatabase:
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        return None

    async def execute(self, query: str) -> FakeCursor:
        self.query = query
        return FakeCursor([row for row in self.rows if row["enabled"]])


@pytest.fixture
def models_client(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[tuple[TestClient, FakeDatabase]]:
    database = FakeDatabase()
    monkeypatch.setattr(models, "_connect_db", lambda: database)
    with TestClient(app) as client:
        yield client, database


def test_get_models_returns_enabled_catalog_entries(
    models_client: tuple[TestClient, FakeDatabase],
) -> None:
    client, database = models_client

    response = client.get("/models")

    assert response.status_code == 200
    assert response.json() == {
        "models": [
            {
                "provider": "openai",
                "model_id": "gpt-test",
                "display_name": "Test GPT",
                "max_output_tokens": 4096,
                "max_temperature": 2.0,
            }
        ]
    }
    assert "WHERE enabled = TRUE" in database.query
    assert "ORDER BY provider, display_name" in database.query
