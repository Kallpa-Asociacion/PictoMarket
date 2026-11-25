# Plan de implementación: Voz realista con ElevenLabs (reemplazo de la voz del navegador)

> Documento para un agente de implementación. Leerlo completo antes de tocar código.
> Objetivo: que Inti hable con una voz natural en español (ElevenLabs) en lugar de `speechSynthesis` del navegador, **sin perder** la accesibilidad actual ni la restricción de autoplay.
> Importante: antes de implementar, verificar en la documentación vigente de ElevenLabs los nombres de modelos, límites y precios (cambian con frecuencia). Este plan fija la arquitectura, no los valores finales.

---

## 0. Contexto y restricciones

- Hoy: `src/hooks/useSpeech.ts` + `src/audio/speech-controller.mjs` usan `window.speechSynthesis`. La voz depende de las voces instaladas en cada dispositivo (calidad y disponibilidad variables; por eso existe el estado `no_voice`).
- El controlador ya resuelve: activar solo con gesto del usuario, deduplicar por `message.id`, repetir, detener, tiempos de espera, pestaña oculta, volumen y velocidad. **Se reutiliza esa lógica**; solo se cambia el *motor* que produce el sonido.
- Los textos del juego son **finitos y predecibles** (instrucciones por producto, pistas, presentación de Inti). Esto permite **pregenerar los audios** y servirlos como archivos estáticos: es más barato, más rápido y funciona sin red.
- La API key de ElevenLabs **nunca** debe llegar al navegador.
- Privacidad: solo se envía texto del juego (nunca datos de usuarios, nombres ni registros de sesión).
- Texto visible de la UI en español neutro; identificadores y comentarios en inglés.

## 1. Decisiones de diseño

| Tema | Decisión | Alternativa y trade-off |
|---|---|---|
| Estrategia principal | **Audios pregenerados** (script offline) servidos desde `public/audio/` | Solo generación en vivo: voz más flexible pero más latencia, costo por uso y riesgo de fallo en la demo |
| Texto no previsto | **Proxy serverless** (función de Vercel) que llama a ElevenLabs con la key en variable de entorno, con caché | Llamar a ElevenLabs desde el navegador: expone la key (descartado) |
| Fallback | Cadena: audio pregenerado → proxy → `speechSynthesis` actual | Sin fallback: el juego pierde voz si falla la red o la cuota |
| Motor | Abstracción `SpeechEngine` con dos implementaciones (`BrowserEngine`, `ElevenLabsEngine`) | Reescribir el controlador: innecesario y arriesgado |
| Formato | MP3 (compatibilidad) a una tasa moderada para reducir el peso | WAV/PCM: más pesado sin beneficio audible |
| Voz | Una voz fija y cálida en español neutro para Inti (`voice_id` configurable) | Varias voces: coste y consistencia; solo si Kallpa lo pide |
| Selección por el terapeuta | El panel del terapeuta permite «Voz: Realista (ElevenLabs) / Del navegador» | Forzar una sola: menos flexible ante falta de red |

## 2. Arquitectura propuesta

```text
codigo/frontend/
├── api/
│   └── tts.ts                    # NUEVO. Función serverless: texto → audio (proxy + validación)
├── scripts/
│   └── generate-voice.mjs        # NUEVO. Pregenera MP3 de todos los textos del juego
├── public/audio/
│   ├── manifest.json             # NUEVO. hash(texto+voz+modelo) → archivo
│   └── *.mp3                     # NUEVOS. Audios pregenerados
└── src/audio/
    ├── speech-controller.mjs     # AJUSTAR (mínimo): aceptar un motor inyectable
    ├── engines/
    │   ├── browser-engine.ts     # NUEVO. Envuelve speechSynthesis (comportamiento actual)
    │   └── eleven-engine.ts      # NUEVO. <audio> + manifest + proxy + fallback
    └── phrases.ts                # NUEVO. Catálogo de frases del juego (única fuente para el script)
```

Flujo de `ElevenLabsEngine.speak(texto)`:

1. Normalizar el texto (misma función `voiceText` de `game.ts`) y calcular su hash.
2. Si está en `manifest.json` → reproducir `public/audio/<hash>.mp3`.
3. Si no → `POST /api/tts` (con timeout corto); si responde, reproducir y cachear en memoria.
4. Si falla o hay timeout → `BrowserEngine` (voz del navegador).

## 3. Tareas (con criterios de aceptación)

> TDD donde haya lógica. Los motores se prueban con dobles (`HTMLAudioElement` y `fetch` simulados). Nunca llamar a ElevenLabs desde los tests.

### Fase A — Catálogo de frases y script de pregeneración

| ID | Tarea | Criterio de aceptación |
|---|---|---|
| A1 | `phrases.ts`: enumerar todos los textos que Inti puede decir leyendo `market` (instrucciones de inicio, acierto, pistas a1/a2/a3 por producto, pasos de la presentación, saludo) reutilizando las mismas funciones de `game.ts` | Test: cada mensaje que `startGame`/`chooseProduct` puede generar para los dos retos está en el catálogo |
| A2 | `scripts/generate-voice.mjs`: lee el catálogo, calcula hash, **omite lo ya generado** (idempotente), llama a la API de texto a voz y escribe MP3 + `manifest.json` | Segunda ejecución no hace llamadas nuevas; `--dry-run` lista costo estimado en caracteres |
| A3 | Variables: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` leídas de entorno; `.env.example` sin secretos y `.env*` en `.gitignore` | Sin key el script falla con mensaje claro; ningún secreto en el repositorio |
| A4 | Revisión auditiva de las frases críticas (nombres de productos, tildes, monedas) | Lista de correcciones de pronunciación documentada |

### Fase B — Proxy serverless seguro

| ID | Tarea | Criterio de aceptación |
|---|---|---|
| B1 | `api/tts.ts`: valida método y cuerpo, **limita longitud** (p. ej. ≤ 200 caracteres) y **solo acepta texto con forma de frase del juego** (lista permitida o patrón) | Pruebas de entradas inválidas ⇒ 400 sin llamar a ElevenLabs |
| B2 | Llamada a ElevenLabs con la key del entorno; responde `audio/mpeg` con cabeceras de caché | Prueba con `fetch` simulado |
| B3 | **Límite de uso** por IP/origen y verificación de origen para evitar abuso de la cuota | Prueba: exceso ⇒ 429 |
| B4 | Manejo de errores: cuota agotada, 401, 5xx, timeout ⇒ respuesta controlada que el cliente interpreta como «usar fallback» | Pruebas por cada código |

### Fase C — Motores y controlador

| ID | Tarea | Criterio de aceptación |
|---|---|---|
| C1 | Definir la interfaz `SpeechEngine` (`speak`, `stop`, `isSupported`, `onEnd`, `onError`) y extraer el comportamiento actual a `BrowserEngine` **sin cambios observables** | Las 17 pruebas de `speech-controller` y las de `App.test.tsx` pasan **sin modificarse** |
| C2 | `ElevenLabsEngine`: reproducción con `<audio>`, volumen y velocidad (`playbackRate`), precarga del siguiente audio probable, detención y limpieza | Pruebas con doble de `Audio` |
| C3 | Cadena de fallback y deduplicación por `message.id` (un mismo mensaje no se reproduce dos veces aunque cambie de motor) | Prueba: fallo del proxy ⇒ habla el navegador una sola vez |
| C4 | Respetar autoplay: el primer audio solo tras un gesto del usuario; **desbloquear** el audio en el clic de «Activar voz» | Prueba: sin gesto, nada suena |
| C5 | Estados y mensajes en `VoiceControls` (`Preparando voz…`, `Usando voz del navegador por falta de conexión`) | Textos en español neutro; sin duplicar anuncios a lectores de pantalla |

### Fase D — Configuración, panel y accesibilidad

| ID | Tarea | Criterio de aceptación |
|---|---|---|
| D1 | Selector «Voz: Realista / Del navegador» en el panel del terapeuta; preferencia en memoria de sesión (y `localStorage` con `try/catch`) | La elección se conserva al reiniciar el escenario |
| D2 | Velocidad y volumen funcionan en ambos motores | Pruebas por motor |
| D3 | Si no hay audio ni voces, el juego sigue siendo usable con texto y pictogramas | Prueba existente `sin API o voces…` sigue pasando |

### Fase E — Calidad, costos y despliegue

| ID | Tarea | Criterio de aceptación |
|---|---|---|
| E1 | Presupuesto: total de caracteres pregenerados y estimación mensual del proxy; registrar en `docs/` | Documento con cifras reales |
| E2 | Despliegue: variables de entorno en Vercel, límites de tamaño de `public/audio/` y verificación de que la key no aparece en el bundle (`dist/`) | Búsqueda de la key en `dist/` sin resultados |
| E3 | E2E de Playwright con red bloqueada hacia el proxy: la voz cae al navegador sin errores de consola | Prueba en verde |
| E4 | Prueba manual en móvil y escritorio (Chrome, Safari) incluyendo el desbloqueo de audio en iOS | Lista de verificación completada |
| E5 | Actualizar README (variables, comando de pregeneración, fallback) y `public/ASSETS.md` (origen de los audios) | Un tercero genera los audios desde cero |

## 4. Verificación

1. `npm test`, `npm run build`, `npm run test:e2e`, `npm run format:check` en verde.
2. Los tests existentes de voz pasan **sin modificarse** (C1).
3. La key de ElevenLabs no aparece en el repositorio ni en `dist/`.
4. Con red cortada, el juego sigue hablando (voz del navegador) o funciona en silencio sin errores.
5. Revisión auditiva de una partida completa de cada escenario.

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| Costo/cuota de ElevenLabs | Pregenerar lo previsible; proxy con límite y caché; fallback al navegador |
| Latencia percibida en la voz en vivo | Precarga del siguiente audio probable; preferir pregenerados |
| Bloqueo de autoplay (sobre todo iOS) | Desbloqueo en el gesto de «Activar voz»; mantener la regla actual de no autoplay |
| Pronunciación de nombres propios o monedas | Revisión auditiva (A4) y ajuste de textos de voz con `voiceText` |
| Abuso del proxy | Validación de frases, límite por origen y 429 |
| Licencia de uso de la voz | Revisar términos del plan contratado para uso educativo/terapéutico antes de publicar |

## 6. Reglas para el agente

- No exponer la API key en el cliente, en logs ni en el repositorio.
- No modificar la lógica del juego (`game.ts`) ni `escenarios.json`; las frases se derivan de ellos.
- Mantener el comportamiento actual de voz como fallback verificable.
- Reutilizar `voiceText`, `createMessage` y el controlador existente; no duplicarlos.
- Commits pequeños con Conventional Commits y sin atribución a IA; **no commitear este plan**.
- Al terminar, informar: tareas cubiertas (A–E), comandos ejecutados con su resultado y todo lo no verificado (en especial, las pruebas auditivas y las de iOS).
