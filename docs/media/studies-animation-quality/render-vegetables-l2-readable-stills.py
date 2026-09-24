#!/usr/bin/env python3
"""Reflow only the existing English text on Vegetables L2 slides 9 and 11."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/course-decks/vegetables-staples/en'
W, H = 1920, 1080
PAPER = (248, 245, 233)
CARD = (253, 251, 247)
GREEN = (33, 83, 48)
GOLD = (190, 119, 16)
INK = (42, 38, 32)
MUTED = (110, 99, 81)
BORDER = (217, 208, 193)


def available_font(*paths):
    return next((path for path in map(Path, paths) if path.exists()), None)


REGULAR = available_font('/System/Library/Fonts/Supplemental/Arial.ttf',
                         '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
BOLD = available_font('/System/Library/Fonts/Supplemental/Arial Bold.ttf',
                      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
SERIF_BOLD = available_font('/System/Library/Fonts/Supplemental/Georgia Bold.ttf',
                            '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf')

SLIDES = {
    9: (
        'Sow Little and Often',
        (
            "Here's what it looks like in practice.",
            'With suitable crop timing, harvests can begin to overlap.',
            'Two to three weeks is a starting rhythm, not a law.',
            'Watch what your own garden does, and adjust the interval.',
        ),
    ),
    11: (
        'Plan Backwards From Your Hungry Gap',
        (
            'A household may have a hungry gap: weeks when stored food runs low before the next harvest is ready.',
            'Yours might come after stored maize runs out.',
            "Don't copy somebody else's calendar.",
            'Write them down.',
        ),
    ),
}


def face(size, bold=False, serif=False):
    path = SERIF_BOLD if serif else (BOLD if bold else REGULAR)
    if path is None:
        raise FileNotFoundError('No supported font found for Vegetables L2 stills')
    return ImageFont.truetype(str(path), size)


def wrap(draw, text, font, width):
    result, line = [], ''
    for word in text.split():
        trial = f'{line} {word}'.strip()
        if line and draw.textlength(trial, font=font) > width:
            result.append(line)
            line = word
        else:
            line = trial
    if line:
        result.append(line)
    return result


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for slide, (title, statements) in SLIDES.items():
        image = Image.new('RGB', (W, H), PAPER)
        draw = ImageDraw.Draw(image)
        draw.text((72, 25), 'IMBEWUFIELD · MODULE 5', font=face(26, True), fill=GOLD)
        draw.rounded_rectangle((72, 66, 164, 74), radius=4, fill=GOLD)
        draw.text((72, 100), title, font=face(68, serif=True), fill=GREEN)
        draw.line((72, 190, 1848, 190), fill=BORDER, width=4)

        copy_face = face(60, True)
        max_width = 1640
        rows = [wrap(draw, item, copy_face, max_width) for item in statements]
        line_height = 70
        row_gap = 24
        heights = [len(lines) * line_height + 28 for lines in rows]
        total = sum(heights) + row_gap * (len(rows) - 1)
        top, bottom = 220, 1000
        if total > bottom - top:
            raise ValueError(f'slide {slide}: existing copy does not fit in larger type ({total}px)')
        # Distribute leftover space evenly, keeping the original sentence order.
        extra = (bottom - top - total) / len(rows)
        y = top
        for index, lines in enumerate(rows):
            height = heights[index] + extra
            draw.rounded_rectangle((72, int(y), 1848, int(y + height - 10)), radius=18,
                                   fill=CARD, outline=BORDER, width=2)
            draw.ellipse((100, int(y + 32), 124, int(y + 56)), fill=GOLD)
            text_y = y + (height - len(lines) * line_height) / 2 - 4
            for line in lines:
                draw.text((158, int(text_y)), line, font=copy_face, fill=INK)
                text_y += line_height
            y += height + row_gap

        draw.text((72, 1037), 'ImbewuField · Imbewu Yohsintso', font=face(22, True), fill=MUTED)
        draw.text((1752, 1035), f'{slide}/18', font=face(24, True), fill=MUTED)
        image.save(OUT / f'slide-{slide:02}.jpg', 'JPEG', quality=94, subsampling=0, optimize=True)

if __name__ == '__main__':
    main()
