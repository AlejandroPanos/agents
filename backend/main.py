from fastapi import FastAPI

from routers.auth import router as auth_router
from routers.health import router as health_router

app = FastAPI()
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(health_router, prefix="/health", tags=["health"])
