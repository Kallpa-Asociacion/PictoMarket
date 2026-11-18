"""Minimal FastAPI service exposing the trained help policies.

The game does not depend on it (the frontend interprets the exported JSON
locally); it exists as the reference API and for anonymous session summaries.

    uvicorn app.main:app --reload   (from codigo/backend, with ia_models on PYTHONPATH
    or simply installed; this module adds it automatically)
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ia_models"))

from pictomarket_ia.cargar import load_policy  # noqa: E402

app = FastAPI(title="PictoMarket policy API", version="1.0.0")
_POLICIES = {name: load_policy(name) for name in ("reglas", "id3", "qlearning")}
# Anonymous, in-memory only: nothing is persisted and there is no user id.
_SESSIONS: deque = deque(maxlen=500)


class PolicyRequest(BaseModel):
    policy: Literal["reglas", "id3", "qlearning"] = "qlearning"
    # (failures 0-3, hint level 0-3, distractors 0-2, items 1-3, profile 0-2,
    #  last help 0-4, confusing same-category distractor 0-1)
    features: list[int] = Field(min_length=7, max_length=7)


class PolicyResponse(BaseModel):
    action: int
    name: str


class SessionSummary(BaseModel):
    policy: Literal["reglas", "id3", "qlearning"]
    scenario: str = Field(max_length=64)
    turns: int = Field(ge=0, le=500)
    errors: int = Field(ge=0, le=500)
    completed: bool


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "policies": sorted(_POLICIES)}


@app.post("/policy/next", response_model=PolicyResponse)
def next_action(request: PolicyRequest) -> PolicyResponse:
    maxima = (3, 3, 2, 3, 2, 4, 1)
    minima = (0, 0, 0, 1, 0, 0, 0)
    for value, low, high in zip(request.features, minima, maxima):
        if not low <= value <= high:
            raise HTTPException(status_code=422, detail="features out of range")
    action = _POLICIES[request.policy].act(tuple(request.features))
    return PolicyResponse(action=action, name=f"a{action}")


@app.post("/sessions", status_code=201)
def add_session(summary: SessionSummary) -> dict:
    _SESSIONS.append(summary.model_dump())
    return {"stored": len(_SESSIONS)}


@app.get("/sessions/summary")
def sessions_summary() -> dict:
    count = len(_SESSIONS)
    if not count:
        return {"sessions": 0}
    return {
        "sessions": count,
        "completed_rate": sum(s["completed"] for s in _SESSIONS) / count,
        "mean_turns": sum(s["turns"] for s in _SESSIONS) / count,
        "mean_errors": sum(s["errors"] for s in _SESSIONS) / count,
    }
