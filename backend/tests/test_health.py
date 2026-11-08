from fastapi.testclient import TestClient

from main import app


def test_health_route_returns_healthy_status() -> None:
    with TestClient(app) as client:
        response = client.get("/health/")

    assert response.status_code == 200
    assert response.json() == {
        "app": "agents",
        "status": "healthy",
        "version": "1.0.0",
    }
