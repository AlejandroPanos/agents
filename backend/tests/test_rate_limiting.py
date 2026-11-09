from fastapi.testclient import TestClient

from main import app, limiter


def test_endpoints_are_rate_limited() -> None:
    limiter.reset()
    with TestClient(app, client=("198.51.100.10", 50000)) as client:
        responses = [client.get("/health/") for _ in range(61)]

    assert all(response.status_code == 200 for response in responses[:60])
    assert responses[60].status_code == 429
