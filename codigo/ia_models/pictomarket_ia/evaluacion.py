"""Policy evaluation on the simulator.

Metrics (per game, averaged):
    success_rate     list completed before the turn cap
    errors           wrong touches (frustration proxy, primary metric)
    max_streak       longest run of consecutive wrong touches
    help_cost        intrusiveness: sum of HELP_COST of the helps given
    repeat_rate      share of helps that repeat an uninformative help (a1/a4)
    autonomy_rate    share of purchases made with no error for that product
    mean_turns       touches per game
    mean_return      return under the reward of entorno.py
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .entorno import HELP_COST, REPEAT_COSTLY, PictoMarketEnv
from .usuario_sim import PROFILES

METRICS = [
    "success_rate", "errors", "max_streak", "help_cost", "repeat_rate",
    "autonomy_rate", "mean_turns", "mean_return",
]


@dataclass
class EpisodeResult:
    success: bool
    turns: int
    errors: int
    max_streak: int
    hints: int
    repeats: int
    help_cost: float
    correct_touches: int
    autonomous_touches: int
    ret: float
    actions: Counter = field(default_factory=Counter)


def run_episode(env: PictoMarketEnv, policy, seed: int) -> EpisodeResult:
    obs, _ = env.reset(seed=seed)
    total = env.initial_reward
    repeats = 0
    while env.pending is not None and not env.done:
        action = policy.act(obs)
        if action in REPEAT_COSTLY and action == env.last_help:
            repeats += 1
        obs, reward, terminated, truncated, _ = env.step(action - 1)
        total += reward
        if terminated or truncated:
            break
    log = env.state.log
    autonomous = streak = max_streak = 0
    for event in log:
        if event.correct:
            autonomous += 1 if streak == 0 else 0
            streak = 0
        else:
            streak += 1
            max_streak = max(max_streak, streak)
    helps = [e.action for e in log if not e.correct]
    return EpisodeResult(
        success=env.completed,
        turns=env.turns,
        errors=len(helps),
        max_streak=max_streak,
        hints=env.decisions,
        repeats=repeats,
        help_cost=sum(HELP_COST[a] for a in helps),
        correct_touches=sum(1 for e in log if e.correct),
        autonomous_touches=autonomous,
        ret=total,
        actions=Counter(helps),
    )


def evaluate(
    data: dict,
    policies: dict,
    seeds: list[int],
    episodes_per_seed: int = 200,
) -> pd.DataFrame:
    """One row per (policy, profile, scenario, seed) with aggregated metrics."""
    rows = []
    for name, policy in policies.items():
        for profile in PROFILES:
            for scenario in range(len(data["retos"])):
                for seed in seeds:
                    env = PictoMarketEnv(data, profile=profile, scenario=scenario)
                    results = [
                        run_episode(env, policy, seed * 100_003 + k)
                        for k in range(episodes_per_seed)
                    ]
                    n = len(results)
                    actions = sum((r.actions for r in results), Counter())
                    total_helps = max(1, sum(actions.values()))
                    rows.append(
                        {
                            "policy": name,
                            "profile": profile,
                            "scenario": data["retos"][scenario]["id_reto"],
                            "seed": seed,
                            "success_rate": sum(r.success for r in results) / n,
                            "errors": float(np.mean([r.errors for r in results])),
                            "max_streak": float(np.mean([r.max_streak for r in results])),
                            "help_cost": float(np.mean([r.help_cost for r in results])),
                            "repeat_rate": sum(r.repeats for r in results) / total_helps,
                            "autonomy_rate": (
                                sum(r.autonomous_touches for r in results)
                                / max(1, sum(r.correct_touches for r in results))
                            ),
                            "mean_turns": float(np.mean([r.turns for r in results])),
                            "mean_return": float(np.mean([r.ret for r in results])),
                            **{
                                f"share_a{a}": actions[a] / total_helps
                                for a in (1, 2, 3, 4)
                            },
                        }
                    )
    return pd.DataFrame(rows)


def summarize(df: pd.DataFrame) -> pd.DataFrame:
    """Mean and 95% confidence interval across seeds, per policy and profile."""
    shares = [c for c in df.columns if c.startswith("share_a")]
    out = []
    for (policy, profile), group in df.groupby(["policy", "profile"]):
        per_seed = group.groupby("seed")[METRICS + shares].mean()
        row = {"policy": policy, "profile": profile, "n_seeds": len(per_seed)}
        for metric in METRICS:
            mean = per_seed[metric].mean()
            sem = (
                per_seed[metric].std(ddof=1) / np.sqrt(len(per_seed))
                if len(per_seed) > 1
                else 0.0
            )
            row[metric] = round(float(mean), 4)
            row[metric + "_ci95"] = round(float(1.96 * sem), 4)
        for share in shares:
            row[share] = round(float(per_seed[share].mean()), 4)
        out.append(row)
    return pd.DataFrame(out)


def paired_difference(df: pd.DataFrame, a: str, b: str, metric: str) -> pd.DataFrame:
    """Per profile: mean of (a - b) over common seeds with a 95% CI (paired,
    the same seeds produce the same learners and screens for both policies)."""
    out = []
    for profile, group in df.groupby("profile"):
        pa = group[group.policy == a].groupby("seed")[metric].mean()
        pb = group[group.policy == b].groupby("seed")[metric].mean()
        diff = (pa - pb).dropna()
        sem = diff.std(ddof=1) / np.sqrt(len(diff)) if len(diff) > 1 else 0.0
        out.append(
            {
                "profile": profile,
                "metric": metric,
                "comparison": f"{a} - {b}",
                "mean_diff": round(float(diff.mean()), 4),
                "ci95": round(float(1.96 * sem), 4),
            }
        )
    return pd.DataFrame(out)
