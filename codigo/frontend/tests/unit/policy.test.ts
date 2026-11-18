import { describe, expect, it } from 'vitest';
import parity from '../../../../datos/politicas/paridad.json';
import { market } from '../../src/data/market';
import {
  chooseProduct,
  startGame,
  type GameState,
  type HelpAction,
} from '../../src/domain/game';
import {
  DEFAULT_POLICY,
  POLICY_LABELS,
  bucketDistractors,
  bucketItems,
  confusingDistractor,
  createHelpPolicy,
  estimateProfile,
  features,
  id3Action,
  qAction,
  type PolicyId,
} from '../../src/domain/policy';

const lunch = market.retos[1];
const [target] = lunch.lista_correcta;
const [d1, d2] = lunch.distractores;
const fresh = () => startGame(market, 1, 0);
const force = (action: HelpAction) => () => action;

describe('acción a4 (repetir sin escalar)', () => {
  it('no sube el nivel de pista ni retira productos, pero cuenta el error', () => {
    const state = fresh();
    const next = chooseProduct(market, state, d1, 10, force('a4'));
    expect(next.log_eventos.at(-1)?.accion_agente).toBe('a4');
    expect(next.nivel_pista).toBe(0);
    expect(next.intentos_fallidos).toBe(1);
    expect(next.errores_totales).toBe(1);
    expect(next.productos_visibles).toEqual(state.productos_visibles);
    expect(next.mensaje.tipo).toBe('pista');
    expect(next.mensaje.texto).toContain('Inténtalo otra vez');
  });
  it('un acierto es a0 aunque la política inyectada diga otra cosa', () => {
    const next = chooseProduct(market, fresh(), target, 10, force('a3'));
    expect(next.log_eventos.at(-1)?.accion_agente).toBe('a0');
    expect(next.items_en_carrito).toEqual([target]);
  });
  it('sin política inyectada escala a1, a2, a3 como siempre', () => {
    let state = fresh();
    const actions: string[] = [];
    for (const id of lunch.distractores.slice(0, 3)) {
      state = chooseProduct(market, state, id, 10);
      actions.push(state.log_eventos.at(-1)!.accion_agente);
    }
    expect(actions).toEqual(['a1', 'a2', 'a3']);
  });
});

describe('características discretas', () => {
  it('estado inicial del almuerzo', () => {
    expect(features(market, fresh())).toEqual([0, 0, 2, 3, 1, 0, 1]);
  });
  it('buckets y perfil', () => {
    expect([0, 1, 2, 3, 6].map(bucketDistractors)).toEqual([0, 1, 1, 2, 2]);
    expect([0, 1, 2, 3, 4].map(bucketItems)).toEqual([1, 1, 2, 3, 3]);
    expect(estimateProfile(0, 1, 100)).toBe(1);
    expect(estimateProfile(3, 2, 9000)).toBe(2);
    expect(estimateProfile(0, 4, 2000)).toBe(0);
    expect(estimateProfile(0, 4, 8000)).toBe(1);
  });
  it('detecta el distractor de la misma categoría', () => {
    const state = fresh();
    expect(confusingDistractor(market, state)).toBe(1);
    expect(
      confusingDistractor(market, {
        ...state,
        productos_visibles: state.productos_visibles.filter(
          (id) => id !== 2534,
        ),
      }),
    ).toBe(0);
  });
  it('recuerda la última ayuda', () => {
    const state = chooseProduct(market, fresh(), d1, 10);
    expect(features(market, state)[5]).toBe(1);
  });
});

describe('políticas', () => {
  it('Q-Learning es la política por defecto y hay tres etiquetas', () => {
    expect(DEFAULT_POLICY).toBe('qlearning');
    expect(Object.keys(POLICY_LABELS)).toHaveLength(3);
  });
  it('reglas no inyecta nada (usa el motor original)', () => {
    expect(createHelpPolicy(market, 'reglas')).toBeUndefined();
  });
  it('un estado nunca visto por Q-Learning cae a las reglas', () => {
    const policy = createHelpPolicy(market, 'qlearning')!;
    // intentos=2 without a trained entry still answers a valid help action.
    const state: GameState = {
      ...fresh(),
      intentos_fallidos: 2,
      nivel_pista: 2,
    };
    expect(['a1', 'a2', 'a3', 'a4']).toContain(policy(state));
  });
  it('el árbol ID3 usa la mayoría ante un valor desconocido', () => {
    const tree = {
      feature: 0,
      majority: 2,
      children: { '0': { leaf: 1 }, '1': { leaf: 3 } },
    };
    expect(id3Action(tree, [0, 0, 0, 1, 1, 0, 0])).toBe(1);
    expect(id3Action(tree, [9, 0, 0, 1, 1, 0, 0])).toBe(2);
  });
  it('qAction devuelve undefined si el estado no existe', () => {
    expect(qAction({ '0,0,2,3,1,0,1': 1 }, [0, 0, 2, 3, 1, 0, 1])).toBe(1);
    expect(qAction({}, [0, 0, 2, 3, 1, 0, 1])).toBeUndefined();
  });
});

describe('paridad Python ↔ TypeScript', () => {
  const policies: PolicyId[] = ['reglas', 'id3', 'qlearning'];
  it('hay casos exportados', () => {
    expect(parity.cases.length).toBeGreaterThan(5);
  });
  for (const [index, testCase] of parity.cases.entries()) {
    it(`caso ${index}: mismas características, acciones y estado`, () => {
      let state: GameState = {
        ...startGame(market, testCase.scenario, 0),
        productos_visibles: testCase.order,
      };
      for (const touch of testCase.touches) {
        expect(features(market, state)).toEqual(touch.features);
        const wrong = !state.items_restantes.includes(touch.product);
        if (wrong)
          for (const id of policies) {
            const policy = createHelpPolicy(market, id);
            const got = policy
              ? Number(policy(state).slice(1))
              : Number(
                  chooseProduct(market, state, touch.product, touch.now)
                    .log_eventos.at(-1)!
                    .accion_agente.slice(1),
                );
            expect(got).toBe(
              (touch.expected_action as Record<string, number>)[id],
            );
          }
        state = chooseProduct(market, state, touch.product, touch.now);
        const expected = touch.rules_state_after;
        expect(state.items_restantes).toEqual(expected.items_restantes);
        expect(state.items_en_carrito).toEqual(expected.items_en_carrito);
        expect(state.intentos_fallidos).toBe(expected.intentos_fallidos);
        expect(state.nivel_pista).toBe(expected.nivel_pista);
        expect(state.productos_visibles).toEqual(expected.productos_visibles);
        expect(state.errores_totales).toBe(expected.errores_totales);
        expect(state.log_eventos.at(-1)?.accion_agente).toBe(expected.action);
      }
    });
  }
});
