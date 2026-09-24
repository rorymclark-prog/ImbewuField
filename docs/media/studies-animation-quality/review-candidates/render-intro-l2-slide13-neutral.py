#!/usr/bin/env python3
"""Render a static, review-only candidate for Introduction L2 slide 13."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
SOURCE = ROOT / 'docs/media/studies-illustrated-release/art/vegetables-staples/three-sisters.jpg'
W, H = 1920, 1080
PAPER = (247, 245, 239)
CARD = (255, 254, 250)
INK = (31, 36, 32)
FOREST = (31, 77, 43)
OCHRE = (192, 122, 30)
MUTED = (115, 103, 87)
LINE = (228, 220, 198)
PALE = (250, 242, 225)
REG = Path('/System/Library/Fonts/Supplemental/Arial.ttf')
BOLD = Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
if not REG.exists():
    REG = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
if not BOLD.exists():
    BOLD = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')


def face(size, bold=False):
    return ImageFont.truetype(str(BOLD if bold else REG), size=size)


def wrapped(draw, text, font, max_width):
    lines, line = [], ''
    for word in text.split():
        candidate = f'{line} {word}'.strip()
        if line and draw.textbbox((0, 0), candidate, font=font)[2] > max_width:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


def centered(draw, lines, box, font, fill, line_height):
    x1, y1, x2, y2 = box
    y = y1 + (y2 - y1 - len(lines) * line_height) // 2
    for line in lines:
        b = draw.textbbox((0, 0), line, font=font)
        draw.text((x1 + (x2 - x1 - (b[2] - b[0])) // 2, y), line, font=font, fill=fill)
        y += line_height


def image_crop(source, box, target):
    crop = source.crop(box)
    tw, th = target
    scale = max(tw / crop.width, th / crop.height)
    crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
    left = (crop.width - tw) // 2
    top = (crop.height - th) // 2
    return crop.crop((left, top, left + tw, top + th))


def render():
    image = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(image)
    d.text((96, 45), 'IMBEWUFIELD  ·  MODULE 1', font=face(27, True), fill=OCHRE)
    d.rounded_rectangle((96, 93, 190, 102), radius=4, fill=OCHRE)
    d.text((96, 123), 'Use and Value Diversity', font=face(70, True), fill=FOREST)
    d.line((96, 225, 1824, 225), fill=LINE, width=4)

    # Crop the existing course artwork to show planting diversity without its person;
    # no crop outcome or storm comparison is presented.
    source = Image.open(SOURCE).convert('RGB')
    art = image_crop(source, (0, 30, 1200, 920), (790, 600))
    mask = Image.new('L', art.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 789, 599), radius=25, fill=255)
    image.paste(art, (96, 280), mask)
    d.rounded_rectangle((96, 280, 886, 880), radius=25, outline=LINE, width=4)
    d.text((116, 900), 'Different crops in one planting', font=face(31, True), fill=FOREST)

    d.rounded_rectangle((940, 280, 1824, 880), radius=30, fill=CARD, outline=LINE, width=4)
    d.rounded_rectangle((984, 326, 1050, 334), radius=4, fill=OCHRE)
    d.text((984, 360), 'HAIL AND MAIZE', font=face(28, True), fill=OCHRE)
    maize = 'Hail injury to maize depends on the storm and the crop’s growth stage.'
    lines = wrapped(d, maize, face(53, True), 790)
    centered(d, lines, (984, 420, 1780, 650), face(53, True), INK, 68)
    d.line((984, 690, 1780, 690), fill=LINE, width=3)
    detail = 'Diversity is a design principle. It does not promise that any crop will survive a storm.'
    detail_lines = wrapped(d, detail, face(32, True), 790)
    centered(d, detail_lines, (984, 716, 1780, 830), face(32, True), MUTED, 43)

    d.text((96, 1020), 'ImbewuField  ·  Imbewu Yoshintso', font=face(22, True), fill=MUTED)
    d.text((1766, 1020), '13/22', font=face(22, True), fill=MUTED)
    return image


def main():
    image = render()
    image.save(OUT / 'intro-l2-slide13-neutral-candidate.png', format='PNG', optimize=False)
    image.resize((269, 151), Image.Resampling.LANCZOS).save(
        OUT / 'intro-l2-slide13-neutral-fit-269.png', format='PNG', optimize=False)


if __name__ == '__main__':
    main()
