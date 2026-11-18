# Decisiones de diseño (registro)

| Fecha | Decisión | Motivo | Alternativa descartada |
|---|---|---|---|
| 2026-11-17 | La IA se entrena en Python (`codigo/ia_models`) y se exporta a JSON | Stack recomendado por el enunciado; métricas y notebooks naturales | Entrenar en TypeScript |
| 2026-11-17 | El frontend interpreta la política exportada (sin servidor) | Funciona sin red y en un despliegue estático | Llamar siempre a una API |
| 2026-11-17 | Backend FastAPI mínimo y opcional | Cumple la estructura de entrega; el juego no depende de él | Omitirlo |
| 2026-11-17 | Se conserva la política de reglas como referencia | Permite comparar y es la salida segura ante estados no vistos | Eliminarla |
| 2026-11-17 | Nueva acción `a4` (repetir sin escalar) | Evita sobre-asistir y repetir ayudas (requisito §4.2) | Solo a1–a3 |
| 2026-11-17 | Visión computacional descartada | Es opcional; interacción digital estructurada | CNN sobre tarjetas físicas |
| 2026-11-17 | Q-Learning como política por defecto en el juego | Es el modelo principal pedido; el terapeuta puede cambiarla | Dejar reglas por defecto |
| 2026-11-17 | `recompensa` del registro de eventos sigue en `null` | Un test existente fija ese contrato; la recompensa solo se define en el simulador | Rellenarla en el juego |
| 2026-11-17 | Recompensa v2: coste de errores creciente con la racha, coste de intrusión por ayuda, bonus de autonomía | La v1 premiaba no ayudar y aumentaba los errores | Mantener la v1 |
| 2026-11-17 | Característica `c` (distractor de la misma categoría visible) | Sin ella, el agente no distingue cuándo sirve la pista de categoría | Estado sin `c` |
| 2026-11-17 | Objetivo Monte-Carlo con `γ = 1` y paso por visitas | Estado parcialmente observable; el objetivo de un paso señalaba en el 76–80 % de las ayudas | Q-Learning de un paso con `γ = 0,95` |
| 2026-11-17 | Dinámica de confianza en el jugador simulado | Modelar la dependencia de la ayuda; se reporta robustez sin ella | Jugador sin aprendizaje |
