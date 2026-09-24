#!/usr/bin/env python3
"""Reflow Food Forest L3 slide 17's existing three statements for phone fit."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / "public/course-decks/food-forest/en/slide-17.jpg"
WIDTH, HEIGHT = 1920, 1080

PAPER = (248, 245, 233)
CARD = (253, 251, 247)
INK = (25, 54, 39)
BODY = (44, 38, 32)
MUTED = (92, 82, 72)
GREEN = (45, 90, 39)
GOLD = (190, 119, 16)
BORDER = (217, 208, 193)

REGULAR_CANDIDATES = (
    Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
)
BOLD_CANDIDATES = (
    Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
)

TITLE = "Adjust as the Trees Grow"
STATEMENTS = (
    "Watch how shade, roots and available water affect neighbouring plants.",
    "Comfrey and wild garlic appear in the original underplanting example; check their local suitability before use.",
    "Prune or thin support plants when needed, using methods suited to each species. Suitable clean cuttings can return as mulch. Do not wait for a fixed year if competition is already harming plants.",
)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = BOLD_CANDIDATES if bold else REGULAR_CANDIDATES
    path = next((item for item in candidates if item.exists()), None)
    if path is None:
        raise FileNotFoundError("Arial or DejaVu Sans is required to render this still")
    return ImageFont.truetype(str(path), size)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont,
              max_width: int) -> list[str]:
    lines: list[str] = []
    line = ""
    for word in text.split():
        candidate = f"{line} {word}".strip()
        if line and draw.textlength(candidate, font=face) > max_width:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


def main() -> None:
    image = Image.new("RGB", (WIDTH, HEIGHT), PAPER)
    draw = ImageDraw.Draw(image)
    draw.text((72, 30), "IMBEWUFIELD · MODULE 8", font=font(26, True), fill=GOLD)
    draw.rounded_rectangle((72, 70, 164, 78), radius=4, fill=GOLD)
    draw.text((72, 91), TITLE, font=font(72, True), fill=GREEN)
    draw.line((72, 185, 1848, 185), fill=BORDER, width=4)

    body_face = font(58, True)
    bullet_x = 120
    text_x = 190
    text_width = 1575
    line_height = 68
    gap = 16
    y = 207

    for index, statement in enumerate(STATEMENTS):
        lines = wrap_text(draw, statement, body_face, text_width)
        card_height = len(lines) * line_height + 40
        draw.rounded_rectangle((72, y, 1848, y + card_height), radius=24,
                               fill=CARD, outline=BORDER, width=3)
        draw.rounded_rectangle((72, y, 88, y + card_height), radius=8,
                               fill=GREEN if index != 1 else GOLD)
        center_y = y + card_height // 2
        draw.ellipse((bullet_x - 11, center_y - 11, bullet_x + 11, center_y + 11),
                     fill=GOLD)
        text_y = y + 20
        for line in lines:
            draw.text((text_x, text_y), line, font=body_face, fill=BODY)
            text_y += line_height
        y += card_height + gap

    draw.text((72, 1037), "ImbewuField · Imbewu Yohsintso",
              font=font(22, True), fill=MUTED)
    draw.text((1752, 1035), "17/20", font=font(24, True), fill=MUTED)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, "JPEG", quality=93, subsampling=0, optimize=True)


if __name__ == "__main__":
    main()
