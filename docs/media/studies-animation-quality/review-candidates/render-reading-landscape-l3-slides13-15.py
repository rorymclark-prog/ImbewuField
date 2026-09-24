#!/usr/bin/env python3
"""Render review-only still candidates for Reading the Landscape L3 slides 13–15."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
W, H = 1920, 1080
PAPER = (247, 245, 239)
CARD = (255, 254, 250)
INK = (31, 36, 32)
FOREST = (31, 77, 43)
OCHRE = (192, 122, 30)
MUTED = (115, 103, 87)
LINE = (228, 220, 198)
PALE_GREEN = (234, 241, 232)
PALE_OCHRE = (250, 242, 225)
BLUE = (83, 137, 159)
PALE_BLUE = (231, 241, 244)

REG = Path('/System/Library/Fonts/Supplemental/Arial.ttf')
BOLD = Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
SERIF_BOLD = Path('/System/Library/Fonts/Supplemental/Georgia Bold.ttf')
if not REG.exists():
    REG = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
if not BOLD.exists():
    BOLD = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
if not SERIF_BOLD.exists():
    SERIF_BOLD = BOLD


def face(size, bold=False, serif=False):
    path = SERIF_BOLD if serif else (BOLD if bold else REG)
    return ImageFont.truetype(str(path), size=size)


def wrap(draw, text, font, width):
    result, line = [], ''
    for word in text.split():
        trial = f'{line} {word}'.strip()
        if line and draw.textbbox((0, 0), trial, font=font)[2] > width:
            result.append(line)
            line = word
        else:
            line = trial
    if line:
        result.append(line)
    return result


def paragraph(draw, text, xy, font, color, width, line_height):
    x, y = xy
    lines = wrap(draw, text, font, width)
    for line in lines:
        draw.text((x, y), line, font=font, fill=color)
        y += line_height
    return y


def centered(draw, text, box, font, color, line_height):
    x1, y1, x2, y2 = box
    lines = wrap(draw, text, font, x2 - x1)
    y = y1 + (y2 - y1 - len(lines) * line_height) // 2
    for line in lines:
        width = draw.textbbox((0, 0), line, font=font)[2]
        draw.text((x1 + (x2 - x1 - width) // 2, y), line, font=font, fill=color)
        y += line_height


def card(draw, box, fill=CARD):
    draw.rounded_rectangle(box, radius=28, fill=fill, outline=LINE, width=4)


def header(draw, title, page):
    draw.text((96, 45), 'IMBEWUFIELD  ·  MODULE 2', font=face(27, True), fill=OCHRE)
    draw.rounded_rectangle((96, 93, 190, 102), radius=4, fill=OCHRE)
    draw.text((96, 123), title, font=face(66, serif=True), fill=FOREST)
    draw.line((96, 225, 1824, 225), fill=LINE, width=4)
    draw.text((96, 1020), 'ImbewuField  ·  Imbewu Yoshintso', font=face(22, True), fill=MUTED)
    draw.text((1766, 1020), f'{page}/21', font=face(22, True), fill=MUTED)


def arrow(draw, points, color, width=8):
    draw.line(points, fill=color, width=width, joint='curve')
    x0, y0 = points[-2]
    x1, y1 = points[-1]
    if abs(x1-x0) > abs(y1-y0):
        sign = 1 if x1 > x0 else -1
        head = [(x1, y1), (x1-sign*24, y1-14), (x1-sign*24, y1+14)]
    else:
        sign = 1 if y1 > y0 else -1
        head = [(x1, y1), (x1-14, y1-sign*24), (x1+14, y1-sign*24)]
    draw.polygon(head, fill=color)


def slide13():
    im = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(im)
    header(d, 'Watch: See Wind and Cold Air on the Map', 13)
    card(d, (96, 258, 1824, 930))
    d.text((146, 286), 'CHECK WIND SHELTER AND FROST RISK SEPARATELY',
           font=face(28, True), fill=BLUE)
    card(d, (1430, 274, 1778, 326), PALE_OCHRE)
    centered(d, 'Concept diagram — not to scale', (1442, 278, 1766, 322),
             face(20, True), MUTED, 24)

    # A cross-section shows how a sheltered hollow can still collect cold air.
    ground = [(150, 690), (290, 585), (440, 520), (580, 558), (710, 655),
              (870, 725), (1095, 744), (1280, 712), (1430, 625), (1600, 542),
              (1770, 585), (1770, 785), (150, 785)]
    d.polygon(ground, fill=(181, 139, 96))
    d.line(ground[:11], fill=(112, 79, 49), width=7, joint='curve')
    # Generic windbreak trees sit on the upwind shoulder; no compass direction is implied.
    for x, y in [(535, 529), (588, 551), (640, 589)]:
        d.rectangle((x-8, y-55, x+8, y+7), fill=(112, 79, 49))
        d.ellipse((x-38, y-110, x+38, y-38), fill=FOREST)
    arrow(d, [(220, 430), (360, 430), (475, 430)], OCHRE, 9)
    d.text((218, 374), 'Damaging wind', font=face(31, True), fill=INK)

    # Blue arrows identify cold-air drainage into the hollow despite wind shelter nearby.
    arrow(d, [(655, 606), (760, 672), (900, 704)], BLUE, 9)
    arrow(d, [(1210, 690), (1090, 712), (980, 710)], BLUE, 9)
    d.ellipse((885, 677, 1110, 742), fill=PALE_BLUE, outline=BLUE, width=4)
    d.text((835, 754), 'Low ground: check for cold-air pooling', font=face(25, True), fill=BLUE)

    card(d, (140, 828, 1780, 898), PALE_OCHRE)
    centered(d, 'A sheltered place can still collect cold air. Check both risks on your site.',
             (170, 832, 1750, 894), face(31, True), INK, 38)
    return im


def slide14():
    im = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(im)
    header(d, 'Cold Air Flows Downhill', 14)

    card(d, (96, 270, 1824, 570), PALE_BLUE)
    d.rounded_rectangle((130, 306, 148, 534), radius=8, fill=BLUE)
    d.text((186, 304), 'ON CLEAR, STILL NIGHTS', font=face(29, True), fill=BLUE)
    paragraph(d, 'Cold air can flow downhill and collect in low places. These places can be colder than nearby slopes.',
              (186, 362), face(42, True), INK, 1540, 55)

    card(d, (96, 602, 1824, 916), PALE_OCHRE)
    d.rounded_rectangle((130, 638, 148, 880), radius=8, fill=OCHRE)
    d.text((186, 636), 'LOOK FOR DAMAGE, EVEN WITHOUT VISIBLE ICE', font=face(29, True), fill=OCHRE)
    paragraph(d, 'Frost is ice that forms on a cold surface. Mist alone does not show that ice has formed, and frost damage can happen without visible ice.',
              (186, 694), face(34, True), INK, 1530, 47)
    paragraph(d, 'Compare low ground with slopes, look for plant damage, and check minimum temperatures where you can. Compare candidate nursery sites through the local frost season; check local records or ask a local agriculture adviser before choosing a permanent position.',
              (186, 800), face(27), MUTED, 1530, 38)
    return im


def slide15():
    im = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(im)
    header(d, 'Choose Airflow and Warmth', 15)

    card(d, (96, 270, 914, 918), PALE_BLUE)
    d.rounded_rectangle((132, 308, 150, 876), radius=8, fill=BLUE)
    d.text((190, 308), 'SEEDLING NURSERY', font=face(31, True), fill=BLUE)
    y = paragraph(d, 'Choose a place outside the cold pockets you have observed.',
                  (190, 382), face(40, True), INK, 650, 54)
    y += 30
    y = paragraph(d, 'Compare candidate places through the local frost season. Check local minimum-temperature records or ask a local agriculture adviser before choosing a permanent position.',
                  (190, y), face(31), INK, 650, 43)
    y += 35
    paragraph(d, 'Check sun and damaging wind too. No hillside position guarantees freedom from frost.',
              (190, y), face(29, True), FOREST, 650, 40)

    card(d, (952, 270, 1824, 918), PALE_GREEN)
    d.rounded_rectangle((988, 308, 1006, 876), radius=8, fill=FOREST)
    d.text((1046, 308), 'TOMATOES AND LATE BLIGHT', font=face(31, True), fill=FOREST)
    y = paragraph(d, 'Good airflow and morning sun can help leaves dry.',
                  (1046, 382), face(40, True), INK, 700, 54)
    y += 35
    y = paragraph(d, 'Prolonged cool, damp weather can still favour late blight.',
                  (1046, y), face(34), INK, 700, 46)
    y += 45
    card(d, (1030, y, 1748, y + 176), PALE_OCHRE)
    paragraph(d, 'Moving a bed alone does not control late blight. Seek local crop-health advice too.',
              (1062, y + 28), face(31, True), INK, 654, 42)
    return im


def save(name, image):
    image.save(OUT / f'reading-landscape-l3-slide-{name}-candidate.png', optimize=False)
    image.resize((269, 151), Image.Resampling.LANCZOS).save(
        OUT / f'reading-landscape-l3-slide-{name}-fit-269.png', optimize=False)


def main():
    for number, image in ((13, slide13()), (14, slide14()), (15, slide15())):
        save(number, image)


if __name__ == '__main__':
    main()
