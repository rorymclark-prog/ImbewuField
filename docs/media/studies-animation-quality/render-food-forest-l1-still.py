#!/usr/bin/env python3
"""Recompose Food Forest Design L1's seven-layer still for phone readability.

Uses the existing reviewed cutaway artwork and the existing seven narrated layer
names. This renders one static JPEG; it does not make or register a movie.
"""
from pathlib import Path
import argparse

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'docs/media/studies-animation-quality/forest-layers/source.png'
DEFAULT_OUT = ROOT / 'public/course-decks/food-forest/en/slide-05.jpg'
LAYERS = (
    'Tall canopy',
    'Smaller trees',
    'Woody shrubs',
    'Herbaceous plants',
    'Ground cover',
    'Root crops',
    'Climbers',
)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        '/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/Library/Fonts/Arial Bold.ttf' if bold else '/Library/Fonts/Arial.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    raise FileNotFoundError('Arial or DejaVu Sans is required to render this still')


def render(output: Path) -> None:
    width, height = 1600, 900
    art_width = 760
    panel_x = 800
    paper = (248, 245, 233)
    ink = (25, 54, 39)
    muted = (74, 92, 75)
    accent = (172, 117, 42)
    rule = (218, 216, 198)

    source = Image.open(SOURCE).convert('RGB')
    art_height = round(source.height * art_width / source.width)
    art = source.resize((art_width, art_height), Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', (width, height), paper)
    canvas.paste(art, (20, (height - art_height) // 2))
    draw = ImageDraw.Draw(canvas)

    title_font = load_font(52, bold=True)
    label_font = load_font(60, bold=True)
    small_font = load_font(31)
    draw.text((panel_x, 54), 'SEVEN PLANTING LAYERS', font=title_font, fill=ink)
    draw.rounded_rectangle((panel_x, 126, panel_x + 112, 134), radius=4, fill=accent)

    row_top, row_height = 158, 91
    for index, label in enumerate(LAYERS, start=1):
        y = row_top + (index - 1) * row_height
        center_y = y + row_height // 2
        radius = 29
        draw.ellipse((panel_x, center_y - radius, panel_x + 2 * radius, center_y + radius), fill=ink)
        number = str(index)
        box = draw.textbbox((0, 0), number, font=small_font)
        tx = panel_x + radius - (box[2] - box[0]) / 2
        ty = center_y - (box[3] - box[1]) / 2 - box[1]
        draw.text((tx, ty), number, font=small_font, fill=(255, 253, 246))
        draw.text((panel_x + 82, y + 9), label, font=label_font, fill=ink)
        if index < len(LAYERS):
            draw.line((panel_x + 82, y + row_height - 2, width - 36, y + row_height - 2), fill=rule, width=2)

    footer_y = row_top + len(LAYERS) * row_height + 8
    draw.text((panel_x, footer_y), 'CONCEPT CUTAWAY · HEIGHTS AND SPACING', font=small_font, fill=muted)
    draw.text((panel_x, footer_y + 38), 'DEPEND ON THE SITE', font=small_font, fill=muted)
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, 'JPEG', quality=91, optimize=True, progressive=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, default=DEFAULT_OUT)
    render(parser.parse_args().out)
