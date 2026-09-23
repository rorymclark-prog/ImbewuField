#!/usr/bin/env python3
"""Render the English Vegetables L3 slide 13 crop cards from its committed source still."""

from __future__ import annotations

import hashlib
import io
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[3]
RELATIVE_IMAGE = Path("public/course-decks/vegetables-staples/en/slide-13.jpg")
SOURCE_REVISION = "dcae8bf37ae8181bf767261467154078cf7b8a72"
SOURCE_SHA256 = "cad8ef3de3d30c36bba7c3812fc95dd1630dde600f9fe40ec7a371841e573be4"

PAPER = (244, 240, 228)
GREEN = (31, 77, 43)
AMBER = (192, 122, 30)
CARD_TEXT = (250, 247, 238)
CARD_BODY = (245, 240, 228)

CARDS = (
    ("Maize", "Stores dry."),
    ("Beans & cowpeas", "Storable protein."),
    (
        "Sweet potato",
        "Water early; some drought tolerance after storage roots form.",
    ),
    ("Amadumbe", "Wetter ground; check local fit."),
)


def wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def main() -> None:
    source = subprocess.run(
        ["git", "show", f"{SOURCE_REVISION}:{RELATIVE_IMAGE.as_posix()}"],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
    ).stdout
    digest = hashlib.sha256(source).hexdigest()
    if digest != SOURCE_SHA256:
        raise SystemExit(f"Pinned source image hash changed: {digest}")

    image = Image.open(io.BytesIO(source)).convert("RGB")
    if image.size != (1920, 1080):
        raise SystemExit(f"Unexpected source dimensions: {image.size}")

    font_path = Path("/System/Library/Fonts/Avenir Next.ttc")
    if not font_path.exists():
        raise SystemExit(f"Required local font is missing: {font_path}")
    title_font = ImageFont.truetype(str(font_path), 66, index=0)
    body_font = ImageFont.truetype(str(font_path), 58, index=5)

    draw = ImageDraw.Draw(image)
    # Clear only the former bullet area, leaving the original heading, rule and footer untouched.
    draw.rectangle((126, 328, 1792, 985), fill=PAPER)

    card_width = 814
    card_height = 316
    x_positions = (132, 974)
    y_positions = (330, 668)
    body_width = 746

    for index, (title, body) in enumerate(CARDS):
        x = x_positions[index % 2]
        y = y_positions[index // 2]
        draw.rounded_rectangle(
            (x, y, x + card_width, y + card_height),
            radius=18,
            fill=GREEN,
            outline=AMBER,
            width=4,
        )

        title_width = int(draw.textlength(title, font=title_font))
        if title_width > body_width:
            raise SystemExit(f"Crop name does not fit its card: {title}")
        draw.text((x + 34, y + 7), title, font=title_font, fill=CARD_TEXT)

        lines = wrap(draw, body, body_font, body_width)
        if len(lines) > 3:
            raise SystemExit(f"Crop claim exceeds its card: {title}: {lines}")
        for line_index, line in enumerate(lines):
            if draw.textlength(line, font=body_font) > body_width:
                raise SystemExit(f"Crop claim line exceeds its card: {title}: {line}")
            draw.text(
                (x + 34, y + 91 + line_index * 63),
                line,
                font=body_font,
                fill=CARD_BODY,
            )

    output = ROOT / RELATIVE_IMAGE
    image.save(output, "JPEG", quality=85, optimize=False, progressive=False, subsampling=2)
    print(f"Wrote {output}")
    print(f"Dimensions: {image.width}x{image.height}")
    print("Whole-slide text at 269px: crop names 9.3px; supporting text 8.1px")
    print(f"SHA-256: {hashlib.sha256(output.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    main()
