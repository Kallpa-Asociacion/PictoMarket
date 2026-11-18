"""Experiment A: console simulation of a guided game (Hito 1 PoC).

    python experimentos/experimento_a_consola.py [--policy reglas|id3|qlearning]
        [--profile rapido|medio|apoyo] [--scenario 0|1] [--seed N]

Shows, turn by turn, the state seen by the agent, what the learner touched and
the help the agent chose. Policies are loaded from datos/politicas/ when they
exist (run entrenar_y_evaluar.py first); otherwise the rules policy is used.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pictomarket_ia.caracteristicas import features  # noqa: E402
from pictomarket_ia.cargar import load_policy  # noqa: E402
from pictomarket_ia.datos import load_data  # noqa: E402
from pictomarket_ia.juego import ACTION_NAME, choose_product, start_game  # noqa: E402
from pictomarket_ia.usuario_sim import PROFILES, SimulatedLearner  # noqa: E402

PROFILE_NAMES = {0: "rápido", 1: "medio", 2: "necesita apoyo"}
HELP_TEXT = {
    1: "pista de categoría: resalta los productos de la misma sección",
    2: "retira un distractor para reducir las opciones",
    3: "señala el producto correcto",
    4: "repite la consulta sin dar más pista",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--policy", default="qlearning", choices=["reglas", "id3", "qlearning"])
    parser.add_argument("--profile", default="apoyo", choices=list(PROFILES))
    parser.add_argument("--scenario", type=int, default=1)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    data = load_data()
    policy = load_policy(args.policy)
    rng = np.random.default_rng(args.seed)
    challenge = data["retos"][args.scenario]
    order = challenge["lista_correcta"] + challenge["distractores"]
    rng.shuffle(order)
    state = start_game(data, args.scenario, [int(x) for x in order])
    learner = SimulatedLearner(PROFILES[args.profile], np.random.default_rng(args.seed + 1))
    name = lambda pid: data["catalogo"][str(pid)]["nombre"]  # noqa: E731

    print(f"Escenario: {challenge['id_reto']} | jugador simulado: {args.profile} | política: {policy.name}")
    print("Lista:", ", ".join(name(p) for p in challenge["lista_correcta"]))
    turn, last_help, now = 0, 0, 0
    while state.items_restantes and turn < 40:
        turn += 1
        target = state.items_restantes[0]
        product, t_ms = learner.touch(data, state, last_help)
        now += t_ms
        feats = features(data, state)
        wrong = product not in state.items_restantes
        action = policy.act(feats) if wrong else 0
        state = choose_product(data, state, product, now, help_action=lambda _s, a=action: a)
        last_help = state.log[-1].action
        print(
            f"\nTurno {turn}: busca {name(target)} | toca {name(product)} ({t_ms} ms)"
            f"\n  estado s=(fallos,nivel,distr,items,perfil,última ayuda,confusor)={feats}"
            f" perfil={PROFILE_NAMES[feats[4]]}"
        )
        if wrong:
            print(f"  agente: {ACTION_NAME[action]} -> {HELP_TEXT[action]}")
        else:
            print("  agente: a0 -> acierto, al carrito")
    print("\n" + ("Partida completada" if not state.items_restantes else "Partida sin terminar")
          + f" en {turn} turnos, {state.errores_totales} errores.")


if __name__ == "__main__":
    main()
