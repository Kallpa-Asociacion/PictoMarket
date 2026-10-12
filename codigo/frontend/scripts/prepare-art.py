"""Regenerar solo arte, nunca controles/texto de la captura de referencia.

Uso opcional: python scripts/prepare-art.py (requiere Pillow).
Los archivos generados están versionados; React no necesita Python.
"""
from collections import deque
from pathlib import Path
from typing import cast

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / 'codigo/frontend/public/art'
OUTPUT.mkdir(parents=True, exist_ok=True)
background = Image.open(ROOT / 'img/fondo.png')
background.save(OUTPUT / 'market.webp', quality=90)
background.crop((207, 195, 1139, 304)).save(OUTPUT / 'awning.webp', quality=94)
background.crop((220, 312, 1128, 469)).save(OUTPUT / 'shelf.webp', quality=94)
# Recomponer solo la plaza lateral para no duplicar el puesto detrás del inicio.
side = background.crop((1138, 0, 1672, 941)).resize((836, 941), Image.Resampling.LANCZOS)
scene = Image.new('RGB', background.size)
scene.paste(ImageOps.mirror(side), (0, 0))
scene.paste(side, (836, 0))
scene.save(OUTPUT / 'welcome-market.webp', quality=90)
# Toldo independiente con transparencia en lugar del rectángulo de la foto.
awning = background.crop((207, 195, 1139, 304)).convert('RGBA')
awning_mask = Image.new('L', awning.size)
ImageDraw.Draw(awning_mask).polygon([
    (20, 7), (909, 7), (909, 24), (932, 61), (932, 109),
    (0, 109), (0, 61), (20, 42),
], fill=255)
awning.putalpha(awning_mask)
for y in range(awning.height):
    for x in range(awning.width):
        r, g, b, alpha = cast(tuple[int, int, int, int], awning.getpixel((x, y)))
        if g > r or b > r * 1.2:
            awning.putpixel((x, y), (r, g, b, 0))
awning.save(OUTPUT / 'welcome-awning.webp', lossless=True)
reference = Image.open(ROOT / 'img/ui.png')
reference.crop((264, 99, 394, 234)).save(OUTPUT / 'guide.webp', quality=94)
# Silueta del guía: máscara trazada sobre el recorte ampliado, sin cartel ni texto.
guide = reference.crop((255, 96, 438, 243)).convert('RGBA')
outline = [
    (88, 588), (108, 550), (145, 515), (187, 487), (214, 478),
    (155, 442), (115, 436), (105, 445), (109, 470), (94, 492),
    (70, 496), (49, 476), (49, 457), (65, 443), (78, 433),
    (64, 419), (54, 398), (50, 375), (54, 360), (44, 332),
    (38, 304), (39, 274), (44, 244), (45, 212), (59, 179),
    (85, 138), (106, 111), (119, 76), (140, 53), (168, 36),
    (204, 28), (232, 32), (254, 46), (296, 48), (350, 56),
    (400, 72), (447, 100), (475, 129), (498, 160), (515, 191),
    (523, 214), (537, 237), (539, 258), (528, 276), (522, 278),
    (522, 305), (537, 325), (539, 351), (536, 380), (520, 399),
    (510, 413), (489, 434), (467, 452), (449, 468), (415, 482),
    (460, 496), (497, 511), (560, 452), (574, 449), (574, 421),
    (579, 399), (590, 389), (603, 392), (613, 407), (644, 372),
    (675, 353), (690, 357), (697, 369), (693, 389), (670, 415),
    (687, 425), (694, 438), (693, 452), (700, 465), (692, 479),
    (698, 489), (691, 505), (670, 520), (632, 530), (619, 553),
    (596, 578), (583, 587),
]
mask = Image.new('L', (732, 588))
ImageDraw.Draw(mask).polygon(outline, fill=255)
guide.putalpha(mask.resize(guide.size, Image.Resampling.LANCZOS))
guide.save(OUTPUT / 'welcome-guide.webp', lossless=True)
logo = reference.crop((1292, 7, 1513, 80)).convert('RGBA')
# Quitar solo el fondo conectado al borde; conservar el dibujo del logotipo.
base = cast(tuple[int, int, int, int], logo.getpixel((0, 0)))[:3]
pixels = logo.load()
assert pixels is not None
queue = deque([(x, 0) for x in range(logo.width)] + [(x, logo.height - 1) for x in range(logo.width)]
              + [(0, y) for y in range(logo.height)] + [(logo.width - 1, y) for y in range(logo.height)])
visited = set()
while queue:
    x, y = queue.popleft()
    if (x, y) in visited or not (0 <= x < logo.width and 0 <= y < logo.height):
        continue
    visited.add((x, y))
    r, g, b, alpha = cast(tuple[int, int, int, int], pixels[x, y])
    if max(abs(r - base[0]), abs(g - base[1]), abs(b - base[2])) > 35:
        continue
    pixels[x, y] = (r, g, b, 0)
    queue.extend([(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)])
logo.save(OUTPUT / 'kallpa.webp', lossless=True)
print('Arte regenerado en', OUTPUT.relative_to(ROOT))
