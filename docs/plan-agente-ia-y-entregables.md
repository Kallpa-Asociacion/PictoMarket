# Plan de implementación: Agente de IA, evaluación y entregables (TP/TF 1ASI0404)

> Documento para un agente/equipo de implementación. Leerlo completo antes de tocar código.
> Origen: brechas detectadas al contrastar el repositorio con `TP-TF-1ASI0404-Enunciado - 2026-20.pdf`.
> Fecha de redacción: 2026-11-17. El enunciado fija el cierre del proyecto el **30 de noviembre de 2026** (Hito 3, semana 15): quedan ~13 días. El plan está ordenado por **prioridad de nota**, no por comodidad técnica.

---

## 0. Estado actual y brechas

| # | Requisito del enunciado | Estado hoy | Prioridad |
|---|---|---|---|
| B1 | Modelo principal de IA (Q-Learning / MDP / experto probabilístico) que module la asistencia y evite repetición (§4.2) | **Ausente.** Política por reglas fijas a0–a3 en `src/domain/game.ts` | P0 |
| B2 | Baseline ID3 / ganancia de información o búsqueda heurística que decida la pista (§4.2) | **Ausente.** Solo `visualEntropy` informativa en el log | P0 |
| B3 | Formalización del espacio de estados, acciones, transiciones y victoria (§4.1) | Implícita en código, sin documento | P0 |
| B4 | Evaluación: tasa de éxito, turnos, convergencia, baseline vs. modelo (Hito 2, informe §II) | **Ausente** | P0 |
| B5 | Experimento A: simulación en consola/notebook del motor (Hito 1) | **Ausente** | P0 |
| B6 | Estructura §11: `/codigo` (`frontend`, `backend`, `ia_models`), `/datos`, `/docs` con informe PDF y manual | Solo `frontend` y `legacy`; `docs/` sin informe ni manual | P0 |
| B7 | Consultas del sistema «construidas enteramente con pictogramas» (§3, Modalidad 1) | Pizarra en texto + voz | P1 |
| B8 | Informe final (§10), video 3–5 min, despliegue | Sin informe ni video; `vercel.json` sin versionar | P1 |
| B9 | Evidencia de CRISP-DM y SCRUM por hito (§5, §7) | Ninguna | P1 |
| B10 | Impacto ético/social ODS 10 y 4 + pruebas de usabilidad (§6, §7) | Ninguna | P1 |

**Fuera de alcance:** visión computacional (es opcional en el enunciado; se justifica en el informe: interacción digital estructurada).

---

## 1. Decisiones de diseño (propuestas; validar con el equipo en la Fase 0)

| Tema | Decisión | Alternativa y trade-off |
|---|---|---|
| Dónde vive la IA | **Python** en `codigo/ia_models/` (stack recomendado por el enunciado: NumPy, scikit-learn, Gymnasium, matplotlib). Entrena y evalúa offline. | Entrenar en TypeScript: evita Python pero se aleja del stack recomendado y complica notebooks/métricas. |
| Cómo llega al juego | Se **exporta la política a JSON** (`datos/politicas/*.json`) y el frontend la interpreta en `src/domain/policy.ts` (tabla Q / árbol ID3). Sin servidor, funciona en Vercel y sin red. | Servir la política por API: más fiel a «backend», pero añade latencia y un punto de fallo en la demo. |
| Backend | `codigo/backend/` con **FastAPI mínimo** (política, salud, registro anónimo de sesiones). **Opcional (P2)**: el juego no depende de él. | Omitirlo e indicar en el informe que `ia_models` cumple el rol; incumple literalmente la estructura §11. |
| Fuente única de datos | `datos/escenarios.json` sigue siendo la fuente. Python y React lo leen; **no duplicar** el catálogo. | — |
| Política actual por reglas | Se conserva como **tercera referencia** (`RulesPolicy`) para comparar; no se elimina. | — |
| Motor del juego | `game.ts` conserva su lógica de transición. Solo cambia **quién elige la acción de ayuda** tras un error, vía una interfaz `HintPolicy`. | — |

---

## 2. Formalización (base de todo lo demás)

Modelar el juego como un **MDP**. Esta formalización se escribe primero (Fase 1) y se implementa idéntica en Python (`entorno.py`) y TypeScript.

**Estado observable por el agente** `s = (fallos_consecutivos, nivel_pista, distractores_restantes, items_restantes, perfil)`:

- `fallos_consecutivos` ∈ {0,1,2,3+}
- `nivel_pista` ∈ {0,1,2,3}
- `distractores_restantes` en cubos {0, 1–2, 3+}
- `items_restantes` en cubos {1, 2, 3+}
- `perfil` ∈ {rápido, medio, necesita apoyo}: estimado de la **tasa de error** y el **tiempo de respuesta** (`t_ms`) de la sesión. Este componente es el que hace al agente *adaptativo* (el enunciado exige «adaptarse a sus respuestas»).

**Acciones del agente** (tras un error): `A = {a1: pista de categoría, a2: retirar distractor, a3: señalar el producto, a4: repetir la consulta sin escalar}`. `a4` permite no sobre-ayudar y evitar respuestas repetitivas.

**Transición:** la dada por `chooseProduct` (compra correcta ⇒ reinicia pistas; error ⇒ incrementa fallos y aplica el efecto de la acción).
**Término:** todos los productos comprados (victoria) o tope de turnos (derrota técnica, para el simulador).

**Recompensa** (diseño inicial, ajustable y documentado en el informe):

| Evento | Recompensa |
|---|---|
| Acierto sin ayuda | `+10` |
| Acierto tras pista de nivel `k` | `+10 − 3k` (premia la autonomía) |
| Cada turno | `−1` |
| Repetir exactamente la misma acción de ayuda seguida | `−4` (penaliza la repetición, requisito §4.2) |
| Completar la partida | `+20` |

**Usuario simulado** (para entrenar sin personas): elige un producto por una distribución sobre candidatos. Perfiles con distinta probabilidad de acierto, sesgo a elegir distractores de la misma categoría, y «lapsos de atención». La pista de categoría y el retiro de distractores reducen candidatos como en el juego real. Semillas fijas para reproducibilidad.

---

## 3. Arquitectura objetivo

```text
PictoMarket/
├── codigo/
│   ├── frontend/                 # React (ya existe)
│   │   └── src/domain/policy.ts  # NUEVO: interfaz HintPolicy + intérpretes (reglas / ID3 / Q-table)
│   ├── backend/                  # NUEVO (P2): FastAPI mínimo
│   │   ├── app/main.py
│   │   └── tests/
│   ├── ia_models/                # NUEVO (P0): núcleo de IA en Python
│   │   ├── pictomarket_ia/
│   │   │   ├── datos.py          # carga datos/escenarios.json
│   │   │   ├── entorno.py        # MDP (Gymnasium Env)
│   │   │   ├── usuario_sim.py    # perfiles simulados
│   │   │   ├── politicas/
│   │   │   │   ├── reglas.py     # a0–a3 actuales (referencia)
│   │   │   │   ├── id3.py        # baseline: ID3 + entropía
│   │   │   │   └── qlearning.py  # modelo principal
│   │   │   ├── evaluacion.py     # métricas y comparación
│   │   │   └── exportar.py       # JSON para el frontend
│   │   ├── experimentos/
│   │   │   ├── experimento_a_consola.py    # Hito 1
│   │   │   └── notebooks/*.ipynb
│   │   ├── tests/                # pytest
│   │   └── requirements.txt
│   └── legacy/streamlit/         # se conserva
├── datos/
│   ├── escenarios.json           # fuente única (ya existe)
│   ├── politicas/                # NUEVO: política exportada (anónima, sin datos personales)
│   └── simulaciones/             # NUEVO: dataset sintético y métricas (CSV)
└── docs/
    ├── plan-*.md                 # planes internos (no se entregan)
    ├── formalizacion.md          # NUEVO
    ├── informe-final.pdf         # NUEVO (fuente: informe/*.md)
    ├── manual-usuario.pdf        # NUEVO
    └── metodologia/              # NUEVO: CRISP-DM y SCRUM
```

---

## 4. Fases y tareas

> Convenciones: identificadores y comentarios de código en inglés; textos de UI y documentos en español neutro. TDD donde haya lógica (RED → GREEN). Sin atribución a IA en commits; Conventional Commits.
> Cada tarea: **criterio de aceptación** verificable.

### Fase 0 — Decisiones y andamiaje (0.5 día)

| ID | Tarea | Criterio de aceptación |
|---|---|---|
| F0.1 | Validar las decisiones de §1 con el equipo y registrarlas en `docs/metodologia/decisiones.md` | Documento con decisión, motivo y alternativa descartada |
| F0.2 | Crear `codigo/ia_models/` con `requirements.txt` (numpy, scipy, scikit-learn, gymnasium, matplotlib, pandas, pytest) y entorno virtual documentado | `pytest` corre en vacío sin errores |
| F0.3 | Versionar o ignorar explícitamente `vercel.json`, `.vercelignore`, `.atl/` y el PDF del enunciado (no commitear el enunciado si no se desea) | `git status` sin ambigüedades |

### Fase 1 — Formalización y entorno (P0, 1 día) → cubre B3

| ID | Tarea | Criterio de aceptación |
|---|---|---|
| F1.1 | Redactar `docs/formalizacion.md`: S, A, P, R, γ, condiciones de término, supuestos, usuario simulado y diagramas de transición | Cada símbolo del §2 definido; revisión cruzada con `game.ts` |
| F1.2 | `datos.py`: cargar y validar `escenarios.json` (reutilizar las reglas de `validateData`) | Test: datos inválidos lanzan error |
| F1.3 | `entorno.py`: Gymnasium `Env` fiel a `chooseProduct` | **Test de paridad**: misma secuencia de toques ⇒ mismo estado y mismas acciones a0–a3 que `game.ts` (fixtures JSON generadas desde los tests TS) |
| F1.4 | `usuario_sim.py`: 3 perfiles con semilla | Test determinista por semilla; tasa de acierto distinta por perfil |

### Fase 2 — Políticas y baseline (P0, 2 días) → cubre B1, B2, B5

| ID | Tarea | Criterio de aceptación |
|---|---|---|
| F2.1 | `reglas.py`: política actual a0–a3 | Reproduce exactamente el comportamiento de `game.ts` (usa F1.3) |
| F2.2 | `id3.py`: **baseline**. Implementar ID3 con cálculo explícito de entropía y ganancia de información sobre un dataset sintético `(estado → mejor acción)` generado por simulación con oráculo de turnos mínimos. Exportar el árbol | Test: entropía y ganancia con casos calculados a mano; árbol serializable; exactitud ≥ umbral documentado en validación cruzada |
| F2.3 | `qlearning.py`: **modelo principal**. Q-Learning tabular con ε-greedy decreciente, α y γ configurables, semillas y checkpoints | Curva de recompensa por episodio creciente y estable en ≥ 5 semillas; política exportable |
| F2.4 | `experimento_a_consola.py`: simula en consola una partida completa guiada por cada política desde un estado inicial, imprimiendo estado, acción y pista | Se ejecuta con un solo comando; salida legible para la demo del Hito 1 |
| F2.5 | Notebook `experimento_a.ipynb` equivalente y reproducible | Ejecuta de principio a fin sin errores |

### Fase 3 — Evaluación (P0, 1 día) → cubre B4

| ID | Tarea | Criterio de aceptación |
|---|---|---|
| F3.1 | `evaluacion.py`: métricas por política y perfil: **tasa de éxito**, **turnos promedio**, **pistas por partida**, **tasa de repetición de ayuda**, **tasa de autonomía** (aciertos sin pista) | Tabla CSV en `datos/simulaciones/` |
| F3.2 | Comparación **reglas vs. ID3 vs. Q-Learning** sobre ≥ 30 semillas × 1000 partidas, con media e intervalo de confianza | Tabla y gráficos (matplotlib) listos para el informe |
| F3.3 | Análisis de convergencia de Q-Learning (recompensa y |ΔQ| por episodio) y sensibilidad a α, γ, ε | Gráficos y párrafo de conclusiones |
| F3.4 | Análisis de fallos y casos de borde (usuario que nunca acierta, escenario de un solo producto, sin distractores) | Sección en el informe con ejemplos reproducibles |

> Si Q-Learning **no supera** al baseline en alguna métrica, se documenta honestamente y se ajusta la recompensa; no se maquillan resultados.

### Fase 4 — Integración en el juego (P0/P1, 1.5 días)

| ID | Tarea | Criterio de aceptación |
|---|---|---|
| F4.1 | `exportar.py`: serializa Q-table / árbol ID3 a `datos/politicas/*.json` con versión y semilla | JSON validado por esquema; tamaño razonable para el bundle |
| F4.2 | `src/domain/policy.ts`: interfaz `HintPolicy` y tres implementaciones (reglas, ID3, Q-table). Sin tocar la lógica de transición de `game.ts`: solo se inyecta la elección de acción | Tests unitarios; con la política `reglas` los tests existentes pasan **sin cambios** |
| F4.3 | Estimador de **perfil** del jugador desde el log (`t_ms`, errores) para alimentar el estado | Test con logs sintéticos |
| F4.4 | Selector de política en el panel del terapeuta («Reglas», «Árbol de decisión (ID3)», «Q-Learning») con **Q-Learning por defecto** | Cambia en caliente y se refleja en el log |
| F4.5 | Completar `recompensa` del evento (hoy `null`) y exportación JSON de sesión **anonimizada** | Test del formato de exportación |
| F4.6 | **Test de paridad inversa**: la política TS produce las mismas acciones que Python para los mismos estados | Fixtures compartidas generadas por `exportar.py` |
| F4.7 | E2E: partida completa con cada política | Playwright en verde |

### Fase 5 — Consultas en pictogramas (P1, 1 día) → cubre B7

| ID | Tarea | Criterio de aceptación |
|---|---|---|
| F5.1 | Añadir al catálogo pictogramas de funciones (BUSCAR, COMPRAR, PARA, AQUÍ, MUY BIEN…) descargándolos con `scripts/download-pictograms.mjs`; registrar origen y licencia en `public/ASSETS.md` | Archivos presentes y atribuidos (ARASAAC, CC BY-NC-SA) |
| F5.2 | Componente `PictoSentence`: la consulta inicial y cada pista se muestran como **secuencia `[BUSCAR] + [PRODUCTO]`** (más texto y voz como refuerzo) | Test de componente; el texto permanece accesible para lectores de pantalla |
| F5.3 | Ajustar la presentación guiada para mencionar la secuencia | E2E de la presentación actualizado |

### Fase 6 — Backend opcional (P2, 0.5 día) → cubre la estructura §11

| ID | Tarea | Criterio de aceptación |
|---|---|---|
| F6.1 | FastAPI: `GET /health`, `POST /policy/next` (estado → acción), `POST /sessions` (registro anónimo) | Tests con `pytest` + `httpx`; mismas acciones que `ia_models` |
| F6.2 | Frontend opcional: usa el backend si responde y cae a la política local si no | El juego sigue funcionando sin backend |

### Fase 7 — Metodología, ética y usabilidad (P1, transversal) → cubre B9, B10

| ID | Tarea | Criterio de aceptación |
|---|---|---|
| F7.1 | `docs/metodologia/crisp-dm.md`: mapear las 6 fases a este trabajo con evidencias (datos = escenarios y simulación; modelado; evaluación; despliegue) | Cada fase enlaza a código/figuras reales |
| F7.2 | `docs/metodologia/scrum.md`: backlog, sprints por hito, revisiones y retrospectivas. **Documentar lo que el equipo realmente hizo**; no fabricar actas | Basado en evidencia real del equipo |
| F7.3 | Protocolo de **pruebas de usabilidad** con terapeutas/educadores de Kallpa: consentimiento, sin datos personales, tareas y criterios de éxito | Protocolo + resultados reales o, si no hay acceso, declarado como limitación |
| F7.4 | Sección de ética: privacidad (datos solo en memoria / exportación anónima), licencias ARASAAC, sesgos del usuario simulado, límites del sistema | Incluida en el informe |
| F7.5 | Impacto en **ODS 10 y 4** con evidencia (qué habilidad estimula cada mecánica) | Sección en el informe, no solo declarativa |

### Fase 8 — Entregables finales (P1, 2 días) → cubre B6, B8

| ID | Tarea | Criterio de aceptación |
|---|---|---|
| F8.1 | `docs/informe/` en Markdown con la **estructura exacta del §10** (I–V) y exportar a `docs/informe-final.pdf` | Los 5 apartados presentes; figuras de la Fase 3 |
| F8.2 | `docs/manual-usuario.pdf` para educadores/terapeutas (capturas, panel del terapeuta, selector de política) | Revisado con el flujo real |
| F8.3 | README: guía de despliegue local y web, comandos de IA (`entrenar`, `evaluar`, `exportar`) y reproducibilidad | Un tercero ejecuta todo desde cero |
| F8.4 | Despliegue en Vercel con `vercel.json` versionado | URL pública con partida completa |
| F8.5 | Guion y grabación del **video de 3–5 min** (partida completa sin cortes) más respaldo | Video + enlace en anexos |
| F8.6 | Empaquetado `TF_1ASI404_NRC_GRUPO_##.zip` con `/codigo`, `/datos`, `/docs`; **anonimizar** los datos | Estructura verificada con el listado del ZIP |
| F8.7 | Guion de la exposición de 15 min (demo en vivo, métricas, lecciones de accesibilidad) y preguntas esperadas | Ensayo cronometrado |

---

## 5. Cronograma compacto (17–30 nov 2026)

| Días | Fases | Resultado |
|---|---|---|
| 17–18 nov | F0, F1 | Formalización + entorno con test de paridad |
| 19–21 nov | F2 | Reglas, ID3 y Q-Learning + Experimento A |
| 22–23 nov | F3 | Métricas, gráficos y convergencia |
| 24–26 nov | F4 (+ F5 en paralelo) | IA integrada en el juego; consultas en pictogramas |
| 24–28 nov | F7 (paralelo) | Metodología, ética, usabilidad |
| 27–29 nov | F8 | Informe, manual, despliegue, video, ZIP |
| 30 nov | Ensayo y entrega | Hito 3 |

F6 (backend) solo si sobra tiempo tras F4; si no, se justifica en el informe.

---

## 6. Verificación global

1. `pytest` en `codigo/ia_models` y en `codigo/backend` (si existe): verde.
2. `npm test`, `npm run build`, `npm run test:e2e`, `npm run format:check` en `codigo/frontend`: verde.
3. Tests de **paridad** Python ↔ TypeScript en verde.
4. Resultados de §F3 reproducibles con un comando y semillas fijas.
5. Partida completa en vivo con cada política, sin errores en consola.
6. Revisión manual con teclado y lector de pantalla.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Poco tiempo (13 días) | Priorizar P0; F6 y parte de F5 son recortables |
| Q-Learning no supera al baseline | Ajustar recompensa/estado; reportar el resultado real y analizarlo |
| Usuario simulado poco realista | Declararlo como limitación; contrastar con usabilidad real si hay acceso |
| Divergencia Python ↔ TypeScript | Tests de paridad con fixtures compartidas |
| Sin acceso a Kallpa para pruebas | Reportar como limitación y proponer protocolo para fases futuras |
| Evidencia SCRUM/CRISP-DM inexistente | Reconstruir desde el historial real del equipo; nunca inventarla |

## 8. Reglas para el agente

- No modificar la lógica de transición de `game.ts` ni `escenarios.json` salvo lo indicado (F5.1 añade pictogramas, no retos).
- No agregar dependencias de frontend sin justificarlas; la IA vive en Python.
- Reutilizar `createMessage`, `Pictogram`, `publicAsset`, `Header` y los tokens de color.
- Datos de salida (CSV, JSON de políticas) sin información personal.
- Commits pequeños con Conventional Commits y sin atribución a IA; **no commitear este plan**.
- Al terminar cada fase, informar: tareas cubiertas (F#.#), comandos ejecutados con su resultado y todo lo no verificado.
