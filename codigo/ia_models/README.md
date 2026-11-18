# ia_models — agente guía de PictoMarket

Entrenamiento y evaluación de las políticas de ayuda (reglas, ID3 y Q-Learning) sobre un simulador. Formalización: `docs/formalizacion.md`.

## Preparar el entorno

```bash
cd codigo/ia_models
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt      # Windows
# source .venv/bin/activate && pip install -r requirements.txt  # Linux/macOS
```

## Comandos

```bash
# Pruebas
python -m pytest -q

# Experimento A: una partida guiada paso a paso en consola
python experimentos/experimento_a_consola.py --policy qlearning --profile apoyo --scenario 1 --seed 7

# Pipeline completo (≈ 5 min): entrena, evalúa, grafica y exporta
python experimentos/entrenar_y_evaluar.py          # --quick para una corrida corta
```

Salidas (versionadas):

| Ruta | Contenido |
|---|---|
| `datos/politicas/qlearning.json`, `id3.json` | Políticas que lee el frontend |
| `datos/politicas/paridad.json` | Casos para comprobar que Python y TypeScript coinciden |
| `datos/simulaciones/*.csv`, `id3_dataset_info.json` | Métricas, diferencias pareadas, convergencia, ablación y robustez |
| `docs/informe/figuras/*.png` | Gráficos del informe |

Todo es reproducible con semillas fijas. Tras reentrenar, ejecuta `npm test` en `codigo/frontend` para validar la paridad con TypeScript.

## Módulos

| Módulo | Rol |
|---|---|
| `juego.py` | Reglas del juego (puerto fiel de `game.ts`) |
| `caracteristicas.py` | Estado discreto y estimador de perfil |
| `usuario_sim.py` | Jugadores simulados (rápido, medio, apoyo) |
| `entorno.py` | Entorno Gymnasium (semi-MDP) |
| `politicas/` | `reglas`, `id3` (entropía y ganancia), `qlearning` |
| `evaluacion.py` | Éxito, turnos, ayudas, repetición, autonomía, retorno |
| `exportar.py`, `cargar.py` | JSON para el frontend y carga inversa |
