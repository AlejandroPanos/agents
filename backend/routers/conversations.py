from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field, field_validator
from psycopg import AsyncConnection

from routers.agents import _connect_agents_db, _database_user_id
from routers.auth import UserProfile, get_current_user

router = APIRouter()

CONVERSATION_COLUMNS = "id, agent_id, title, created_at, updated_at"
MESSAGE_COLUMNS = """
    id, conversation_id, role, content, model,
    input_tokens, output_tokens, created_at
"""


class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)


class ConversationResponse(BaseModel):
    id: UUID
    agent_id: UUID
    title: str | None
    created_at: datetime
    updated_at: datetime


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    role: Literal["user", "assistant"]
    content: str
    model: str | None
    input_tokens: int | None
    output_tokens: int | None
    created_at: datetime


class ConversationWithMessages(ConversationResponse):
    messages: list[MessageResponse]


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=32_000)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message content cannot be blank")
        return value


class SendMessageResponse(BaseModel):
    user_message: MessageResponse
    assistant_message: MessageResponse


@asynccontextmanager
async def _connect_conversations_db() -> (
    AsyncGenerator[AsyncConnection[dict[str, Any]], None]
):
    async with _connect_agents_db() as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(200),
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                conversation_id UUID NOT NULL
                    REFERENCES conversations(id) ON DELETE CASCADE,
                role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                model VARCHAR(100),
                input_tokens INTEGER,
                output_tokens INTEGER,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """)
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_conversations_agent_id "
            "ON conversations (agent_id)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_conversations_user_id "
            "ON conversations (user_id)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_conversation_created "
            "ON messages (conversation_id, created_at)"
        )
        yield db


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Conversation not found",
    )


async def _owned_agent(
    db: AsyncConnection[dict[str, Any]], agent_id: UUID, user_id: UUID
) -> dict[str, Any]:
    cursor = await db.execute(
        "SELECT id FROM agents WHERE id = %s AND user_id = %s",
        (agent_id, user_id),
    )
    agent = await cursor.fetchone()
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    return agent


async def _owned_conversation(
    db: AsyncConnection[dict[str, Any]], conversation_id: UUID, user_id: UUID
) -> dict[str, Any]:
    cursor = await db.execute(
        f"""
        SELECT {CONVERSATION_COLUMNS}
        FROM conversations
        WHERE id = %s AND user_id = %s
        """,
        (conversation_id, user_id),
    )
    conversation = await cursor.fetchone()
    if conversation is None:
        raise _not_found()
    return conversation


async def _generate_reply(
    agent: dict[str, Any], history: list[dict[str, str]], user_content: str
) -> tuple[str, int | None, int | None]:
    provider = agent["provider"]
    key_names = {
        "openai": "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "google": "GOOGLE_API_KEY",
        "deepseek": "DEEPSEEK_API_KEY",
    }
    if provider not in key_names:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"Message generation for {provider} is not implemented",
        )

    api_key = os.getenv(key_names[provider])
    if not api_key:
        provider_name = {
            "openai": "OpenAI",
            "anthropic": "Anthropic",
            "google": "Google",
            "deepseek": "DeepSeek",
        }[provider]
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{provider_name} API is not configured",
        )

    messages = [*history, {"role": "user", "content": user_content}]
    if provider in {"openai", "deepseek"}:
        url = (
            "https://api.openai.com/v1/chat/completions"
            if provider == "openai"
            else "https://api.deepseek.com/chat/completions"
        )
        headers = {"Authorization": f"Bearer {api_key}"}
        payload = {
            "model": agent["model"],
            "messages": [
                {"role": "system", "content": agent["system_prompt"]},
                *messages,
            ],
            "temperature": float(agent["temperature"]),
            "max_tokens": agent["max_tokens"],
        }
    elif provider == "anthropic":
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        }
        payload = {
            "model": agent["model"],
            "system": agent["system_prompt"],
            "messages": messages,
            "temperature": float(agent["temperature"]),
            "max_tokens": agent["max_tokens"],
        }
    else:
        model_id = agent["model"].removeprefix("models/")
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model_id}:generateContent"
        )
        headers = {"x-goog-api-key": api_key}
        payload = {
            "systemInstruction": {"parts": [{"text": agent["system_prompt"]}]},
            "contents": [
                {
                    "role": "user" if message["role"] == "user" else "model",
                    "parts": [{"text": message["content"]}],
                }
                for message in messages
            ],
            "generationConfig": {
                "temperature": float(agent["temperature"]),
                "maxOutputTokens": agent["max_tokens"],
            },
        }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            result = response.json()
        if provider in {"openai", "deepseek"}:
            reply = result["choices"][0]["message"]["content"]
            usage = result.get("usage", {})
            input_tokens = usage.get("prompt_tokens")
            output_tokens = usage.get("completion_tokens")
        elif provider == "anthropic":
            reply = "".join(
                block["text"]
                for block in result["content"]
                if block.get("type") == "text"
            )
            usage = result.get("usage", {})
            input_tokens = usage.get("input_tokens")
            output_tokens = usage.get("output_tokens")
        else:
            reply = "".join(
                part["text"]
                for part in result["candidates"][0]["content"]["parts"]
                if "text" in part
            )
            usage = result.get("usageMetadata", {})
            input_tokens = usage.get("promptTokenCount")
            output_tokens = usage.get("candidatesTokenCount")
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The configured agent provider could not generate a reply",
        ) from exc

    if not isinstance(reply, str) or not reply.strip():
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The configured agent provider returned an empty reply",
        )
    return reply.strip(), input_tokens, output_tokens


@router.post(
    "/agents/{agent_id}/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    agent_id: UUID,
    user: Annotated[UserProfile, Depends(get_current_user)],
    body: ConversationCreate | None = None,
) -> ConversationResponse:
    async with _connect_conversations_db() as db:
        user_id = await _database_user_id(db, user)
        await _owned_agent(db, agent_id, user_id)
        cursor = await db.execute(
            f"""
            INSERT INTO conversations (agent_id, user_id, title)
            VALUES (%s, %s, %s)
            RETURNING {CONVERSATION_COLUMNS}
            """,
            (agent_id, user_id, body.title if body is not None else None),
        )
        conversation = await cursor.fetchone()
    return ConversationResponse.model_validate(conversation)


@router.get(
    "/agents/{agent_id}/conversations", response_model=list[ConversationResponse]
)
async def list_conversations(
    agent_id: UUID,
    user: Annotated[UserProfile, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[ConversationResponse]:
    async with _connect_conversations_db() as db:
        user_id = await _database_user_id(db, user)
        await _owned_agent(db, agent_id, user_id)
        cursor = await db.execute(
            f"""
            SELECT {CONVERSATION_COLUMNS}
            FROM conversations
            WHERE agent_id = %s AND user_id = %s
            ORDER BY updated_at DESC, id
            LIMIT %s OFFSET %s
            """,
            (agent_id, user_id, limit, offset),
        )
        conversations = await cursor.fetchall()
    return [
        ConversationResponse.model_validate(conversation)
        for conversation in conversations
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationWithMessages)
async def get_conversation(
    conversation_id: UUID,
    user: Annotated[UserProfile, Depends(get_current_user)],
) -> ConversationWithMessages:
    async with _connect_conversations_db() as db:
        user_id = await _database_user_id(db, user)
        conversation = await _owned_conversation(db, conversation_id, user_id)
        cursor = await db.execute(
            f"""
            SELECT {MESSAGE_COLUMNS}
            FROM messages
            WHERE conversation_id = %s
            ORDER BY created_at, id
            """,
            (conversation_id,),
        )
        messages = await cursor.fetchall()
    return ConversationWithMessages.model_validate(
        {**conversation, "messages": messages}
    )


@router.delete(
    "/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_conversation(
    conversation_id: UUID,
    user: Annotated[UserProfile, Depends(get_current_user)],
) -> Response:
    async with _connect_conversations_db() as db:
        user_id = await _database_user_id(db, user)
        cursor = await db.execute(
            "DELETE FROM conversations WHERE id = %s AND user_id = %s RETURNING id",
            (conversation_id, user_id),
        )
        deleted = await cursor.fetchone()
    if deleted is None:
        raise _not_found()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/conversations/{conversation_id}/messages", response_model=SendMessageResponse
)
async def send_message(
    conversation_id: UUID,
    body: SendMessageRequest,
    user: Annotated[UserProfile, Depends(get_current_user)],
) -> SendMessageResponse:
    async with _connect_conversations_db() as db:
        user_id = await _database_user_id(db, user)
        cursor = await db.execute(
            """
            SELECT a.id, a.system_prompt, a.provider, a.model, a.temperature,
                   a.max_tokens
            FROM conversations AS c
            JOIN agents AS a ON a.id = c.agent_id
            WHERE c.id = %s AND c.user_id = %s
            """,
            (conversation_id, user_id),
        )
        agent = await cursor.fetchone()
        if agent is None:
            raise _not_found()
        cursor = await db.execute(
            """
            SELECT role, content
            FROM messages
            WHERE conversation_id = %s
            ORDER BY created_at, id
            """,
            (conversation_id,),
        )
        history = await cursor.fetchall()

    reply, input_tokens, output_tokens = await _generate_reply(
        agent, history, body.content
    )

    async with _connect_conversations_db() as db:
        user_id = await _database_user_id(db, user)
        await _owned_conversation(db, conversation_id, user_id)
        user_cursor = await db.execute(
            f"""
            INSERT INTO messages (conversation_id, role, content)
            VALUES (%s, 'user', %s)
            RETURNING {MESSAGE_COLUMNS}
            """,
            (conversation_id, body.content),
        )
        user_message = await user_cursor.fetchone()
        assistant_cursor = await db.execute(
            f"""
            INSERT INTO messages
                (conversation_id, role, content, model, input_tokens, output_tokens)
            VALUES (%s, 'assistant', %s, %s, %s, %s)
            RETURNING {MESSAGE_COLUMNS}
            """,
            (
                conversation_id,
                reply,
                agent["model"],
                input_tokens,
                output_tokens,
            ),
        )
        assistant_message = await assistant_cursor.fetchone()
        await db.execute(
            "UPDATE conversations SET updated_at = now() WHERE id = %s",
            (conversation_id,),
        )

    return SendMessageResponse(
        user_message=MessageResponse.model_validate(user_message),
        assistant_message=MessageResponse.model_validate(assistant_message),
    )


@router.get(
    "/conversations/{conversation_id}/messages", response_model=list[MessageResponse]
)
async def list_messages(
    conversation_id: UUID,
    user: Annotated[UserProfile, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[MessageResponse]:
    async with _connect_conversations_db() as db:
        user_id = await _database_user_id(db, user)
        await _owned_conversation(db, conversation_id, user_id)
        cursor = await db.execute(
            f"""
            SELECT {MESSAGE_COLUMNS}
            FROM messages
            WHERE conversation_id = %s
            ORDER BY created_at, id
            LIMIT %s OFFSET %s
            """,
            (conversation_id, limit, offset),
        )
        messages = await cursor.fetchall()
    return [MessageResponse.model_validate(message) for message in messages]
