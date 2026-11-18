"""Pure game rules: a faithful port of src/domain/game.ts.

Help actions after a wrong touch (the MDP action space):
    1 = a1 category hint, 2 = a2 remove a distractor,
    3 = a3 point at the product, 4 = a4 repeat the query without escalating.
A correct touch is always a0 (not an agent decision).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional

from .datos import category_of

A1, A2, A3, A4 = 1, 2, 3, 4
HELP_ACTIONS = (A1, A2, A3, A4)
ACTION_NAME = {0: "a0", A1: "a1", A2: "a2", A3: "a3", A4: "a4"}
HINT_LEVEL = {A1: 1, A2: 2, A3: 3}


@dataclass
class Event:
    target: int
    touched: int
    correct: bool
    action: int  # 0 for a correct touch, else a help action
    t_ms: int
    removed: Optional[int] = None


@dataclass
class GameState:
    reto_idx: int
    items_restantes: list[int]
    items_en_carrito: list[int] = field(default_factory=list)
    intentos_fallidos: int = 0
    nivel_pista: int = 0
    productos_visibles: list[int] = field(default_factory=list)
    errores_totales: int = 0
    t_ultimo_evento: int = 0
    log: list[Event] = field(default_factory=list)

    def clone(self) -> "GameState":
        # Events are never mutated, so a shallow copy of the log is enough.
        return GameState(
            self.reto_idx,
            list(self.items_restantes),
            list(self.items_en_carrito),
            self.intentos_fallidos,
            self.nivel_pista,
            list(self.productos_visibles),
            self.errores_totales,
            self.t_ultimo_evento,
            list(self.log),
        )


# A help policy receives the discrete features (see caracteristicas.py) and
# returns one of HELP_ACTIONS.
HelpPolicy = Callable[[tuple], int]


def start_game(
    data: dict, index: int, order: list[int], now: int = 0
) -> GameState:
    """`order` is the (already shuffled) visible product order."""
    challenge = data["retos"][index]
    if not challenge["lista_correcta"]:
        raise ValueError("El reto no existe o no tiene productos.")
    return GameState(
        reto_idx=index,
        items_restantes=list(challenge["lista_correcta"]),
        productos_visibles=list(order),
        t_ultimo_evento=now,
    )


def rules_action(failed_before: int) -> int:
    """The original rule policy (agentPolicy in game.ts) for a wrong touch."""
    if failed_before == 0:
        return A1
    if failed_before == 1:
        return A2
    return A3


def choose_product(
    data: dict,
    state: GameState,
    product: int,
    now: int,
    help_action: Callable[[GameState], int] | None = None,
) -> GameState:
    """Transition of the game. `help_action(state_before)` picks the help for a
    wrong touch; by default the original rules are used."""
    target = state.items_restantes[0] if state.items_restantes else None
    if (
        target is None
        or product not in state.productos_visibles
        or product in state.items_en_carrito
    ):
        return state
    challenge = data["retos"][state.reto_idx]
    nxt = state.clone()
    nxt.t_ultimo_evento = now
    t_ms = max(0, int(now - state.t_ultimo_evento))
    removed: Optional[int] = None
    if product in state.items_restantes:
        action = 0
        nxt.items_restantes = [i for i in state.items_restantes if i != product]
        nxt.items_en_carrito = state.items_en_carrito + [product]
        nxt.intentos_fallidos = 0
        nxt.nivel_pista = 0
    else:
        action = (
            help_action(state)
            if help_action is not None
            else rules_action(state.intentos_fallidos)
        )
        nxt.intentos_fallidos = state.intentos_fallidos + 1
        nxt.errores_totales = state.errores_totales + 1
        if action == A2:
            candidates = [
                p for p in state.productos_visibles if p in challenge["distractores"]
            ]
            removed = product if product in candidates else (
                candidates[0] if candidates else None
            )
            if removed is None:
                action = A3
            else:
                nxt.productos_visibles = [
                    p for p in state.productos_visibles if p != removed
                ]
        if action in HINT_LEVEL:
            nxt.nivel_pista = max(state.nivel_pista, HINT_LEVEL[action])
    nxt.log.append(
        Event(target, product, action == 0, action, t_ms, removed)
    )
    return nxt


def distractors_visible(data: dict, state: GameState) -> int:
    challenge = data["retos"][state.reto_idx]
    return sum(1 for p in state.productos_visibles if p in challenge["distractores"])


def target_category(data: dict, state: GameState) -> str | None:
    if not state.items_restantes:
        return None
    return category_of(data, state.items_restantes[0])
