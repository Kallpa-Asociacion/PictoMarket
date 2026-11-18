# Entrega — lista de verificación

## Contenido del ZIP

Nombre: `TF_1ASI404_NRC_GRUPO_##.zip` (reemplazar NRC y número de grupo).

- `codigo/` — frontend, backend e `ia_models`
- `datos/` — escenarios, políticas y simulaciones
- `docs/` — informe final (PDF), manual de usuario (PDF) y documentación en Markdown
- `README.md`

Se excluyen automáticamente: `node_modules`, entornos virtuales, cachés, `dist`, `artifacts`, `.git`, el enunciado del curso y los planes internos `docs/plan-*.md`.

## Cómo regenerar

Desde la raíz del repositorio:

```bash
# 1. Dependencia (una vez)
codigo/ia_models/.venv/Scripts/python -m pip install -r scripts/requirements.txt

# 2. PDFs (requiere Google Chrome y Node)
codigo/ia_models/.venv/Scripts/python scripts/exportar_pdf.py

# 3. ZIP en entrega/
python scripts/empaquetar_entrega.py --nrc <NRC> --grupo <##>
```

## Pendiente del equipo

- [ ] Reemplazar NRC y número de grupo (y los integrantes en `docs/metodologia/scrum.md`).
- [ ] Enlace del video de demostración.
- [ ] URL del despliegue público.
- [ ] Sesiones de usabilidad con Kallpa y registro de resultados (protocolo en `docs/metodologia/usabilidad-protocolo.md`).
- [ ] Regenerar los PDFs tras la última edición del informe y del manual.
- [ ] Revisar el ZIP final antes de subirlo.
