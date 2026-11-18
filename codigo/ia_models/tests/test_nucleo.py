import math

import numpy as np
import pytest

from pictomarket_ia.caracteristicas import (
    bucket_distractors,
    bucket_items,
    confusing_distractor,
    estimate_profile,
    features,
)
from pictomarket_ia.datos import load_data, validate_data
from pictomarket_ia.entorno import (
    HELP_COST,
    REWARD_COMPLETE,
    REWARD_REPEAT,
    PictoMarketEnv,
    error_cost,
)
from pictomarket_ia.evaluacion import run_episode
from pictomarket_ia.juego import A1, A2, A3, A4, choose_product, start_game
from pictomarket_ia.politicas.id3 import ID3Tree, entropy, information_gain
from pictomarket_ia.politicas.qlearning import QConfig, QLearningPolicy
from pictomarket_ia.politicas.reglas import RulesPolicy
from pictomarket_ia.datos import category_of
from pictomarket_ia.usuario_sim import (
    CONFIDENCE_RANGE,
    PROFILES,
    SimulatedLearner,
)

DATA = load_data()
LUNCH = 1
CH = DATA["retos"][LUNCH]
TARGETS = CH["lista_correcta"]
D = CH["distractores"]


def fresh():
    order = TARGETS + D
    return start_game(DATA, LUNCH, order, now=0)


class TestDatos:
    def test_valid_data_loads(self):
        assert len(DATA["retos"]) == 2

    def test_invalid_budget_raises(self):
        bad = {**DATA, "retos": [{**CH, "presupuesto": 1}]}
        with pytest.raises(ValueError, match="Presupuesto"):
            validate_data(bad)


class TestReglasDelJuego:
    def test_correct_touch_buys_and_resets_hints(self):
        s = choose_product(DATA, fresh(), D[0], 10)
        assert s.nivel_pista == 1 and s.intentos_fallidos == 1
        s = choose_product(DATA, s, TARGETS[0], 20)
        assert s.items_en_carrito == [TARGETS[0]]
        assert s.intentos_fallidos == 0 and s.nivel_pista == 0
        assert s.log[-1].action == 0

    def test_default_rules_escalate_a1_a2_a3(self):
        s = fresh()
        actions = []
        for d in D[:3]:
            s = choose_product(DATA, s, d, 10)
            actions.append(s.log[-1].action)
        assert actions == [A1, A2, A3]

    def test_a2_removes_touched_distractor(self):
        s = choose_product(DATA, fresh(), D[0], 10)
        s = choose_product(DATA, s, D[1], 20)
        assert D[1] not in s.productos_visibles and s.log[-1].removed == D[1]

    def test_a2_without_removable_distractor_becomes_a3(self):
        # The touched product is not a configured distractor and none is visible.
        data = {**DATA, "retos": [DATA["retos"][0], {**CH, "distractores": []}]}
        s = start_game(data, LUNCH, TARGETS + [D[0]], now=0)
        s = choose_product(data, s, D[0], 10, help_action=lambda _s: A2)
        assert s.log[-1].action == A3 and s.nivel_pista == 3
        assert D[0] in s.productos_visibles

    def test_a4_repeats_without_escalating(self):
        s = choose_product(DATA, fresh(), D[0], 10, help_action=lambda _s: A4)
        assert s.log[-1].action == A4
        assert s.nivel_pista == 0 and s.intentos_fallidos == 1
        assert s.errores_totales == 1 and len(s.productos_visibles) == len(TARGETS + D)

    def test_bought_or_unknown_touch_is_ignored(self):
        s = choose_product(DATA, fresh(), TARGETS[0], 10)
        assert choose_product(DATA, s, TARGETS[0], 20) is s
        assert choose_product(DATA, s, 999999, 20) is s

    def test_original_state_is_not_mutated(self):
        s = fresh()
        before = (list(s.items_restantes), list(s.productos_visibles), len(s.log))
        choose_product(DATA, s, D[0], 10)
        assert (s.items_restantes, s.productos_visibles, len(s.log)) == before


class TestCaracteristicas:
    def test_buckets(self):
        assert [bucket_distractors(n) for n in (0, 1, 2, 3, 6)] == [0, 1, 1, 2, 2]
        assert [bucket_items(n) for n in (0, 1, 2, 3, 4)] == [1, 1, 2, 3, 3]

    def test_profile_estimation(self):
        assert estimate_profile(0, 1, 100) == 1  # too early to tell
        assert estimate_profile(3, 2, 9000) == 2  # many errors
        assert estimate_profile(0, 4, 2000) == 0  # accurate and quick
        assert estimate_profile(0, 4, 8000) == 1  # accurate but slow

    def test_initial_features(self):
        # Lunch starts with chicken; "muslo de pollo" is a same-category distractor.
        assert category_of(DATA, 2534) == category_of(DATA, TARGETS[0])
        assert features(DATA, fresh()) == (0, 0, 2, 3, 1, 0, 1)

    def test_confusing_distractor_flag(self):
        s = fresh()
        assert confusing_distractor(DATA, s) == 1
        s.productos_visibles = [p for p in s.productos_visibles if p != 2534]
        assert confusing_distractor(DATA, s) == 0

    def test_last_action_is_tracked(self):
        s = choose_product(DATA, fresh(), D[0], 10)
        assert features(DATA, s)[5] == A1


class TestUsuarioSimulado:
    def test_same_seed_same_touches(self):
        def run(seed):
            learner = SimulatedLearner(PROFILES["medio"], np.random.default_rng(seed))
            return [learner.touch(DATA, fresh(), 0) for _ in range(20)]

        assert run(5) == run(5)
        assert run(5) != run(6)

    def test_profiles_differ_in_accuracy(self):
        rates = {}
        for name, profile in PROFILES.items():
            learner = SimulatedLearner(profile, np.random.default_rng(1))
            hits = sum(
                learner.touch(DATA, fresh(), 0)[0] in TARGETS for _ in range(600)
            )
            rates[name] = hits / 600
        assert rates["rapido"] > rates["medio"] > rates["apoyo"]

    def test_confidence_rises_with_mild_help_and_falls_when_pointed(self):
        learner = SimulatedLearner(PROFILES["medio"], np.random.default_rng(0))
        learner.on_purchase(0)
        assert learner.confidence > 1.0
        for _ in range(50):
            learner.on_purchase(3)
        assert learner.confidence == CONFIDENCE_RANGE[0]
        learner.on_purchase(2)  # removing a distractor is neutral
        assert learner.confidence == CONFIDENCE_RANGE[0]

    def test_pointing_hint_raises_accuracy(self):
        learner = SimulatedLearner(PROFILES["apoyo"], np.random.default_rng(2))
        plain, pointed = fresh(), fresh()
        pointed.nivel_pista = 3
        base = sum(learner.touch(DATA, plain, 0)[0] == TARGETS[0] for _ in range(600))
        hint = sum(learner.touch(DATA, pointed, 3)[0] == TARGETS[0] for _ in range(600))
        assert hint > base


class TestEntorno:
    def test_reset_is_reproducible(self):
        a = PictoMarketEnv(DATA, profile="apoyo", scenario=LUNCH)
        b = PictoMarketEnv(DATA, profile="apoyo", scenario=LUNCH)
        assert a.reset(seed=3)[0] == b.reset(seed=3)[0]

    def test_episode_always_ends(self):
        env = PictoMarketEnv(DATA)
        for seed in range(30):
            result = run_episode(env, RulesPolicy(), seed)
            assert result.turns <= env.max_turns

    def test_error_cost_grows_with_the_streak(self):
        assert [error_cost(f) for f in (0, 1, 2, 3, 7)] == [-2, -4, -6, -8, -8]

    def test_help_cost_follows_least_to_most(self):
        assert HELP_COST[A4] < HELP_COST[A1] < HELP_COST[A2] < HELP_COST[A3]

    def _decision_env(self):
        for seed in range(300):
            env = PictoMarketEnv(DATA, profile="apoyo", scenario=LUNCH)
            env.reset(seed=seed)
            if env.pending is not None:
                return env
        pytest.skip("no seed produced a decision")

    def test_uninformative_repeat_is_penalised_but_not_a2(self):
        env = self._decision_env()
        env.last_help = A1
        same = env.clone()
        # Same learner RNG in both clones: only the previous help differs.
        same.learner.rng = np.random.default_rng(0)
        _, r_same, *_ = same.step(A1 - 1)
        env2 = env.clone()
        env2.last_help = A4
        env2.learner.rng = np.random.default_rng(0)
        _, r_fresh, *_ = env2.step(A1 - 1)
        assert r_same == pytest.approx(r_fresh + REWARD_REPEAT)
        env.last_help = A2
        a, b = env.clone(), env.clone()
        a.learner.rng = np.random.default_rng(1)
        b.learner.rng = np.random.default_rng(1)
        b.last_help = A4
        assert a.step(A2 - 1)[1] == pytest.approx(b.step(A2 - 1)[1])

    def test_completed_game_gets_bonus(self):
        env = PictoMarketEnv(DATA, profile="rapido", scenario=LUNCH)
        total = 0
        for seed in range(50):
            obs, _ = env.reset(seed=seed)
            if env.pending is None and env.completed:
                total = env.initial_reward
                break
        assert total >= REWARD_COMPLETE

    def test_step_after_end_raises(self):
        env = PictoMarketEnv(DATA, profile="rapido", scenario=LUNCH)
        for seed in range(50):
            env.reset(seed=seed)
            if env.pending is None:
                with pytest.raises(RuntimeError):
                    env.step(0)
                return
        pytest.skip("no error-free game found")


class TestID3:
    def test_entropy_known_values(self):
        assert entropy([]) == 0.0
        assert entropy([1, 1, 1]) == 0.0
        assert math.isclose(entropy([1, 2]), 1.0)
        assert math.isclose(entropy([1, 1, 2, 2, 3, 3, 4, 4]), 2.0)
        assert math.isclose(entropy([1, 1, 1, 2]), 0.8112781244591328)

    def test_information_gain_hand_computed(self):
        rows = [(0,), (0,), (1,), (1,)]
        assert math.isclose(information_gain(rows, [1, 1, 2, 2], 0), 1.0)
        assert math.isclose(information_gain(rows, [1, 2, 1, 2], 0), 0.0)

    def test_tree_learns_a_rule_and_serialises(self):
        rows = [(a, b) for a in range(3) for b in range(3)] * 2
        labels = [1 if a == 0 else 3 for a, _b in rows]
        tree = ID3Tree().fit(rows, labels)
        assert tree.tree["feature"] == 0
        assert all(tree.act(r) == l for r, l in zip(rows, labels))
        clone = ID3Tree.from_dict(tree.to_dict())
        assert all(clone.act(r) == tree.act(r) for r in rows)

    def test_unseen_value_falls_back_to_majority(self):
        tree = ID3Tree().fit([(0,), (0,), (1,)], [1, 1, 2])
        assert tree.act((9,)) == 1


class TestQLearning:
    def test_training_is_deterministic_per_seed(self):
        cfg = QConfig(episodes=300, seed=4)
        a = QLearningPolicy().train(DATA, cfg).to_dict()
        b = QLearningPolicy().train(DATA, cfg).to_dict()
        assert a == b

    def test_exports_and_reloads(self):
        p = QLearningPolicy().train(DATA, QConfig(episodes=300, seed=1))
        clone = QLearningPolicy.from_dict(p.to_dict())
        for state in list(p.q)[:20]:
            assert clone.act(state) == p.act(state)

    def test_unseen_state_uses_rules(self):
        obs = (2, 1, 1, 1, 1, 1, 0)
        assert QLearningPolicy().act(obs) == RulesPolicy().act(obs)

    def test_td_target_still_available_for_the_ablation(self):
        p = QLearningPolicy().train(DATA, QConfig(episodes=300, seed=1, target="td", gamma=0.95))
        assert p.q

    def test_learning_reduces_exploration_cost(self):
        p = QLearningPolicy().train(DATA, QConfig(episodes=4000, seed=2))
        early = np.mean([h["return"] for h in p.history[:500]])
        late = np.mean([h["return"] for h in p.history[-500:]])
        assert late > early
