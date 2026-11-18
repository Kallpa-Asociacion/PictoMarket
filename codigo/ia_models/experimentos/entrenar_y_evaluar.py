"""Full pipeline: train the main model, build the ID3 baseline, evaluate,
run the ablation and robustness checks, plot and export.

    python experimentos/entrenar_y_evaluar.py            # full run (~10 min)
    python experimentos/entrenar_y_evaluar.py --quick    # small run for smoke tests
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pictomarket_ia import usuario_sim  # noqa: E402
from pictomarket_ia.datos import ROOT, load_data  # noqa: E402
from pictomarket_ia.evaluacion import (  # noqa: E402
    evaluate,
    paired_difference,
    summarize,
)
from pictomarket_ia.exportar import (  # noqa: E402
    export_id3,
    export_parity_fixtures,
    export_qlearning,
)
from pictomarket_ia.politicas.id3 import ID3Tree, build_oracle_dataset  # noqa: E402
from pictomarket_ia.politicas.qlearning import QConfig, QLearningPolicy  # noqa: E402
from pictomarket_ia.politicas.reglas import RulesPolicy  # noqa: E402

SIM_DIR = ROOT / "datos" / "simulaciones"
FIG_DIR = ROOT / "docs" / "informe" / "figuras"
PROFILES = ["rapido", "medio", "apoyo"]
LABELS = {"reglas": "Reglas", "id3": "ID3 (baseline)", "qlearning": "Q-Learning"}


def moving_average(values, window):
    kernel = np.ones(window) / window
    return np.convolve(values, kernel, mode="valid")


def plot_convergence(histories: list[pd.DataFrame], path: Path, window: int):
    fig, axes = plt.subplots(1, 2, figsize=(11, 3.8))
    for i, h in enumerate(histories):
        axes[0].plot(moving_average(h["return"].to_numpy(), window), alpha=0.7, label=f"semilla {i}")
        axes[1].plot(moving_average(h["max_delta"].to_numpy(), window), alpha=0.7)
    axes[0].set(title="Retorno por partida (media móvil)", xlabel="partida", ylabel="retorno")
    axes[1].set(title="Cambio máximo de Q (media móvil)", xlabel="partida", ylabel="|ΔQ|")
    axes[1].set_yscale("log")
    axes[0].legend(fontsize=7)
    for ax in axes:
        ax.grid(alpha=0.3)
    fig.tight_layout()
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=140)
    plt.close(fig)


def plot_comparison(summary: pd.DataFrame, path: Path):
    metrics = [
        ("errors", "Errores por partida (menos = mejor)"),
        ("max_streak", "Racha máxima de errores (menos = mejor)"),
        ("autonomy_rate", "Compras sin error (más = mejor)"),
        ("help_cost", "Intrusión de la ayuda (menos = mejor)"),
    ]
    policies = [p for p in LABELS if p in set(summary["policy"])]
    fig, axes = plt.subplots(1, 4, figsize=(16, 3.8))
    width = 0.8 / len(policies)
    for ax, (metric, title) in zip(axes, metrics):
        for j, policy in enumerate(policies):
            rows = summary[summary["policy"] == policy].set_index("profile").loc[PROFILES]
            ax.bar(
                np.arange(3) + j * width, rows[metric], width,
                yerr=rows[metric + "_ci95"], label=LABELS[policy], capsize=2,
            )
        ax.set_xticks(np.arange(3) + width * (len(policies) - 1) / 2, PROFILES)
        ax.set_title(title, fontsize=9)
        ax.grid(axis="y", alpha=0.3)
    axes[0].legend(fontsize=8)
    fig.tight_layout()
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=140)
    plt.close(fig)


def plot_actions(summary: pd.DataFrame, path: Path):
    names = {"share_a1": "a1 categoría", "share_a2": "a2 retirar", "share_a3": "a3 señalar", "share_a4": "a4 repetir"}
    policies = [p for p in LABELS if p in set(summary["policy"])]
    fig, axes = plt.subplots(1, len(policies), figsize=(4.2 * len(policies), 3.4), sharey=True)
    for ax, policy in zip(axes, policies):
        rows = summary[summary["policy"] == policy].set_index("profile").loc[PROFILES]
        bottom = np.zeros(3)
        for col, label in names.items():
            ax.bar(PROFILES, rows[col], bottom=bottom, label=label)
            bottom += rows[col].to_numpy()
        ax.set_title(LABELS[policy], fontsize=10)
        ax.set_ylim(0, 1)
    axes[0].set_ylabel("proporción de ayudas")
    axes[-1].legend(fontsize=7, loc="upper right")
    fig.tight_layout()
    fig.savefig(path, dpi=140)
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--quick", action="store_true")
    parser.add_argument("--no-export", action="store_true")
    args = parser.parse_args()
    quick = args.quick
    cfg = QConfig(episodes=6000 if quick else 60000, seed=0)
    train_seeds = [0, 1] if quick else [0, 1, 2, 3, 4]
    eval_seeds = list(range(1000, 1004 if quick else 1030))
    per_seed = 50 if quick else 200
    data = load_data()
    SIM_DIR.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    print(f"[1/6] Modelo principal ({cfg.episodes} partidas x {len(train_seeds)} semillas)")
    histories, trained = [], []
    for seed in train_seeds:
        policy = QLearningPolicy().train(data, QConfig(**{**cfg.__dict__, "seed": seed}))
        histories.append(pd.DataFrame(policy.history))
        trained.append(policy)
    qpolicy = trained[0]  # exported policy: seed 0 (documented)
    pd.concat(
        [h.assign(seed=s) for s, h in zip(train_seeds, histories)], ignore_index=True
    ).to_csv(SIM_DIR / "convergencia_qlearning.csv", index=False)
    plot_convergence(histories, FIG_DIR / "convergencia_qlearning.png", window=max(50, cfg.episodes // 100))

    print("[2/6] Dataset oráculo e ID3 (baseline)")
    states, labels, _w = build_oracle_dataset(
        data, episodes=150 if quick else 900, rollouts=6 if quick else 10, seed=11
    )
    rng = np.random.default_rng(3)
    order = rng.permutation(len(states))
    cut = int(0.7 * len(order))
    tr, te = order[:cut], order[cut:]
    tree = ID3Tree(max_depth=6).fit([states[i] for i in tr], [labels[i] for i in tr])
    acc_test = float(np.mean([tree.act(states[i]) == labels[i] for i in te])) if len(te) else float("nan")
    majority = max(set(labels), key=labels.count)
    acc_majority = float(np.mean([labels[i] == majority for i in te])) if len(te) else float("nan")
    tree_full = ID3Tree(max_depth=6).fit(states, labels)
    id3_info = {
        "states": len(states),
        "train_states": len(tr),
        "test_states": len(te),
        "test_accuracy": round(acc_test, 4),
        "majority_class_accuracy": round(acc_majority, 4),
        "label_distribution": {str(a): labels.count(a) for a in sorted(set(labels))},
        "root_feature": tree_full.tree.get("feature"),
    }
    (SIM_DIR / "id3_dataset_info.json").write_text(json.dumps(id3_info, indent=1), encoding="utf-8")
    print("   ", id3_info)

    print("[3/6] Evaluación (semillas distintas a las de entrenamiento)")
    policies = {"reglas": RulesPolicy(), "id3": tree_full, "qlearning": qpolicy}
    detail = evaluate(data, policies, eval_seeds, episodes_per_seed=per_seed)
    summary = summarize(detail)
    detail.to_csv(SIM_DIR / "metricas_detalle.csv", index=False)
    summary.to_csv(SIM_DIR / "metricas_resumen.csv", index=False)
    diffs = pd.concat(
        [
            paired_difference(detail, a, b, metric)
            for a, b in (("qlearning", "reglas"), ("qlearning", "id3"))
            for metric in ("errors", "max_streak", "autonomy_rate", "help_cost", "mean_turns", "mean_return")
        ],
        ignore_index=True,
    )
    diffs.to_csv(SIM_DIR / "diferencias_pareadas.csv", index=False)
    plot_comparison(summary, FIG_DIR / "comparacion_politicas.png")
    plot_actions(summary, FIG_DIR / "ayudas_por_perfil.png")
    print(summary[["policy", "profile", "errors", "max_streak", "autonomy_rate", "help_cost", "mean_turns", "mean_return"]].to_string(index=False))

    print("[4/6] Ablación: objetivo (TD/MC) y descuento")
    rows = []
    ab_eps = 3000 if quick else 20000
    for target in ("td", "mc"):
        for gamma in (0.95, 1.0):
            p = QLearningPolicy().train(data, QConfig(episodes=ab_eps, gamma=gamma, target=target, seed=0))
            s = summarize(evaluate(data, {"q": p}, eval_seeds[:5], episodes_per_seed=per_seed))
            rows.append({
                "target": target, "gamma": gamma, "episodes": ab_eps,
                "errors": round(float(s["errors"].mean()), 3),
                "autonomy_rate": round(float(s["autonomy_rate"].mean()), 3),
                "help_cost": round(float(s["help_cost"].mean()), 3),
                "share_a3": round(float(s["share_a3"].mean()), 3),
                "mean_return": round(float(s["mean_return"].mean()), 3),
            })
    pd.DataFrame(rows).to_csv(SIM_DIR / "ablacion_qlearning.csv", index=False)
    print(pd.DataFrame(rows).to_string(index=False))

    print("[5/6] Robustez: jugador simulado sin dinámica de aprendizaje")
    gain, loss = usuario_sim.CONFIDENCE_GAIN, usuario_sim.CONFIDENCE_LOSS
    usuario_sim.CONFIDENCE_GAIN = usuario_sim.CONFIDENCE_LOSS = 1.0
    try:
        robust = summarize(evaluate(data, policies, eval_seeds[:10], episodes_per_seed=per_seed))
    finally:
        usuario_sim.CONFIDENCE_GAIN, usuario_sim.CONFIDENCE_LOSS = gain, loss
    robust.to_csv(SIM_DIR / "robustez_sin_aprendizaje.csv", index=False)
    print(robust[["policy", "profile", "errors", "autonomy_rate", "help_cost"]].to_string(index=False))

    if not args.no_export:
        print("[6/6] Exportación")
        meta = {
            "train_seed": 0, "episodes": cfg.episodes, "gamma": cfg.gamma,
            "target": cfg.target, "alpha_mode": cfg.alpha_mode, "reward": "v2",
        }
        print("   ", export_qlearning(qpolicy, meta))
        print("   ", export_id3(tree_full, {"oracle_states": len(states), "test_accuracy": id3_info["test_accuracy"], "reward": "v2"}))
        print("   ", export_parity_fixtures(data, policies))
    print(f"Listo en {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
