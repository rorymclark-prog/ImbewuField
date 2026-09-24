#!/usr/bin/env python3
"""Render review-only static candidates for Water Harvesting L1 slides 2, 3, 4, 5 and 7."""

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
    draw.text((96, 45), 'IMBEWUFIELD  ·  MODULE 3', font=face(27, True), fill=OCHRE)
    draw.rounded_rectangle((96, 93, 190, 102), radius=4, fill=OCHRE)
    draw.text((96, 123), title, font=ImageFont.truetype(str(SERIF_BOLD), size=70), fill=FOREST)
    draw.line((96, 225, 1824, 225), fill=LINE, width=4)
    draw.text((96, 1020), 'ImbewuField  ·  Imbewu Yoshintso', font=face(22, True), fill=MUTED)
    draw.text((1766, 1020), f'{slide}/24', font=face(22, True), fill=MUTED)


def card(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill=CARD) -> None:
    draw.rounded_rectangle(box, radius=28, fill=fill, outline=LINE, width=4)


def label(draw: ImageDraw.ImageDraw, text: str, center: tuple[int, int], color=FOREST) -> None:
    bounds = draw.textbbox((0, 0), text, font=face(38, True))
    draw.text((center[0] - (bounds[2] - bounds[0]) // 2, center[1] - 24),
              text, font=face(38, True), fill=color)


def slide3() -> Image.Image:
    image = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(image)
    header(d, 'Two Swale Designs', 3)

    left, right = (132, 270, 942, 790), (978, 270, 1788, 790)
    card(d, left, PALE_GREEN)
    card(d, right, PALE_BLUE)
    label(d, 'Level contour', (537, 328))
    label(d, 'Slight designed grade', (1383, 328), BLUE)

    # Plan-view contour bands show the swale following one level line.
    for yoff in (510, 565, 620):
        d.arc((260, yoff - 105, 820, yoff + 105), start=190, end=350,
              fill=(132, 151, 119), width=6)
    d.arc((300, 537, 780, 717), start=190, end=350, fill=FOREST, width=13)
    d.rounded_rectangle((410, 735, 660, 780), radius=20, fill=CARD, outline=LINE, width=3)
    label(d, 'Same level', (535, 758), MUTED)

    # Side-view channel slopes only slightly toward a proposed outlet. The
    # outlet is marked for assessment, not shown as safe or approved.
    d.polygon([(1080, 590), (1245, 510), (1400, 468), (1575, 440),
               (1700, 420), (1700, 660), (1080, 660)], fill=(222, 231, 211))
    d.line([(1080, 590), (1245, 510), (1400, 468), (1575, 440), (1700, 420)],
           fill=FOREST, width=8)
    d.line([(1190, 565), (1370, 530), (1538, 508), (1645, 495)],
           fill=BLUE, width=14)
    d.ellipse((1620, 460, 1695, 535), fill=PALE_OCHRE, outline=OCHRE, width=5)
    label(d, '?', (1658, 500), OCHRE)
    centered(d, ['Outlet and receiving point', 'need a site check'],
             (1080, 665, 1690, 760), face(30, True), INK, 38)

    card(d, (132, 825, 1788, 975), PALE_OCHRE)
    centered(d, wrap(d, 'Soil, slope, drainage and storm flow decide which design may suit a site. Ask a trained local adviser before digging.',
                     face(39, True), 1510), (180, 840, 1740, 958),
             face(39, True), INK, 50)
    return image


def slide2() -> Image.Image:
    image = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(image)
    header(d, 'Learning Outcomes', 2)

    # Keep the existing course card's quiet list style, while giving the
    # longer corrected first outcome enough room to wrap without crowding.
    outcomes = [
        'Explain how a level contour swale can slow and spread runoff for infiltration on a suitable site.',
        'Explain why dams need a designed spillway and a site assessment.',
        'Explain what a first-flush diverter does and why tank water still needs a safety check.',
        'Keep greywater away from people, food and drinking-water pipes.',
    ]
    font = face(44, True)
    line_height = 57
    max_width = 1575
    rows = [(wrap(d, text, font, max_width), text) for text in outcomes]
    heights = [len(lines) * line_height for lines, _ in rows]
    gap = 31
    total = sum(heights) + gap * (len(rows) - 1)
    y = 265 + (715 - total) // 2

    for lines, _ in rows:
        d.ellipse((132, y + 8, 148, y + 24), fill=OCHRE)
        for line in lines:
            d.text((180, y), line, font=font, fill=INK)
            y += line_height
        y += gap
    return image


def slide4() -> Image.Image:
    image = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(image)
    header(d, 'A Swale May Let Water Soak In', 4)

    card(d, (132, 265, 1788, 720))
    # Concept cross-section: no roots, water table or promised moisture depth.
    d.polygon([(240, 395), (520, 448), (730, 470), (800, 590),
               (1060, 590), (1120, 474), (1390, 445), (1675, 510),
               (1675, 650), (240, 650)], fill=(190, 149, 91))
    d.line([(240, 395), (520, 448), (730, 470), (800, 590), (1060, 590),
            (1120, 474), (1390, 445), (1675, 510)], fill=FOREST, width=8)
    d.rounded_rectangle((806, 530, 1054, 588), radius=12, fill=(85, 154, 190))
    # Short downward marks suggest possible infiltration, without showing its depth.
    for x in (850, 930, 1010):
        d.line((x, 602, x, 635), fill=BLUE, width=8)
        d.polygon([(x, 642), (x - 12, 624), (x + 12, 624)], fill=BLUE)
    label(d, 'Concept cross-section', (960, 318), MUTED)

    card(d, (132, 760, 1788, 975), PALE_BLUE)
    d.rounded_rectangle((132, 782, 151, 953), radius=9, fill=BLUE)
    centered(d, wrap(d, 'Water may spread and soak in where the soil allows. This picture cannot show how deep moisture reaches on your land.',
                     face(41, True), 1470), (195, 778, 1725, 958),
             face(41, True), INK, 54)
    return image


def slide5() -> Image.Image:
    image = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(image)
    header(d, 'The Downhill Berm', 5)

    card(d, (132, 265, 1788, 710))
    # A berm and tree are shown as a landform concept; no water arrows or roots
    # imply a fixed moisture depth or guaranteed tree response.
    d.polygon([(260, 565), (580, 500), (820, 474), (980, 375),
               (1160, 458), (1370, 490), (1660, 560), (1660, 655),
               (260, 655)], fill=(190, 149, 91))
    d.line([(260, 565), (580, 500), (820, 474), (980, 375),
            (1160, 458), (1370, 490), (1660, 560)], fill=FOREST, width=8)
    d.line((980, 375, 980, 280), fill=(100, 78, 48), width=18)
    d.ellipse((875, 260, 1085, 400), fill=(111, 146, 84), outline=FOREST, width=5)
    label(d, 'Downhill berm', (980, 590), CARD)
    d.line((1220, 482, 1435, 520), fill=OCHRE, width=6)
    d.polygon([(1450, 523), (1427, 509), (1423, 532)], fill=OCHRE)
    label(d, 'Downhill side', (1485, 445), OCHRE)

    card(d, (132, 755, 1788, 975), PALE_GREEN)
    centered(d, wrap(d, 'Trees may draw on nearby soil moisture after rain. The result varies by site.',
                     face(49, True), 1480), (190, 778, 1730, 950),
             face(49, True), INK, 64)
    return image


def slide7() -> Image.Image:
    image = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(image)
    header(d, 'Assess the Overflow Before Digging', 7)

    checks = [
        ('Route', 'Where will excess water travel?'),
        ('Outlet', 'Where will it leave the earthwork?'),
        ('Receiving point', 'Can that place take the storm flow?'),
    ]
    top, height, gap = 270, 160, 24
    for idx, (name, prompt) in enumerate(checks):
        fill, accent = ((PALE_BLUE, BLUE), (PALE_GREEN, FOREST), (PALE_OCHRE, OCHRE))[idx]
        card(d, (132, top, 1788, top + height), fill)
        d.rounded_rectangle((132, top + 15, 151, top + height - 15), radius=8, fill=accent)
        d.ellipse((195, top + 47, 293, top + 145), fill=CARD, outline=accent, width=5)
        centered(d, ['?'], (195, top + 43, 293, top + 143), face(60, True), accent, 74)
        d.text((345, top + 24), name, font=face(39, True), fill=FOREST)
        d.text((345, top + 82), prompt, font=face(36), fill=INK)
        top += height + gap

    card(d, (132, 825, 1788, 985))
    centered(d, wrap(d, 'Use another swale or a dam only if a trained local adviser confirms the route, outlet and receiver can take storm flow without damage.',
                     face(34, True), 1500), (180, 835, 1740, 975),
             face(34, True), INK, 43)
    return image


def save(image: Image.Image, stem: str) -> None:
    image.save(OUT / f'{stem}-candidate.png', format='PNG', optimize=False)
    image.resize((269, 151), Image.Resampling.LANCZOS).save(
        OUT / f'{stem}-fit-269.png', format='PNG', optimize=False)


def main() -> None:
    save(slide2(), 'water-l1-slide02-learning-outcomes')
    save(slide3(), 'water-l1-slide03-swale-designs')
    save(slide4(), 'water-l1-slide04-infiltration-concept')
    save(slide5(), 'water-l1-slide05-downhill-berm')
    save(slide7(), 'water-l1-slide07-overflow-assessment')


if __name__ == '__main__':
    main()
