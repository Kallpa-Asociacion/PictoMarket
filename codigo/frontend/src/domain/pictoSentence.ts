import functionData from '../../../../datos/pictogramas_funcion.json';
import type { GameState, MarketData } from './game';

export interface SentenceItem {
  kind: 'function' | 'product' | 'category';
  id?: number;
  label: string;
  icon?: string;
}

// Function words come from the single data file; ids are never hard-coded here.
const word = (key: keyof typeof functionData.funcion): SentenceItem => ({
  kind: 'function',
  id: functionData.funcion[key].id,
  label: key.replaceAll('_', ' '),
});
export const FUNCTION_WORDS = functionData.funcion;

// The agent query as a pictogram sentence, derived only from the game state.
export function pictoSentence(
  data: MarketData,
  state: GameState,
): SentenceItem[] {
  const targetId = state.items_restantes[0];
  const target: SentenceItem[] = targetId
    ? [
        {
          kind: 'product',
          id: targetId,
          label: data.catalogo[targetId].nombre,
        },
      ]
    : [];
  const search = [word('BUSCAR'), ...target];
  if (state.mensaje.tipo === 'inicio') return search;
  if (state.mensaje.tipo === 'exito')
    return [word('MUY_BIEN'), word('CARRITO'), ...(targetId ? search : [])];
  switch (state.log_eventos.at(-1)?.accion_agente) {
    case 'a1': {
      const category = data.categorias[data.catalogo[targetId]?.categoria];
      return category
        ? [
            word('BUSCAR'),
            { kind: 'category', label: category.nombre, icon: category.icono },
          ]
        : search;
    }
    case 'a2':
      return [word('AYUDA'), word('QUITAR')];
    case 'a3':
      return [word('MIRAR'), word('AQUÍ'), ...target];
    case 'a4':
      return [word('OTRA_VEZ'), ...search];
    default:
      return search;
  }
}
