import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from pictomarket_ia.cargar import load_policy  # noqa: E402

client = TestClient(app)


def test_health_lists_policies():
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["policies"] == ["id3", "qlearning", "reglas"]


def test_policy_matches_ia_models_for_every_policy():
    feats = [1, 1, 2, 3, 1, 1, 1]
    for name in ("reglas", "id3", "qlearning"):
        response = client.post("/policy/next", json={"policy": name, "features": feats})
        assert response.status_code == 200
        assert response.json()["action"] == load_policy(name).act(tuple(feats))


def test_rules_policy_escalates():
    actions = [
        client.post(
            "/policy/next", json={"policy": "reglas", "features": [f, 0, 2, 3, 1, 0, 1]}
        ).json()["name"]
        for f in range(4)
    ]
    assert actions == ["a1", "a2", "a3", "a3"]


def test_invalid_features_are_rejected():
    assert client.post("/policy/next", json={"features": [1, 2]}).status_code == 422
    assert (
        client.post("/policy/next", json={"features": [9, 0, 0, 1, 1, 0, 0]}).status_code
        == 422
    )
    assert (
        client.post("/policy/next", json={"policy": "x", "features": [0, 0, 0, 1, 0, 0, 0]}).status_code
        == 422
    )


def test_sessions_are_anonymous_and_summarised():
    for turns in (6, 10):
        client.post(
            "/sessions",
            json={"policy": "qlearning", "scenario": "almuerzo_casa", "turns": turns, "errors": 2, "completed": True},
        )
    summary = client.get("/sessions/summary").json()
    assert summary["sessions"] >= 2 and summary["completed_rate"] == 1.0
    # No free-form fields: extra data (e.g. a name) is not stored.
    stored = client.post(
        "/sessions",
        json={"policy": "id3", "scenario": "a", "turns": 1, "errors": 0, "completed": True, "name": "X"},
    )
    assert stored.status_code == 201
