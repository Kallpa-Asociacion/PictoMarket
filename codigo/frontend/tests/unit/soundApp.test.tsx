import { StrictMode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { SOUND_KEY } from '../../src/sound/useSound';
import { FakeAudioContext } from './fakeAudio';

beforeEach(() => {
  FakeAudioContext.created = [];
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('scrollTo', vi.fn());
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.setItem('pictomarket.intro.seen', '1');
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});
const mount = () =>
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name }));
const toggle = () => screen.getByRole('button', { name: /música$/ });
const track = () => toggle().getAttribute('data-sound-track');

describe('música según la pantalla', () => {
  it('no crea audio hasta que la persona toca algo', () => {
    mount();
    expect(FakeAudioContext.created).toHaveLength(0);
    expect(toggle()).toHaveAccessibleName('Activar música');
    fireEvent.click(document.body);
    expect(FakeAudioContext.created).toHaveLength(1);
    expect(toggle()).toHaveAccessibleName('Silenciar música');
  });
  it('el primer toque del botón de música la enciende, no la apaga', () => {
    mount();
    fireEvent.click(toggle());
    expect(toggle()).toHaveAccessibleName('Silenciar música');
    fireEvent.click(toggle());
    expect(toggle()).toHaveAccessibleName('Activar música');
    expect(JSON.parse(localStorage.getItem(SOUND_KEY)!).music).toBe(false);
  });
  it('cambia entre inicio, juego, panel del terapeuta y celebración', () => {
    mount();
    expect(track()).toBe('home');
    click('EMPEZAR');
    expect(track()).toBe('game');
    click('Panel del terapeuta');
    expect(track()).toBe('therapist');
    click('Cerrar panel del terapeuta');
    expect(track()).toBe('game');
    for (const name of ['PECHUGA DE POLLO', 'PAPA', 'TOMATE', 'LECHUGA'])
      click(new RegExp(`^${name},`));
    expect(track()).toBe('celebration');
    click('Volver al inicio');
  });
  it('comprar y equivocarse disparan efectos', () => {
    mount();
    click('EMPEZAR');
    const audio = FakeAudioContext.created.at(-1)!;
    const before = audio.sources.length;
    click(/^PECHUGA DE POLLO,/);
    const afterSuccess = audio.sources.length;
    expect(afterSuccess).toBeGreaterThan(before);
    click(/^JABÓN,/);
    expect(audio.sources.length).toBeGreaterThan(afterSuccess);
  });
  it('el panel permite apagar música y efectos y ajustar el volumen', () => {
    mount();
    click('Panel del terapeuta');
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('checkbox', { name: 'Música de fondo' }));
    fireEvent.click(
      dialog.getByRole('checkbox', { name: 'Efectos de sonido' }),
    );
    fireEvent.change(dialog.getByRole('slider', { name: /Volumen/ }), {
      target: { value: '0.6' },
    });
    expect(JSON.parse(localStorage.getItem(SOUND_KEY)!)).toEqual({
      music: false,
      effects: false,
      volume: 0.6,
    });
  });
  it('recuerda la preferencia y tolera datos dañados', () => {
    localStorage.setItem(
      SOUND_KEY,
      JSON.stringify({ music: false, effects: true, volume: 0.5 }),
    );
    const first = mount();
    expect(toggle()).toHaveAccessibleName('Activar música');
    first.unmount();
    localStorage.setItem(SOUND_KEY, '{roto');
    mount();
    expect(toggle()).toBeInTheDocument();
  });
  it('sin Web Audio no muestra controles y el juego funciona', () => {
    vi.stubGlobal('AudioContext', undefined);
    mount();
    expect(screen.queryByRole('button', { name: /música$/ })).toBeNull();
    click('EMPEZAR');
    expect(document.querySelectorAll('[data-product-id]')).toHaveLength(10);
  });
});
