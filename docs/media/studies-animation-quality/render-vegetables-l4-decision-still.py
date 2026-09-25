#!/usr/bin/env python3
"""Render a review candidate for Vegetables L4 slide 16's decision path."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'public/course-decks/vegetables-staples/en/slide-16.jpg'
OUTPUT = ROOT / 'docs/media/studies-animation-quality/review-candidates/vegetables-l4-slide16-decision-candidate.jpg'
WIDTH, HEIGHT = 1920, 1080
PAPER = (248, 245, 233)
CARD = (253, 251, 247)
INK = (25, 54, 39)
BODY = (44, 38, 32)
MUTED = (92, 82, 72)
GREEN = (45, 90, 39)
GOLD = (190, 119, 16)
ALERT = (247, 238, 220)
BORDER = (217, 208, 193)
REG = Path('/System/Library/Fonts/Supplemental/Arial.ttf')
BOLD = Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf')


def f(size, bold=False):
    path = BOLD if bold else REG
    return ImageFont.truetype(str(path), size)


def fit_crop(source, box, size):
    crop = source.crop(box)
    crop.thumbnail(size, Image.Resampling.LANCZOS)
    return crop


def centered(draw, xy, text, face, fill):
    x, y = xy
    b = draw.textbbox((0, 0), text, font=face)
    draw.text((x - (b[2]-b[0])/2, y - (b[3]-b[1])/2 - b[1]), text, font=face, fill=fill)


def main():
    source = Image.open(SOURCE).convert('RGB')
    image = Image.new('RGB', (WIDTH, HEIGHT), PAPER)
    draw = ImageDraw.Draw(image)
    draw.text((72, 25), 'IMBEWUFIELD · MODULE 5', font=f(26, True), fill=GOLD)
    draw.rounded_rectangle((72, 66, 164, 74), radius=4, fill=GOLD)
    draw.text((72, 86), 'Treat the Cause Before the Insect', font=f(68, True), fill=GREEN)
    draw.line((72, 174, 1848, 174), fill=BORDER, width=4)
    draw.text((72, 190), 'FOUR STEPS · IN ORDER', font=f(30, True), fill=MUTED)

    cards = [
        ((72, 236, 920, 500), '1', 'OBSERVE', 'Damage pattern · leaf underside · stem · nearby plants', (480, 265, 820, 900)),
        ((1000, 236, 1848, 500), '2', 'CHECK FOR STRESS', 'Moisture · roots · spacing · nutrition · drainage', None),
        ((72, 522, 920, 786), '3', 'PROTECT', 'Beneficial insects are doing work', (915, 270, 1210, 560)),
        ((1000, 522, 1848, 786), '4', 'ONLY THEN ACT', 'Lightest thing that works · physical removal · barriers · crop care · suit the problem · monitor', (790, 570, 1440, 900)),
    ]
    for rect, number, label, detail, crop_box in cards:
        x1, y1, x2, y2 = rect
        draw.rounded_rectangle(rect, radius=22, fill=CARD, outline=BORDER, width=3)
        draw.ellipse((x1+20, y1+18, x1+78, y1+76), fill=GOLD if number == '4' else GREEN)
        centered(draw, (x1+49, y1+47), number, f(38, True), (255, 253, 246))
        label_face = f(34, True)
        draw.text((x1+98, y1+27), label, font=label_face, fill=GREEN if number != '4' else GOLD)
        if crop_box:
            tile = fit_crop(source, crop_box, (210, 170))
            image.paste(tile, (x1+25, y1+83))
        text_x = x1 + (252 if crop_box else 35)
        max_w = x2 - text_x - 28
        detail_face = f(32, True)
        words, lines, line = detail.split(), [], ''
        for word in words:
            test = f'{line} {word}'.strip()
            if line and draw.textlength(test, font=detail_face) > max_w:
                lines.append(line); line = word
            else:
                line = test
        if line: lines.append(line)
        # Reserve the bottom strip for safety; any overflow is an explicit stop.
        if len(lines) > 3:
            raise ValueError(f'{label} needs {len(lines)} detail lines in its card')
        y = y1 + 91
        for ln in lines:
            draw.text((text_x, y), ln, font=detail_face, fill=BODY)
            y += 40

    # This safety strip keeps each conditional and safeguard visible as its own line.
    draw.rounded_rectangle((72, 808, 1848, 1016), radius=22, fill=ALERT, outline=(216, 177, 104), width=4)
    draw.text((100, 824), 'ONLY IF TREATMENT IS NEEDED', font=f(34, True), fill=GOLD)
    safety = [
        'Use a product registered for this crop + pest · follow its label',
        'Check protection + harvest waiting instructions',
        'Do not improvise mixtures or stronger doses',
    ]
    sf = f(38, True)
    for i, line in enumerate(safety):
        draw.text((100, 865 + i*43), line, font=sf, fill=BODY)
    draw.text((72, 1033), 'ImbewuField · Imbewu Yohsintso', font=f(22, True), fill=MUTED)
    draw.text((1752, 1032), '16/18', font=f(24, True), fill=MUTED)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, 'JPEG', quality=94, subsampling=0, optimize=True)

if __name__ == '__main__':
    main()
