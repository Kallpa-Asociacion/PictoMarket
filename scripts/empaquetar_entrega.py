"""Build the delivery ZIP: entrega/TF_1ASI404_<NRC>_GRUPO_<NN>.zip

Usage (from the repo root):
    python scripts/empaquetar_entrega.py --nrc 1234 --grupo 05
"""
from __future__ import annotations

import argparse
import fnmatch
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INCLUDE = ["codigo", "datos", "docs", "README.md"]
EXCLUDED_DIRS = {
    "node_modules", ".venv", "venv", "__pycache__", ".pytest_cache", ".ruff_cache",
    "dist", "artifacts", "test-results", "playwright-report", ".git", ".atl",
    ".claude", ".codegraph", "entrega", ".vite",
}
EXCLUDED_GLOBS = ["TP-TF-*.pdf", "docs/plan-*.md", "*.pyc", ".*.tmp.html"]


def is_excluded(rel: Path) -> bool:
    if any(part in EXCLUDED_DIRS for part in rel.parts):
        return True
    posix = rel.as_posix()
    return any(
        fnmatch.fnmatch(posix, g) or fnmatch.fnmatch(rel.name, g) for g in EXCLUDED_GLOBS
    )


def collect() -> list[Path]:
    files: list[Path] = []
    for item in INCLUDE:
        path = ROOT / item
        if path.is_file():
            files.append(path)
        elif path.is_dir():
            files.extend(p for p in sorted(path.rglob("*")) if p.is_file())
    return [p for p in files if not is_excluded(p.relative_to(ROOT))]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--nrc", default="NRC")
    ap.add_argument("--grupo", default="00")
    args = ap.parse_args()

    out_dir = ROOT / "entrega"
    out_dir.mkdir(exist_ok=True)
    zip_path = out_dir / f"TF_1ASI404_{args.nrc}_GRUPO_{args.grupo}.zip"
    files = collect()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            zf.write(f, f.relative_to(ROOT).as_posix())

    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
    tops = sorted({n.split("/")[0] for n in names})
    print(f"{zip_path.relative_to(ROOT)}: {len(names)} files, {zip_path.stat().st_size / 1024:.0f} KB")
    print("Top-level entries:", ", ".join(tops))
    missing = [d for d in ("codigo", "datos", "docs") if d not in tops]
    if missing:
        print("ERROR: missing folders:", ", ".join(missing))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
