#!/usr/bin/env python3
"""Render a review-only, phone-readable Small Livestock L2 slide 11 still."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
W, H = 1920, 1080
PAPER = (248, 245, 233)
INK = (25, 54, 39)
TEXT = (40, 42, 36)
MUTED = (105, 105, 89)
GOLD = (190, 123, 28)
GREEN = (53, 100, 64)
RULE = (218, 216, 198)
CARD = (255, 253, 247)


def font(size: int, bold: bool = False):
    paths = [
        '/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/Library/Fonts/Arial Bold.ttf' if bold else '/Library/Fonts/Arial.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    ]
    for path in paths:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    raise FileNotFoundError('Arial or DejaVu Sans is required')


def centered(draw, xy, text, fnt, fill):
    x, y = xy
    box = draw.textbbox((0, 0), text, font=fnt)
    draw.text((x - (box[2] - box[0]) / 2, y - (box[3] - box[1]) / 2 - box[1]), text, font=fnt, fill=fill)


def honeycomb(draw, cx, cy, color):
    # Abstract honeycomb mark; it does not depict or identify a bee or its range.
    r = 38
    for dx, dy in [(-42, 0), (0, 0), (42, 0), (-21, 36), (21, 36)]:
        x, y = cx + dx, cy + dy
        pts = [(x + r * __import__('math').cos(__import__('math').radians(60 * i - 30)),
                y + r * __import__('math').sin(__import__('math').radians(60 * i - 30))) for i in range(6)]
        draw.line(pts + [pts[0]], fill=color, width=5, joint='curve')


def render():
    im = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(im)
    d.text((132, 48), 'IMBEWUFIELD  ·  MODULE 9', font=font(29, True), fill=GOLD)
    d.rounded_rectangle((132, 99, 238, 108), radius=4, fill=GOLD)
    d.text((132, 144), 'South Africa’s Native Honeybees', font=font(64, True), fill=INK)
    d.line((132, 235, 1788, 235), fill=RULE, width=3)

    boxes = [(132, 282, 928, 717), (992, 282, 1788, 717)]
    items = [
        ('Cape honeybee:', 'Western Cape and parts of\nEastern Cape', GOLD),
        ('African honeybee:', 'Central and most of\nsouthern Africa', GREEN),
    ]
    for box, (label, region, color) in zip(boxes, items):
        x1, y1, x2, y2 = box
        d.rounded_rectangle(box, radius=28, fill=CARD, outline=RULE, width=3)
        d.rounded_rectangle((x1, y1, x1 + 18, y2), radius=9, fill=color)
        honeycomb(d, x1 + 115, y1 + 116, color)
        d.text((x1 + 220, y1 + 68), label, font=font(52, True), fill=INK)
        d.multiline_text((x1 + 64, y1 + 232), region, font=font(51, True), fill=TEXT, spacing=17)

    # A single shared action line avoids implying that a broad range map can identify a colony.
    d.rounded_rectangle((132, 775, 1788, 963), radius=28, fill=(239, 235, 216), outline=RULE, width=2)
    d.rounded_rectangle((132, 775, 150, 963), radius=9, fill=GOLD)
    d.text((194, 811), 'Learn from a local beekeeper.', font=font(48, True), fill=INK)
    d.text((194, 875), 'Check rules before moving hives.', font=font(48, True), fill=INK)

    d.text((132, 1014), 'ImbewuField  ·  Imbewu Yohintso', font=font(24, True), fill=MUTED)
    centered(d, (1747, 1028), '11/20', font(24, True), MUTED)
    OUT.mkdir(parents=True, exist_ok=True)
    master = OUT / 'small-livestock-l2-slide11-candidate.jpg'
    fit = OUT / 'small-livestock-l2-slide11-fit-269.png'
    im.save(master, 'JPEG', quality=93, optimize=True, progressive=True)
    im.resize((269, 151), Image.Resampling.LANCZOS).save(fit, 'PNG', optimize=True)


if __name__ == '__main__':
    render()
