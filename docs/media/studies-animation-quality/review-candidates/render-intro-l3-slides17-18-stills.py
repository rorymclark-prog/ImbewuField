#!/usr/bin/env python3
"""Render review-only static raster candidates for Introduction L3 slides 17–18."""
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
if not REG.exists():
    REG = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
if not BOLD.exists():
    BOLD = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')


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
    draw.text((96, 45), 'IMBEWUFIELD  ·  MODULE 1', font=face(27, True), fill=OCHRE)
    draw.rounded_rectangle((96, 93, 190, 102), radius=4, fill=OCHRE)
    draw.text((96, 123), title, font=face(70, True), fill=FOREST)
    draw.line((96, 225, 1824, 225), fill=LINE, width=4)
    draw.text((96, 1020), 'ImbewuField  ·  Imbewu Yoshintso', font=face(22, True), fill=MUTED)
    draw.text((1766, 1020), f'{slide}/22', font=face(22, True), fill=MUTED)


def card(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill=CARD) -> None:
    draw.rounded_rectangle(box, radius=28, fill=fill, outline=LINE, width=4)


def house(draw: ImageDraw.ImageDraw, center: tuple[int, int], scale: float = 1) -> None:
    x, y = center
    w, h = int(104 * scale), int(70 * scale)
    draw.rectangle((x - w // 2, y - h // 2 + 18, x + w // 2, y + h // 2 + 18),
                   fill=(239, 225, 194), outline=FOREST, width=max(3, int(4 * scale)))
    draw.polygon([(x - w // 2 - 12, y - h // 2 + 20), (x, y - h // 2 - 28),
                  (x + w // 2 + 12, y - h // 2 + 20)],
                 fill=FOREST)
    draw.rectangle((x - 10 * scale, y + 11 * scale, x + 10 * scale, y + h // 2 + 18),
                   fill=OCHRE)


def slide17() -> Image.Image:
    image = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(image)
    header(d, 'Zones Plan Your Labour', 17)

    card(d, (132, 265, 1788, 435), PALE_GREEN)
    centered(d, wrap(d, 'Zones help organise space around walking, carrying and checking.',
                     face(48, True), 1480), (175, 280, 1745, 420), face(48, True), INK, 60)

    # The rings are schematic: they show relative closeness to the home, not measured distances.
    card(d, (132, 470, 1050, 940))
    cx, cy = 590, 704
    d.ellipse((cx - 365, cy - 205, cx + 365, cy + 205), fill=(246, 240, 222), outline=LINE, width=4)
    d.ellipse((cx - 280, cy - 157, cx + 280, cy + 157), fill=(234, 241, 232), outline=(184, 205, 181), width=4)
    d.ellipse((cx - 183, cy - 106, cx + 183, cy + 106), fill=(215, 230, 211), outline=(156, 185, 151), width=4)
    house(d, (cx, cy), 1.05)
    d.text((cx - 61, cy + 72), 'HOME', font=face(26, True), fill=FOREST)
    d.text((cx - 140, cy - 175), 'CLOSER', font=face(25, True), fill=FOREST)
    d.text((cx + 188, cy - 196), 'FARTHER OUT', font=face(25, True), fill=MUTED)
    # A simple outward cue makes the relation legible without adding distance values.
    d.line((cx + 120, cy + 18, cx + 295, cy + 18), fill=OCHRE, width=8)
    d.polygon([(cx + 295, cy + 18), (cx + 266, cy - 1), (cx + 266, cy + 37)], fill=OCHRE)

    card(d, (1088, 470, 1788, 940), PALE_OCHRE)
    statement_font = face(34, True)
    statement = wrap(d, 'The more often something needs you, the closer it lives.',
                     statement_font, 550)
    centered(d, statement, (1140, 510, 1735, 710), statement_font, FOREST, 46)
    d.line((1190, 758, 1680, 758), fill=LINE, width=4)
    centered(d, ['Plan around the work', 'your day already asks of you.'],
             (1140, 780, 1735, 900), face(34, True), MUTED, 45)
    return image


def arrow(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int],
          color: tuple[int, int, int], width: int = 8) -> None:
    draw.line((start, end), fill=color, width=width)
    import math
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    length, spread = 26, 0.48
    points = [end,
              (end[0] - length * math.cos(angle - spread), end[1] - length * math.sin(angle - spread)),
              (end[0] - length * math.cos(angle + spread), end[1] - length * math.sin(angle + spread))]
    draw.polygon(points, fill=color)


def slide18() -> Image.Image:
    image = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(image)
    header(d, 'Sectors: Energies From Outside', 18)

    card(d, (132, 265, 1788, 420), PALE_GREEN)
    centered(d, ['Zones start inside. Sectors arrive from outside.'],
             (175, 280, 1745, 405), face(43, True), FOREST, 56)

    # Site diagram is intentionally unlabelled by compass or region; observe each farm locally.
    card(d, (132, 455, 1150, 940))
    site = (252, 520, 1030, 852)
    d.rounded_rectangle(site, radius=12, fill=(249, 248, 242), outline=FOREST, width=7)
    # Gentle contours suggest a site surface while arrows show observed movement across it.
    for i in range(4):
        y = 610 + i * 53
        d.arc((365, y - 30, 925, y + 90), start=15, end=165, fill=(214, 221, 201), width=4)
    house(d, (625, 681), 0.86)
    d.text((573, 747), 'HOME', font=face(21, True), fill=FOREST)
    # Wind enters from the boundary. Direction is a prompt for local observation.
    arrow(d, (275, 586), (455, 586), BLUE, 9)
    arrow(d, (275, 646), (468, 646), BLUE, 9)
    arrow(d, (275, 795), (455, 795), BLUE, 9)
    d.text((270, 537), 'WIND', font=face(23, True), fill=BLUE)
    # Rainwater enters at the edge and follows the site's surface.
    arrow(d, (988, 558), (884, 620), OCHRE, 8)
    arrow(d, (884, 620), (783, 654), OCHRE, 8)
    arrow(d, (783, 654), (744, 777), OCHRE, 8)
    d.text((814, 525), 'RAINWATER', font=face(22, True), fill=OCHRE)
    d.text((263, 867), 'Observe where wind enters and where water flows.',
           font=face(23, True), fill=MUTED)

    card(d, (1190, 455, 1788, 670), PALE_BLUE)
    d.rounded_rectangle((1190, 477, 1208, 648), radius=8, fill=BLUE)
    centered(d, ['Watch where strong wind', 'comes from on your farm.'],
             (1240, 478, 1740, 642), face(34, True), INK, 48)

    card(d, (1190, 695, 1788, 940), PALE_OCHRE)
    centered(d, ['Weather-station records can help', 'you check wind direction.'],
             (1230, 720, 1748, 835), face(30, True), FOREST, 41)
    d.line((1250, 852, 1728, 852), fill=LINE, width=3)
    centered(d, ['Watch where rainwater enters', 'and flows across your land.'],
             (1230, 862, 1748, 927), face(27, True), INK, 35)
    return image


def save(image: Image.Image, stem: str) -> None:
    image.save(OUT / f'{stem}-candidate.png', format='PNG', optimize=False)
    image.resize((269, 151), Image.Resampling.LANCZOS).save(
        OUT / f'{stem}-fit-269.png', format='PNG', optimize=False)


def main() -> None:
    save(slide17(), 'intro-l3-slide17-zones')
    save(slide18(), 'intro-l3-slide18-sectors')


if __name__ == '__main__':
    main()
