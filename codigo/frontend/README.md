# 🛒 PictoMarket

Mercado pictográfico para practicar compras cotidianas, con instrucciones visuales, pistas progresivas y apoyo de voz en español.

**El frontend principal ahora es React + Vite + TypeScript. No necesita Python ni Streamlit.** La implementación anterior se conserva exclusivamente en `codigo/legacy/streamlit/`.

## Ejecutar

Requisitos: **Node.js 22.12+** y un navegador actualizado. Chrome o Edge con una voz española instalada son recomendados para el audio.

Desde la raíz del repositorio, entra en la carpeta del frontend:

```bash
cd codigo/frontend
npm ci
npm run dev
```

Abre **http://127.0.0.1:5173**. Detén el servidor con `Ctrl+C`.

```bash
npm run build       # Comprobación TypeScript + producción en codigo/frontend/dist/
npm run preview     # Previsualización del build en http://127.0.0.1:4173
```

`codigo/frontend/dist/` se puede publicar en un servidor estático. `base: './'` permite desplegar también bajo una subcarpeta. No hay backend, credenciales ni llamadas a Streamlit en la aplicación nueva.

## Interfaz

Implementación con componentes React basada en **`img/ui.png`**, usando **`img/fondo.png`** y recortes de su arte:

- Pantalla de bienvenida anterior al juego, inspirada en la referencia de inicio: cartel, toldo, guía, carrito y botón amarillo **Empezar**.
- Presentación guiada sobre la propia pantalla de juego: Inti se desplaza con animación hasta la lista, los productos, la pizarra y la billetera, con su diálogo, mientras el resto de la pantalla se oscurece. Se muestra sola la primera vez (`localStorage` `pictomarket.intro.seen`) y se repite desde el panel del terapeuta («Ver presentación otra vez») sin perder la compra.
- Guía Inti en la esquina superior derecha durante el juego, con nube corta que reacciona a aciertos y pistas (a1/a2/a3) y ofrece ayuda tras 15 s de inactividad. No altera el estado del juego ni el registro de eventos.
- Acceso al panel del terapeuta desde la bienvenida para configurar el escenario sin iniciar la compra.
- Cabecera PictoMarket, objetivo pictográfico durante la compra y logotipo de la referencia.
- Guía sobre un letrero de madera, con instrucción real y botón para escuchar.
- Toldo, estantes y tarjetas de producto accesibles con precio en monedas.
- Lista de compras con producto actual, marcas de comprado y progreso real.
- Billetera que diferencia monedas disponibles y gastadas; carrito actualizado al comprar.
- Panel del terapeuta en un diálogo con navegación por teclado y cierre con Escape.
- Vista de compra completada y botón para pasar al otro reto.
- Diseño adaptable a escritorio, tablet y móvil; foco visible y respeto de movimiento reducido.

**La referencia no se usa como una captura con zonas clicables.** Texto, precios, botones, tarjetas y estados son elementos reales de React. Solo se recortan recursos gráficos decorativos.

Los valores vienen de los datos existentes, no de las cifras ilustrativas de la referencia. Por ejemplo, el almuerzo empieza con **8 monedas**, la pechuga cuesta **3** y el contador empieza en **0 / 4**. El escenario tiene diez productos: se distribuyen en tres estantes (3 + 3 + 4), sin perder distractores. En móvil, la fila de cuatro se adapta a dos columnas. El orden se mezcla al iniciar cada reto, como antes.

## Arquitectura

```text
PictoMarket/
├── codigo/
│   ├── frontend/
│   │   ├── README.md
│   │   ├── package.json / package-lock.json
│   │   ├── vite.config.ts / tsconfig.json / playwright.config.ts
│   │   ├── scripts/              # Preparación de arte, pictogramas y runner
│   │   ├── tests/
│   │   │   ├── unit/             # Dominio y componentes React
│   │   │   ├── e2e/              # Navegador real con Playwright
│   │   │   └── speech-controller.test.mjs
│   │   ├── index.html
│   │   ├── public/
│   │   │   ├── art/                # Fondo, toldo, madera, guía y marca
│   │   │   ├── pictograms/         # 30 pictogramas originales ARASAAC
│   │   │   ├── fonts/             # Nunito local + licencia OFL
│   │   │   └── ASSETS.md           # Procedencia y licencias
│   │   └── src/
│   │       ├── components/        # Cabecera, mercado, paneles y controles
│   │       ├── hooks/             # useGame, useSpeech
│   │       ├── domain/game.ts     # Estado, compra, pistas, mensajes y eventos
│   │       ├── data/market.ts     # Adaptador al JSON original
│   │       ├── audio/             # Controlador Web Speech independiente
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       └── styles.css
│   └── legacy/streamlit/          # Implementación histórica, no producción
│       ├── tests/                # Regresión de Streamlit
│       └── pytest.ini            # Configuración exclusiva del archivo histórico
├── datos/escenarios.json          # Única fuente de catálogo/precios/retos
├── img/                          # Fondo y referencia originales
└── README.md                     # Entrada general al proyecto
```

### Separación de responsabilidades

- **Dominio:** `domain/game.ts` no importa React ni SpeechSynthesis. Decide la compra, el saldo, las pistas y el registro de eventos sin mutar el estado anterior.
- **Datos:** `data/market.ts` importa directamente `datos/escenarios.json` y valida referencias, categorías, precios y presupuesto. No existe un catálogo duplicado dentro de los componentes.
- **Estado de compra:** `useGame` conecta las transiciones del dominio con `useReducer`.
- **Voz:** `audio/speech-controller.mjs` conserva el controlador probado de la versión anterior, sin dependencias de Streamlit ni de React. `useSpeech` adapta mensajes y ciclo de vida al navegador.
- **Presentación:** componentes React tipados; estilos sin selectores internos de Streamlit, manipulación manual del DOM ni HTML inyectado.

El frontend sigue siendo autónomo. La extracción del dominio facilita una integración posterior con un backend, pero **el frontend no depende de un servidor**: interpreta las políticas ID3 y Q-Learning exportadas por `codigo/ia_models` (`src/domain/policy.ts`).

## Datos y política pedagógica conservados

| Reto                 | Nivel | Lista                                   | Presupuesto |
| -------------------- | ----- | --------------------------------------- | ----------- |
| `desayuno_saludable` | 1     | Leche, pan, manzana                     | 6           |
| `almuerzo_casa`      | 2     | Pechuga de pollo, papa, tomate, lechuga | 8           |

Pantallas: `home` → `game` (máquina simple en `App.tsx`, sin router; la presentación es una capa `GameTour` sobre `game`). Al abrir se presenta la bienvenida. **Empezar** abre el juego con la presentación la primera vez y directo después; el botón **Inicio** del juego vuelve a la bienvenida (con confirmación si hay productos en el carrito). **Empezar** inicia el almuerzo por defecto, o el reto elegido previamente en el panel del terapeuta. La espera en la bienvenida no cuenta en el tiempo del primer evento: se crea una actividad limpia al empezar. El foco pasa a los productos, sin activar voz automáticamente. Recargar vuelve a la bienvenida; no se persiste el progreso.

| Acción | Condición                                        | Resultado                                         |
| ------ | ------------------------------------------------ | ------------------------------------------------- |
| `a0`   | Cualquier producto pendiente de la lista         | Compra, descuenta su precio y reinicia las pistas |
| `a1`   | Primer error consecutivo                         | Indica y resalta la categoría del objetivo        |
| `a2`   | Segundo error                                    | Elimina el distractor tocado y reduce candidatos  |
| `a3`   | Tercer error o sin distractores al intentar `a2` | Señala el producto correcto                       |

La política **por reglas** es la referencia; el panel del terapeuta permite elegir también el árbol ID3 o Q-Learning (predeterminada), que añaden la acción `a4` (repetir la consulta sin escalar). Los errores no descuentan monedas y un producto comprado no se cobra dos veces.

## Apoyo de voz

La primera carga es silenciosa. **Activar voz** o el altavoz de la instrucción requieren una acción explícita del usuario.

- Lectura de inicio, aciertos, siguiente producto, pistas y compra completada.
- **Repetir instrucción**, **Detener** y **Silenciar voz**.
- Selector de voz española, velocidad lenta/tranquila/normal y volumen.
- Preferencia por voces españolas locales; no se sustituye por una voz inglesa.
- Cada mensaje tiene `id`, `tipo`, `texto` y `texto_voz`; el texto hablado conserva español y elimina emojis.
- Un render, abrir el panel o cambiar ajustes no vuelve a leer el mismo mensaje.
- Una decisión nueva cancela la lectura anterior, sin acumular una cola.
- Ocultar la pestaña o desmontar la app detiene la voz y limpia los listeners/timers.
- Reiniciar o cambiar de escenario conserva preferencias en esa instancia. Recargar exige activar de nuevo.
- Sin soporte, sin voces o con un error de reproducción, el texto y los pictogramas siguen funcionando.

Se usa **Web Speech API**, sin micrófono, claves ni servidor TTS propio. Las voces «en línea» pueden necesitar internet y servicios del proveedor del navegador. No se garantiza voz offline ni pronunciación idéntica entre equipos. Los recursos visuales y fuentes sí se sirven localmente.

## Panel del terapeuta

Permite cambiar y reiniciar el escenario, consultar productos comprados, errores, nivel de pista, estado y eventos. **Exportar sesión JSON** descarga el estado y el log de la actividad actual.

Los eventos conservan `escenario_id`, `t_ms`, `item_objetivo`, `item_tocado`, `correcto`, `estado_s`, `accion_agente`, `distractor_eliminado`, `entropia_antes`, `entropia_despues` y `recompensa: null`.

El progreso y los eventos viven solo en la memoria de la pestaña: **reiniciar, cambiar escenario o recargar los borra**. Exporta antes si necesitas conservarlos. La medición `t_ms` sigue siendo el intervalo entre decisiones; no descuenta la duración del audio. El panel es una herramienta del prototipo, no un área autenticada.

## Pruebas

```bash
npm test               # 21 pruebas de dominio/React + 17 del controlador de voz
npm run typecheck
npm run build
npm run test:e2e        # 10 pruebas con Chrome instalado
npm audit
```

Las pruebas de navegador revisan bienvenida y mercado en anchos **320, 360, 390, 720, 768, 1024, 1440 y 1590 px**, carga de imágenes, ausencia de desbordamiento horizontal, separación entre imagen y nombre, errores de ejecución, diálogo y Escape. También ejercitan configuración previa, inicio con Enter, foco, vuelta a bienvenida al recargar, pistas, compra completa, exportación, cambio de reto y reinicio. Las pruebas React verifican que el tiempo del primer evento no incluya la espera en bienvenida. Las capturas se guardan en `codigo/frontend/artifacts/`, ignorado por Git. Los resultados de Playwright van a `codigo/frontend/test-results/`. Ninguna prueba ni salida del frontend se crea en la raíz del repositorio.

Si usas Edge en lugar de Chrome:

```powershell
$env:BROWSER_CHANNEL = "msedge"
npm run test:e2e
```

El servidor Vite de las pruebas se inicia y detiene automáticamente. Las pruebas del motor de voz son simuladas: **no certifican sonido en los altavoces**. Verifica manualmente en el dispositivo final: activar, repetir, provocar las tres pistas, completar, detener, silenciar y ajustar voz/ritmo/volumen.

El script `scripts/run-vitest.mjs` normaliza la ruta de Windows para evitar que `c:` y `C:` carguen dos instancias del runner. Las pruebas también funcionan en otros sistemas.

## Recursos y mantenimiento

Todos los recursos necesarios están versionados. No hace falta volver a descargarlos para ejecutar la aplicación.

```bash
npm run assets:pictograms           # Descargar el catálogo desde ARASAAC
node scripts/download-function-pictograms.mjs  # Pictogramas de la oración (datos/pictogramas_funcion.json)
# Opcional, solo si cambian las imágenes originales; requiere Pillow:
python scripts/prepare-art.py
```

La oración de pictogramas sobre la instrucción (`PictoSentence`, derivada del estado en `src/domain/pictoSentence.ts`) es decorativa (`aria-hidden`); el texto `role="status"` sigue siendo el mensaje accesible.

Al añadir un producto a `datos/escenarios.json`, descarga también su pictograma. Los fallos de imagen mantienen un nombre y una alternativa visual; no sustituyen el producto por un pictograma incorrecto.

## Versión histórica

La migración aparta Python y Streamlit del frontend activo sin destruir su referencia. Consulta [`codigo/legacy/streamlit/README.md`](../legacy/streamlit/README.md) para ejecutar su regresión. No mezcles sus dependencias ni comandos con el frontend React.

## Créditos

Pictogramas: **Sergio Palao · ARASAAC · Gobierno de Aragón · CC BY-NC-SA**. Proyecto académico de Inteligencia Artificial y Educación Especial. Nunito: SIL Open Font License. Consulta la procedencia del arte y la marca en [`codigo/frontend/public/ASSETS.md`](public/ASSETS.md).

## Módulo de sonido (`src/sound/`)

| Archivo | Rol |
|---|---|
| `tracks.ts` | Cuatro pistas originales escritas como datos: `home`, `game`, `therapist`, `celebration` |
| `engine.ts` | Sintetizador Web Audio: bucle, fundido entre pistas, atenuación con la voz y efectos |
| `useSound.ts` | Preferencias (`localStorage` `pictomarket.sound`), desbloqueo con el primer gesto y pausa en segundo plano |
| `SoundControls.tsx` | Botón de música de la barra y ajustes del panel del terapeuta |

No hay archivos de audio ni dependencias nuevas, así que no hay licencias que atribuir y funciona sin red. Para cambiar la música se editan las notas de `tracks.ts` (`[pulso, nota MIDI, duración]`). `tests/e2e/sound.spec.ts` mide en Chrome que cada pista suene sin saturar.

## Voz de Inti: se graba una vez con ElevenLabs

El juego **nunca llama a ElevenLabs**. Los audios se graban una sola vez, se guardan en `public/audio/inti/`, se commitean y la aplicación solo los reproduce.

Para gastar lo mínimo se graba **por oración**: «¡Muy bien!» o «Ahora busca: leche.» se pagan una vez y se combinan al reproducir. Hoy son 102 oraciones (unos 2 400 caracteres).

### Grabar

1. Copia `.env.example` a `.env.local` (o usa `codigo/.env`; Git ignora ambos) y completa `ELEVENLABS_API_KEY` y `ELEVENLABS_VOICE_ID`. **Nunca** commitees la clave.
2. `npm run voz:lista`: muestra lo pendiente y los caracteres, sin gastar nada. Deja la lista en `artifacts/frases-voz.csv`.
3. Prueba primero con poco: `npm run voz:grabar -- --max-chars=150`, escucha y, si la voz convence, `npm run voz:grabar`.
4. Commitea `public/audio/inti/` y `src/voice/manifest.json`.

El script solo pide lo que falta, guarda después de cada oración y se detiene en el primer error (por ejemplo, cuota agotada): al repetirlo no se vuelve a pagar. Para cambiar de voz: `npm run voz:grabar -- --force` (graba todo de nuevo).

**Grabación manual** (desde la web de ElevenLabs): guarda cada audio en `public/audio/inti/` con el nombre de la columna `archivo` del CSV y ejecuta `npm run voz:sync`.

### Editar diálogos

Las frases del juego están en `src/domain/dialogue.ts` y las de la presentación en `src/content/intro.ts`. Cambiar una oración solo obliga a grabar esa oración. Los archivos que dejan de usarse se listan al ejecutar `voz:lista`.

### Comportamiento

Con grabaciones, **«Inti (voz grabada)» es la única voz**: la del navegador no se usa ni como respaldo, así nunca se mezclan dos voces. Al hablar por primera vez se precargan todos los audios en memoria. Si uno falla, se reintenta una vez y, si sigue fallando, se salta esa oración (el texto sigue en pantalla). Por eso `voiceCoverage.test.ts` falla si se cambia un diálogo y no se graba. Sin ninguna grabación, la app usa la voz del navegador.
