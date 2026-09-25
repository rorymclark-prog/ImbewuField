#!/usr/bin/env python3
"""Render a phone-readability review candidate for Small Livestock L1 slide 8."""

from pathlib import Path
from shutil import copyfile
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
PUBLIC = OUT.parents[3] / 'public/course-decks/small-livestock/en/slide-08.jpg'
WIDTH, HEIGHT = 1920, 1080

CREAM = (245, 241, 232)
CARD = (253, 251, 247)
TEXT = (44, 38, 32)
FOREST = (45, 90, 39)
GOLD = (198, 125, 10)
BORDER = (217, 208, 193)
MUTED = (135, 119, 96)

REGULAR = Path('/System/Library/Fonts/Supplemental/Arial.ttf')
BOLD = Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
if not REGULAR.exists():
    REGULAR = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
if not BOLD.exists():
    BOLD = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')

TITLE = 'Rotate the Tractor Across the Plot'
STATEMENTS = (
    'A chicken tractor is a moveable, floorless pen.',
    'Move it before the ground becomes bare, muddy or heavily covered with manure.',
    'The right time depends on the birds, soil and weather.',
    'There is no single number of chickens that guarantees enough fertility for every plot.',
)


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


def wrap(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ''
    for word in words:
        trial = f'{current} {word}'.strip()
        if current and draw.textbbox((0, 0), trial, font=face)[2] > max_width:
            lines.append(current)
            current = word
        else:
            current = trial
    if current:
        lines.append(current)
    return lines


def main() -> None:
    image = Image.new('RGB', (WIDTH, HEIGHT), CREAM)
    draw = ImageDraw.Draw(image)

    draw.text((132, 50), 'IMBEWUFIELD  ·  MODULE 9', font=font(BOLD, 26), fill=GOLD)
    draw.rounded_rectangle((132, 100, 224, 108), radius=4, fill=GOLD)
    title_font = font(BOLD, 68)
    draw.text((132, 133), TITLE, font=title_font, fill=FOREST)
    draw.line((132, 230, 1788, 230), fill=BORDER, width=4)

    body_font = font(BOLD, 55)
    left, right = 132, 1788
    top = 258
    card_height = 170
    gap = 20
    text_left = 204
    text_width = right - text_left - 54
    for statement in STATEMENTS:
        lines = wrap(draw, statement, body_font, text_width)
        line_height = 70
        content_height = len(lines) * line_height
        y = top + (card_height - content_height) // 2 - 4
        draw.rounded_rectangle((left, top, right, top + card_height), radius=28,
                               fill=CARD, outline=BORDER, width=3)
        draw.rounded_rectangle((left, top + 10, left + 15, top + card_height - 10),
                               radius=7, fill=FOREST)
        draw.ellipse((158, top + card_height // 2 - 10, 178, top + card_height // 2 + 10), fill=GOLD)
        for line in lines:
            draw.text((text_left, y), line, font=body_font, fill=TEXT)
            y += line_height
        top += card_height + gap

    draw.text((132, 1019), 'ImbewuField  ·  Imbewu Yoshintso', font=font(BOLD, 22), fill=MUTED)
    draw.text((1713, 1019), '8/20', font=font(BOLD, 22), fill=MUTED)
    candidate = OUT / 'small-livestock-l1-slide08-readable-candidate.jpg'
    image.save(candidate, format='JPEG', quality=94, subsampling=0, optimize=True)
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    copyfile(candidate, PUBLIC)
    image.resize((269, 151), Image.Resampling.LANCZOS).save(
        OUT / 'small-livestock-l1-slide08-readable-fit-269.jpg',
        format='JPEG', quality=95, subsampling=0, optimize=True,
    )


if __name__ == '__main__':
    main()
