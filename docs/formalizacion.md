# Formalización del juego y del agente

Implementada en `codigo/ia_models/pictomarket_ia/` (Python) y en `codigo/frontend/src/domain/` (TypeScript). Ambas versiones se mantienen idénticas mediante pruebas de paridad (`datos/politicas/paridad.json`).

## 1. Juego

El jugador debe comprar, en orden, los productos de una lista (`lista_correcta`) entre los visibles (lista + distractores). Los escenarios salen de `datos/escenarios.json` (fuente única): `desayuno_saludable` (3 productos, 9 visibles) y `almuerzo_casa` (4 productos, 10 visibles).

**Estado del juego** `G = (R, C, V, f, n, e, L)`: pendientes `R`, carrito `C`, visibles `V`, fallos consecutivos `f`, nivel de pista `n ∈ {0..3}`, errores totales `e` y registro de eventos `L` (incluye el tiempo de respuesta `t_ms`).

**Transición** (idéntica a `chooseProduct` en `game.ts`):

| Toque | Efecto |
|---|---|
| Producto pendiente (acierto, `a0`) | pasa de `R` a `C`; `f ← 0`, `n ← 0` |
| Producto no pendiente (error) | `f ← f+1`, `e ← e+1`; se aplica la **ayuda** elegida por el agente |
| Producto ya comprado o inexistente | se ignora |

**Ayudas del agente** (espacio de acciones `A`, solo tras un error):

| Acción | Efecto | Nivel `n` |
|---|---|---|
| `a1` pista de categoría | resalta los productos de la categoría del objetivo | `max(n,1)` |
| `a2` retirar distractor | quita el distractor tocado (o el primero visible); si no hay, equivale a `a3` | `max(n,2)` |
| `a3` señalar | marca el producto correcto («👇 ¡Este!») | `3` |
| `a4` repetir consulta | repite la instrucción sin escalar ni cambiar la pantalla | sin cambio |

**Victoria:** `R = ∅`. En el simulador, además, tope técnico de 40 turnos.

## 2. MDP del agente

El agente decide solo después de un error (semi-MDP). Observación discreta `s = (f, n, d, i, p, la, c)`:

| Variable | Valores | Significado |
|---|---|---|
| `f` | 0, 1, 2, 3+ | fallos consecutivos antes de este toque |
| `n` | 0–3 | nivel de pista ya dado al objetivo actual |
| `d` | 0, 1–2, 3+ | distractores visibles |
| `i` | 1, 2, 3+ | productos que faltan |
| `p` | 0 rápido, 1 medio, 2 necesita apoyo | **perfil estimado** de la sesión |
| `la` | 0–4 | última ayuda dada |
| `c` | 0, 1 | hay un distractor visible **de la misma categoría** que el objetivo (p. ej. «muslo de pollo» al buscar «pechuga de pollo») |

**Perfil `p`** (señal de adaptación): con menos de 2 turnos es `medio`; error ≥ 50 % → `apoyo`; error ≤ 15 % y tiempo medio < 4 s → `rápido`; en otro caso `medio`.

**Por qué `c`:** decide si la pista de categoría sirve. Si el confusor es de la misma categoría, resaltar la categoría no lo separa del objetivo y conviene retirarlo (`a2`). Sin `c`, ambas situaciones se ven iguales y el agente aprende un promedio malo.

Espacio máximo: 4·4·3·3·3·5·2 = 4 320 estados (el agente visita unos 300).

### Recompensa (versión 2)

La primera versión (turno −1, acierto +10 − 3·nivel de pista, repetir −4) castigaba más una pista que un error. El agente aprendió a **no ayudar** (`a4`) y los jugadores cometían más errores que con las reglas. Para personas con discapacidad intelectual, encadenar errores genera frustración y abandono; la práctica habitual es el **aprendizaje sin errores** con ayudas **de menor a mayor intrusión**, retiradas gradualmente. La versión 2 traduce eso:

| Evento | Valor | Motivo |
|---|---|---|
| Error tras `f` fallos seguidos | −(2 + 2·min(f,3)) | la frustración crece con la racha |
| Ayuda dada | `a4` 0 · `a1` −0,5 · `a2` −1,5 · `a3` −3 | coste de intrusión: preferir la ayuda mínima que funcione |
| Repetir `a1` o `a4` seguidas | −3 | no aportan información nueva (requisito «evitar respuestas repetitivas») |
| Compra | +10 | progreso |
| Compra sin ningún error para ese producto | +3 | autonomía |
| Completar la lista | +20 | objetivo |
| Llegar al tope de 40 turnos | −10 | partida fallida |

El turno en sí no se penaliza: importan los errores, la intrusión y la autonomía, no el número de toques. El coste de cada error se asigna a la ayuda que lo precedió.

**Sin descuento (`γ = 1`).** La partida es finita (tope de 40 turnos), así que el retorno sin descontar está bien definido y coincide con lo que se quiere optimizar: la suma de errores, intrusión y logros de toda la partida. Se eligió por coherencia teórica; en la ablación del informe, `γ = 0,95` y `γ = 1` dan resultados parecidos. El cambio decisivo fue usar el retorno Monte-Carlo (§4).

## 3. Usuario simulado

El jugador elige un producto con probabilidad proporcional a un peso: el objetivo pesa `skill · confianza`; un distractor pesa 1 (×2 si comparte categoría con el objetivo); otro pendiente pesa `0,35·skill`. Con una pista de categoría, lo que no es de esa categoría pesa ×0,35; con «señalar», el objetivo ×9; con `a4`, ×1,3. Hay una probabilidad `lapse` de toque al azar y un tiempo de respuesta log-normal.

| Perfil | skill | lapse | tiempo medio |
|---|---|---|---|
| rápido | 8 | 0,03 | 2,5 s |
| medio | 3 | 0,06 | 5 s |
| apoyo | 1 | 0,12 | 9 s |

**Dinámica de aprendizaje (supuesto de modelado).** La `confianza` empieza en 1 y cambia tras cada compra: ×1,15 si se compró sin pista o con la de categoría; ×0,85 si hubo que señalar (dependencia de la ayuda); sin cambio tras retirar un distractor; acotada a [0,5; 2]. Es una hipótesis simplificada, no medida con usuarios: el informe incluye una prueba de robustez sin esta dinámica.

Todas las simulaciones usan semillas fijas.

## 4. Políticas

| Política | Descripción |
|---|---|
| `reglas` | Escalada original: 1.er error `a1`, 2.º `a2`, 3.º o más `a3`. Referencia. |
| `id3` (baseline) | Árbol ID3 (entropía y ganancia de información propias, profundidad ≤ 6) entrenado con un conjunto sintético estado → mejor ayuda, donde la «mejor ayuda» es la de mayor retorno medio en simulaciones Monte-Carlo (oráculo con continuación por reglas). |
| `qlearning` (modelo principal) | Control tabular de valores de acción con objetivo Monte-Carlo (retorno real hasta el final de la partida), `γ = 1`, paso `α = max(0,02; N(s,a)^−0,6)`, ε-greedy decreciente 1 → 0,05, 60 000 partidas. Estado no visto: cae a `reglas`. |

Actualización: `Q(s,a) ← Q(s,a) + α_N [ G − Q(s,a) ]`, con `G` el retorno observado desde esa decisión. Se eligió el objetivo Monte-Carlo en lugar del de un paso `r + γ·maxₐ′ Q(s′,a′)` porque el estado es **parcialmente observable** (el perfil solo se estima). Estimar valores a partir de estados que se confunden entre sí introduce sesgo; los retornos completos no. El objetivo de un paso se conserva en el código (`target="td"`) para la ablación.
