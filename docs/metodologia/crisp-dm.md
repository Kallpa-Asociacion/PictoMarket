# CRISP-DM aplicado a PictoMarket

| Fase | Qué se hizo | Evidencia |
|---|---|---|
| 1. Comprensión del negocio | Necesidad de Kallpa: estimulación cognitiva con CAA, instrucciones breves, ritmo individual. ODS 10 y 4 | `docs/informe/informe-final.md` §I |
| 2. Comprensión de los datos | Catálogo ARASAAC de 30 productos, 2 escenarios, precios y categorías; validación de integridad y presupuesto | `datos/escenarios.json`, `datos.py`, `validateData` |
| 3. Preparación de los datos | Discretización del estado (`f,n,d,i,p,la`), estimador de perfil, generación de un conjunto oráculo estado → mejor ayuda | `caracteristicas.py`, `politicas/id3.py` |
| 4. Modelado | Baseline ID3 y Q-Learning tabular; reglas como referencia | `politicas/`, `docs/formalizacion.md` |
| 5. Evaluación | Simulador con 3 perfiles; 30 semillas; IC 95 %; convergencia y sensibilidad | `datos/simulaciones/`, `docs/informe/figuras/` |
| 6. Despliegue | Políticas exportadas e interpretadas en el frontend; paridad Python ↔ TypeScript; selector en el panel del terapeuta | `datos/politicas/`, `src/domain/policy.ts` |

Iteraciones previstas: ajustar la recompensa con terapeutas y reentrenar tras pruebas con usuarios reales.
