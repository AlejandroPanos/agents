from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def health():
    return {"app": "agents", "status": "healthy", "version": "1.0.0"}
