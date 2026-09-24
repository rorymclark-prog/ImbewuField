#!/usr/bin/env python3
"""Render review-only static replacement candidates for Reading the Landscape L1."""

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


def face(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(BOLD if bold else REG), size=size)


def wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont,
         max_width: int) -> list[str]:
    lines, current = [], ''
    for word in text.split():
        candidate = f'{current} {word}'.strip()
        if current and draw.textbbox((0, 0), candidate, font=font)[2] > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def centered(draw: ImageDraw.ImageDraw, lines: list[str], box: tuple[int, int, int, int],
             font: ImageFont.FreeTypeFont, fill: tuple[int, int, int],
             line_height: int) -> None:
    x1, y1, x2, y2 = box
    y = y1 + (y2 - y1 - len(lines) * line_height) // 2
    for line in lines:
        bounds = draw.textbbox((0, 0), line, font=font)
        draw.text((x1 + (x2 - x1 - (bounds[2] - bounds[0])) // 2, y),
                  line, font=font, fill=fill)
        y += line_height


def header(draw: ImageDraw.ImageDraw, title: str, slide: int) -> None:
    draw.text((96, 45), 'IMBEWUFIELD  ·  MODULE 2', font=face(27, True), fill=OCHRE)
    draw.rounded_rectangle((96, 93, 190, 102), radius=4, fill=OCHRE)
    draw.text((96, 123), title, font=ImageFont.truetype(str(SERIF_BOLD), size=70), fill=FOREST)
    draw.line((96, 225, 1824, 225), fill=LINE, width=4)
    draw.text((96, 1020), 'ImbewuField  ·  Imbewu Yoshintso', font=face(22, True), fill=MUTED)
    draw.text((1766, 1020), f'{slide}/21', font=face(22, True), fill=MUTED)


def card(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill=CARD) -> None:
    draw.rounded_rectangle(box, radius=28, fill=fill, outline=LINE, width=4)


def arrow(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int],
          color: tuple[int, int, int], width: int = 10) -> None:
    import math
    draw.line((start, end), fill=color, width=width)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    length, spread = 32, 0.5
    draw.polygon([end,
                  (end[0] - length * math.cos(angle - spread), end[1] - length * math.sin(angle - spread)),
                  (end[0] - length * math.cos(angle + spread), end[1] - length * math.sin(angle + spread))],
                 fill=color)


def slide4() -> Image.Image:
    image = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(image)
    header(d, 'Where Rain Goes', 4)

    # A schematic observation cue only: the arrows show movement and an exit,
    # without locating or prescribing an earthwork.
    card(d, (132, 265, 1788, 620))
    d.polygon([(230, 370), (500, 399), (800, 430), (1110, 466),
               (1410, 500), (1510, 512), (1694, 526), (1694, 560), (230, 560)],
              fill=(222, 231, 211))
    d.line([(230, 370), (500, 399), (800, 430), (1110, 466),
            (1410, 500), (1510, 512), (1694, 526)], fill=FOREST, width=8, joint='curve')
    # Raindrops are kept abstract; blue arrows invite observation across the surface.
    for x, y in [(620, 298), (702, 318), (784, 288), (866, 313)]:
        d.ellipse((x - 8, y - 18, x + 8, y + 8), fill=BLUE)
    arrow(d, (650, 414), (850, 440), BLUE, 11)
    arrow(d, (1010, 452), (1240, 480), BLUE, 11)
    # The boundary and an outgoing arrow indicate that excess water can leave.
    d.line((1510, 342, 1510, 570), fill=MUTED, width=5)
    arrow(d, (1430, 502), (1660, 530), OCHRE, 11)

    card(d, (132, 660, 1788, 808), PALE_BLUE)
    d.rounded_rectangle((132, 678, 151, 790), radius=8, fill=BLUE)
    centered(d, wrap(d, 'Watch where water leaves your property', face(46, True), 1470),
             (190, 675, 1730, 795), face(46, True), INK, 58)

    card(d, (132, 836, 1788, 972), PALE_OCHRE)
    d.rounded_rectangle((132, 854, 151, 954), radius=8, fill=OCHRE)
    centered(d, wrap(d, 'Some excess water needs a safe route away so it does not cause damage.',
                     face(40, True), 1470),
             (190, 845, 1730, 964), face(40, True), FOREST, 51)
    return image


def icon(draw: ImageDraw.ImageDraw, kind: str, center: tuple[int, int]) -> None:
    x, y = center
    if kind == 'observe':
        draw.ellipse((x - 34, y - 34, x + 34, y + 34), outline=BLUE, width=8)
        draw.line((x + 26, y + 26, x + 58, y + 58), fill=BLUE, width=10)
        draw.arc((x - 18, y - 4, x + 18, y + 20), start=190, end=350, fill=OCHRE, width=5)
    elif kind == 'contour':
        for offset in (-20, 0, 20):
            draw.arc((x - 55, y - 28 + offset, x + 55, y + 28 + offset),
                     start=185, end=350, fill=FOREST, width=6)
        draw.line((x + 34, y - 18, x + 53, y + 3), fill=OCHRE, width=8)
        draw.line((x + 53, y + 3, x + 29, y + 18), fill=OCHRE, width=8)
    else:
        # Open-ended dotted route: a safety planning prompt, not a mapped design.
        for px in range(x - 48, x + 31, 22):
            draw.ellipse((px - 5, y - 5, px + 5, y + 5), fill=BLUE)
        arrow(draw, (x + 16, y), (x + 58, y), OCHRE, 8)


def slide7() -> Image.Image:
    image = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(image)
    header(d, 'Observe Water Before You Build', 7)

    statements = [
        ('Observe where water moves and gathers', 'observe', PALE_BLUE, BLUE),
        ('Poorly laid contours can increase erosion', 'contour', PALE_GREEN, FOREST),
        ('Check safe overflow with a trained local adviser', 'route', PALE_OCHRE, OCHRE),
    ]
    top, height, gap = 280, 197, 30
    for text, symbol, fill, accent in statements:
        card(d, (132, top, 1788, top + height), fill)
        d.rounded_rectangle((132, top + 14, 151, top + height - 14), radius=8, fill=accent)
        icon(d, symbol, (255, top + height // 2))
        lines = wrap(d, text, face(48, True), 1370)
        y1 = top + 18
        centered(d, lines, (360, y1, 1715, top + height - 18), face(48, True), INK, 62)
        top += height + gap
    return image


def save(image: Image.Image, stem: str) -> None:
    image.save(OUT / f'{stem}-candidate.png', format='PNG', optimize=False)
    image.resize((269, 151), Image.Resampling.LANCZOS).save(
        OUT / f'{stem}-fit-269.png', format='PNG', optimize=False)


def main() -> None:
    save(slide4(), 'reading-landscape-l1-slide04')
    save(slide7(), 'reading-landscape-l1-slide07')


if __name__ == '__main__':
    main()
