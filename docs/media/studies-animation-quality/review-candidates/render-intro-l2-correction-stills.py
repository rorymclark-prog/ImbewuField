#!/usr/bin/env python3
"""Render static, review-only raster candidates for Introduction L2 slides 11, 12 and 14.

The statements follow the coordinated English narration edits. These files are
not registered course media and do not change the learner deck.
"""
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


def slide11() -> Image.Image:
    image = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(image)
    header(d, 'Catch and Store Energy', 11)
    card(d, (132, 300, 1788, 710))
    d.rounded_rectangle((132, 322, 150, 688), radius=9, fill=FOREST)
    lead = 'Compare the cost and work with the benefit on your own farm.'
    centered(d, wrap(d, lead, face(68, True), 1450), (205, 340, 1715, 670),
             face(68, True), INK, 86)
    d.text((168, 790), 'Rain  ·  Sun  ·  Biomass', font=face(48, True), fill=FOREST)
    d.line((168, 870, 1752, 870), fill=LINE, width=4)
    centered(d, ['Name one thing that arrives on your land free',
                 'and leaves again without being used.'],
             (168, 885, 1752, 990), face(35, True), MUTED, 45)
    return image


def slide12() -> Image.Image:
    image = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(image)
    header(d, 'Use Edges and Value the Marginal', 12)
    card(d, (132, 270, 1788, 590), PALE_GREEN)
    centered(d, wrap(d, 'The edge is where two things meet — a fence line or the strip beside a path.',
                     face(54, True), 1480), (190, 290, 1730, 570),
             face(54, True), INK, 68)
    card(d, (132, 625, 1788, 875))
    centered(d, wrap(d, 'These can be useful places to observe.', face(59, True), 1440),
             (180, 645, 1740, 855), face(59, True), FOREST, 74)
    centered(d, ['Look at what already grows well along yours.',
                 'That is the land telling you something.'],
             (180, 900, 1740, 1000), face(34, True), MUTED, 43)
    return image


def slide14() -> Image.Image:
    image = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(image)
    header(d, 'Integrate Rather Than Segregate', 14)
    card(d, (132, 265, 1788, 410), PALE_GREEN)
    centered(d, ['Put each element where it works for its neighbours.'],
             (160, 280, 1760, 395), face(48, True), FOREST, 60)

    # Three text panels keep the lesson's existing garden, fruit-tree and chicken
    # example while making the safe return-to-food boundary the clearest message.
    panels = ((132, 445, 650, 610), (701, 445, 1219, 610), (1270, 445, 1788, 610))
    labels = ('Garden', 'Fruit trees', 'Chicken run')
    for box, label in zip(panels, labels):
        card(d, box)
        centered(d, [label], (box[0] + 22, box[1] + 18, box[2] - 22, box[3] - 18),
                 face(42, True), INK, 52)

    card(d, (132, 655, 1788, 940), PALE_OCHRE)
    d.rounded_rectangle((132, 673, 150, 922), radius=9, fill=OCHRE)
    statement = ('Keep chickens away from crops being harvested for food. Fresh manure can carry germs.')
    centered(d, wrap(d, statement, face(45, True), 1450),
             (195, 674, 1725, 815), face(45, True), INK, 56)
    advice = 'Ask an extension adviser how to manage the bed safely before edible crops return.'
    centered(d, wrap(d, advice, face(38, True), 1450),
             (195, 817, 1725, 920), face(38, True), FOREST, 49)
    return image


def save(image: Image.Image, stem: str) -> None:
    image.save(OUT / f'{stem}-candidate.png', format='PNG', optimize=False)
    image.resize((269, 151), Image.Resampling.LANCZOS).save(
        OUT / f'{stem}-fit-269.png', format='PNG', optimize=False)


def main() -> None:
    save(slide11(), 'intro-l2-slide11-correction')
    save(slide12(), 'intro-l2-slide12-correction')
    save(slide14(), 'intro-l2-slide14-correction')


if __name__ == '__main__':
    main()
