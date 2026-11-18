"""Baseline: ID3 decision tree (entropy / information gain).

The training set maps a discrete state to the help action with the best
expected return, estimated by Monte-Carlo rollouts from simulated games
(an oracle). The tree is then a compact, explainable policy.
"""

from __future__ import annotations

import math
from collections import Counter, defaultdict
from typing import Optional

import numpy as np

from ..entorno import PictoMarketEnv
from ..juego import HELP_ACTIONS
from .reglas import RulesPolicy


def entropy(labels) -> float:
    """Shannon entropy (bits) of a label sequence."""
    total = len(labels)
    if total == 0:
        return 0.0
    return -sum(
        (c / total) * math.log2(c / total) for c in Counter(labels).values()
    )


def information_gain(rows, labels, feature: int) -> float:
    base = entropy(labels)
    total = len(labels)
    groups: dict = defaultdict(list)
    for row, label in zip(rows, labels):
        groups[row[feature]].append(label)
    remainder = sum(len(g) / total * entropy(g) for g in groups.values())
    return base - remainder


class ID3Tree:
    name = "id3"

    def __init__(self, max_depth: int = 6, min_samples: int = 2):
        self.max_depth = max_depth
        self.min_samples = min_samples
        self.tree: dict | None = None
        self.default = 3

    def fit(self, rows, labels) -> "ID3Tree":
        rows = [tuple(r) for r in rows]
        self.default = Counter(labels).most_common(1)[0][0]
        self.tree = self._build(rows, list(labels), set(range(len(rows[0]))), 0)
        return self

    def _build(self, rows, labels, features: set, depth: int) -> dict:
        majority = Counter(labels).most_common(1)[0][0]
        if (
            len(set(labels)) == 1
            or not features
            or depth >= self.max_depth
            or len(rows) < self.min_samples
        ):
            return {"leaf": majority}
        gains = {f: information_gain(rows, labels, f) for f in features}
        best = max(sorted(gains), key=lambda f: gains[f])
        if gains[best] <= 1e-12:
            return {"leaf": majority}
        children = {}
        for value in sorted({r[best] for r in rows}):
            idx = [i for i, r in enumerate(rows) if r[best] == value]
            children[str(value)] = self._build(
                [rows[i] for i in idx],
                [labels[i] for i in idx],
                features - {best},
                depth + 1,
            )
        return {"feature": best, "majority": majority, "children": children}

    def act(self, obs: tuple) -> int:
        node = self.tree
        while node is not None and "leaf" not in node:
            child = node["children"].get(str(obs[node["feature"]]))
            if child is None:
                return int(node["majority"])
            node = child
        return int(node["leaf"]) if node else self.default

    def to_dict(self) -> dict:
        return {"max_depth": self.max_depth, "tree": self.tree}

    @classmethod
    def from_dict(cls, payload: dict) -> "ID3Tree":
        tree = cls(payload.get("max_depth", 6))
        tree.tree = payload["tree"]
        return tree


def build_oracle_dataset(
    data: dict,
    episodes: int = 600,
    rollouts: int = 10,
    seed: int = 0,
    min_count: int = 2,
):
    """(states, best actions, counts): per discrete state, the action with the
    highest mean return over `rollouts` Monte-Carlo continuations (rules after
    the first help)."""
    rng = np.random.default_rng(seed)
    rules = RulesPolicy()
    totals: dict = defaultdict(lambda: np.zeros(len(HELP_ACTIONS)))
    counts: dict = defaultdict(int)
    for ep in range(episodes):
        env = PictoMarketEnv(data)
        obs, _ = env.reset(seed=int(rng.integers(2**31)))
        while env.pending is not None and not env.done:
            for a in range(len(HELP_ACTIONS)):
                acc = 0.0
                for _ in range(rollouts):
                    sim = env.clone()
                    _, r, term, trunc, _ = sim.step(a)
                    total = r
                    while not (term or trunc):
                        o = sim.observe()
                        _, r, term, trunc, _ = sim.step(rules.act(o) - 1)
                        total += r
                    acc += total
                totals[obs][a] += acc / rollouts
            counts[obs] += 1
            # Explore: advance with a random help action to visit more states.
            obs, _, term, trunc, _ = env.step(int(rng.integers(len(HELP_ACTIONS))))
            if term or trunc:
                break
    states, labels, weights = [], [], []
    for obs, vec in totals.items():
        if counts[obs] >= min_count:
            states.append(obs)
            labels.append(int(np.argmax(vec)) + 1)
            weights.append(counts[obs])
    return states, labels, weights
