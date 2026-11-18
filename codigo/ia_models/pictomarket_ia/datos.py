"""Loads and validates datos/escenarios.json (the single source of truth)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA_FILE = ROOT / "datos" / "escenarios.json"


def validate_data(data: dict) -> None:
    """Same checks as validateData in src/domain/game.ts."""
    if not data["retos"]:
        raise ValueError("No hay retos de compra.")
    for challenge in data["retos"]:
        ids = challenge["lista_correcta"] + challenge["distractores"]
        if not challenge["lista_correcta"] or len(set(ids)) != len(ids):
            raise ValueError(f"Reto inválido: {challenge['id_reto']}")
        cost = 0
        for pid in ids:
            product = data["catalogo"].get(str(pid))
            if (
                product is None
                or product["categoria"] not in data["categorias"]
                or not isinstance(product["precio"], int)
                or product["precio"] < 0
            ):
                raise ValueError(f"Producto inválido: {pid}")
            if pid in challenge["lista_correcta"]:
                cost += product["precio"]
        if cost > challenge["presupuesto"]:
            raise ValueError(f"Presupuesto insuficiente: {challenge['id_reto']}")


def load_data(path: Path = DATA_FILE) -> dict:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    validate_data(data)
    return data


def category_of(data: dict, product_id: int) -> str:
    return data["catalogo"][str(product_id)]["categoria"]
