#!/usr/bin/env python3
"""Recompose Market Gardening L2 slide 9 for a readable phone fit.

The original route names and arrow meaning already exist in the English
narration. The three equal rows keep those choices legible without implying a
preferred route, guaranteed sale, price or income.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / "public/course-decks/market-community/en/slide-09.jpg"
WIDTH, HEIGHT = 1920, 1080

CREAM = (245, 241, 232)
CARD = (253, 251, 247)
TEXT = (44, 38, 32)
MUTED = (92, 82, 72)
FOREST = (45, 90, 39)
PALE_GREEN = (232, 240, 229)
SOIL = (92, 64, 51)
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
    draw.text(((WIDTH - (right - left)) / 2 - left, y - top), text,
              font=f, fill=fill)


def farm(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    draw.rounded_rectangle((x, y, x + 240, y + 180), radius=22,
                           fill=PALE_GREEN, outline=BORDER, width=4)
    draw.rectangle((x + 61, y + 65, x + 174, y + 125), fill=(253, 251, 247),
                   outline=SOIL, width=5)
    draw.polygon(((x + 48, y + 68), (x + 117, y + 16), (x + 187, y + 68)),
                 fill=SOIL)
    draw.rectangle((x + 108, y + 83, x + 135, y + 125), fill=FOREST)
    draw.text((x + 66, y + 128), "Farm", font=font(48, True), fill=TEXT)


def stall(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    draw.rectangle((x + 5, y + 45, x + 175, y + 58), fill=SOIL)
    draw.rectangle((x + 18, y + 60, x + 31, y + 139), fill=SOIL)
    draw.rectangle((x + 149, y + 60, x + 162, y + 139), fill=SOIL)
    draw.rectangle((x + 0, y + 32, x + 180, y + 50), fill=FOREST)
    for i in range(4):
        draw.rectangle((x + 8 + i * 43, y + 48, x + 34 + i * 43, y + 76),
                       fill=(253, 251, 247) if i % 2 == 0 else FOREST)
    for i, color in enumerate(((166, 75, 42), (198, 125, 10), FOREST)):
        draw.ellipse((x + 35 + i * 37, y + 94, x + 69 + i * 37, y + 128),
                     fill=color)


def shop(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    draw.rectangle((x + 10, y + 66, x + 174, y + 143), fill=CARD,
                   outline=BORDER, width=5)
    draw.polygon(((x, y + 69), (x + 92, y + 8), (x + 184, y + 69)), fill=FOREST)
    draw.rectangle((x + 34, y + 82, x + 74, y + 117), fill=PALE_GREEN,
                   outline=BORDER, width=3)
    draw.rectangle((x + 111, y + 82, x + 153, y + 143), fill=SOIL)


def household(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    draw.rectangle((x + 20, y + 67, x + 170, y + 145), fill=CARD,
                   outline=BORDER, width=5)
    draw.polygon(((x + 8, y + 69), (x + 94, y + 7), (x + 182, y + 69)),
                 fill=(166, 75, 42))
    draw.rectangle((x + 78, y + 96, x + 113, y + 145), fill=SOIL)
    # Open box with produce marks: the source narration names a box to a household.
    bx, by = x + 193, y + 78
    draw.polygon(((bx, by), (bx + 88, by), (bx + 77, by + 66), (bx + 12, by + 66)),
                 fill=(198, 125, 10), outline=SOIL)
    draw.ellipse((bx + 19, by - 22, bx + 48, by + 10), fill=FOREST)
    draw.ellipse((bx + 43, by - 30, bx + 72, by + 6), fill=(166, 75, 42))


def arrow(draw: ImageDraw.ImageDraw, x1: int, y: int, x2: int) -> None:
    draw.line((x1, y, x2 - 34, y), fill=FOREST, width=13)
    draw.polygon(((x2, y), (x2 - 42, y - 27), (x2 - 42, y + 27)), fill=FOREST)


def main() -> None:
    image = Image.new("RGB", (WIDTH, HEIGHT), CREAM)
    draw = ImageDraw.Draw(image)

    centered(draw, "Watch: Where Surplus Can Go", 37, 82, TEXT, bold=True)

    routes = (
        ("Roadside stall", stall),
        ("Group delivery\nto a shop", shop),
        ("Box delivered to\na household", household),
    )
    row_top = (177, 468, 759)
    for (label, destination), top in zip(routes, row_top):
        draw.rounded_rectangle((72, top, 1848, top + 238), radius=28,
                               fill=CARD, outline=BORDER, width=4)
        farm(draw, 112, top + 29)
        arrow(draw, 402, top + 119, 704)
        destination(draw, 770, top + 48)
        if "\n" in label:
            draw.multiline_text((1080, top + 47), label, font=font(62, True),
                                fill=TEXT, spacing=13)
        else:
            draw.text((1080, top + 76), label, font=font(76, True), fill=TEXT)

    image.save(OUTPUT, format="JPEG", quality=93, subsampling=0, optimize=True)


if __name__ == "__main__":
    main()
