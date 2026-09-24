#!/usr/bin/env python3
"""Render the static Market L1 record still with labels legible at phone width.

The source diagram's five-column table and long caption became unreadable when
the whole 16:9 slide was fitted into a 390 px learner player. The spoken script
already explains the season review; this still keeps the four recorded harvest
destinations prominent without inventing an amount or outcome.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / "public/course-decks/market-community/en/slide-04.jpg"
WIDTH, HEIGHT = 1920, 1080

CREAM = (245, 241, 232)
CARD = (253, 251, 247)
TEXT = (44, 38, 32)
MUTED = (92, 82, 72)
FOREST = (45, 90, 39)
PALE_GREEN = (232, 240, 229)
SOIL = (92, 64, 51)
GOLD = (198, 125, 10)
RUST = (166, 75, 42)
BORDER = (217, 208, 193)

FONT_REGULAR = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
FONT_BOLD = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
if not FONT_BOLD.exists():
    FONT_BOLD = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
if not FONT_REGULAR.exists():
    FONT_REGULAR = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)


def centered(draw: ImageDraw.ImageDraw, text: str, y: int, size: int,
             fill: tuple[int, int, int], bold: bool = False) -> None:
    f = font(size, bold)
    left, top, right, bottom = draw.textbbox((0, 0), text, font=f)
    draw.text(((WIDTH - (right - left)) / 2 - left, y - top), text, font=f, fill=fill)


def basket(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    # Reuse the existing lesson's simple basket motif at a larger phone-safe size.
    draw.ellipse((cx - 54, cy - 48, cx - 9, cy + 1), fill=RUST)
    draw.ellipse((cx - 13, cy - 59, cx + 35, cy + 2), fill=FOREST)
    draw.ellipse((cx + 17, cy - 45, cx + 58, cy + 3), fill=GOLD)
    draw.polygon([(cx - 74, cy - 14), (cx + 74, cy - 14),
                  (cx + 56, cy + 68), (cx - 56, cy + 68)], fill=GOLD)
    draw.line((cx - 75, cy - 14, cx + 75, cy - 14), fill=SOIL, width=10)


def main() -> None:
    image = Image.new("RGB", (WIDTH, HEIGHT), CREAM)
    draw = ImageDraw.Draw(image)

    centered(draw, "Watch: What the Farm Record Shows", 47, 91, TEXT, bold=True)
    centered(draw, "Record where each harvest goes", 160, 69, MUTED)

    labels = ("Family food", "Sales", "Gifts", "Compost")
    y_positions = (270, 442, 614, 786)
    for label, y in zip(labels, y_positions):
        draw.rounded_rectangle((100, y, 1820, y + 150), radius=32,
                               fill=CARD, outline=BORDER, width=3)
        draw.rounded_rectangle((100, y, 120, y + 150), radius=10, fill=FOREST)
        draw.ellipse((157, y + 18, 274, y + 135), fill=PALE_GREEN)
        basket(draw, 216, y + 80)
        draw.line((337, y + 75, 480, y + 75), fill=FOREST, width=13)
        draw.polygon(((480, y + 75), (442, y + 47), (442, y + 103)), fill=FOREST)
        draw.text((556, y + 10), label, font=font(116, bold=True), fill=TEXT)

    centered(draw, "Season overview", 966, 83, FOREST, bold=True)
    image.save(OUTPUT, format="JPEG", quality=93, subsampling=0, optimize=True)


if __name__ == "__main__":
    main()
