#!/usr/bin/env python3
"""Render the corrected static Market Community L3 field-action slide."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
W, H = 1920, 1080
PAPER = (245, 241, 229)
INK = (52, 47, 37)
FOREST = (28, 79, 48)
OCHRE = (194, 119, 23)
RULE = (222, 214, 190)
MUTED = (143, 126, 99)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        '/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/Library/Fonts/Arial Bold.ttf' if bold else '/Library/Fonts/Arial.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    raise FileNotFoundError('Arial or DejaVu Sans is required')


def wrap(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont,
         max_width: int) -> list[str]:
    lines: list[str] = []
    current = ''
    for word in text.split():
        candidate = f'{current} {word}'.strip()
        if current and draw.textbbox((0, 0), candidate, font=face)[2] > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def render() -> tuple[Image.Image, Image.Image]:
    image = Image.new('RGB', (W, H), PAPER)
    draw = ImageDraw.Draw(image)
    draw.text((132, 48), 'IMBEWUFIELD  ·  MODULE 10', font=font(29, True), fill=OCHRE)
    draw.rounded_rectangle((132, 99, 238, 108), radius=4, fill=OCHRE)
    draw.text((132, 144), 'Field Action: Use the Record', font=font(64, True), fill=FOREST)
    draw.line((132, 235, 1788, 235), fill=RULE, width=3)

    bullets = [
        'Choose one real decision from your farm record.',
        'Compare crop or selling-route costs and returns, or plan a household food gap using local growing conditions.',
        'Before a seed swap, check whether the variety is protected and whether permission is needed.',
        'Choose a seed swap, tool share, shared delivery or skills session with neighbours. Agree responsibilities and review results.',
    ]
    body = font(60, True)
    line_height = 75
    max_width = 1500
    rows = [wrap(draw, item, body, max_width) for item in bullets]
    gap = 22
    total_height = sum(len(lines) * line_height for lines in rows) + gap * (len(rows) - 1)
    y = 277 + (690 - total_height) // 2
    for lines in rows:
        draw.ellipse((136, y + 16, 154, y + 34), fill=OCHRE)
        for line in lines:
            draw.text((180, y), line, font=body, fill=INK)
            y += line_height
        y += gap

    draw.text((132, 1016), 'ImbewuField  ·  Imbewu Yoshintso', font=font(24, True), fill=MUTED)
    slide_number = '20/20'
    bounds = draw.textbbox((0, 0), slide_number, font=font(24, True))
    draw.text((1788 - (bounds[2] - bounds[0]), 1016), slide_number,
              font=font(24, True), fill=MUTED)
    fit = image.resize((269, 151), Image.Resampling.LANCZOS)
    return image, fit


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    master, phone = render()
    master.save(OUT / 'market-community-l3-slide20-candidate.jpg', 'JPEG', quality=94, optimize=True, progressive=True)
    phone.save(OUT / 'market-community-l3-slide20-fit-269.png', 'PNG', optimize=True)
    master.save(ROOT / 'public/course-decks/market-community/en/slide-20.jpg', 'JPEG', quality=94, optimize=True, progressive=True)
