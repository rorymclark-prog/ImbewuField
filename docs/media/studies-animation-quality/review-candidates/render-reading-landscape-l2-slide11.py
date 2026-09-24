#!/usr/bin/env python3
"""Render a review-only static candidate for Reading the Landscape L2 slide 11."""
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


def face(size, bold=False):
    return ImageFont.truetype(str(BOLD if bold else REG), size=size)


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


def centered(draw, text, box, font, color, line_height):
    x1, y1, x2, y2 = box
    lines = wrap(draw, text, font, x2 - x1)
    y = y1 + (y2 - y1 - len(lines) * line_height) // 2
    for line in lines:
        width = draw.textbbox((0, 0), line, font=font)[2]
        draw.text((x1 + (x2 - x1 - width) // 2, y), line, font=font, fill=color)
        y += line_height


def header(draw):
    draw.text((96, 45), 'IMBEWUFIELD  ·  MODULE 2', font=face(27, True), fill=OCHRE)
    draw.rounded_rectangle((96, 93, 190, 102), radius=4, fill=OCHRE)
    draw.text((96, 123), 'Protect Frost-Tender Plants', font=ImageFont.truetype(str(SERIF_BOLD), size=70), fill=FOREST)
    draw.line((96, 225, 1824, 225), fill=LINE, width=4)
    draw.text((96, 1020), 'ImbewuField  ·  Imbewu Yoshintso', font=face(22, True), fill=MUTED)
    draw.text((1766, 1020), '11/21', font=face(22, True), fill=MUTED)


def card(draw, box, fill=CARD):
    draw.rounded_rectangle(box, radius=28, fill=fill, outline=LINE, width=4)


def sun(draw, x, y, radius=28):
    draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=OCHRE)
    import math
    for angle in range(0, 360, 45):
        a = math.radians(angle)
        p1 = (x + math.cos(a) * (radius + 12), y + math.sin(a) * (radius + 12))
        p2 = (x + math.cos(a) * (radius + 29), y + math.sin(a) * (radius + 29))
        draw.line((p1, p2), fill=OCHRE, width=7)


def slide():
    im = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(im)
    header(d)

    # A simple field sketch invites learners to record what is true on their own site.
    card(d, (96, 258, 1824, 804))
    d.text((146, 286), 'MARK WHAT YOU OBSERVE ON YOUR SITE', font=face(28, True), fill=BLUE)

    # Winding contours show relative high ground and a low hollow without prescribing a direction.
    d.polygon([(180, 666), (250, 575), (390, 545), (505, 590), (650, 572),
               (825, 612), (980, 581), (1120, 616), (1290, 570), (1460, 602),
               (1705, 560), (1705, 731), (180, 731)], fill=(229, 235, 219))
    for box in [(220, 480, 1655, 735), (285, 510, 1588, 705), (370, 540, 1500, 680)]:
        d.arc(box, 185, 352, fill=(141, 160, 120), width=5)

    # Three observation windows: labels ask the learner to map real shade, not infer a fixed aspect.
    windows = [(390, '8am'), (900, 'Midday'), (1410, '4pm')]
    for x, label in windows:
        sun(d, x, 390, 22)
        d.text((x - 50, 442), label, font=face(30, True), fill=INK)
        d.line((x, 468, x, 535), fill=OCHRE, width=5)
        d.polygon([(x - 11, 521), (x + 11, 521), (x, 541)], fill=OCHRE)
    # A generic tree and its varying shade patch are observational marks, not siting advice.
    d.rectangle((882, 582, 918, 650), fill=(112, 79, 49))
    d.ellipse((842, 530, 958, 612), fill=FOREST)
    for poly in [
        [(918, 615), (1085, 648), (1100, 668), (918, 657)],
        [(918, 615), (1012, 660), (1014, 680), (918, 657)],
        [(918, 615), (965, 667), (960, 687), (918, 657)],
    ]:
        d.polygon(poly, fill=(167, 176, 151))
    d.text((1050, 699), 'shade falls here', font=face(23, True), fill=MUTED)

    # A low hollow is identified by terrain shape; blue marks say cold air may collect there.
    d.ellipse((1370, 620, 1580, 708), fill=(205, 225, 230), outline=BLUE, width=4)
    d.arc((1390, 620, 1560, 688), 0, 180, fill=BLUE, width=5)
    for x, y in [(1420, 672), (1473, 680), (1522, 665)]:
        d.ellipse((x-8, y-8, x+8, y+8), fill=BLUE)
    d.text((1348, 724), 'low hollow: check frost', font=face(23, True), fill=BLUE)

    # These reminders describe risk and observation, without assigning a fixed safe aspect.
    reminders = [
        ('Pawpaw and young citrus are frost-sensitive', PALE_OCHRE, OCHRE),
        ('Cold air may settle in low hollows', PALE_BLUE, BLUE),
        ('Observe local frost, sun and shade before planting', PALE_GREEN, FOREST),
    ]
    x = 96
    width = 552
    for text, fill, accent in reminders:
        card(d, (x, 830, x + width, 972), fill)
        d.rounded_rectangle((x, 850, x + 16, 952), radius=8, fill=accent)
        centered(d, text, (x + 38, 838, x + width - 24, 962), face(31, True), INK, 39)
        x += 576
    return im


def main():
    image = slide()
    image.save(OUT / 'reading-landscape-l2-slide11-candidate.png', optimize=False)
    image.resize((269, 151), Image.Resampling.LANCZOS).save(
        OUT / 'reading-landscape-l2-slide11-fit-269.png', optimize=False)

if __name__ == '__main__':
    main()
