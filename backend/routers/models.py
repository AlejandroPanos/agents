from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from routers.auth import _connect_db

router = APIRouter()


class ModelOption(BaseModel):
    provider: str
    model_id: str
    display_name: str
    max_output_tokens: int
    max_temperature: float


class ModelsResponse(BaseModel):
    models: list[ModelOption]


@router.get("/models", response_model=ModelsResponse)
async def get_models() -> ModelsResponse:
    async with _connect_db() as db:
        cursor = await db.execute("""
            SELECT provider, model_id, display_name,
                   max_output_tokens, max_temperature
            FROM models
            WHERE enabled = TRUE
            ORDER BY provider, display_name
            """)
        rows: list[dict[str, Any]] = await cursor.fetchall()
    return ModelsResponse(models=[ModelOption.model_validate(row) for row in rows])
