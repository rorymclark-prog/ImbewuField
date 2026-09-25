#!/usr/bin/env python3
"""Render the corrected static Small Livestock L1 slides 3 and 19.

Both source slides are pinned to the original committed English stills. Run
from any directory with Pillow installed; the source git objects keep reruns
independent of the already-corrected public JPEGs.
"""

from __future__ import annotations

import io
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[4]
OUTPUTS = ROOT / "public/course-decks/small-livestock/en"
SOURCE_COMMIT = "b5aec110"
WIDTH, HEIGHT = 1920, 1080
PAPER = (245, 241, 229)
INK = (52, 47, 37)
FOREST = (28, 79, 48)
OCHRE = (194, 119, 23)

AVENIR = Path("/System/Library/Fonts/Avenir Next.ttc")
GEORGIA_BOLD = Path("/System/Library/Fonts/Supplemental/Georgia Bold.ttf")
ARIAL_BOLD = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
DEJAVU_BOLD = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")


def source_slide(number: int) -> Image.Image:
    path = f"public/course-decks/small-livestock/en/slide-{number:02}.jpg"
    data = subprocess.run(
        ["git", "show", f"{SOURCE_COMMIT}:{path}"],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
    ).stdout
    image = Image.open(io.BytesIO(data)).convert("RGB")
    if image.size != (WIDTH, HEIGHT):
        raise ValueError(f"Pinned slide {number} has unexpected size {image.size}")
    return image


def body_font(size: int) -> ImageFont.FreeTypeFont:
    if AVENIR.exists():
        return ImageFont.truetype(str(AVENIR), size=size, index=8)
    if ARIAL_BOLD.exists():
        return ImageFont.truetype(str(ARIAL_BOLD), size=size)
    return ImageFont.truetype(str(DEJAVU_BOLD), size=size)


def title_font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(GEORGIA_BOLD), size=size)


def wrap(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont,
         width: int) -> list[str]:
    lines: list[str] = []
    line = ""
    for word in text.split():
        candidate = f"{line} {word}".strip()
        if line and draw.textbbox((0, 0), candidate, font=face)[2] > width:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


def render_slide_03() -> Image.Image:
    image = source_slide(3)
    draw = ImageDraw.Draw(image)
    # Only the third learning outcome changes; the first two stay byte-for-byte
    # as rendered in the pinned still.
    draw.rectangle((118, 656, 1660, 782), fill=PAPER)
    draw.ellipse((135, 681, 151, 697), fill=OCHRE)
    text = "You will understand pollination, hive placement, and how livestock move nutrients around a farm."
    face = body_font(42)
    lines = wrap(draw, text, face, 1455)
    if len(lines) > 2:
        raise ValueError(f"Slide 3 outcome needs too many lines: {lines}")
    y = 672
    for line in lines:
        draw.text((180, y), line, font=face, fill=INK)
        y += 45
    return image


def render_slide_19() -> Image.Image:
    image = source_slide(19)
    draw = ImageDraw.Draw(image)

    # Replace the overlong heading with the requested heading in the same
    # Georgia and forest-green treatment, scaled to one line.
    draw.rectangle((0, 0, WIDTH, 206), fill=PAPER)
    heading = "Field Assignment: Draw Where Resources Go"
    heading_size = 68
    while draw.textbbox((0, 0), heading, font=title_font(heading_size))[2] > 1656:
        heading_size -= 1
    draw.text((132, 9), heading, font=title_font(heading_size), fill=FOREST)

    # Redraw the list as one legible block so the longer final instruction fits
    # cleanly while retaining the established bullet, ink and ochre colors.
    draw.rectangle((112, 209, 1790, 880), fill=PAPER)
    bullets = [
        "Walk your smallholding and choose an area where livestock could support another part of the system.",
        "Record what food, scraps, pests, surplus produce, manure, or flowering resources are already present.",
        "Then note what each animal could produce, and what it would need from the farm.",
        "Draw one useful link between livestock and the rest of your farm. Show what comes in and what leaves.",
    ]
    face = body_font(46)
    line_height = 59
    gap = 32
    rows = [wrap(draw, item, face, 1515) for item in bullets]
    total_height = sum(len(row) * line_height for row in rows) + gap * (len(rows) - 1)
    if total_height > 650:
        raise ValueError(f"Slide 19 bullets exceed the available area ({total_height}px)")
    y = 222
    for lines in rows:
        draw.ellipse((135, y + 13, 151, y + 29), fill=OCHRE)
        for line in lines:
            draw.text((180, y), line, font=face, fill=INK)
            y += line_height
        y += gap
    return image


def save(image: Image.Image, number: int) -> None:
    path = OUTPUTS / f"slide-{number:02}.jpg"
    image.save(path, format="JPEG", quality=95, optimize=True, progressive=True)
    print(f"{path.relative_to(ROOT)} {image.width}x{image.height}")


def main() -> None:
    save(render_slide_03(), 3)
    save(render_slide_19(), 19)


if __name__ == "__main__":
    main()
