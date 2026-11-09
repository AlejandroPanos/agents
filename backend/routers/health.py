from fastapi import APIRouter, Request

from rate_limit import ENDPOINT_RATE_LIMIT, limiter

router = APIRouter()


@router.get("/")
@limiter.limit(ENDPOINT_RATE_LIMIT)
def health(request: Request):
    return {"app": "agents", "status": "healthy", "version": "1.0.0"}
