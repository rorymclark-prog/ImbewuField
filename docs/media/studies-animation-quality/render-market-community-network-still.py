#!/usr/bin/env python3
"""Recompose Market Gardening L3 slide 14 for the learner's phone-width still.

The English narration already names the four kinds of sharing. This static
concept diagram makes those words visible without implying a guaranteed
harvest, sale or income.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / "public/course-decks/market-community/en/slide-14.jpg"
WIDTH, HEIGHT = 1920, 1080

CREAM = (245, 241, 232)
CARD = (253, 251, 247)
TEXT = (44, 38, 32)
MUTED = (92, 82, 72)
FOREST = (45, 90, 39)
PALE_GREEN = (232, 240, 229)
SOIL = (92, 64, 51)
BORDER = (217, 208, 193)
GOLD = (198, 125, 10)
RUST = (166, 75, 42)

FONT_REGULAR = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
FONT_BOLD = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
if not FONT_REGULAR.exists():
    FONT_REGULAR = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
if not FONT_BOLD.exists():
    FONT_BOLD = Path("/System/Library/Fonts/Supplemental/Arial Black.ttf")
if not FONT_BOLD.exists():
    FONT_BOLD = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)


def centered(draw: ImageDraw.ImageDraw, text: str, y: int, size: int,
             fill: tuple[int, int, int], bold: bool = False) -> None:
    face = font(size, bold)
    left, top, right, _ = draw.textbbox((0, 0), text, font=face)
    draw.text(((WIDTH - (right - left)) / 2 - left, y - top), text,
              font=face, fill=fill)


def seed_icon(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    draw.ellipse((x - 35, y - 22, x + 35, y + 22), fill=GOLD, outline=SOIL, width=4)
    draw.line((x - 24, y + 16, x + 23, y - 16), fill=SOIL, width=4)


def tools_icon(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    draw.line((x - 29, y + 28, x + 23, y - 24), fill=SOIL, width=13)
    draw.line((x + 17, y - 30, x + 36, y - 11), fill=FOREST, width=12)
    draw.line((x + 36, y - 30, x + 17, y - 11), fill=FOREST, width=12)


def skills_icon(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    draw.ellipse((x - 10, y - 39, x + 10, y - 19), fill=GOLD)
    draw.rounded_rectangle((x - 25, y - 10, x + 25, y + 37), radius=16, fill=FOREST)
    draw.line((x - 44, y - 1, x - 23, y + 16), fill=SOIL, width=10)
    draw.line((x + 44, y - 1, x + 23, y + 16), fill=SOIL, width=10)


def transport_icon(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    draw.rounded_rectangle((x - 53, y - 22, x + 29, y + 20), radius=7, fill=RUST)
    draw.polygon(((x + 29, y - 13), (x + 49, y - 13), (x + 63, y + 3),
                  (x + 63, y + 20), (x + 29, y + 20)), fill=GOLD)
    for wx in (x - 29, x + 39):
        draw.ellipse((wx - 12, y + 11, wx + 12, y + 35), fill=SOIL)
        draw.ellipse((wx - 5, y + 18, wx + 5, y + 28), fill=CARD)


def main() -> None:
    image = Image.new("RGB", (WIDTH, HEIGHT), CREAM)
    draw = ImageDraw.Draw(image)

    centered(draw, "Watch: How Neighbours", 25, 68, TEXT, True)
    centered(draw, "Strengthen a Harvest", 96, 68, TEXT, True)
    centered(draw, "A group can share", 174, 54, MUTED)

    rows = (
        ("Seed", seed_icon),
        ("Tools", tools_icon),
        ("Skills", skills_icon),
        ("Transport", transport_icon),
    )
    tops = (245, 418, 591, 764)
    for (label, icon), top in zip(rows, tops):
        draw.rounded_rectangle((118, top, 1802, top + 142), radius=28,
                               fill=CARD, outline=BORDER, width=4)
        draw.ellipse((164, top + 17, 286, top + 125), fill=PALE_GREEN)
        icon(draw, 225, top + 70)
        draw.text((355, top + 17), label, font=font(92, True), fill=TEXT)
        draw.rounded_rectangle((1210, top + 49, 1718, top + 95), radius=22,
                               fill=PALE_GREEN)
        draw.line((1240, top + 72, 1688, top + 72), fill=FOREST, width=8)
        for node_x in (1272, 1380, 1488, 1596, 1674):
            draw.ellipse((node_x - 10, top + 62, node_x + 10, top + 82), fill=FOREST)

    centered(draw, "Local food network", 929, 68, FOREST, True)
    centered(draw, "Concept diagram — not to scale", 1017, 42, MUTED)
    image.save(OUTPUT, format="JPEG", quality=93, subsampling=0, optimize=True)


if __name__ == "__main__":
    main()
