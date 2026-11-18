"""Simulated learner used to train and evaluate the agent without people.

The learner picks a product with probability proportional to a weight:
the target gets the learner's skill, distractors weigh 1 (x2 when they share
the target's category, a typical confusion). Hints reshape the weights the
same way they reshape the screen in the game. All draws come from a seeded RNG.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .datos import category_of
from .juego import A1, A2, A3, A4, GameState


@dataclass(frozen=True)
class Profile:
    name: str
    skill: float  # weight of the correct product (higher = more accurate)
    lapse: float  # probability of a random touch (attention lapse)
    mean_ms: float  # typical response time


PROFILES = {
    "rapido": Profile("rapido", 8.0, 0.03, 2500.0),
    "medio": Profile("medio", 3.0, 0.06, 5000.0),
    "apoyo": Profile("apoyo", 1.0, 0.12, 9000.0),
}
CATEGORY_CONFUSION = 2.0
OUT_OF_CATEGORY_AFTER_HINT = 0.35
POINTED_BOOST = 9.0
REPEAT_BOOST = 1.3
OTHER_PENDING_WEIGHT = 0.35
# Learning dynamics (modelling assumption, see docs/formalizacion.md §3):
# finding a product alone or with a mild hint builds confidence; being shown
# the answer (a3) builds prompt dependency. Confidence scales the target weight
# for the following products of the same game.
CONFIDENCE_GAIN = 1.15
CONFIDENCE_LOSS = 0.85
CONFIDENCE_RANGE = (0.5, 2.0)


class SimulatedLearner:
    def __init__(self, profile: Profile, rng: np.random.Generator):
        self.profile = profile
        self.rng = rng
        self.confidence = 1.0

    def on_purchase(self, hint_level: int) -> None:
        """Updates confidence after buying a product with `hint_level` active."""
        if hint_level <= 1:
            self.confidence *= CONFIDENCE_GAIN
        elif hint_level >= 3:
            self.confidence *= CONFIDENCE_LOSS
        low, high = CONFIDENCE_RANGE
        self.confidence = min(high, max(low, self.confidence))

    def touch(self, data: dict, state: GameState, last_help: int) -> tuple[int, int]:
        """Returns (product, response time in ms)."""
        candidates = [p for p in state.productos_visibles if p not in state.items_en_carrito]
        target = state.items_restantes[0]
        target_cat = category_of(data, target)
        if self.rng.random() < self.profile.lapse:
            pick = int(self.rng.choice(candidates))
        else:
            weights = []
            for pid in candidates:
                if pid == target:
                    w = self.profile.skill * self.confidence
                    if state.nivel_pista >= 3:
                        w *= POINTED_BOOST
                    if last_help == A4:
                        w *= REPEAT_BOOST
                elif pid in state.items_restantes:
                    w = self.profile.skill * OTHER_PENDING_WEIGHT
                else:
                    w = CATEGORY_CONFUSION if category_of(data, pid) == target_cat else 1.0
                if state.nivel_pista >= 1 and category_of(data, pid) != target_cat:
                    w *= OUT_OF_CATEGORY_AFTER_HINT
                weights.append(w)
            probs = np.array(weights) / sum(weights)
            pick = int(self.rng.choice(candidates, p=probs))
        wrong = pick not in state.items_restantes
        scale = 1.3 if wrong else 1.0
        t_ms = int(self.rng.lognormal(np.log(self.profile.mean_ms * scale), 0.35))
        return pick, t_ms
