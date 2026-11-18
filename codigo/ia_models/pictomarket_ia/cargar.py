"""Loads exported policies (datos/politicas/*.json) back into policy objects."""

from __future__ import annotations

import json

import numpy as np

from .datos import ROOT
from .politicas.id3 import ID3Tree
from .politicas.qlearning import QLearningPolicy
from .politicas.reglas import RulesPolicy

POLICY_DIR = ROOT / "datos" / "politicas"
POLICY_NAMES = ("reglas", "id3", "qlearning")


def load_policy(name: str):
    """Returns the policy, or the rules policy when the export is missing."""
    if name == "reglas":
        return RulesPolicy()
    path = POLICY_DIR / f"{name}.json"
    if not path.exists():
        return RulesPolicy()
    payload = json.loads(path.read_text(encoding="utf-8"))
    if name == "id3":
        return ID3Tree.from_dict(payload)
    if name == "qlearning":
        # The export keeps only the best action per state.
        policy = QLearningPolicy()
        for key, best in payload["best_action"].items():
            row = np.zeros(4)
            row[best - 1] = 1.0
            policy.q[tuple(int(x) for x in key.split(","))] = row
        return policy
    raise ValueError(f"Unknown policy: {name}")
