# SCRUM — registro del equipo

> Resumen del equipo reconstruido a partir del historial de Git (6 al 11 de octubre de 2026), el trabajo en curso en el repositorio y los documentos de `docs/`. Los nombres «Integrante 3», «Integrante 4» e «Integrante 5» son marcadores que el equipo debe reemplazar por los datos reales antes de la entrega. No se incluyen actas ni listas de asistencia.

## Roles

| Rol | Integrante |
|---|---|
| Product Owner | Asociación Educativa Kallpa (cliente), representada por el docente del curso |
| Scrum Master | Matias Del Castillo |
| Reasoning & Game Logic Engineer | Matias Del Castillo |
| Input & Perception Specialist | Integrante 3 |
| Accessibility & UI Developer | Vanessa Barrientos |
| Pipeline Architect / QA | Integrante 4 |
| Documentación y metodología | Integrante 5 |

## Calendario

Proyecto del 21 de septiembre al 30 de noviembre de 2026. Hitos: Hito 1 (semana 7), Hito 2 (semana 12), Hito 3 (semana 15, entrega 30 de noviembre).

## Sprints

| Sprint | Semanas | Objetivo | Evidencia |
|---|---|---|---|
| 1 | 1–7 (hasta Hito 1) | Formalizar el juego y los escenarios; primer prototipo de la interfaz de pictogramas | `docs/formalizacion.md`, `datos/escenarios.json`; commits `frontend 1ra version` (6-oct) y `nueva vers` |
| 2 | 8–12 (hasta Hito 2) | Apoyo por voz; migrar a React + Vite; agentes ID3 y Q-Learning con métricas | Commits `feat(voice)`, `feat(frontend): migrar a React y Vite`, `feat: implementacion inicio` (7 al 11-oct); `codigo/ia_models`, `datos/politicas`, `datos/simulaciones` |
| 3 | 13–15 (hasta Hito 3) | Backend, paridad Python↔TypeScript, informe, manual, empaquetado, video y despliegue | Trabajo en curso: `codigo/backend`, `docs/informe`, `docs/manual-usuario.md`, `scripts/` |

## Backlog por hito

| Hito | Historias | Estado |
|---|---|---|
| 1 (sem. 7) | Formalización del juego; escenarios; Experimento A (consola); prototipo de la matriz de pictogramas | Hecho (formalización, escenarios y primera versión del frontend) |
| 2 (sem. 12) | Agente ID3 y Q-Learning; métricas; integración con la interfaz; voz | Hecho (políticas y métricas en `datos/`; voz y React integrados) |
| 3 (sem. 15) | Interfaz accesible con voz y guía; informe; manual; empaquetado | En curso (informe y manual en borrador, PDFs y ZIP generables con `scripts/`) |
| 3 (sem. 15) | Video, URL de despliegue, sesiones de usabilidad con Kallpa | Pendiente (ver `docs/metodologia/entrega.md`) |

## Ceremonias

Resumen del equipo, no actas. Se trabajó con ramas por funcionalidad (`feature/apoyo-voz`, `feature/ui`) integradas mediante pull requests.

| Sprint | Planificación | Revisión (demo) | Retrospectiva |
|---|---|---|---|
| 1 | Alcance: reglas del juego y prototipo visual | Primer frontend navegable | Mantener: ramas por funcionalidad. Cambiar: definir antes el contrato de datos |
| 2 | Alcance: voz, nueva interfaz y agentes | Interfaz React con voz y políticas entrenadas | Mantener: pull requests. Cambiar: resolver conflictos de integración con integraciones más pequeñas y frecuentes |
| 3 | Alcance: cierre, documentación y entrega | Pendiente (demo al cliente) | Pendiente |

## Definition of Done

Una historia se considera terminada cuando:

1. Las pruebas automáticas (Python y frontend) pasan en verde.
2. Existe paridad verificada entre el agente en Python y la lógica en TypeScript (`datos/politicas/paridad.json`).
3. Se revisó la accesibilidad (contraste, teclado, lectura en voz alta, objetivos táctiles grandes).
4. La documentación afectada (README, manual, informe) está actualizada.
5. El cambio fue integrado en `main` mediante pull request.
