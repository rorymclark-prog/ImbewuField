#!/usr/bin/env python3
"""Rebuild the English Vegetables L3 slide 13 still from its committed source image.

The source commit is pinned so rerunning this local repair always starts with the same JPEG,
rather than repeatedly editing an already-compressed result.
"""

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
REPLACEMENT = (
    "Sweet potato: some drought tolerance after storage roots form; early water matters. "
    "Young leaves are edible."
)


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

    # Match the existing fourth bullet's position, Avenir face, and palette. The source still's
    # paper pixels decode to this solid JPEG color, so the cleared area has no visible patch edge.
    draw = ImageDraw.Draw(image)
    draw.rectangle((130, 746, 1838, 842), fill=(244, 240, 228))
    draw.ellipse((135, 762, 149, 776), fill=(192, 122, 30))

    font_path = Path("/System/Library/Fonts/Avenir Next.ttc")
    if not font_path.exists():
        raise SystemExit(f"Required local font is missing: {font_path}")
    font = ImageFont.truetype(str(font_path), 34, index=0)
    lines: list[str] = []
    current = ""
    for word in REPLACEMENT.split():
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=font) <= 1620:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    if len(lines) != 2:
        raise SystemExit(f"Expected the replacement bullet to use two lines; got {len(lines)}")

    for index, line in enumerate(lines):
        draw.text((180, 749 + index * 46), line, font=font, fill=(58, 48, 32))

    output = ROOT / RELATIVE_IMAGE
    image.save(output, "JPEG", quality=85, optimize=False, progressive=False, subsampling=2)
    print(f"Wrote {output}")
    print(f"Dimensions: {image.width}x{image.height}")
    print(f"SHA-256: {hashlib.sha256(output.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    main()
