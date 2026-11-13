from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

import routers.conversations as conversations
from main import app
from routers.auth import UserProfile, get_current_user

USER_ID = UUID("00000000-0000-0000-0000-000000000001")
OTHER_USER_ID = UUID("00000000-0000-0000-0000-000000000002")
AGENT_ID = UUID("00000000-0000-0000-0000-000000000011")


class FakeCursor:
    def __init__(self, row: dict[str, Any] | list[dict[str, Any]] | None = None):
        self.row = row

    async def fetchone(self) -> dict[str, Any] | None:
        return self.row if isinstance(self.row, dict) else None

    async def fetchall(self) -> list[dict[str, Any]]:
        return self.row if isinstance(self.row, list) else []


class FakeDatabase:
    def __init__(self) -> None:
        self.user_ids = {"google-user-1": USER_ID}
        self.agents = {
            AGENT_ID: {
                "id": AGENT_ID,
                "user_id": USER_ID,
                "system_prompt": "Be helpful.",
                "provider": "openai",
                "model": "gpt-test",
                "temperature": Decimal("1.00"),
                "max_tokens": 512,
            }
        }
        self.conversations: dict[UUID, dict[str, Any]] = {}
        self.messages: list[dict[str, Any]] = []

    async def __aenter__(self) -> FakeDatabase:
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        return None

    async def execute(self, query: str, parameters: tuple[Any, ...] = ()) -> FakeCursor:
        normalized = " ".join(query.split())
        if normalized.startswith(("CREATE TABLE", "CREATE INDEX")):
            return FakeCursor()
        if normalized.startswith("SELECT id FROM users"):
            user_id = self.user_ids.get(parameters[0])
            return FakeCursor({"id": user_id} if user_id else None)
        if normalized.startswith("SELECT id FROM agents"):
            agent_id, user_id = parameters
            agent = self.agents.get(agent_id)
            return FakeCursor(
                {"id": agent_id} if agent and agent["user_id"] == user_id else None
            )
        if normalized.startswith("INSERT INTO conversations"):
            agent_id, user_id, title = parameters
            conversation = self.make_conversation(agent_id, user_id, title)
            self.conversations[conversation["id"]] = conversation
            return FakeCursor(conversation)
        if normalized.startswith("SELECT a.id"):
            conversation_id, user_id = parameters
            conversation = self.conversations.get(conversation_id)
            if conversation is None or conversation["user_id"] != user_id:
                return FakeCursor()
            return FakeCursor(self.agents.get(conversation["agent_id"]))
        if normalized.startswith("SELECT") and "FROM conversations" in normalized:
            if "WHERE id = %s AND user_id = %s" in normalized:
                conversation_id, user_id = parameters
                conversation = self.conversations.get(conversation_id)
                return FakeCursor(
                    conversation
                    if conversation and conversation["user_id"] == user_id
                    else None
                )
            agent_id, user_id, limit, offset = parameters
            matching = [
                conversation
                for conversation in self.conversations.values()
                if conversation["agent_id"] == agent_id
                and conversation["user_id"] == user_id
            ]
            matching.sort(key=lambda item: (item["updated_at"], str(item["id"])))
            matching.reverse()
            return FakeCursor(matching[offset : offset + limit])
        if normalized.startswith("DELETE FROM conversations"):
            conversation_id, user_id = parameters
            conversation = self.conversations.get(conversation_id)
            if conversation is None or conversation["user_id"] != user_id:
                return FakeCursor()
            del self.conversations[conversation_id]
            self.messages = [
                message
                for message in self.messages
                if message["conversation_id"] != conversation_id
            ]
            return FakeCursor({"id": conversation_id})
        if normalized.startswith("UPDATE conversations SET title = %s"):
            title, conversation_id, user_id = parameters
            conversation = self.conversations.get(conversation_id)
            if conversation is None or conversation["user_id"] != user_id:
                return FakeCursor()
            conversation["title"] = title
            conversation["updated_at"] = datetime.now(timezone.utc)
            return FakeCursor(conversation)
        if normalized.startswith("SELECT role, content FROM messages"):
            conversation_id = parameters[0]
            return FakeCursor(
                [
                    {"role": message["role"], "content": message["content"]}
                    for message in self.messages
                    if message["conversation_id"] == conversation_id
                ]
            )
        if normalized.startswith("INSERT INTO messages"):
            if "'user'" in normalized:
                conversation_id, content = parameters
                message = self.make_message(conversation_id, "user", content)
            else:
                conversation_id, content, model, input_tokens, output_tokens = (
                    parameters
                )
                message = self.make_message(
                    conversation_id,
                    "assistant",
                    content,
                    model,
                    input_tokens,
                    output_tokens,
                )
            self.messages.append(message)
            return FakeCursor(message)
        if normalized.startswith("UPDATE conversations"):
            conversation = self.conversations.get(parameters[0])
            if conversation:
                conversation["updated_at"] = datetime.now(timezone.utc)
            return FakeCursor()
        if normalized.startswith("SELECT") and "FROM messages" in normalized:
            conversation_id = parameters[0]
            matching = [
                message
                for message in self.messages
                if message["conversation_id"] == conversation_id
            ]
            if "LIMIT %s OFFSET %s" not in normalized:
                return FakeCursor(matching)
            limit, offset = parameters[1:]
            return FakeCursor(matching[offset : offset + limit])
        raise AssertionError(f"Unexpected SQL query: {normalized}")

    @staticmethod
    def make_conversation(
        agent_id: UUID, user_id: UUID, title: str | None
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        return {
            "id": uuid4(),
            "agent_id": agent_id,
            "user_id": user_id,
            "title": title,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def make_message(
        conversation_id: UUID,
        role: str,
        content: str,
        model: str | None = None,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
    ) -> dict[str, Any]:
        return {
            "id": uuid4(),
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "created_at": datetime.now(timezone.utc),
        }


@pytest.fixture
def conversation_client(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[tuple[TestClient, FakeDatabase]]:
    database = FakeDatabase()
    user = UserProfile(
        id="google-user-1",
        email="person@example.com",
        name="Test Person",
        picture=None,
    )
    monkeypatch.setattr(conversations, "_connect_conversations_db", lambda: database)
    app.dependency_overrides[get_current_user] = lambda: user

    with TestClient(app) as client:
        yield client, database

    app.dependency_overrides.pop(get_current_user, None)


async def fake_reply(
    agent: dict[str, Any], history: list[dict[str, str]], content: str
) -> tuple[str, int, int]:
    return f"Reply to: {content}", 3, 5


def test_conversation_and_message_lifecycle(
    conversation_client: tuple[TestClient, FakeDatabase],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, database = conversation_client
    monkeypatch.setattr(conversations, "_generate_reply", fake_reply)

    created = client.post(f"/agents/{AGENT_ID}/conversations", json={"title": "First"})
    assert created.status_code == 201
    conversation_id = created.json()["id"]
    assert created.json()["title"] == "First"

    first_reply = client.post(
        f"/conversations/{conversation_id}/messages", json={"content": "Hello"}
    )
    assert first_reply.status_code == 200
    assert first_reply.json()["user_message"]["content"] == "Hello"
    assert first_reply.json()["assistant_message"]["content"] == "Reply to: Hello"
    assert first_reply.json()["assistant_message"]["input_tokens"] == 3

    second_reply = client.post(
        f"/conversations/{conversation_id}/messages", json={"content": "Again"}
    )
    assert second_reply.status_code == 200
    assert len(database.messages) == 4

    history = client.get(f"/conversations/{conversation_id}/messages?limit=2&offset=2")
    assert history.status_code == 200
    assert [message["content"] for message in history.json()] == [
        "Again",
        "Reply to: Again",
    ]

    detail = client.get(f"/conversations/{conversation_id}")
    assert detail.status_code == 200
    assert len(detail.json()["messages"]) == 4

    listed = client.get(f"/agents/{AGENT_ID}/conversations?limit=10&offset=0")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [conversation_id]

    renamed = client.patch(
        f"/conversations/{conversation_id}", json={"title": "Updated title"}
    )
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Updated title"

    deleted = client.delete(f"/conversations/{conversation_id}")
    assert deleted.status_code == 204
    assert client.get(f"/conversations/{conversation_id}").status_code == 404
    assert database.messages == []


def test_conversation_routes_enforce_ownership(
    conversation_client: tuple[TestClient, FakeDatabase],
) -> None:
    client, database = conversation_client
    other_conversation = database.make_conversation(AGENT_ID, OTHER_USER_ID, "Private")
    database.conversations[other_conversation["id"]] = other_conversation

    response = client.get(f"/conversations/{other_conversation['id']}")

    assert response.status_code == 404
    assert (
        client.delete(f"/conversations/{other_conversation['id']}").status_code == 404
    )
    assert (
        client.patch(
            f"/conversations/{other_conversation['id']}",
            json={"title": "Changed"},
        ).status_code
        == 404
    )


def test_conversation_rename_rejects_blank_title(
    conversation_client: tuple[TestClient, FakeDatabase],
) -> None:
    client, _ = conversation_client
    created = client.post(f"/agents/{AGENT_ID}/conversations", json={"title": "Existing"})

    response = client.patch(
        f"/conversations/{created.json()['id']}", json={"title": "   "}
    )

    assert response.status_code == 422


def test_conversation_creation_requires_an_owned_agent(
    conversation_client: tuple[TestClient, FakeDatabase],
) -> None:
    client, _ = conversation_client

    response = client.post(f"/agents/{uuid4()}/conversations")

    assert response.status_code == 404
    assert response.json()["detail"] == "Agent not found"


def test_message_requires_provider_configuration(
    conversation_client: tuple[TestClient, FakeDatabase],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, database = conversation_client
    database.agents[AGENT_ID]["provider"] = "google"
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    created = client.post(f"/agents/{AGENT_ID}/conversations")
    conversation_id = created.json()["id"]

    response = client.post(
        f"/conversations/{conversation_id}/messages", json={"content": "Hello"}
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Google API is not configured"
    assert database.messages == []


def test_message_rejects_unknown_provider(
    conversation_client: tuple[TestClient, FakeDatabase],
) -> None:
    client, database = conversation_client
    database.agents[AGENT_ID]["provider"] = "unknown"
    created = client.post(f"/agents/{AGENT_ID}/conversations")
    conversation_id = created.json()["id"]

    response = client.post(
        f"/conversations/{conversation_id}/messages", json={"content": "Hello"}
    )

    assert response.status_code == 501
    assert response.json()["detail"] == (
        "Message generation for unknown is not implemented"
    )
    assert database.messages == []


@pytest.mark.parametrize(
    (
        "provider",
        "key_name",
        "url",
        "provider_result",
        "input_tokens",
        "output_tokens",
    ),
    [
        (
            "openai",
            "OPENAI_API_KEY",
            "https://api.openai.com/v1/chat/completions",
            {
                "choices": [{"message": {"content": "OpenAI reply"}}],
                "usage": {"prompt_tokens": 7, "completion_tokens": 4},
            },
            7,
            4,
        ),
        (
            "anthropic",
            "ANTHROPIC_API_KEY",
            "https://api.anthropic.com/v1/messages",
            {
                "content": [{"type": "text", "text": "Anthropic reply"}],
                "usage": {"input_tokens": 8, "output_tokens": 5},
            },
            8,
            5,
        ),
        (
            "deepseek",
            "DEEPSEEK_API_KEY",
            "https://api.deepseek.com/chat/completions",
            {
                "choices": [{"message": {"content": "DeepSeek reply"}}],
                "usage": {"prompt_tokens": 9, "completion_tokens": 6},
            },
            9,
            6,
        ),
        (
            "google",
            "GOOGLE_API_KEY",
            "https://generativelanguage.googleapis.com/v1beta/models/gpt-test:generateContent",
            {
                "candidates": [{"content": {"parts": [{"text": "Google reply"}]}}],
                "usageMetadata": {
                    "promptTokenCount": 10,
                    "candidatesTokenCount": 7,
                },
            },
            10,
            7,
        ),
    ],
)
def test_message_provider_adapters(
    conversation_client: tuple[TestClient, FakeDatabase],
    monkeypatch: pytest.MonkeyPatch,
    provider: str,
    key_name: str,
    url: str,
    provider_result: dict[str, Any],
    input_tokens: int,
    output_tokens: int,
) -> None:
    client, database = conversation_client
    database.agents[AGENT_ID]["provider"] = provider
    monkeypatch.setenv(key_name, "test-provider-key")
    requests: list[dict[str, Any]] = []

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, Any]:
            return provider_result

    class FakeProviderClient:
        async def __aenter__(self) -> FakeProviderClient:
            return self

        async def __aexit__(self, *exc_info: object) -> None:
            return None

        async def post(
            self, request_url: str, *, headers: dict[str, str], json: dict[str, Any]
        ) -> FakeResponse:
            requests.append({"url": request_url, "headers": headers, "json": json})
            return FakeResponse()

    monkeypatch.setattr(
        conversations.httpx, "AsyncClient", lambda **kwargs: FakeProviderClient()
    )
    created = client.post(f"/agents/{AGENT_ID}/conversations")
    conversation_id = created.json()["id"]

    response = client.post(
        f"/conversations/{conversation_id}/messages", json={"content": "Hi"}
    )

    assert response.status_code == 200
    assert response.json()["assistant_message"]["content"].endswith("reply")
    assert response.json()["assistant_message"]["input_tokens"] == input_tokens
    assert response.json()["assistant_message"]["output_tokens"] == output_tokens
    assert requests[0]["url"] == url
    if provider in {"openai", "deepseek"}:
        assert requests[0]["headers"]["Authorization"] == "Bearer test-provider-key"
        assert requests[0]["json"]["messages"][0] == {
            "role": "system",
            "content": "Be helpful.",
        }
    elif provider == "anthropic":
        assert requests[0]["headers"]["x-api-key"] == "test-provider-key"
        assert requests[0]["json"]["system"] == "Be helpful."
    else:
        assert requests[0]["headers"]["x-goog-api-key"] == "test-provider-key"
        assert requests[0]["json"]["systemInstruction"] == {
            "parts": [{"text": "Be helpful."}]
        }
        assert requests[0]["json"]["contents"] == [
            {"role": "user", "parts": [{"text": "Hi"}]}
        ]
        assert requests[0]["json"]["generationConfig"]["maxOutputTokens"] == 512
