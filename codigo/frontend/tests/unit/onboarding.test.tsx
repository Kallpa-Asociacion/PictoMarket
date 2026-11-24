import { StrictMode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { INTRO_STEPS } from '../../src/content/intro';
import { market } from '../../src/data/market';

const voice = {
  name: 'Español local',
  lang: 'es-PE',
  voiceURI: 'local',
  localService: true,
};
class FakeUtterance {
  constructor(public text: string) {}
}
let synth: {
  getVoices: ReturnType<typeof vi.fn>;
  speak: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
} & EventTarget;
beforeEach(() => {
  synth = Object.assign(new EventTarget(), {
    getVoices: vi.fn(() => [voice]),
    speak: vi.fn(),
    cancel: vi.fn(),
  });
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('scrollTo', vi.fn());
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});
function mount() {
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name }));
const buy = (name: string) => click(new RegExp(`^${name},`));
const bubble = () => document.querySelector('.guide-mascot .speech-bubble');

// The default help policy is now the learned one; these flows assert the
// original a1 -> a2 -> a3 escalation, so they select the rules policy.
function selectRules() {
  fireEvent.click(screen.getByRole('button', { name: 'Panel del terapeuta' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Ayuda del agente'), {
    target: { value: 'reglas' },
  });
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Cerrar panel del terapeuta' }),
  );
}
const nextStep = () => click('Siguiente');
const tourTitle = () => document.getElementById('tour-heading');
const tourStep = () =>
  document.querySelector('.tour')?.getAttribute('data-step');
// Saltar closes the guide; a second Saltar closes the focus on the list.
const closeGuide = () => {
  click('Saltar');
  click('Saltar');
};

describe('presentación guiada sobre el juego', () => {
  it('no existe el botón de cómo se juega en la bienvenida', () => {
    mount();
    expect(screen.queryByRole('button', { name: /Cómo se juega/ })).toBeNull();
  });
  it('primera visita: EMPEZAR abre el juego con Inti presentando 5 pasos', () => {
    mount();
    click('EMPEZAR');
    expect(document.querySelectorAll('[data-product-id]')).toHaveLength(10);
    expect(tourTitle()).toHaveTextContent(INTRO_STEPS[0].title);
    expect(tourTitle()).toHaveFocus();
    // The game behind it is inert while Inti presents.
    expect(document.querySelector('.market-app')).toHaveAttribute('inert');
    for (let step = 1; step < INTRO_STEPS.length; step++) {
      expect(screen.getByLabelText(`Paso ${step} de 5`)).toBeInTheDocument();
      nextStep();
      expect(tourTitle()).toHaveTextContent(INTRO_STEPS[step].title);
    }
    click('¡A comprar!');
    // First query, played with Inti: list, list item, product on the shelf.
    expect(tourTitle()).toHaveTextContent('Primero, mira tu lista');
    expect(document.querySelector('.market-app')).toHaveAttribute('inert');
    nextStep();
    expect(tourTitle()).toHaveTextContent('Lo primero: pechuga de pollo');
    nextStep();
    expect(tourTitle()).toHaveTextContent('Busca: pechuga de pollo');
    // Inti waits for the touch: no "Siguiente", the shelf can be touched.
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
    expect(document.querySelector('.market-app')).not.toHaveAttribute('inert');
    buy('PECHUGA DE POLLO');
    expect(tourTitle()).toHaveTextContent('¡Muy bien!');
    // Siguiente until the end of the demo, touching what Inti asks.
    for (let guard = 0; guard < 20 && tourStep(); guard++) {
      const asked = document.querySelector<HTMLButtonElement>(
        '.product-card.target-hint, .product-card.category-hint',
      );
      if (!screen.queryByRole('button', { name: /Siguiente|A comprar/ }))
        fireEvent.click(asked!);
      else if (tourStep() === 'focus-ready') click('¡A comprar!');
      else nextStep();
    }
    expect(tourTitle()).toBeNull();
    expect(document.querySelector('.market-app')).not.toHaveAttribute('inert');
    expect(localStorage.getItem('pictomarket.intro.seen')).toBe('1');
    expect(document.getElementById('mercado')).toHaveFocus();
  });
  it('nivel demo: guía, primera compra y un error a propósito', () => {
    vi.useFakeTimers();
    mount();
    click('EMPEZAR');
    const [pollo, papa] = market.retos[1].lista_correcta;
    const list = [...market.retos[1].lista_correcta].sort();
    const ids = (selector: string) =>
      [...document.querySelectorAll(selector)]
        .map((el) => Number(el.getAttribute('data-product-id')))
        .sort();
    const green = () => ids('.product-card.target-hint');
    const amber = () => ids('.product-card.category-hint');
    const shelf = () => ids('.product-card');
    const wait = () => act(() => vi.advanceTimersByTime(3000));
    nextStep();
    expect(tourStep()).toBe('list');
    expect(green()).toEqual([]);
    nextStep();
    expect(tourStep()).toBe('touch');
    expect(green()).toEqual(list);
    nextStep();
    expect(green()).toEqual([]);
    click('Saltar');
    // List, list item, then the product on the shelf in green.
    expect(tourStep()).toBe('focus-list');
    wait();
    expect(tourStep()).toBe('focus-item');
    wait();
    expect(tourStep()).toBe('focus-product');
    expect(green()).toEqual([pollo]);
    // Another product is ignored here: Inti keeps asking for the chicken.
    buy('QUESO');
    expect(tourStep()).toBe('focus-product');
    buy('PECHUGA DE POLLO');
    expect(tourStep()).toBe('focus-good');
    expect(document.querySelector(`[data-product-id="${pollo}"]`)).toHaveClass(
      'bought',
    );
    expect(document.querySelector('.tour-text')).toHaveTextContent(
      'El verde significa que ya está en tu carrito.',
    );
    nextStep();
    // The list already shows the chicken in green; next comes the potato.
    expect(tourStep()).toBe('focus-list-done');
    wait();
    expect(tourStep()).toBe('focus-item-2');
    expect(tourTitle()).toHaveTextContent('Ahora sigue: papa');
    wait();
    // "¿Y si te equivocas?": a product that is not on the list, in green.
    expect(tourStep()).toBe('focus-try-wrong');
    const [decoy] = green();
    expect(list).not.toContain(decoy);
    const total = shelf().length;
    fireEvent.click(document.querySelector(`[data-product-id="${decoy}"]`)!);
    // The mistake is not counted: amber on the potato, then fewer products.
    expect(tourStep()).toBe('focus-wrong');
    expect(amber()).toEqual([papa]);
    expect(screen.getByText(/Tengo/)).toHaveTextContent('Tengo 5 de 8');
    nextStep();
    expect(tourStep()).toBe('focus-remove');
    expect(shelf()).toHaveLength(total - 1);
    expect(shelf()).not.toContain(decoy);
    nextStep();
    expect(tourStep()).toBe('focus-retry');
    buy('PAPA');
    expect(tourStep()).toBe('focus-good-2');
    nextStep();
    // The hint board, and then the child plays alone.
    expect(tourStep()).toBe('focus-board');
    expect(document.querySelector('.tour-text')).toHaveTextContent(
      'el panel de pistas se actualiza mientras eliges',
    );
    nextStep();
    expect(tourStep()).toBe('focus-ready');
    expect(tourTitle()).toHaveTextContent('¡Ya estás listo!');
    click('¡A comprar!');
    expect(tourStep()).toBeUndefined();
    // After the guide the shelf is the real one again.
    expect(shelf()).toHaveLength(total);
  });
  it('durante la espera del toque, el resto del juego no responde', () => {
    vi.useFakeTimers();
    mount();
    click('EMPEZAR');
    click('Saltar');
    act(() => vi.advanceTimersByTime(3000));
    act(() => vi.advanceTimersByTime(3000));
    expect(tourStep()).toBe('focus-product');
    click('Panel del terapeuta');
    expect(document.querySelector('dialog[open]')).toBeNull();
    expect(tourStep()).toBe('focus-product');
  });
  it('segunda visita: EMPEZAR va directo al juego sin presentación', () => {
    localStorage.setItem('pictomarket.intro.seen', '1');
    mount();
    click('EMPEZAR');
    expect(tourTitle()).toBeNull();
    expect(document.querySelectorAll('[data-product-id]')).toHaveLength(10);
  });
  it('Saltar cierra la presentación y la marca como vista', () => {
    mount();
    click('EMPEZAR');
    closeGuide();
    expect(tourTitle()).toBeNull();
    expect(localStorage.getItem('pictomarket.intro.seen')).toBe('1');
  });
  it('el tiempo de la presentación no cuenta como tiempo de compra', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      mount();
      click('EMPEZAR');
      clock.mockReturnValue(90000);
      closeGuide();
      clock.mockReturnValue(90150);
      buy('PECHUGA DE POLLO');
      click('Panel del terapeuta');
      expect(screen.getByRole('dialog')).toHaveTextContent('"t_ms": 150');
    } finally {
      clock.mockRestore();
    }
  });
  it('si localStorage falla el juego funciona', () => {
    const boom = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', {
      getItem: boom,
      setItem: boom,
      removeItem: boom,
    });
    mount();
    click('EMPEZAR');
    click('Saltar');
    expect(document.querySelectorAll('[data-product-id]')).toHaveLength(10);
  });
  it('Atrás está deshabilitado en el primer paso y retrocede después', () => {
    mount();
    click('EMPEZAR');
    expect(screen.getByRole('button', { name: 'Atrás' })).toBeDisabled();
    nextStep();
    click('Atrás');
    expect(tourTitle()).toHaveTextContent(INTRO_STEPS[0].title);
  });
  it('flechas navegan y Esc salta', () => {
    mount();
    click('EMPEZAR');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(tourTitle()).toHaveTextContent(INTRO_STEPS[1].title);
    expect(tourTitle()).toHaveFocus();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(tourTitle()).toHaveTextContent(INTRO_STEPS[0].title);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(tourStep()).toBe('focus-list');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(tourTitle()).toBeNull();
  });
  it('durante la presentación el guía fijo y el empujón no aparecen', () => {
    vi.useFakeTimers();
    mount();
    click('EMPEZAR');
    expect(document.querySelector('.guide-mascot')).toBeNull();
    act(() => vi.advanceTimersByTime(20000));
    expect(document.querySelector('.guide-mascot')).toBeNull();
    expect(tourTitle()).toBeInTheDocument();
  });
  it('el panel del terapeuta permite verla otra vez sin perder la compra', () => {
    localStorage.setItem('pictomarket.intro.seen', '1');
    mount();
    click('EMPEZAR');
    buy('PECHUGA DE POLLO');
    click('Panel del terapeuta');
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Ver presentación otra vez',
      }),
    );
    expect(tourTitle()).toHaveTextContent(INTRO_STEPS[0].title);
    click('Saltar');
    expect(screen.getByText(/Tengo/)).toHaveTextContent('Tengo 5 de 8');
  });
  it('el botón Guía de la barra superior repite la presentación', () => {
    localStorage.setItem('pictomarket.intro.seen', '1');
    mount();
    click('EMPEZAR');
    buy('PECHUGA DE POLLO');
    click('Ver la presentación de Inti');
    expect(tourTitle()).toHaveTextContent(INTRO_STEPS[0].title);
    click('Saltar');
    expect(screen.getByText(/Tengo/)).toHaveTextContent('Tengo 5 de 8');
  });
  it('Inicio: sin carrito vuelve directo; con carrito pide confirmar', () => {
    localStorage.setItem('pictomarket.intro.seen', '1');
    mount();
    click('EMPEZAR');
    click('Volver al inicio');
    expect(screen.getByRole('button', { name: 'EMPEZAR' })).toBeInTheDocument();
    click('EMPEZAR');
    buy('PECHUGA DE POLLO');
    click('Volver al inicio');
    const dialog = screen.getByRole('dialog', { name: '¿Volver al inicio?' });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Seguir comprando' }),
    );
    expect(screen.queryByRole('button', { name: 'EMPEZAR' })).toBeNull();
    expect(screen.getByText(/Tengo/)).toHaveTextContent('Tengo 5 de 8');
    click('Volver al inicio');
    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: '¿Volver al inicio?' }),
      ).getAllByRole('button', { name: 'Volver al inicio' })[0],
    );
    expect(screen.getByRole('button', { name: 'EMPEZAR' })).toBeInTheDocument();
  });
});

describe('voz', () => {
  it('no habla sola; activar desde Inti lee el paso y cada paso nuevo', () => {
    mount();
    click('EMPEZAR');
    expect(synth.speak).not.toHaveBeenCalled();
    click('Activar voz y escuchar a Inti');
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(synth.speak.mock.calls[0][0].text).toContain('te acompaño');
    nextStep();
    expect(synth.speak).toHaveBeenCalledTimes(2);
    expect(synth.speak.mock.calls[1][0].text).toContain('qué vamos a comprar');
  });
  it('la nube de inicio es la región viva con el saludo', () => {
    mount();
    expect(screen.getByRole('status')).toHaveTextContent('Soy Inti');
    expect(synth.speak).not.toHaveBeenCalled();
  });
});

describe('guía durante el juego', () => {
  function play() {
    localStorage.setItem('pictomarket.intro.seen', '1');
    mount();
    click('EMPEZAR');
  }
  it('reemplaza el retrato de la pizarra y no duplica el aviso a lectores', () => {
    play();
    expect(
      document.querySelector('.instruction-board .guide-portrait'),
    ).toBeNull();
    expect(document.querySelector('.guide-mascot')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    // Only the instruction board announces; the bubble stays silent.
    expect(document.querySelector('.guide-mascot [role="status"]')).toBeNull();
    expect(
      document.querySelectorAll('.instruction-board [role="status"]'),
    ).toHaveLength(1);
    expect(bubble()).toHaveTextContent('¡Vamos de compras!');
  });
  it('reacciona a acierto y a las tres pistas', () => {
    play();
    selectRules();
    buy('JABÓN');
    expect(bubble()).toHaveTextContent('Mira la pista 💡');
    buy('CHAMPÚ');
    expect(bubble()).toHaveTextContent('¡Tú puedes!');
    buy('DENTÍFRICO');
    expect(bubble()).toHaveTextContent('¡Está aquí abajo!');
    buy('PECHUGA DE POLLO');
    expect(bubble()).toHaveTextContent('¡Muy bien!');
  });
  it('las nubes de éxito se minimizan solas y el retrato las recupera; las pistas no', () => {
    vi.useFakeTimers();
    play();
    buy('PECHUGA DE POLLO');
    expect(bubble()).not.toBeNull();
    act(() => vi.advanceTimersByTime(6100));
    expect(bubble()).toBeNull();
    fireEvent.click(document.querySelector('.guide-portrait-frame')!);
    expect(bubble()).toHaveTextContent('¡Muy bien!');
    buy('JABÓN');
    const hint = bubble()?.textContent;
    expect(hint).not.toMatch(/Muy bien/);
    act(() => vi.advanceTimersByTime(10000));
    // Hint bubbles (whatever help the policy chose) never shrink on their own.
    expect(bubble()).toHaveTextContent(hint!);
  });
  it('empujón por inactividad a los 15 s; desaparece al tocar y no toca el log', () => {
    vi.useFakeTimers();
    play();
    act(() => vi.advanceTimersByTime(14900));
    // The greeting already shrank to the portrait.
    expect(bubble()).toBeNull();
    act(() => vi.advanceTimersByTime(200));
    expect(bubble()).toHaveTextContent('¿Te ayudo? Toca 🔊 para escuchar.');
    expect(synth.speak).not.toHaveBeenCalled();
    click('Panel del terapeuta');
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Registro de eventos (0)',
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cerrar panel del terapeuta',
      }),
    );
    buy('PECHUGA DE POLLO');
    expect(bubble()).toHaveTextContent('¡Muy bien!');
    expect(bubble()).not.toHaveTextContent('¿Te ayudo?');
  });
});

describe('selector de política de ayuda', () => {
  function openPanel() {
    localStorage.setItem('pictomarket.intro.seen', '1');
    mount();
    click('EMPEZAR');
    click('Panel del terapeuta');
    return screen.getByRole('dialog');
  }
  it('ofrece tres políticas y Q-Learning es la predeterminada', () => {
    const dialog = openPanel();
    const select = within(dialog).getByLabelText(
      'Ayuda del agente',
    ) as HTMLSelectElement;
    expect(select.value).toBe('qlearning');
    expect([...select.options].map((option) => option.value)).toEqual([
      'reglas',
      'id3',
      'qlearning',
    ]);
  });
  it('cada política permite completar una partida', () => {
    for (const id of ['reglas', 'id3', 'qlearning']) {
      const dialog = openPanel();
      fireEvent.change(within(dialog).getByLabelText('Ayuda del agente'), {
        target: { value: id },
      });
      fireEvent.click(
        within(dialog).getByRole('button', {
          name: 'Cerrar panel del terapeuta',
        }),
      );
      for (const name of ['JABÓN', 'CHAMPÚ', 'DENTÍFRICO']) {
        const card = document.querySelector(`[data-product-id]:not(:disabled)`);
        expect(card).not.toBeNull();
        if (screen.queryByRole('button', { name: new RegExp(`^${name},`) }))
          buy(name);
      }
      for (const name of ['PECHUGA DE POLLO', 'PAPA', 'TOMATE', 'LECHUGA'])
        buy(name);
      expect(
        screen.getByRole('heading', { name: '¡Lo lograste!' }),
      ).toBeInTheDocument();
      cleanup();
    }
  });
  it('el JSON exportado indica la política usada', () => {
    const dialog = openPanel();
    fireEvent.change(within(dialog).getByLabelText('Ayuda del agente'), {
      target: { value: 'id3' },
    });
    expect(dialog).toHaveTextContent('Árbol de decisión (ID3)');
  });
});
