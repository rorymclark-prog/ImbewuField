#!/usr/bin/env python3
"""Render review-only static candidates for Introduction L1 slides 7 and 8."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
W, H = 1920, 1080

# ImbewuField's warm paper, forest green and ochre editorial palette.
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


def face(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(BOLD if bold else REGULAR), size=size)


def wrapped(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont,
            max_width: int) -> list[str]:
    lines: list[str] = []
    current = ''
    for word in text.split():
        candidate = f'{current} {word}'.strip()
        if current and draw.textbbox((0, 0), candidate, font=f)[2] > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def centered_lines(draw: ImageDraw.ImageDraw, lines: list[str], x: int, y: int,
                   width: int, height: int, f: ImageFont.FreeTypeFont,
                   fill: tuple[int, int, int], line_height: int) -> None:
    total = len(lines) * line_height
    cy = y + (height - total) // 2 - 2
    for line in lines:
        box = draw.textbbox((0, 0), line, font=f)
        draw.text((x + (width - (box[2] - box[0])) // 2, cy), line, font=f, fill=fill)
        cy += line_height


def header(draw: ImageDraw.ImageDraw, title: str, slide: str) -> None:
    draw.text((132, 50), 'IMBEWUFIELD  ·  MODULE 1', font=face(26, True), fill=OCHRE)
    draw.rounded_rectangle((132, 100, 224, 108), radius=4, fill=OCHRE)
    draw.text((132, 133), title, font=face(68, True), fill=FOREST)
    draw.line((132, 230, 1788, 230), fill=LINE, width=4)
    draw.text((132, 1019), 'ImbewuField  ·  Imbewu Yoshintso', font=face(22, True), fill=MUTED)
    draw.text((1714, 1019), slide, font=face(22, True), fill=MUTED)


def slide7() -> Image.Image:
    image = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(image)
    header(d, 'Before Sharing Borehole Water', '7/22')
    d.text((132, 254), 'Check both conditions before agreeing to share.',
           font=face(34, True), fill=INK)

    # Ordered checks, followed by an explicit decision gate.
    cards = [(132, 320, 620, 610), (702, 320, 1190, 610)]
    labels = ['Check sharing is allowed.', 'Check the source can serve all users.']
    for i, ((x1, y1, x2, y2), label) in enumerate(zip(cards, labels), start=1):
        d.rounded_rectangle((x1, y1, x2, y2), radius=30, fill=CARD, outline=LINE, width=4)
        d.ellipse((x1 + 34, y1 + 32, x1 + 112, y1 + 110), fill=FOREST)
        n = str(i)
        nb = d.textbbox((0, 0), n, font=face(46, True))
        d.text((x1 + 73 - (nb[2] - nb[0]) // 2, y1 + 43), n, font=face(46, True), fill=CARD)
        check_font = face(43, True)
        lines = wrapped(d, label, check_font, x2 - x1 - 76)
        centered_lines(d, lines, x1 + 36, y1 + 118, x2 - x1 - 72, 155,
                       check_font, INK, 50)

    # Join the ordered checks at a visible gate.
    d.line((620, 465, 670, 465), fill=OCHRE, width=8)
    d.polygon([(670, 451), (692, 465), (670, 479)], fill=OCHRE)
    d.line((1190, 465, 1262, 465), fill=OCHRE, width=8)
    d.polygon([(1262, 451), (1284, 465), (1262, 479)], fill=OCHRE)
    d.rounded_rectangle((1288, 350, 1788, 580), radius=30,
                        fill=PALE_GREEN, outline=FOREST, width=4)
    centered_lines(d, ['BOTH CHECKS', 'HOLD?'], 1320, 380, 436, 160,
                   face(51, True), FOREST, 64)

    # Two labeled outcomes make the conditional logic unmistakable.
    d.line((1538, 580, 1538, 650), fill=FOREST, width=7)
    d.line((520, 650, 1538, 650), fill=FOREST, width=7)
    d.line((520, 650, 520, 700), fill=OCHRE, width=7)
    d.line((1300, 650, 1300, 700), fill=FOREST, width=7)
    d.rounded_rectangle((132, 700, 908, 930), radius=28,
                        fill=PALE_OCHRE, outline=OCHRE, width=4)
    d.text((176, 726), 'NO  /  NOT CLEAR', font=face(30, True), fill=OCHRE)
    centered_lines(d, ['Pause and check before', 'sharing.'], 166, 770, 708, 126,
                   face(45, True), INK, 58)
    d.rounded_rectangle((950, 700, 1788, 930), radius=28,
                        fill=CARD, outline=FOREST, width=4)
    d.text((994, 726), 'YES  ·  BOTH CHECKS HOLD', font=face(30, True), fill=FOREST)
    d.ellipse((994, 797, 1064, 867), fill=FOREST)
    d.text((1015, 805), '3', font=face(42, True), fill=CARD)
    centered_lines(d, ['Agree fairly and', 'keep monitoring.'], 1070, 770, 674, 126,
                   face(48, True), INK, 60)
    return image


def slide7_simple() -> Image.Image:
    """Simpler large-label decision path for a phone-fit review variant."""
    image = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(image)
    header(d, 'Before Sharing Borehole Water', '7/22')
    d.rounded_rectangle((132, 300, 912, 535), radius=32,
                        fill=CARD, outline=LINE, width=4)
    d.rounded_rectangle((1008, 300, 1788, 535), radius=32,
                        fill=CARD, outline=LINE, width=4)
    centered_lines(d, ['Sharing allowed?'], 174, 330, 696, 170,
                   face(66, True), FOREST, 82)
    centered_lines(d, ['Enough for all users?'], 1050, 330, 696, 170,
                   face(66, True), FOREST, 82)

    # Both questions visibly converge on one decision gate.
    d.line((522, 535, 522, 585), fill=OCHRE, width=8)
    d.line((1398, 535, 1398, 585), fill=OCHRE, width=8)
    d.line((522, 585, 1398, 585), fill=OCHRE, width=8)
    d.line((960, 585, 960, 620), fill=OCHRE, width=8)
    d.rounded_rectangle((560, 620, 1360, 720), radius=30,
                        fill=PALE_GREEN, outline=FOREST, width=4)
    centered_lines(d, ['BOTH YES?'], 592, 625, 736, 88,
                   face(48, True), FOREST, 56)

    # Outcomes are stated directly, without asserting a specific legal route.
    d.line((960, 720, 960, 760), fill=FOREST, width=8)
    d.line((520, 760, 1400, 760), fill=FOREST, width=8)
    d.line((520, 760, 520, 790), fill=FOREST, width=8)
    d.line((1400, 760, 1400, 790), fill=OCHRE, width=8)
    d.rounded_rectangle((132, 790, 908, 950), radius=28,
                        fill=CARD, outline=FOREST, width=4)
    d.rounded_rectangle((1012, 790, 1788, 950), radius=28,
                        fill=PALE_OCHRE, outline=OCHRE, width=4)
    centered_lines(d, ['If both yes: agree fairly', 'and monitor'],
                   166, 802, 708, 136, face(43, True), INK, 54)
    centered_lines(d, ['If unsure: pause', 'and check'],
                   1046, 802, 708, 136, face(43, True), INK, 54)
    return image


def slide8() -> Image.Image:
    image = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(image)
    header(d, 'When the Answer Is Not Written Down', '8/22')
    statements = (
        'This is what the ethics are actually for.',
        'A neighbour asks to graze cattle after a drought.',
        'The ethics help you weigh the choices and explain your decision. Check the rules and ask permission where it is needed.',
        'Build these three into how you think before you build anything on the ground.',
    )
    top, left, right = 252, 132, 1788
    card_h, gap = 174, 14
    body = face(48, True)
    for statement in statements:
        d.rounded_rectangle((left, top, right, top + card_h), radius=26,
                            fill=CARD, outline=LINE, width=3)
        d.rounded_rectangle((left, top + 12, left + 14, top + card_h - 12),
                            radius=7, fill=FOREST)
        d.ellipse((158, top + card_h // 2 - 10, 178, top + card_h // 2 + 10), fill=OCHRE)
        lines = wrapped(d, statement, body, right - 250)
        centered_lines(d, lines, 205, top + 10, right - 260, card_h - 20,
                       body, INK, 61)
        top += card_h + gap
    return image


def slide8_key_card() -> Image.Image:
    """Large-type review variant showing only the approved core cue."""
    image = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(image)
    header(d, 'When the Answer Is Not Written Down', '8/22')
    d.rounded_rectangle((132, 300, 1788, 860), radius=34,
                        fill=CARD, outline=LINE, width=4)
    d.rounded_rectangle((132, 315, 150, 845), radius=9, fill=FOREST)
    statements = (
        'Use the ethics to weigh a decision.',
        'Check the rules and ask permission where needed.',
    )
    key_font = face(68, True)
    first = wrapped(d, statements[0], key_font, 1450)
    second = wrapped(d, statements[1], key_font, 1450)
    centered_lines(d, first, 205, 380, 1500, 150, key_font, INK, 82)
    d.line((280, 545, 1640, 545), fill=LINE, width=4)
    centered_lines(d, second, 205, 570, 1500, 220, key_font, FOREST, 82)
    return image


def save(image: Image.Image, stem: str) -> None:
    image.save(OUT / f'{stem}-candidate.png', format='PNG', optimize=False)
    image.resize((269, 151), Image.Resampling.LANCZOS).save(
        OUT / f'{stem}-fit-269.png', format='PNG', optimize=False)


def main() -> None:
    save(slide7(), 'intro-l1-slide07-static')
    save(slide7_simple(), 'intro-l1-slide07-simple')
    save(slide8(), 'intro-l1-slide08-static')
    save(slide8_key_card(), 'intro-l1-slide08-key-card')


if __name__ == '__main__':
    main()
