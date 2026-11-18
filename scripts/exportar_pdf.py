"""Export the final report and the user manual from Markdown to PDF.

Usage (from the repo root):
    codigo/ia_models/.venv/Scripts/python scripts/exportar_pdf.py

Requires: `markdown` (see scripts/requirements.txt), Node, and Google Chrome.
Playwright is resolved from codigo/frontend/node_modules.
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
HELPER = ROOT / "scripts" / "html_to_pdf.mjs"

JOBS = [
    (ROOT / "docs" / "informe" / "informe-final.md", ROOT / "docs" / "informe-final.pdf"),
    (ROOT / "docs" / "manual-usuario.md", ROOT / "docs" / "manual-usuario.pdf"),
]

CSS = """
@page { size: A4; }
html { font-size: 11pt; }
body { font-family: 'Nunito', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
       color: #222; line-height: 1.5; }
h1 { font-size: 22pt; color: #8a4b08; border-bottom: 2px solid #f2b84b; padding-bottom: 4pt; }
h2 { font-size: 15pt; color: #8a4b08; margin-top: 18pt; break-after: avoid; }
h3 { font-size: 12.5pt; color: #444; break-after: avoid; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 9.5pt; break-inside: avoid; }
th, td { border: 1px solid #c9c2b5; padding: 4pt 6pt; text-align: left; vertical-align: top; }
th { background: #fbeccb; }
img { max-width: 100%; display: block; margin: 8pt auto; break-inside: avoid; }
code { font-family: Consolas, 'Courier New', monospace; font-size: 9.5pt;
       background: #f4f1ea; padding: 0 2pt; border-radius: 2pt; }
pre { background: #f4f1ea; padding: 8pt; overflow-wrap: anywhere; white-space: pre-wrap;
      break-inside: avoid; }
pre code { background: none; }
blockquote { border-left: 3px solid #f2b84b; margin-left: 0; padding-left: 10pt; color: #555; }
"""


def render_html(md_path: Path) -> Path:
    text = md_path.read_text(encoding="utf-8")
    body = markdown.markdown(
        text, extensions=["tables", "fenced_code", "sane_lists", "toc"]
    )
    html = (
        '<!doctype html><html lang="es"><head><meta charset="utf-8">'
        f'<base href="{md_path.parent.as_uri()}/">'
        f"<title>{md_path.stem}</title><style>{CSS}</style></head>"
        f"<body>{body}</body></html>"
    )
    # <base> makes relative image paths (figuras/*.png) resolve against the .md folder.
    tmp = Path(tempfile.mkdtemp(prefix="pictomarket_pdf_")) / f"{md_path.stem}.html"
    tmp.write_text(html, encoding="utf-8")
    return tmp


def main() -> int:
    status = 0
    for md_path, pdf_path in JOBS:
        if not md_path.exists():
            print(f"SKIP (missing): {md_path}")
            status = 1
            continue
        html_path = render_html(md_path)
        try:
            subprocess.run(
                ["node", str(HELPER), str(html_path), str(pdf_path)],
                check=True,
                cwd=ROOT,
                shell=sys.platform == "win32",
            )
        finally:
            html_path.unlink(missing_ok=True)
            html_path.parent.rmdir()
        print(f"OK {pdf_path.relative_to(ROOT)} ({pdf_path.stat().st_size // 1024} KB)")
    return status


if __name__ == "__main__":
    sys.exit(main())
