"""Reference policy: the original a1 -> a2 -> a3 escalation rules."""

from __future__ import annotations

from ..juego import rules_action


class RulesPolicy:
    name = "reglas"

    def act(self, obs: tuple) -> int:
        return rules_action(obs[0])
