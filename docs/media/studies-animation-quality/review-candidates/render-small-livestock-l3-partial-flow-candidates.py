#!/usr/bin/env python3
"""Render review-only static partial-nutrient-flow candidates for Small Livestock L3."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent

PAPER = (247, 245, 239)
CARD = (255, 254, 250)
INK = (31, 36, 32)
FOREST = (31, 77, 43)
OCHRE = (192, 122, 30)
MUTED = (140, 122, 98)
LINE = (228, 220, 198)
PALE_GREEN = (234, 241, 232)
PALE_OCHRE = (250, 242, 225)

REGULAR = Path('/System/Library/Fonts/Supplemental/Arial.ttf')
BOLD = Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
if not REGULAR.exists():
    REGULAR = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
if not BOLD.exists():
    BOLD = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(BOLD if bold else REGULAR), size=size)


def wrap(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont,
         width: int) -> list[str]:
    lines: list[str] = []
    current = ''
    for word in text.split():
        trial = f'{current} {word}'.strip()
        if current and draw.textbbox((0, 0), trial, font=face)[2] > width:
            lines.append(current)
            current = word
        else:
            current = trial
    if current:
        lines.append(current)
    return lines


def centered(draw: ImageDraw.ImageDraw, text: str, box: tuple[int, int, int, int],
             size: int, fill: tuple[int, int, int], *, bold: bool = True,
             line_height: int | None = None) -> None:
    x1, y1, x2, y2 = box
    f = font(size, bold)
    lines = wrap(draw, text, f, x2 - x1)
    line_height = line_height or int(size * 1.2)
    height = len(lines) * line_height
    y = y1 + (y2 - y1 - height) // 2
    for line in lines:
        b = draw.textbbox((0, 0), line, font=f)
        draw.text((x1 + (x2 - x1 - (b[2] - b[0])) // 2, y), line, font=f, fill=fill)
        y += line_height


def arrow(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int],
          color: tuple[int, int, int], width: int = 10) -> None:
    x1, y1 = start
    x2, y2 = end
    draw.line((x1, y1, x2 - 24, y2), fill=color, width=width)
    draw.polygon([(x2 - 24, y2 - 20), (x2, y2), (x2 - 24, y2 + 20)], fill=color)


def slide_header(draw: ImageDraw.ImageDraw, title: str, number: str) -> None:
    draw.text((132, 48), 'IMBEWUFIELD  ·  SMALL LIVESTOCK  ·  L3',
              font=font(25, True), fill=OCHRE)
    draw.rounded_rectangle((132, 96, 224, 104), radius=4, fill=OCHRE)
    draw.text((132, 128), title, font=font(64, True), fill=FOREST)
    draw.line((132, 222, 1788, 222), fill=LINE, width=4)
    draw.text((132, 1018), 'ImbewuField  ·  Imbewu Yoshintso', font=font(22, True), fill=MUTED)
    draw.text((1720, 1018), number, font=font(22, True), fill=MUTED)


def stage_card(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int],
               heading: str, detail: str, *, fill=CARD) -> None:
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=28, fill=fill, outline=LINE, width=4)
    centered(draw, heading, (x1 + 22, y1 + 28, x2 - 22, y1 + 130),
             47, FOREST, line_height=54)
    draw.line((x1 + 42, y1 + 144, x2 - 42, y1 + 144), fill=LINE, width=3)
    centered(draw, detail, (x1 + 28, y1 + 158, x2 - 28, y2 - 20),
             38, INK, line_height=46)


def slide14() -> Image.Image:
    im = Image.new('RGB', (1920, 1080), PAPER)
    d = ImageDraw.Draw(im)
    slide_header(d, 'Nutrients Move Through the Farm', '14/20')
    boxes = [(132, 355, 500, 680), (570, 355, 938, 680),
             (1008, 355, 1376, 680), (1446, 355, 1788, 680)]
    labels = ['BOUGHT\nFEED', 'ANIMALS', 'COMPOSTED\nMANURE', 'GROWING\nBED']
    fills = [PALE_OCHRE, CARD, PALE_GREEN, CARD]
    for box, label, fill in zip(boxes, labels, fills):
        d.rounded_rectangle(box, radius=30, fill=fill, outline=LINE, width=4)
        lines = label.splitlines()
        h = len(lines) * 72
        y = box[1] + 62
        for line in lines:
            b = d.textbbox((0, 0), line, font=font(58, True))
            d.text((box[0] + (box[2] - box[0] - (b[2] - b[0])) // 2, y),
                   line, font=font(58, True), fill=FOREST)
            y += 72
        if box == boxes[2]:
            centered(d, 'Manure handled safely',
                     (box[0] + 20, box[1] + 215, box[2] - 20, box[3] - 24),
                     34, INK, line_height=40)
        elif box == boxes[3]:
            centered(d, 'Some nutrients return',
                     (box[0] + 20, box[1] + 215, box[2] - 20, box[3] - 24),
                     34, INK, line_height=40)
    for a, b in zip(boxes, boxes[1:]):
        arrow(d, (a[2] + 12, 505), (b[0] - 12, 505), OCHRE, 9)

    # Food and products leave; this branch has no arrow back to animals.
    d.line((754, 680, 754, 745), fill=FOREST, width=8)
    d.line((1617, 680, 1617, 745), fill=FOREST, width=8)
    d.line((754, 745, 1617, 745), fill=FOREST, width=8)
    d.line((1185, 745, 1185, 770), fill=OCHRE, width=8)
    d.polygon([(1167, 770), (1185, 794), (1203, 770)], fill=OCHRE)
    d.rounded_rectangle((498, 790, 1488, 900), radius=28,
                        fill=PALE_OCHRE, outline=OCHRE, width=4)
    centered(d, 'Food + other products leave the farm', (538, 800, 1448, 890),
             46, INK, line_height=56)
    d.rounded_rectangle((498, 918, 1488, 988), radius=22,
                        fill=PALE_OCHRE, outline=OCHRE, width=3)
    centered(d, 'Fresh manure can carry pathogens.', (528, 922, 1458, 984),
             39, OCHRE, line_height=48)
    return im


def slide15() -> Image.Image:
    im = Image.new('RGB', (1920, 1080), PAPER)
    d = ImageDraw.Draw(im)
    slide_header(d, 'What Enters, Returns, and Leaves', '15/20')

    # System boundary makes external feed and product flows distinct from the
    # one-way partial return through managed compost.
    d.rounded_rectangle((340, 310, 1580, 690), radius=34,
                        fill=(250, 249, 244), outline=LINE, width=4)
    d.text((390, 338), 'ON THE FARM', font=font(28, True), fill=MUTED)
    d.rounded_rectangle((100, 478, 320, 650), radius=28,
                        fill=PALE_OCHRE, outline=OCHRE, width=4)
    centered(d, 'BOUGHT FEED', (118, 492, 302, 636), 40, INK, line_height=50)
    arrow(d, (320, 564), (386, 564), OCHRE, 9)

    boxes = [(400, 405, 750, 635), (785, 405, 1150, 635), (1185, 405, 1520, 635)]
    labels = ['ANIMALS', 'COMPOSTED\nMANURE', 'GROWING\nBED']
    fills = [CARD, PALE_GREEN, CARD]
    for box, label, fill in zip(boxes, labels, fills):
        d.rounded_rectangle(box, radius=28, fill=fill, outline=LINE, width=4)
        centered(d, label.replace('\n', ' '),
                 (box[0] + 18, box[1] + 20, box[2] - 18, box[1] + 142),
                 48, FOREST, line_height=58)
    arrow(d, (750, 520), (775, 520), FOREST, 9)
    arrow(d, (1150, 520), (1175, 520), FOREST, 9)
    centered(d, 'Manure collected', (425, 552, 725, 622), 30, INK, line_height=36)
    centered(d, 'Some nutrients return', (1205, 548, 1500, 622), 29, INK, line_height=35)

    # Animal and crop products leave from their own stages, not through the bed.
    d.line((575, 635, 575, 720), fill=OCHRE, width=8)
    d.line((1352, 635, 1352, 720), fill=OCHRE, width=8)
    d.line((575, 720, 1352, 720), fill=OCHRE, width=8)
    d.line((963, 720, 963, 750), fill=OCHRE, width=8)
    d.polygon([(945, 750), (963, 774), (981, 750)], fill=OCHRE)
    d.rounded_rectangle((500, 770, 1420, 864), radius=24,
                        fill=PALE_OCHRE, outline=OCHRE, width=4)
    centered(d, 'Food + other products leave the farm', (528, 782, 1392, 852),
             40, INK, line_height=48)
    d.rounded_rectangle((500, 900, 1420, 974), radius=20,
                        fill=PALE_OCHRE, outline=OCHRE, width=3)
    centered(d, 'Fresh manure can carry pathogens.', (528, 906, 1392, 968),
             36, OCHRE, line_height=44)
    return im


def accordion_image() -> Image.Image:
    """Landscape infographic size used by the L3 accordion image."""
    im = Image.new('RGB', (1200, 800), PAPER)
    d = ImageDraw.Draw(im)
    d.text((58, 40), 'SMALL LIVESTOCK  ·  L3', font=font(24, True), fill=OCHRE)
    d.text((58, 82), 'Nutrients Move Through the Farm', font=font(48, True), fill=FOREST)
    d.line((58, 150, 1142, 150), fill=LINE, width=4)
    d.text((58, 175), 'Some nutrients return. Feed enters; food and products leave.',
           font=font(25, True), fill=INK)

    d.rounded_rectangle((250, 304, 1142, 610), radius=30,
                        fill=(250, 249, 244), outline=LINE, width=4)
    d.text((278, 322), 'ON THE FARM', font=font(23, True), fill=MUTED)
    d.rounded_rectangle((32, 405, 235, 575), radius=24,
                        fill=PALE_OCHRE, outline=OCHRE, width=3)
    centered(d, 'BOUGHT FEED', (48, 425, 219, 555), 31, INK, line_height=38)
    arrow(d, (235, 490), (282, 490), OCHRE, 8)

    boxes = [(288, 370, 530, 560), (568, 370, 830, 560), (868, 370, 1098, 560)]
    entries = [
        ('ANIMALS', 'Manure collected'),
        ('COMPOSTED MANURE', 'Fresh manure can carry pathogens'),
        ('GROWING BED', 'Some nutrients return'),
    ]
    for box, (heading, detail), fill in zip(boxes, entries, [CARD, PALE_GREEN, CARD]):
        x1, y1, x2, y2 = box
        d.rounded_rectangle(box, radius=24, fill=fill, outline=LINE, width=3)
        centered(d, heading, (x1 + 12, y1 + 10, x2 - 12, y1 + 72),
                 27, FOREST, line_height=31)
        d.line((x1 + 20, y1 + 82, x2 - 20, y1 + 82), fill=LINE, width=2)
        centered(d, detail, (x1 + 14, y1 + 91, x2 - 14, y2 - 8),
                 26, INK, line_height=32)
    arrow(d, (530, 465), (558, 465), FOREST, 8)
    arrow(d, (830, 465), (858, 465), FOREST, 8)
    d.line((696, 610, 696, 630), fill=OCHRE, width=7)
    d.polygon([(680, 630), (696, 650), (712, 630)], fill=OCHRE)
    d.rounded_rectangle((250, 650, 1142, 760), radius=24,
                        fill=PALE_OCHRE, outline=OCHRE, width=3)
    centered(d, 'FOOD + OTHER PRODUCTS LEAVE THE FARM',
             (278, 662, 1114, 748), 30, INK, line_height=38)
    return im


def save(image: Image.Image, stem: str) -> None:
    image.save(OUT / f'{stem}-candidate.png', format='PNG', optimize=False)
    image.resize((269, 151), Image.Resampling.LANCZOS).save(
        OUT / f'{stem}-fit-269.png', format='PNG', optimize=False)


def main() -> None:
    save(slide14(), 'small-livestock-l3-slide14-partial-flow')
    save(slide15(), 'small-livestock-l3-slide15-partial-flow')
    save(accordion_image(), 'small-livestock-l3-accordion-partial-flow')


if __name__ == '__main__':
    main()
