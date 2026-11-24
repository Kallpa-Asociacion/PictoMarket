import { useEffect, useRef } from 'react';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChartNoAxesColumnIncreasing,
  Download,
  Presentation,
  RotateCcw,
  Settings2,
  X,
  XCircle,
} from 'lucide-react';
import { market } from '../data/market';
import { objectiveWords, type GameState } from '../domain/game';
import { POLICY_LABELS, type PolicyId, estimateProfile } from '../domain/policy';
import { downloadSessionReport } from '../utils/pdf-report';

const ACTION_LABELS: Record<string, string> = {
  a0: '—',
  a1: 'Pista: categoría',
  a2: 'Eliminó distractor',
  a3: 'Señaló producto',
  a4: 'Repitió indicación',
};

const PROFILE_LABELS = ['Rápido / Autónomo', 'Ritmo medio', 'Necesita apoyo'];
const PROFILE_CLASSES = ['profile-fast', 'profile-medium', 'profile-slow'];

export function TherapistPanel({
  open,
  close,
  state,
  reset,
  replayTour,
  policy,
  setPolicy,
}: {
  open: boolean;
  close: () => void;
  state: GameState;
  reset: (index?: number) => void;
  replayTour: () => void;
  policy: PolicyId;
  setPolicy: (policy: PolicyId) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const challenge = market.retos[state.reto_idx];
  const totalProducts = challenge.lista_correcta.length;
  const log = state.log_eventos;
  const meanMs = log.length
    ? log.reduce((s, e) => s + e.t_ms, 0) / log.length
    : 0;
  const profileIndex = estimateProfile(
    state.errores_totales,
    state.items_en_carrito.length,
    meanMs,
  );

  return (
    <dialog
      ref={dialog}
      className="therapist-dialog"
      aria-labelledby="therapist-heading"
      onClose={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="dialog-content">
        {/* ——— CABECERA ——— */}
        <header className="dialog-heading">
          <div>
            <span className="eyebrow">ACOMPAÑAMIENTO</span>
            <h2 id="therapist-heading">
              <ChartNoAxesColumnIncreasing aria-hidden="true" />
              Panel del terapeuta
            </h2>
          </div>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Cerrar panel del terapeuta"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        {/* ——— CONFIGURACIÓN ——— */}
        <section className="therapist-section">
          <h3 className="section-title">
            <Settings2 size={15} aria-hidden="true" />
            Configuración de sesión
          </h3>
          <div className="section-fields">
            <label className="scenario-label">
              Escenario de compra
              <select
                value={state.reto_idx}
                onChange={(event) => reset(Number(event.target.value))}
              >
                {market.retos.map((ch, index) => (
                  <option key={ch.id_reto} value={index}>
                    {objectiveWords(ch).join(' ').toLowerCase()} · nivel{' '}
                    {ch.nivel}
                  </option>
                ))}
              </select>
            </label>
            <label className="scenario-label">
              Política de ayuda del agente
              <select
                value={policy}
                onChange={(event) => setPolicy(event.target.value as PolicyId)}
              >
                {(Object.keys(POLICY_LABELS) as PolicyId[]).map((id) => (
                  <option key={id} value={id}>
                    {POLICY_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* ——— ESTADÍSTICAS ——— */}
        <section className="therapist-section">
          <h3 className="section-title">
            <BarChart3 size={15} aria-hidden="true" />
            Estadísticas de sesión
          </h3>
          <div className="therapist-stats">
            <div
              className="stat-tile"
              style={
                {
                  '--progress': `${(state.items_en_carrito.length / totalProducts) * 100}%`,
                } as React.CSSProperties
              }
            >
              <strong>
                {state.items_en_carrito.length}/{totalProducts}
              </strong>
              <span>Productos comprados</span>
            </div>
            <div className="stat-tile">
              <strong
                className={
                  state.errores_totales > 0 ? 'stat-warn' : 'stat-good'
                }
              >
                {state.errores_totales}
              </strong>
              <span>Errores totales</span>
            </div>
            <div className="stat-tile">
              <strong>{state.nivel_pista}/3</strong>
              <span>Nivel de pista</span>
            </div>
            <div className="stat-tile">
              <strong>{state.monedas}</strong>
              <span>Monedas restantes</span>
            </div>
          </div>
          <div className={`profile-badge ${PROFILE_CLASSES[profileIndex]}`}>
            Perfil estimado: {PROFILE_LABELS[profileIndex]}
          </div>
        </section>

        {/* ——— ACCIONES ——— */}
        <div className="therapist-actions">
          <button className="soft-button" onClick={() => reset()}>
            <RotateCcw aria-hidden="true" />
            Reiniciar escenario
          </button>
          <button
            className="primary-button"
            onClick={() => downloadSessionReport(state, policy)}
          >
            <Download aria-hidden="true" />
            Exportar informe PDF
          </button>
        </div>
        <div className="intro-reset">
          <button className="soft-button" onClick={replayTour}>
            <Presentation aria-hidden="true" />
            Ver presentación otra vez
          </button>
          <p className="fine-print">
            Reiniciar o cambiar de escenario borra el progreso y los eventos
            actuales, pero conserva los ajustes de voz. Exporta el informe
            primero si necesitas guardarlos.
          </p>
        </div>

        {/* ——— REGISTRO DE EVENTOS ——— */}
        <section className="therapist-section">
          <h3 className="section-title">
            <BookOpen size={15} aria-hidden="true" />
            Registro de eventos
            {log.length > 0 && (
              <span className="event-count-badge">{log.length}</span>
            )}
          </h3>
          {log.length === 0 ? (
            <p className="event-log-empty">
              Aún no hay eventos registrados. Inicia la actividad con el
              paciente para ver el historial de interacciones.
            </p>
          ) : (
            <div className="event-log-wrapper">
              <table className="event-log-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Tiempo</th>
                    <th scope="col">Objetivo</th>
                    <th scope="col">Tocado</th>
                    <th scope="col">Resultado</th>
                    <th scope="col">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((event, i) => (
                    <tr
                      key={i}
                      className={event.correcto ? 'event-correct' : 'event-error'}
                    >
                      <td className="event-num">{i + 1}</td>
                      <td className="event-time">
                        {(event.t_ms / 1000).toFixed(1)}s
                      </td>
                      <td>
                        {market.catalogo[event.item_objetivo]?.nombre?.toLowerCase()}
                      </td>
                      <td>
                        {market.catalogo[event.item_tocado]?.nombre?.toLowerCase()}
                      </td>
                      <td>
                        {event.correcto ? (
                          <span className="result-ok">
                            <CheckCircle2 size={13} aria-hidden="true" />
                            Correcto
                          </span>
                        ) : (
                          <span className="result-err">
                            <XCircle size={13} aria-hidden="true" />
                            Error
                          </span>
                        )}
                      </td>
                      <td className="event-action">
                        {ACTION_LABELS[event.accion_agente]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="fine-print" style={{ marginTop: '18px' }}>
          Política de ayuda seleccionable: reglas a0–a3, árbol de decisión ID3
          o Q-Learning, entrenados sin conexión con jugadores simulados. Los
          datos solo viven en la memoria de esta pestaña.
        </p>
      </div>
    </dialog>
  );
}
