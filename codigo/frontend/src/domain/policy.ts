import qlearningExport from '../../../../datos/politicas/qlearning.json';
import id3Export from '../../../../datos/politicas/id3.json';
import {
  agentPolicy,
  type GameState,
  type HelpAction,
  type HelpPolicy,
  type MarketData,
} from './game';

// Help policies trained offline in codigo/ia_models (see docs/formalizacion.md).
// The discrete features below MUST stay identical to
// pictomarket_ia/caracteristicas.py; tests/unit/policy.test.ts checks parity.

export type PolicyId = 'reglas' | 'id3' | 'qlearning';
export const POLICY_LABELS: Record<PolicyId, string> = {
  reglas: 'Reglas (a1 → a2 → a3)',
  id3: 'Árbol de decisión (ID3)',
  qlearning: 'Q-Learning (adaptativo)',
};
export const DEFAULT_POLICY: PolicyId = 'qlearning';

/** (failures, hint level, distractors, items, profile, last help,
 * confusing same-category distractor visible) */
export type Features = [number, number, number, number, number, number, number];

const FAST_MEAN_MS = 4000;
const FAST_MAX_ERROR_RATE = 0.15;
const SUPPORT_MIN_ERROR_RATE = 0.5;

export const bucketDistractors = (count: number) =>
  count === 0 ? 0 : count <= 2 ? 1 : 2;
export const bucketItems = (count: number) => Math.max(1, Math.min(3, count));

/** 0 fast, 1 medium, 2 needs support. */
export function estimateProfile(
  errors: number,
  correct: number,
  meanMs: number,
): number {
  const turns = errors + correct;
  if (turns < 2) return 1;
  const rate = errors / turns;
  if (rate >= SUPPORT_MIN_ERROR_RATE) return 2;
  if (rate <= FAST_MAX_ERROR_RATE && meanMs < FAST_MEAN_MS) return 0;
  return 1;
}

const ACTION_NUMBER: Record<string, number> = {
  a0: 0,
  a1: 1,
  a2: 2,
  a3: 3,
  a4: 4,
};
const NUMBER_ACTION: HelpAction[] = ['a1', 'a1', 'a2', 'a3', 'a4'];

/** 1 when a visible distractor shares the target's category (a category
 * hint cannot separate them), else 0. */
export function confusingDistractor(
  data: MarketData,
  state: GameState,
): number {
  const target = state.items_restantes[0];
  if (target === undefined) return 0;
  const category = data.catalogo[target].categoria;
  const distractors = data.retos[state.reto_idx].distractores;
  return state.productos_visibles.some(
    (id) =>
      distractors.includes(id) && data.catalogo[id].categoria === category,
  )
    ? 1
    : 0;
}

export function features(data: MarketData, state: GameState): Features {
  const log = state.log_eventos;
  const meanMs = log.length
    ? log.reduce((sum, event) => sum + event.t_ms, 0) / log.length
    : 0;
  const distractors = data.retos[state.reto_idx].distractores;
  const visible = state.productos_visibles.filter((id) =>
    distractors.includes(id),
  ).length;
  return [
    Math.min(state.intentos_fallidos, 3),
    state.nivel_pista,
    bucketDistractors(visible),
    bucketItems(state.items_restantes.length),
    estimateProfile(
      state.errores_totales,
      state.items_en_carrito.length,
      meanMs,
    ),
    log.length ? ACTION_NUMBER[log[log.length - 1].accion_agente] : 0,
    confusingDistractor(data, state),
  ];
}

const toAction = (n: number): HelpAction => NUMBER_ACTION[n] ?? 'a1';
const rulesAction = (state: GameState): HelpAction =>
  agentPolicy(
    {
      items_restantes: state.items_restantes,
      items_en_carrito: state.items_en_carrito,
      intentos_fallidos: Math.min(state.intentos_fallidos, 3),
      nivel_pista: state.nivel_pista,
    },
    -1, // not a pending product: the rules answer with the escalation help
  ) as HelpAction;

interface TreeNode {
  leaf?: number;
  feature?: number;
  majority?: number;
  children?: Record<string, TreeNode>;
}

/** ID3 tree interpreter (same traversal as ID3Tree.act in Python). */
export function id3Action(tree: TreeNode, feats: Features): number {
  let node: TreeNode = tree;
  while (node.leaf === undefined) {
    const child: TreeNode | undefined =
      node.children?.[String(feats[node.feature as number])];
    if (!child) return node.majority as number;
    node = child;
  }
  return node.leaf;
}

export function qAction(
  best: Record<string, number>,
  feats: Features,
): number | undefined {
  return best[feats.join(',')];
}

export function createHelpPolicy(
  data: MarketData,
  id: PolicyId,
): HelpPolicy | undefined {
  if (id === 'reglas') return undefined; // game.ts default rules
  if (id === 'id3')
    return (state) =>
      toAction(id3Action(id3Export.tree as TreeNode, features(data, state)));
  return (state) => {
    const best = qAction(qlearningExport.best_action, features(data, state));
    // Unseen state: safe fallback to the rules.
    return best === undefined ? rulesAction(state) : toAction(best);
  };
}
