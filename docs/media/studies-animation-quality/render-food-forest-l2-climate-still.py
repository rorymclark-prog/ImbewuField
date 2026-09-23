#!/usr/bin/env python3
"""Recompose Food Forest L2 slide 10 as a phone-readable static comparison.

The lesson names regions as examples and asks learners to check each plant at
their own site. The paired panels therefore name no species and imply no
universal regional planting list.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / "public/course-decks/food-forest/en/slide-10.jpg"
WIDTH, HEIGHT = 1920, 1080

CREAM = (245, 241, 232)
CARD = (253, 251, 247)
TEXT = (44, 38, 32)
MUTED = (92, 82, 72)
FOREST = (45, 90, 39)
PALE_GREEN = (232, 240, 229)
PALE_BLUE = (233, 241, 246)
SOIL = (92, 64, 51)
BORDER = (217, 208, 193)
GOLD = (190, 119, 16)

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
    left, top, right, _ = draw.textbbox((0, 0), text, font=f)
    draw.text(((WIDTH - (right - left)) / 2 - left, y - top), text,
              font=f, fill=fill)


def sun(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    draw.ellipse((cx - 40, cy - 40, cx + 40, cy + 40), fill=GOLD)
    for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0),
                   (1, -1), (1, 1), (-1, 1), (-1, -1)):
        draw.line((cx + dx * 55, cy + dy * 55,
                   cx + dx * 75, cy + dy * 75), fill=GOLD, width=9)


def snowflake(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    for angle in (0, 60, 120):
        import math
        dx = int(46 * math.cos(math.radians(angle)))
        dy = int(46 * math.sin(math.radians(angle)))
        draw.line((cx - dx, cy - dy, cx + dx, cy + dy),
                  fill=(49, 105, 145), width=9)


def check_card(draw: ImageDraw.ImageDraw, x: int, y: int, w: int,
               label: str) -> None:
    draw.rounded_rectangle((x, y, x + w, y + 104), radius=24,
                           fill=CARD, outline=BORDER, width=4)
    draw.text((x + 32, y + 25), label, font=font(45, True), fill=TEXT)


def main() -> None:
    image = Image.new("RGB", (WIDTH, HEIGHT), CREAM)
    draw = ImageDraw.Draw(image)

    centered(draw, "Match the Species to the Climate", 34, 78, FOREST, True)
    draw.line((72, 137, 1848, 137), fill=BORDER, width=4)

    cards = (
        (72, PALE_BLUE, (49, 105, 145), "Highveld",
         ("Cold-tolerant trees", "and shrubs"), snowflake),
        (984, (250, 243, 230), GOLD, "KZN coast / Lowveld",
         "Warm-climate species", sun),
    )
    for x, fill, accent, region, guidance, icon in cards:
        draw.rounded_rectangle((x, 183, x + 864, 653), radius=30,
                               fill=fill, outline=BORDER, width=4)
        icon(draw, x + 117, 291)
        draw.text((x + 214, 224), region, font=font(66, True), fill=TEXT)
        draw.rounded_rectangle((x + 52, 388, x + 812, 566), radius=23,
                               fill=CARD, outline=BORDER, width=3)
        labels = guidance if isinstance(guidance, tuple) else (guidance,)
        label_font = font(49 if len(labels) > 1 else 52, True)
        line_height = 60
        first_y = 447 - ((len(labels) - 1) * line_height // 2)
        for index, label in enumerate(labels):
            bbox = draw.textbbox((0, 0), label, font=label_font)
            draw.text((x + (864 - (bbox[2] - bbox[0])) / 2 - bbox[0],
                       first_y + index * line_height),
                      label, font=label_font, fill=TEXT)

    centered(draw, "Match every plant to your site.", 690, 50, TEXT, True)
    draw.rounded_rectangle((72, 789, 1848, 929), radius=26,
                           fill=(238, 232, 219), outline=BORDER, width=4)
    centered(draw, "SITE CHECK FACTORS", 809, 30, MUTED, True)
    centered(draw, "Frost     ·     Rainfall     ·     Humidity", 850, 48,
             TEXT, True)
    centered(draw, "Concept diagram — not to scale", 992, 28, MUTED)

    image.save(OUTPUT, format="JPEG", quality=93, subsampling=0, optimize=True)


if __name__ == "__main__":
    main()
