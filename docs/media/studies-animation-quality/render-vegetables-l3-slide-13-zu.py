#!/usr/bin/env python3
"""Render the isiZulu L3 crop cards over the checked-in English source still."""

from __future__ import annotations

import hashlib
import io
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[3]
SOURCE_REVISION = "7c0c30db"
SOURCE_PATH = "public/course-decks/vegetables-staples/en/slide-13.jpg"
SOURCE_SHA256 = "557b3dec511b95c8013d22dce1dff40e94aabf61cf58aa40b0e521f674bc4b01"
OUTPUT_PATH = ROOT / "public/course-decks/vegetables-staples/zu/slide-13.jpg"

PAPER = (244, 240, 228)
GREEN = (31, 77, 43)
AMBER = (192, 122, 30)
CARD_TEXT = (250, 247, 238)
CARD_BODY = (245, 240, 228)
TITLE = "Izitshalo Eziyisisekelo Ezahlukene Zivikela Ezingozini Ezahlukene"
CARDS = (
    ("Ummbila", "Uyomiswa ugcinwe."),
    ("Izimbotyi nezindumba", "Amaprotheni angagcinwa."),
    (
        "Ubhatata",
        "Udinga amanzi ekuqaleni nangesikhathi kwakheka izimpande. "
        "Ukubekezelela ukoma kuqala kancane ngemva kwalokho.",
    ),
    ("Amadumbe", "Umhlabathi omanzi; hlola ukufaneleka kwendawo."),
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
        ["git", "show", f"{SOURCE_REVISION}:{SOURCE_PATH}"],
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
    eyebrow_font = ImageFont.truetype(str(font_path), 22, index=1)
    title_font = ImageFont.truetype(str(font_path), 60, index=0)
    card_title_font = ImageFont.truetype(str(font_path), 58, index=0)
    card_body_font = ImageFont.truetype(str(font_path), 44, index=5)
    draw = ImageDraw.Draw(image)

    # Reuse the committed card layout. Localize its module eyebrow, heading and crop claims.
    draw.rectangle((126, 45, 900, 93), fill=PAPER)
    eyebrow = "IMBEWUFIELD · IMOJULI 5"
    eyebrow_x = 132
    for char in eyebrow:
        draw.text((eyebrow_x, 62), char, font=eyebrow_font, fill=AMBER)
        eyebrow_x += draw.textlength(char, font=eyebrow_font) + 3
    # The longer isiZulu water sentence fits in four lines at this size.
    draw.rectangle((126, 122, 1792, 285), fill=PAPER)
    title_lines = wrap(draw, TITLE, title_font, 1660)
    if len(title_lines) > 2:
        raise SystemExit(f"Localized title exceeds heading space: {title_lines}")
    for index, line in enumerate(title_lines):
        draw.text((132, 137 + index * 72), line, font=title_font, fill=GREEN)

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
        if draw.textlength(title, font=card_title_font) > body_width:
            raise SystemExit(f"Crop name does not fit its card: {title}")
        draw.text((x + 34, y + 7), title, font=card_title_font, fill=CARD_TEXT)
        lines = wrap(draw, body, card_body_font, body_width)
        if len(lines) > 4:
            raise SystemExit(f"Crop claim exceeds its card: {title}: {lines}")
        for line_index, line in enumerate(lines):
            draw.text(
                (x + 34, y + 91 + line_index * 52),
                line,
                font=card_body_font,
                fill=CARD_BODY,
            )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT_PATH, "JPEG", quality=85, optimize=False, progressive=False, subsampling=2)
    print(f"Wrote {OUTPUT_PATH}")
    print(f"Dimensions: {image.width}x{image.height}")
    print(f"Source SHA-256: {digest}")
    print(f"Output SHA-256: {hashlib.sha256(OUTPUT_PATH.read_bytes()).hexdigest()}")
    print("No animation was generated.")


if __name__ == "__main__":
    main()
