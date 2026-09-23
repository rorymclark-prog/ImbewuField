#!/usr/bin/env python3
"""Render a static, unregistered 269px-fit review still for Vegetables L4."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / 'docs/media/studies-animation-quality/review-candidates/vegetables-l4-slide16-review-v2.png'
PUBLIC_OUTPUT = ROOT / 'public/course-decks/vegetables-staples/en/slide-16.jpg'
WIDTH, HEIGHT = 1920, 1080

PAPER = (248, 245, 233)
CARD = (255, 253, 248)
INK = (25, 54, 39)
BODY = (37, 35, 31)
MUTED = (87, 79, 69)
GREEN = (45, 90, 39)
GOLD = (190, 119, 16)
ALERT = (250, 239, 216)
BORDER = (217, 208, 193)
REG = next((path for path in (
    Path('/System/Library/Fonts/Supplemental/Arial.ttf'),
    Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),
) if path.exists()), None)
BOLD = next((path for path in (
    Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf'),
    Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
) if path.exists()), None)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = BOLD if bold else REG
    if path is None:
        raise FileNotFoundError('No supported font found for Vegetables L4 review still')
    return ImageFont.truetype(str(path), size)


def wrap(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines: list[str] = []
    line = ''
    for word in text.split():
        proposal = f'{line} {word}'.strip()
        if line and draw.textlength(proposal, font=face) > width:
            lines.append(line)
            line = word
        else:
            line = proposal
    if line:
        lines.append(line)
    return lines


def main() -> None:
    image = Image.new('RGB', (WIDTH, HEIGHT), PAPER)
    draw = ImageDraw.Draw(image)
    margin = 78

    draw.text((margin, 22), 'IMBEWUFIELD · MODULE 5', font=font(28, True), fill=GOLD)
    draw.text((margin, 62), 'Treat the Cause Before the Insect', font=font(74, True), fill=GREEN)
    draw.line((margin, 151, WIDTH - margin, 151), fill=BORDER, width=4)

    steps = [
        ('1', 'OBSERVE · ', 'Damage pattern · leaf underside · stem · nearby plants'),
        ('2', 'CHECK FOR STRESS · ', 'Moisture · roots · spacing · nutrition · drainage'),
        ('3', 'PROTECT · ', 'Beneficial insects are doing work'),
        ('4', 'ONLY THEN ACT · ', 'Lightest thing that works · physical removal · barriers · crop care · suit the problem · monitor'),
    ]
    top = 166
    gap = 10
    label_face = font(52, True)
    detail_face = font(48, True)
    body_x = margin + 110
    prepared = []
    for number, label, detail in steps:
        first_width = WIDTH - margin - body_x - draw.textlength(label, font=label_face)
        body_lines = wrap(draw, detail, detail_face, first_width)
        if len(body_lines) > 2:
            raise ValueError(f'{label} requires {len(body_lines)} lines; layout must be reconsidered')
        prepared.append((number, label, body_lines))
    row_heights = [100 + max(0, len(lines)-1) * 62 for _, _, lines in prepared]
    y = top

    for number, label, lines in prepared:
        row_h = row_heights.pop(0)
        y1 = y
        y2 = y1 + row_h
        draw.rounded_rectangle((margin, y1, WIDTH - margin, y2), radius=18,
                               fill=CARD, outline=BORDER, width=3)
        cx, cy, radius = margin + 48, y1 + row_h // 2, 29
        draw.ellipse((cx-radius, cy-radius, cx+radius, cy+radius),
                     fill=GOLD if number == '4' else GREEN)
        number_face = font(40, True)
        number_box = draw.textbbox((0, 0), number, font=number_face)
        draw.text((cx-(number_box[2]-number_box[0])/2, cy-(number_box[3]-number_box[1])/2-number_box[1]),
                  number, font=number_face, fill=(255, 253, 246))
        text_y = y1 + 16
        draw.text((body_x, text_y), label, font=label_face,
                  fill=GOLD if number == '4' else GREEN)
        label_w = draw.textlength(label, font=label_face)
        draw.text((body_x + label_w, text_y), lines[0], font=detail_face, fill=BODY)
        for line in lines[1:]:
            draw.text((body_x, text_y + 59), line, font=detail_face, fill=BODY)
        y = y2 + gap

    panel_y = y + 4
    panel_bottom = 1028
    draw.rounded_rectangle((margin, panel_y, WIDTH - margin, panel_bottom),
                           radius=20, fill=ALERT, outline=(216, 177, 104), width=4)
    draw.text((margin + 28, panel_y + 10), 'ONLY IF TREATMENT IS NEEDED',
              font=font(54, True), fill=GOLD)
    safeguards = [
        'Product registered for this crop and pest · follow its label',
        'Check protection and harvest waiting instructions',
        'Do not improvise mixtures or stronger doses',
    ]
    safety_face = font(60, True)
    safety_y = panel_y + 76
    safety_gap = 72
    for item in safeguards:
        lines = wrap(draw, item, safety_face, WIDTH - 2 * margin - 65)
        if len(lines) != 1:
            raise ValueError(f'Safeguard does not fit on one prominent line: {item}')
        draw.text((margin + 30, safety_y), item, font=safety_face, fill=BODY)
        safety_y += safety_gap
    if safety_y + 6 > panel_bottom:
        raise ValueError('Safeguards exceed the available safety panel')

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, 'PNG', optimize=True)
    PUBLIC_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(PUBLIC_OUTPUT, 'JPEG', quality=94, subsampling=0, optimize=True)


if __name__ == '__main__':
    main()
