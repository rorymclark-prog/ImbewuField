"""Render a static large-label review candidate for Introduction L3 slide 19.

The source artwork and all instructional wording are existing project assets.
This script makes a review PNG only; it does not change learner registration.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "public/course-decks/intro-permaculture/en/slide-19.jpg"
OUTPUT = ROOT / "docs/media/studies-animation-quality/review-candidates/intro-permaculture-l3-slide19-static.png"

WIDTH = 1920
HEIGHT = 1080
PANEL_TOP = 650
GREEN = (18, 61, 45)
ACCENT = (229, 195, 86)
WHITE = (255, 255, 247)
MUTED = (210, 224, 211)

FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def centered(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont,
             y: int, fill: tuple[int, int, int]) -> int:
    box = draw.textbbox((0, 0), text, font=face)
    text_width = box[2] - box[0]
    if text_width > WIDTH - 120:
        raise ValueError(f"caption does not fit one line: {text!r} ({text_width}px)")
    x = (WIDTH - text_width) // 2
    draw.text((x, y), text, font=face, fill=fill)
    return y + box[3] - box[1]


def main() -> None:
    source = Image.open(SOURCE).convert("RGB")
    # Keep the current still's complete 16:9 landscape and north arrow. Its
    # small original lower caption strip is excluded; the larger panel overlays
    # only the lower part of the same scene so the exported still stays 16:9.
    art = source.crop((0, 0, 1600, 900)).resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    canvas = art.copy()
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, PANEL_TOP, WIDTH, HEIGHT), fill=GREEN)

    y = PANEL_TOP + 15
    header = font(FONT_REGULAR, 46)
    title = font(FONT_BOLD, 76)
    labels = font(FONT_BOLD, 56)
    conditional = font(FONT_REGULAR, 56)
    caution = font(FONT_BOLD, 64)

    y = centered(draw, "Look at this example.", header, y, ACCENT) + 14
    y = centered(draw, "Wind from the north-west", title, y, WHITE) + 22
    y = centered(draw, "The trees and shrubs stand between that wind and the crops.", labels, y, WHITE) + 20
    y = centered(draw, "The shelter can reduce wind speed behind it.", conditional, y, MUTED) + 20
    centered(draw, "Observe your own site. This picture is not a planting plan.", caution, y, WHITE)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUTPUT, format="PNG", optimize=True)
    print(f"{OUTPUT} {canvas.width}x{canvas.height} {OUTPUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
