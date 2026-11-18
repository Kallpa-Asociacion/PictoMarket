"""Main model: tabular action-value learning over the discrete features.

Update at each decision (a wrong touch):
    Q(s,a) <- Q(s,a) + alpha_N * (G - Q(s,a))
where G is the Monte-Carlo return to the end of the game (default, `target="mc"`)
or the one-step Q-Learning target r + gamma * max_a' Q(s',a') (`target="td"`,
kept for the ablation). Epsilon-greedy exploration decays over episodes and
alpha_N decays with the visits of each (s, a) pair.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..entorno import PictoMarketEnv
from ..juego import HELP_ACTIONS, rules_action


@dataclass
class QConfig:
    episodes: int = 60000
    alpha: float = 0.1
    # Episodic task with a hard turn cap: no discount. With gamma < 1 the agent
    # learns to *postpone* the next error instead of avoiding it (see informe).
    gamma: float = 1.0
    eps_start: float = 1.0
    eps_end: float = 0.05
    eps_decay_fraction: float = 0.7  # share of episodes used to decay epsilon
    # "visits": alpha = max(alpha_min, N(s,a) ** -alpha_power), counting this visit. Rewards are
    # stochastic (simulated learner), so a decaying, per-pair step size averages
    # the noise out instead of chasing the last sample (Robbins-Monro).
    alpha_mode: str = "visits"
    alpha_power: float = 0.6
    alpha_min: float = 0.02
    # "td": one-step Q-Learning target r + gamma*max Q(s').
    # "mc": every-visit Monte-Carlo target (the return actually obtained until
    # the end of the game). The observation is partial (the profile is only
    # estimated), so bootstrapping through aliased states is biased; full
    # returns are not (Sutton & Barto, ch. 5 and 17.3).
    target: str = "mc"
    seed: int = 0


class QLearningPolicy:
    name = "qlearning"

    def __init__(self):
        self.q: dict[tuple, np.ndarray] = {}
        self.visits: dict[tuple, np.ndarray] = {}
        self.history: list[dict] = []

    def _row(self, obs: tuple) -> np.ndarray:
        if obs not in self.q:
            self.q[obs] = np.zeros(len(HELP_ACTIONS))
        return self.q[obs]

    def act(self, obs: tuple) -> int:
        row = self.q.get(obs)
        if row is None or not row.any():
            return rules_action(obs[0])  # unseen state: safe fallback
        return int(np.argmax(row)) + 1

    def train(self, data: dict, config: QConfig = QConfig()) -> "QLearningPolicy":
        rng = np.random.default_rng(config.seed)
        env = PictoMarketEnv(data)
        decay_episodes = max(1, int(config.episodes * config.eps_decay_fraction))
        for episode in range(config.episodes):
            frac = min(1.0, episode / decay_episodes)
            eps = config.eps_start + frac * (config.eps_end - config.eps_start)
            obs, _ = env.reset(seed=int(rng.integers(2**31)))
            total = env.initial_reward
            max_delta = 0.0
            trajectory = []
            while env.pending is not None and not env.done:
                row = self._row(obs)
                if rng.random() < eps:
                    a = int(rng.integers(len(HELP_ACTIONS)))
                else:
                    best = np.flatnonzero(row == row.max())
                    a = int(rng.choice(best))
                nxt, reward, terminated, truncated, _ = env.step(a)
                done = terminated or truncated
                if config.target == "mc":
                    trajectory.append((obs, a, reward))
                    total += reward
                    obs = nxt
                    if done:
                        break
                    continue
                target = reward if done else reward + config.gamma * self._row(nxt).max()
                if config.alpha_mode == "visits":
                    counts = self.visits.setdefault(obs, np.zeros(len(HELP_ACTIONS)))
                    counts[a] += 1
                    alpha = max(config.alpha_min, counts[a] ** -config.alpha_power)
                else:
                    alpha = config.alpha
                delta = alpha * (target - row[a])
                row[a] += delta
                max_delta = max(max_delta, abs(delta))
                total += reward
                obs = nxt
                if done:
                    break
            if config.target == "mc":
                ret = 0.0
                for s_obs, a, r in reversed(trajectory):
                    ret = r + config.gamma * ret
                    row = self._row(s_obs)
                    counts = self.visits.setdefault(s_obs, np.zeros(len(HELP_ACTIONS)))
                    counts[a] += 1
                    alpha = (
                        max(config.alpha_min, counts[a] ** -config.alpha_power)
                        if config.alpha_mode == "visits"
                        else config.alpha
                    )
                    delta = alpha * (ret - row[a])
                    row[a] += delta
                    max_delta = max(max_delta, abs(delta))
            self.history.append(
                {"episode": episode, "return": total, "epsilon": eps, "max_delta": max_delta}
            )
        return self

    def to_dict(self) -> dict:
        return {
            "q": {
                ",".join(map(str, k)): [round(float(x), 4) for x in v]
                for k, v in sorted(self.q.items())
                if v.any()
            }
        }

    @classmethod
    def from_dict(cls, payload: dict) -> "QLearningPolicy":
        policy = cls()
        for key, values in payload["q"].items():
            policy.q[tuple(int(x) for x in key.split(","))] = np.array(values)
        return policy
