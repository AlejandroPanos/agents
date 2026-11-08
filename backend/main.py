from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.agents import router as agents_router
from routers.auth import router as auth_router
from routers.health import router as health_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(agents_router, prefix="/agents", tags=["agents"])
app.include_router(health_router, prefix="/health", tags=["health"])
