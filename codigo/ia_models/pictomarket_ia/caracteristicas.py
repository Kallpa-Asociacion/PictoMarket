"""Discrete state features seen by the agent (the MDP observation).

features = (f, n, d, i, p, la, c)
    f  consecutive failures before this touch, capped at 3
    n  hint level already given for the current target (0..3)
    d  visible distractors bucket: 0 -> 0, 1-2 -> 1, 3+ -> 2
    i  remaining products bucket: 1 -> 1, 2 -> 2, 3+ -> 3
    p  estimated learner profile: 0 fast, 1 medium, 2 needs support
    la last help action given (0 none, else 1..4)
    c  1 if a visible distractor shares the target's category (the confusing
       case where a category hint cannot separate them), else 0
The same definitions exist in src/domain/policy.ts (parity tests keep them aligned).
"""

from __future__ import annotations

from .datos import category_of
from .juego import GameState, distractors_visible

PROFILE_FAST, PROFILE_MEDIUM, PROFILE_SUPPORT = 0, 1, 2
FAST_MEAN_MS = 4000
FAST_MAX_ERROR_RATE = 0.15
SUPPORT_MIN_ERROR_RATE = 0.5


def bucket_distractors(count: int) -> int:
    return 0 if count == 0 else 1 if count <= 2 else 2


def bucket_items(count: int) -> int:
    return max(1, min(3, count))


def estimate_profile(errors: int, correct: int, mean_t_ms: float) -> int:
    """Learner profile from the session so far (adaptivity signal)."""
    turns = errors + correct
    if turns < 2:
        return PROFILE_MEDIUM
    rate = errors / turns
    if rate >= SUPPORT_MIN_ERROR_RATE:
        return PROFILE_SUPPORT
    if rate <= FAST_MAX_ERROR_RATE and mean_t_ms < FAST_MEAN_MS:
        return PROFILE_FAST
    return PROFILE_MEDIUM


def confusing_distractor(data: dict, state: GameState) -> int:
    if not state.items_restantes:
        return 0
    challenge = data["retos"][state.reto_idx]
    target_cat = category_of(data, state.items_restantes[0])
    return int(
        any(
            p in challenge["distractores"] and category_of(data, p) == target_cat
            for p in state.productos_visibles
        )
    )


def features(data: dict, state: GameState) -> tuple[int, int, int, int, int, int, int]:
    log = state.log
    mean_t = sum(e.t_ms for e in log) / len(log) if log else 0.0
    profile = estimate_profile(
        state.errores_totales, len(state.items_en_carrito), mean_t
    )
    last = log[-1].action if log else 0
    return (
        min(state.intentos_fallidos, 3),
        state.nivel_pista,
        bucket_distractors(distractors_visible(data, state)),
        bucket_items(len(state.items_restantes)),
        profile,
        last,
        confusing_distractor(data, state),
    )
