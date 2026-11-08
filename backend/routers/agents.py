from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field, model_validator
from psycopg import AsyncConnection
from psycopg.errors import UniqueViolation

from routers.auth import UserProfile, _connect_db, get_current_user

router = APIRouter()

AgentProvider = Literal["anthropic", "openai", "google", "deepseek"]
AGENT_COLUMNS = """
	id, name, description, system_prompt, provider, model,
	temperature, max_tokens, created_at, updated_at
"""


class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    system_prompt: str = Field(min_length=1)
    provider: AgentProvider
    model: str = Field(min_length=1, max_length=100)


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    system_prompt: str | None = Field(default=None, min_length=1)
    provider: AgentProvider | None = None
    model: str | None = Field(default=None, min_length=1, max_length=100)

    @model_validator(mode="after")
    def validate_changes(self) -> AgentUpdate:
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        for field in ("name", "system_prompt", "provider", "model"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class AgentResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    system_prompt: str
    provider: AgentProvider
    model: str
    temperature: float
    max_tokens: int
    created_at: datetime
    updated_at: datetime


@asynccontextmanager
async def _connect_agents_db() -> AsyncGenerator[AsyncConnection[dict[str, Any]], None]:
    async with _connect_db() as db:
        await db.execute("""
			CREATE TABLE IF NOT EXISTS agents (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				name VARCHAR(100) NOT NULL,
				description TEXT,
				system_prompt TEXT NOT NULL,
				provider VARCHAR(20) NOT NULL
                    CHECK (provider IN ('anthropic', 'openai', 'google', 'deepseek')),
				model VARCHAR(100) NOT NULL,
				temperature NUMERIC(3, 2) NOT NULL DEFAULT 1.00
					CHECK (temperature >= 0 AND temperature <= 2),
				max_tokens INTEGER NOT NULL DEFAULT 1024 CHECK (max_tokens > 0),
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				CONSTRAINT uq_agents_user_id_name UNIQUE (user_id, name)
			)
			""")
        yield db


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Agent not found",
    )


async def _database_user_id(
    db: AsyncConnection[dict[str, Any]], user: UserProfile
) -> UUID:
    cursor = await db.execute(
        "SELECT id FROM users WHERE google_sub = %s",
        (user.id,),
    )
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )
    return row["id"]


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    body: AgentCreate,
    user: Annotated[UserProfile, Depends(get_current_user)],
) -> AgentResponse:
    try:
        async with _connect_agents_db() as db:
            user_id = await _database_user_id(db, user)
            cursor = await db.execute(
                f"""
				INSERT INTO agents
					(user_id, name, description, system_prompt, provider, model)
				VALUES (%s, %s, %s, %s, %s, %s)
				RETURNING {AGENT_COLUMNS}
				""",
                (
                    user_id,
                    body.name,
                    body.description,
                    body.system_prompt,
                    body.provider,
                    body.model,
                ),
            )
            agent = await cursor.fetchone()
    except UniqueViolation as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An agent with this name already exists",
        ) from exc
    return AgentResponse.model_validate(agent)


@router.get("", response_model=list[AgentResponse])
async def list_agents(
    user: Annotated[UserProfile, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[AgentResponse]:
    async with _connect_agents_db() as db:
        user_id = await _database_user_id(db, user)
        cursor = await db.execute(
            f"""
			SELECT {AGENT_COLUMNS}
			FROM agents
			WHERE user_id = %s
			ORDER BY created_at DESC, id
			LIMIT %s OFFSET %s
			""",
            (user_id, limit, offset),
        )
        agents = await cursor.fetchall()
    return [AgentResponse.model_validate(agent) for agent in agents]


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: UUID,
    user: Annotated[UserProfile, Depends(get_current_user)],
) -> AgentResponse:
    async with _connect_agents_db() as db:
        user_id = await _database_user_id(db, user)
        cursor = await db.execute(
            f"""
			SELECT {AGENT_COLUMNS}
			FROM agents
			WHERE id = %s AND user_id = %s
			""",
            (agent_id, user_id),
        )
        agent = await cursor.fetchone()
    if agent is None:
        raise _not_found()
    return AgentResponse.model_validate(agent)


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: UUID,
    body: AgentUpdate,
    user: Annotated[UserProfile, Depends(get_current_user)],
) -> AgentResponse:
    changes = body.model_dump(exclude_unset=True)
    assignments = ", ".join(f"{field} = %s" for field in changes)
    try:
        async with _connect_agents_db() as db:
            user_id = await _database_user_id(db, user)
            cursor = await db.execute(
                f"""
				UPDATE agents
				SET {assignments}, updated_at = now()
				WHERE id = %s AND user_id = %s
				RETURNING {AGENT_COLUMNS}
				""",
                (*changes.values(), agent_id, user_id),
            )
            agent = await cursor.fetchone()
    except UniqueViolation as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An agent with this name already exists",
        ) from exc
    if agent is None:
        raise _not_found()
    return AgentResponse.model_validate(agent)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: UUID,
    user: Annotated[UserProfile, Depends(get_current_user)],
) -> Response:
    async with _connect_agents_db() as db:
        user_id = await _database_user_id(db, user)
        cursor = await db.execute(
            "DELETE FROM agents WHERE id = %s AND user_id = %s RETURNING id",
            (agent_id, user_id),
        )
        deleted_agent = await cursor.fetchone()
    if deleted_agent is None:
        raise _not_found()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
