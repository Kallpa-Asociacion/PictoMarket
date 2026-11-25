# Plan de implementación: Inicio, Presentación y Guía (mascota)

> Documento para un agente de implementación. Leerlo completo antes de tocar código.
> Alcance: **ajustes de UX/UI**, no un rediseño. Se conserva el estilo visual actual (madera, papel, pizarras, Nunito, paleta de `:root` en `src/styles.css`).

---

## 0. Contexto obligatorio

- App: React 18 + Vite + TypeScript en `codigo/frontend/`. Comandos (dentro de `codigo/frontend/`):
  - `npm test` → Vitest (unit + componentes + voz).
  - `npm run test:e2e` → Playwright.
  - `npm run build`, `npm run format:check` (Prettier).
- Datos: única fuente `datos/escenarios.json`, cargada en `src/data/market.ts`. **No duplicar datos en React.**
- Motor del juego: `src/domain/game.ts` (funciones puras). **No modificar su lógica** en este trabajo.
- Voz: `src/hooks/useSpeech.ts` recibe un `Message` (`{ id, tipo, texto, texto_voz }`) y lo lee cuando la voz está activada. La voz **solo se activa con un gesto del usuario** (restricción de autoplay del navegador); no intentar reproducir audio automáticamente sin ese gesto.
- Flujo actual (`src/App.tsx`): `started: boolean` → `WelcomeScreen` o mercado.
- El personaje guía ya existe como asset:
  - `public/art/guide.webp` (retrato recortado, usado en `MarketStall.tsx` dentro de `.guide-portrait` con un emoji 👋 superpuesto).
  - `public/art/welcome-guide.webp` (ilustración grande de la bienvenida).
- Idioma: identificadores y comentarios de código en **inglés**; textos visibles de la UI en **español neutro** (como el resto de la app).
- Accesibilidad CAA es requisito, no extra: textos cortos, pictogramas, voz, objetivos táctiles grandes, foco gestionado, `prefers-reduced-motion`.

---

## 1. Objetivo

1. **Pantalla de inicio** pulida, con acceso a "Cómo se juega".
2. **Presentación e instrucciones** paso a paso, guiada por el personaje.
3. **Guía (mascota)** fija en la **esquina superior derecha**, con **nubes de diálogo** (speech bubbles) a su costado que acompañan toda la experiencia: saluda, explica, celebra, anima y da pistas.

### Fuera de alcance (no implementar)
- Pantalla de resultados/celebración final y selección de reto.
- Cambios en el motor (`game.ts`), ID3, IA adicional.
- Cambios en `datos/escenarios.json`.

---

## 2. Decisiones de diseño (ya tomadas)

| Tema | Decisión |
|---|---|
| Navegación | Máquina de pantallas simple: `'home' \| 'intro' \| 'game'`, en `App.tsx`. Sin router. |
| Nombre del guía | Constante `GUIDE_NAME = 'Inti'` en un solo lugar (fácil de cambiar). |
| Posición | Fija arriba a la derecha, **debajo** de la barra superior (no tapar el logo de Kallpa). |
| Nube | A la **izquierda** del retrato, con "colita" apuntando al personaje. En móvil, **debajo** del retrato. |
| Inicio | En `home` **no** se muestra el guía flotante (ya está la ilustración grande `welcome-guide.webp`); se agrega una nube junto a esa ilustración. |
| Juego | El guía flotante **reemplaza** al retrato `.guide-portrait` de la pizarra de instrucciones (para no tener dos personajes). La pizarra conserva el texto completo y el botón de voz. |
| Fuente de verdad del mensaje | En juego, la nube **deriva** de `state.mensaje` y del último evento del log. No crea estado de juego nuevo ni escribe en `log_eventos`. |
| Poses | Sin assets nuevos obligatorios: una sola imagen (`guide.webp`) + emoji superpuesto + animación CSS por estado de ánimo. Si luego llegan poses reales, se cambia solo el mapa de imágenes. |
| Presentación vista | `localStorage` clave `pictomarket.intro.seen = '1'`, siempre dentro de `try/catch` (puede fallar en modo privado). |

---

## 3. Arquitectura propuesta

```text
src/
├── domain/
│   └── guide.ts              # NUEVO. Puro: tipos + mapeo mensaje/acción → ánimo y texto corto
├── content/
│   └── intro.ts              # NUEVO. Pasos de la presentación (texto, pictograma, ánimo)
├── hooks/
│   └── useIntroSeen.ts       # NUEVO. Lectura/escritura segura en localStorage
├── components/
│   ├── GuideMascot.tsx       # NUEVO. Retrato + nube, posición fija arriba-derecha
│   ├── SpeechBubble.tsx      # NUEVO. Nube reutilizable (también en Home)
│   ├── IntroScreen.tsx       # NUEVO. Presentación paso a paso
│   ├── guide.css             # NUEVO. Estilos del guía y la nube
│   ├── WelcomeScreen.tsx     # AJUSTAR. Botón secundario + nube junto a la ilustración
│   ├── MarketStall.tsx       # AJUSTAR. Quitar .guide-portrait de Instruction
│   └── TherapistPanel.tsx    # AJUSTAR (pequeño). "Ver presentación otra vez"
└── App.tsx                   # AJUSTAR. Máquina de pantallas + mensaje activo para la voz
```

### 3.1 `src/domain/guide.ts` (puro, testeable)

```ts
export const GUIDE_NAME = 'Inti';

export type GuideMood = 'greet' | 'explain' | 'celebrate' | 'encourage' | 'point' | 'think';

export interface GuideLine {
  id: string;        // estable para reiniciar animación y voz
  mood: GuideMood;
  text: string;      // corto: máx. ~8 palabras
}

// Emoji superpuesto al retrato según el ánimo.
export const MOOD_BADGE: Record<GuideMood, string> = {
  greet: '👋', explain: '☝️', celebrate: '🎉', encourage: '💪', point: '👇', think: '💡',
};

// Deriva la línea del guía durante el juego a partir del mensaje y la última acción del agente.
export function guideLineFromGame(state: GameState): GuideLine;
```

Reglas de `guideLineFromGame` (usar `state.mensaje` y `state.log_eventos.at(-1)?.accion_agente`):

| Situación | mood | Texto de la nube (ejemplos) |
|---|---|---|
| `mensaje.tipo === 'inicio'` | `greet` | "¡Vamos de compras!" |
| `exito` y quedan productos | `celebrate` | "¡Muy bien!" |
| `exito` y `items_restantes.length === 0` | `celebrate` | "¡Compraste todo!" |
| `pista` con acción `a1` | `think` | "Mira la pista 💡" |
| `pista` con acción `a2` | `encourage` | "¡Tú puedes!" |
| `pista` con acción `a3` | `point` | "¡Está aquí abajo!" |

- `id` = `mensaje.id` (así la nube se reanima con cada mensaje nuevo).
- Elegir los textos de una lista corta fija por caso (sin aleatoriedad, para que los tests sean deterministas).

### 3.2 `src/content/intro.ts`

```ts
export interface IntroStep {
  id: string;
  mood: GuideMood;
  title: string;          // visible grande
  text: string;           // lo que dice la nube y la voz
  pictogram?: number;     // id existente en public/pictograms/
  highlight?: 'objective' | 'products' | 'hint' | 'coins'; // mini-ilustración del paso
}
```

Pasos (texto final, se puede ajustar redacción pero no el número ni el orden sin motivo):

1. `greet` — "¡Hola! Soy Inti" / "Te acompaño en el mercado."
2. `explain` — "Mira la lista" / "Arriba ves qué vamos a comprar."
3. `explain` — "Toca el producto" / "Toca el dibujo del producto que te pido."
4. `encourage` — "Si te equivocas, te ayudo" / "Te doy una pista y lo intentas otra vez."
5. `celebrate` — "¡A comprar!" / "Cuida tus monedas. ¡Vamos!"

Para los pictogramas usar **solo** IDs ya presentes en `public/pictograms/` y en el catálogo (`market.catalogo`). Usar el componente existente `Pictogram.tsx`. No descargar recursos nuevos.

### 3.3 `src/hooks/useIntroSeen.ts`

```ts
export function useIntroSeen(): { seen: boolean; markSeen: () => void; clear: () => void };
```
- Clave `pictomarket.intro.seen`. Toda lectura/escritura en `try/catch`; si falla, `seen = false` y la app sigue funcionando.

### 3.4 `App.tsx`

- Reemplazar `started` por `const [screen, setScreen] = useState<'home' | 'intro' | 'game'>('home')`.
- Transiciones:
  - Home → botón **EMPEZAR**: si `seen` → `game` (con `reset()`), si no → `intro`.
  - Home → botón **¿Cómo se juega?**: siempre `intro`.
  - Intro → **Terminar / ¡A comprar!** o **Saltar**: `markSeen()`, `reset()`, `game`.
  - Game → botón **Inicio** (en el header, nuevo, discreto): confirmación simple si hay productos en el carrito; luego `home`.
- Voz: calcular **un único** mensaje activo y pasarlo a `useSpeech`:
  - `intro` → `createMessage('inicio', step.text, \`intro-${step.id}\`)` (ver `createMessage` en `game.ts`; reutilizarlo, no duplicarlo).
  - `game` → `state.mensaje` (como hoy).
  - `home` → mensaje fijo de bienvenida con id estable.
- Foco al cambiar de pantalla: mover el foco al `<main>`/heading de la pantalla nueva (seguir el patrón existente con `tabIndex={-1}` y `focus()`), y `window.scrollTo(0, 0)`.
- `skip-link`: actualizar destino según pantalla.
- Mantener `TherapistPanel` accesible desde todas las pantallas como hoy.

---

## 4. Componentes de UI

### 4.1 `SpeechBubble`

Props: `{ line: GuideLine; tail: 'right' | 'top' | 'left'; live?: boolean; onSpeak?: () => void; speakLabel?: string }`.

- Estilo: papel claro (`--paper`), borde cálido como `.instruction-paper` (`#efd7a5`), radio 20px, sombra suave, texto Nunito 800, 18–22px en desktop, 16–18px en móvil.
- Colita con pseudo-elemento CSS (triángulo) según `tail`.
- Botón 🔊 opcional dentro de la nube (reutilizar ícono `Volume2` de `lucide-react` y el mismo patrón de `speaker-button`: si la voz está apagada, el clic la activa; si está encendida, repite).
- `key={line.id}` en el contenedor para reiniciar la animación de entrada.
- Accesibilidad:
  - `live === true` → `role="status" aria-live="polite"`.
  - En **juego** usar `live={false}` y `aria-hidden="true"` porque la pizarra de instrucciones ya es el `role="status"` (evitar doble lectura del lector de pantalla).
  - En **intro** y **home** la nube sí es la región viva.

### 4.2 `GuideMascot`

Props: `{ line: GuideLine; speech?: SpeechSupport; live?: boolean }`.

- Contenedor `position: fixed`, arriba a la derecha:
  - `top: calc(var(--topbar-height) + 12px)`; `right: max(16px, env(safe-area-inset-right))`.
  - Definir `--topbar-height` en `:root` midiendo la `.topbar` real (o con valor fijo verificado en las 3 resoluciones de §7).
  - `z-index` por encima del mercado y **por debajo** del diálogo del terapeuta.
- Retrato: círculo/escudo de 96–112px en desktop, 64–72px en móvil, con el mismo marco/borde de madera que el estilo actual. Imagen `guide.webp` con `alt=""` (decorativa; el texto lo da la nube).
- Badge del ánimo (`MOOD_BADGE`) abajo a la derecha del retrato, como el 👋 actual.
- Nube a la **izquierda** (`tail="right"`), ancho máx. 280px.
- **Móvil (< 640px)**: retrato más chico; nube debajo (`tail="top"`), ancho `min(100vw - 32px, 320px)`, alineada a la derecha.
- La nube **no tapa productos ni botones**: reservar espacio. Opción recomendada: en `.market-layout` agregar `padding-top` en móvil igual al alto ocupado; en desktop verificar que cae sobre zona libre. Si tapa algo, se considera bug (ver e2e §7).
- Botón "ocultar/mostrar nube" no es necesario; la nube se **minimiza** sola (solo queda el retrato) 6 s después de un mensaje de tipo `exito`/`inicio`. Los mensajes `pista` **no** se minimizan solos. Tocar el retrato vuelve a mostrar la última nube.

### 4.3 Animaciones (CSS, sin librerías nuevas)

| Ánimo | Retrato | Nube |
|---|---|---|
| entrada de nube | — | fade + translate 6px, 180ms `ease-out` |
| `greet` | rotación ±8° del badge 👋 (2 ciclos) | — |
| `celebrate` | salto (`translateY -6px`) 1 vez, 300ms | — |
| `encourage` / `think` | inclinación leve 4° | — |
| `point` | badge 👇 rebota 2 veces | — |

- Animar solo `transform` y `opacity`.
- En `@media (prefers-reduced-motion: reduce)` (ya existe un bloque en `styles.css` línea ~1610): desactivar todas, dejar solo cambios instantáneos.

### 4.4 Empujón por inactividad (UX)

- En `game`, si pasan **15 s** sin que el usuario toque un producto y quedan productos, la nube muestra `{ mood: 'think', text: '¿Te ayudo? Toca 🔊 para escuchar.' }`.
- Implementar con `useEffect` + `setTimeout`, reiniciado al cambiar `state.mensaje.id`; limpiar en el cleanup.
- **No** modificar `GameState`, **no** escribir en `log_eventos`, **no** llamar a la voz automáticamente (solo visual).

---

## 5. Pantallas

### 5.1 Inicio (`WelcomeScreen`, ajuste mínimo)

- Mantener todo el layout actual.
- Agregar `SpeechBubble` junto a `.welcome-guide` con: "¡Hola! Soy Inti. Toca EMPEZAR para jugar." (`mood: 'greet'`, `live`).
- Agregar botón secundario **"¿Cómo se juega?"** bajo **EMPEZAR** (estilo secundario: fondo papel, borde madera; mismo alto mínimo 48px).
- Nuevas props: `start`, `openIntro`, `openTherapist`.
- Revisar los breakpoints existentes de `welcome.css` (≈ líneas 447 y 547) para que la nube no rompa el layout en tablet/móvil; en móvil la nube va **encima** de la ilustración.

### 5.2 Presentación (`IntroScreen`, nueva)

- Reutiliza el fondo y `Header` (sin `challenge`).
- Muestra `GuideMascot` arriba a la derecha con la nube del paso actual (`live`).
- Centro: tarjeta de papel grande con `title`, pictograma del paso y una mini-ilustración según `highlight` (recrear en pequeño, con los mismos estilos, un chip de objetivo / una tarjeta de producto / la pizarra de pista / las monedas; sin lógica real).
- Indicador de progreso: puntos `1/5` con `aria-label="Paso 2 de 5"`.
- Controles (mín. 48×48px, separados ≥ 8px):
  - **Atrás** (deshabilitado en el paso 1).
  - **Siguiente** → en el último paso cambia a **¡A comprar!**.
  - **Saltar** (texto secundario, siempre visible).
- Teclado: `←`/`→` navegan pasos; `Esc` = Saltar. Foco inicial en el heading del paso; al cambiar de paso, foco al nuevo heading.
- Al terminar o saltar: `markSeen()` y pasar a `game`.

### 5.3 Juego (ajuste)

- En `MarketStall.tsx` → `Instruction`: **eliminar** el bloque `.guide-portrait` (y su CSS en `styles.css` ≈ líneas 228–250). Ajustar `.instruction-board` para que el papel ocupe el ancho liberado.
- Montar `GuideMascot` con `line = idleLine ?? guideLineFromGame(state)` y `live={false}`.
- Agregar botón **Inicio** en `Header` cuando hay `challenge` (ícono `House` ya importado), con `aria-label="Volver al inicio"`.

### 5.4 Panel del terapeuta (ajuste pequeño)

- Botón "Ver presentación otra vez" que llama a `clear()` de `useIntroSeen` (no navega; solo reinicia la preferencia).

---

## 6. Tareas (en orden, con criterios de aceptación)

> Seguir TDD donde haya lógica: escribir el test, verlo fallar (RED), implementar (GREEN).

| ID | Tarea | Criterio de aceptación |
|---|---|---|
| T1 | `domain/guide.ts` + tests unitarios | Cada fila de la tabla §3.1 tiene su test; función pura, sin React. |
| T2 | `content/intro.ts` | 5 pasos en el orden de §3.2; todos los `pictogram` existen en `market.catalogo` (test). |
| T3 | `useIntroSeen` + test | Con `localStorage` que lanza error, no rompe y devuelve `seen=false`. |
| T4 | `SpeechBubble` + `GuideMascot` + `guide.css` | Render correcto de texto, badge por ánimo, `aria-hidden` cuando `live=false`. |
| T5 | Máquina de pantallas en `App.tsx` | Flujos de §3.4 cubiertos en `tests/unit/App.test.tsx`. |
| T6 | `IntroScreen` | Atrás/Siguiente/Saltar/teclado funcionan; el último paso entra al juego. |
| T7 | Ajuste `WelcomeScreen` | Botón "¿Cómo se juega?" abre la presentación; nube visible. |
| T8 | Integración en juego | Sin `.guide-portrait`; guía arriba-derecha reacciona a acierto/pista (a1/a2/a3). |
| T9 | Empujón por inactividad | Test con timers falsos de Vitest: aparece a los 15 s, desaparece al tocar un producto; el log no cambia. |
| T10 | Botón Inicio + panel terapeuta | Volver al inicio funciona; "Ver presentación otra vez" reinicia la preferencia. |
| T11 | e2e + capturas | Ver §7. |
| T12 | Documentación | Actualizar `codigo/frontend/README.md` (flujo de pantallas) y `public/ASSETS.md` si se agregan imágenes. |

---

## 7. Verificación

1. `npm test` en verde (incluye los tests ya existentes: no deben cambiar su comportamiento salvo los que referencian `.guide-portrait` o `started`, que se actualizan).
2. `npm run test:e2e` con un spec nuevo `tests/e2e/onboarding.spec.ts`:
   - Primera visita: Inicio → EMPEZAR → Presentación → 5 × Siguiente → Juego.
   - Segunda visita (mismo contexto): EMPEZAR va directo al Juego.
   - "¿Cómo se juega?" siempre abre la Presentación; "Saltar" entra al Juego.
   - Tocar un distractor muestra la nube con ánimo de pista.
   - **Sin superposición**: en 1280×800, 768×1024 y 375×812, la caja del guía + nube no intersecta ninguna tarjeta de producto ni el botón de voz (comparar `boundingBox()`).
   - Con `reducedMotion: 'reduce'` no hay animaciones activas en `.guide-*`.
3. `npm run build` y `npm run format:check` sin errores.
4. Revisión manual con teclado solamente (Tab, Enter, flechas, Esc) y con lector de pantalla: en juego el mensaje se anuncia **una sola vez**.

---

## 8. Reglas para el agente

- No cambiar `game.ts`, `escenarios.json` ni el controlador de voz (`src/audio/`).
- No agregar dependencias nuevas (todo se hace con React, CSS y `lucide-react`, ya instalados).
- No hardcodear datos del catálogo: leerlos de `market`.
- Reutilizar `createMessage`, `Pictogram`, `publicAsset`, `Header` y los tokens de color de `:root`.
- Commits pequeños con Conventional Commits (`feat(ui): ...`, `test(ui): ...`), sin atribución a IA.
- Al terminar, informar: tareas cubiertas (T#), comandos ejecutados con su resultado, y cualquier cosa no verificada.
