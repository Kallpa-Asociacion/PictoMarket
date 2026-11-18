"""Gymnasium environment: the guided shopping game as a semi-MDP.

A decision happens only after a wrong touch: the agent picks one help action
(1..4). The environment applies it, then lets the simulated learner keep
touching until the next wrong touch (the next decision) or the end.

Reward (v2, see docs/formalizacion.md §2 for the pedagogical rationale):

* Frustration of an error grows with the streak: a wrong touch made after
  ``f`` consecutive failures costs ``-(ERROR_BASE + ERROR_STREAK * f)``.
  The error is charged to the help that preceded it (credit assignment).
* Intrusiveness: each help has a cost, lowest for the least intrusive one
  (least-to-most prompting): a4 repeat 0, a1 category 0.5, a2 remove 1.5,
  a3 point 3.
* Helps that add no new information when given twice in a row (a1, a4)
  cost ``REWARD_REPEAT`` extra (the brief asks to avoid repetitive answers).
* Each purchase is worth ``REWARD_CORRECT``; buying it without any error
  for that product adds ``REWARD_AUTONOMY``.
* Finishing the list adds ``REWARD_COMPLETE``; hitting the turn cap costs
  ``REWARD_TIMEOUT``.

Turns themselves are not penalised: what matters for the learner is how many
errors (and how long the error streaks) it suffers, and how intrusive the help
was, not the raw number of touches.
"""

from __future__ import annotations

from typing import Optional

import gymnasium as gym
import numpy as np
from gymnasium import spaces

from .caracteristicas import features
from .juego import A1, A2, A3, A4, HELP_ACTIONS, GameState, choose_product, start_game
from .usuario_sim import PROFILES, SimulatedLearner

MAX_TURNS = 40
REWARD_CORRECT = 10.0
REWARD_AUTONOMY = 3.0
ERROR_BASE = 2.0
ERROR_STREAK = 2.0
HELP_COST = {A4: 0.0, A1: 0.5, A2: 1.5, A3: 3.0}
REPEAT_COSTLY = (A1, A4)  # repeating these adds nothing new
REWARD_REPEAT = -3.0
REWARD_COMPLETE = 20.0
REWARD_TIMEOUT = -10.0

OBS_NVEC = [4, 4, 3, 3, 3, 5, 2]


TERMINAL_OBS = (0, 0, 0, 1, 1, 0, 0)


def error_cost(failed_before: int) -> float:
    """Frustration cost of a wrong touch after `failed_before` failures."""
    return -(ERROR_BASE + ERROR_STREAK * min(failed_before, 3))


class PictoMarketEnv(gym.Env):
    metadata = {"render_modes": []}

    def __init__(
        self,
        data: dict,
        profile: str | None = None,
        scenario: int | None = None,
        max_turns: int = MAX_TURNS,
    ):
        self.data = data
        self.fixed_profile = profile
        self.fixed_scenario = scenario
        self.max_turns = max_turns
        self.observation_space = spaces.MultiDiscrete(OBS_NVEC)
        self.action_space = spaces.Discrete(len(HELP_ACTIONS))  # index = action - 1
        self.state: Optional[GameState] = None
        self.learner: Optional[SimulatedLearner] = None
        self.pending: Optional[int] = None  # the wrong product awaiting help
        self.pending_t_ms = 0
        self.turns = 0
        self.decisions = 0
        self.last_help = 0
        self.completed = False
        self.rng = np.random.default_rng()

    # ---- helpers -------------------------------------------------------
    def _play_until_error(self) -> float:
        """Learner touches until a wrong touch (stored in `pending`, and
        charged here) or the end. Returns the reward of those touches."""
        gained = 0.0
        self.pending = None
        while self.state.items_restantes and self.turns < self.max_turns:
            product, t_ms = self.learner.touch(self.data, self.state, self.last_help)
            if product in self.state.items_restantes:
                autonomous = (
                    self.state.intentos_fallidos == 0 and self.state.nivel_pista == 0
                )
                self.learner.on_purchase(self.state.nivel_pista)
                self.state = choose_product(
                    self.data, self.state, product, self.state.t_ultimo_evento + t_ms
                )
                self.turns += 1
                self.last_help = 0
                gained += REWARD_CORRECT + (REWARD_AUTONOMY if autonomous else 0.0)
            else:
                self.pending = product
                self.pending_t_ms = t_ms
                return gained + error_cost(self.state.intentos_fallidos)
        if not self.state.items_restantes:
            self.completed = True
            gained += REWARD_COMPLETE
        else:
            gained += REWARD_TIMEOUT
        return gained

    def clone(self) -> "PictoMarketEnv":
        other = PictoMarketEnv(
            self.data, self.fixed_profile, self.fixed_scenario, self.max_turns
        )
        other.state = self.state.clone()
        other.learner = SimulatedLearner(
            self.learner.profile, np.random.default_rng(self.rng.integers(2**63))
        )
        other.learner.confidence = self.learner.confidence
        other.rng = np.random.default_rng(self.rng.integers(2**63))
        for attr in (
            "pending", "pending_t_ms", "turns", "decisions", "last_help",
            "completed",
        ):
            setattr(other, attr, getattr(self, attr))
        return other

    def observe(self) -> tuple:
        return features(self.data, self.state)

    @property
    def done(self) -> bool:
        return self.completed or self.turns >= self.max_turns

    # ---- gym API -------------------------------------------------------
    def reset(self, *, seed: int | None = None, options: dict | None = None):
        super().reset(seed=seed)
        self.rng = np.random.default_rng(seed)
        scenario = (
            self.fixed_scenario
            if self.fixed_scenario is not None
            else int(self.rng.integers(len(self.data["retos"])))
        )
        name = self.fixed_profile or str(self.rng.choice(list(PROFILES)))
        challenge = self.data["retos"][scenario]
        order = list(challenge["lista_correcta"]) + list(challenge["distractores"])
        self.rng.shuffle(order)
        self.state = start_game(self.data, scenario, order)
        self.learner = SimulatedLearner(
            PROFILES[name], np.random.default_rng(self.rng.integers(2**63))
        )
        self.turns = self.decisions = self.last_help = 0
        self.completed = False
        self.initial_reward = self._play_until_error()
        return self.observe(), {"profile": name, "scenario": scenario}

    def step(self, action_index: int):
        """`action_index` is HELP_ACTIONS index (0..3). Only valid while not done."""
        if self.pending is None:
            raise RuntimeError("No pending decision: the episode is over.")
        action = HELP_ACTIONS[int(action_index)]
        reward = 0.0
        if action in REPEAT_COSTLY and action == self.last_help:
            reward += REWARD_REPEAT
        self.decisions += 1
        self.state = choose_product(
            self.data,
            self.state,
            self.pending,
            self.state.t_ultimo_evento + self.pending_t_ms,
            help_action=lambda _s: action,
        )
        self.turns += 1
        given = self.state.log[-1].action  # a2 may fall back to a3
        reward -= HELP_COST[given]
        self.last_help = given
        reward += self._play_until_error()
        terminated = self.completed
        truncated = (not terminated) and self.turns >= self.max_turns
        # Terminal observation is a neutral placeholder (never used for decisions).
        obs = self.observe() if self.pending is not None else TERMINAL_OBS
        return obs, reward, terminated, truncated, {}
