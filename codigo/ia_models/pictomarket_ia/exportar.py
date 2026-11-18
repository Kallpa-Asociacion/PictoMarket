"""Exports trained policies and parity fixtures for the TypeScript frontend."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from .caracteristicas import features
from .datos import ROOT
from .juego import ACTION_NAME, GameState, choose_product, start_game
from .politicas.id3 import ID3Tree
from .politicas.qlearning import QLearningPolicy

POLICY_DIR = ROOT / "datos" / "politicas"
SCHEMA_VERSION = 1


def _write(path: Path, payload: dict) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return path


def export_qlearning(policy: QLearningPolicy, meta: dict) -> Path:
    # Frontend only needs the best action per state (smaller bundle).
    best = {
        key: int(np.argmax(values)) + 1
        for key, values in policy.to_dict()["q"].items()
    }
    return _write(
        POLICY_DIR / "qlearning.json",
        {"version": SCHEMA_VERSION, "meta": meta, "best_action": best},
    )


def export_id3(tree: ID3Tree, meta: dict) -> Path:
    return _write(
        POLICY_DIR / "id3.json",
        {"version": SCHEMA_VERSION, "meta": meta, **tree.to_dict()},
    )


def export_parity_fixtures(data: dict, policies: dict, seed: int = 7, games: int = 12) -> Path:
    """Replays scripted games and records, per touch, the features seen by the
    policy and the action each policy picks. The TS tests replay the same
    touches through game.ts/policy.ts and must agree exactly."""
    rng = np.random.default_rng(seed)
    cases = []
    for g in range(games):
        scenario = g % len(data["retos"])
        challenge = data["retos"][scenario]
        order = list(challenge["lista_correcta"]) + list(challenge["distractores"])
        rng.shuffle(order)
        state = start_game(data, scenario, [int(x) for x in order], now=0)
        now = 0
        touches = []
        for _ in range(25):
            if not state.items_restantes:
                break
            # Mix of correct and wrong touches (wrong ~55%).
            if rng.random() < 0.45:
                product = state.items_restantes[0]
            else:
                visible = [p for p in state.productos_visibles if p not in state.items_en_carrito]
                product = int(rng.choice(visible))
            now += int(rng.integers(800, 9000))
            feats = features(data, state)
            wrong = product not in state.items_restantes
            expected = {
                name: (policy.act(feats) if wrong else 0)
                for name, policy in policies.items()
            }
            before = state
            state = choose_product(
                data, state, product, now,
                help_action=lambda s, p=policies["reglas"]: p.act(features(data, s)),
            )
            touches.append(
                {
                    "product": product,
                    "now": now,
                    "features": list(feats),
                    "expected_action": expected,
                    "rules_state_after": {
                        "items_restantes": state.items_restantes,
                        "items_en_carrito": state.items_en_carrito,
                        "intentos_fallidos": state.intentos_fallidos,
                        "nivel_pista": state.nivel_pista,
                        "productos_visibles": state.productos_visibles,
                        "errores_totales": state.errores_totales,
                        "action": ACTION_NAME[state.log[-1].action] if state is not before else None,
                    },
                }
            )
        cases.append({"scenario": scenario, "order": [int(x) for x in order], "touches": touches})
    return _write(POLICY_DIR / "paridad.json", {"version": SCHEMA_VERSION, "cases": cases})
