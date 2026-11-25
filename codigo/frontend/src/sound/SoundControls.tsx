import { Music, Volume2, VolumeX } from 'lucide-react';
import { TRACKS } from './tracks';
import type { SoundSupport } from './useSound';
import './sound.css';

/** Always-visible music switch for the top bar. */
export function SoundToggle({ sound }: { sound: SoundSupport }) {
  if (!sound.supported) return null;
  const label = sound.playing ? 'Silenciar música' : 'Activar música';
  return (
    <button
      type="button"
      className={`sound-toggle ${sound.playing ? 'playing' : ''}`}
      onClick={sound.toggle}
      aria-label={label}
      title={label}
      data-sound-toggle
      data-sound-track={sound.track}
    >
      {sound.playing ? (
        <Music aria-hidden="true" />
      ) : (
        <VolumeX aria-hidden="true" />
      )}
    </button>
  );
}

/** Full settings for the therapist panel. */
export function SoundSettingsSection({ sound }: { sound: SoundSupport }) {
  if (!sound.supported) return null;
  const { settings, configure } = sound;
  return (
    <section className="therapist-section sound-settings">
      <h3 className="section-title">
        <Volume2 size={15} aria-hidden="true" />
        Música y sonidos
      </h3>
      <label className="sound-option">
        <input
          type="checkbox"
          checked={settings.music}
          onChange={(event) => configure({ music: event.target.checked })}
        />
        Música de fondo
      </label>
      <label className="sound-option">
        <input
          type="checkbox"
          checked={settings.effects}
          onChange={(event) => configure({ effects: event.target.checked })}
        />
        Efectos de sonido
      </label>
      <label className="sound-volume">
        Volumen de la música y los sonidos
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.volume}
          onChange={(event) =>
            configure({ volume: Number(event.target.value) })
          }
        />
      </label>
      <p className="fine-print">
        Cada parte tiene su propia música: inicio («{TRACKS.home.label}»), juego
        («{TRACKS.game.label}»), este panel («{TRACKS.therapist.label}») y la
        compra completada («{TRACKS.celebration.label}»). La música baja sola
        mientras habla la voz. Para personas sensibles al sonido, puede
        desactivarse aquí.
      </p>
    </section>
  );
}
