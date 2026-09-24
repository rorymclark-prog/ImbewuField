#!/usr/bin/env python3
"""Render the Soil Health isiZulu review deck from its paired narration source."""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
MEDIA = Path(__file__).resolve().parent
OUT = ROOT / "public/course-decks/soil-health/zu"
STAGING = MEDIA / "rendered-png"
QA = MEDIA / "qa"
SOURCE = ROOT / "docs/narration/soil-health.zu.md"
OVERRIDES = MEDIA / "soil-health-zu-art-overrides.json"
BRANDING = MEDIA / "soil-health-zu-branding.json"
W, H = 1920, 1080


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size: int, bold: bool = False):
    candidates = (["/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                  "/Library/Fonts/Arial Bold.ttf"] if bold else []) + [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def wrap(draw, text, face, max_width):
    lines, current = [], ""
    for word in text.split():
        candidate = (current + " " + word).strip()
        if draw.textlength(candidate, font=face) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def main():
    STAGING.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)
    for path in (SOURCE, OVERRIDES, BRANDING):
        if not path.is_file():
            raise SystemExit(f"Missing build input: {path}")

    subprocess.run([
        "node", "scripts/make-lesson-slides.mjs", "soil-health", "zu",
        str(STAGING), "--art-overrides", str(OVERRIDES), "--branding", str(BRANDING),
    ], cwd=ROOT, check=True)

    expected = [STAGING / f"slide-{n:02d}.png" for n in range(1, 21)]
    if not all(path.is_file() for path in expected):
        raise SystemExit("Expected all 20 slide PNGs")
    OUT.mkdir(parents=True, exist_ok=True)
    thumbs = []
    slides = []
    for n, png in enumerate(expected, 1):
        with Image.open(png) as source:
            if source.size != (W, H):
                raise SystemExit(f"Slide {n} has unexpected size {source.size}")
            image = source.convert("RGB")
            jpg = OUT / f"slide-{n:02d}.jpg"
            image.save(jpg, "JPEG", quality=88, optimize=True, progressive=True)
            thumb = image.copy()
            thumb.thumbnail((384, 216), Image.Resampling.LANCZOS)
            slides.append({"slide": n, "path": str(jpg.relative_to(ROOT)),
                           "sha256": sha(jpg), "bytes": jpg.stat().st_size,
                           "pixels": "1920x1080"})
            thumbs.append(thumb)

    contact = Image.new("RGB", (4 * 396, 5 * 245), (238, 233, 220))
    d = ImageDraw.Draw(contact)
    for index, (thumb, row) in enumerate(zip(thumbs, slides)):
        x, y = (index % 4) * 396 + 6, (index // 4) * 245 + 6
        contact.paste(thumb, (x, y))
        d.text((x + 4, y + 219), f"Slide {row['slide']:02d}", font=font(18, True), fill=(32, 25, 15))
    contact.save(QA / "contact-sheet.jpg", quality=90, optimize=True)

    samples = []
    for n in (1, 5, 6, 10, 11, 12, 14, 16, 17, 18, 20):
        jpg = OUT / f"slide-{n:02d}.jpg"
        with Image.open(jpg) as source:
            im = source.convert("RGB")
            im.thumbnail((390, 220), Image.Resampling.LANCZOS)
            sample = QA / f"slide-{n:02d}-390.jpg"
            im.save(sample, quality=92, optimize=True)
            samples.append({"slide": n, "path": str(sample.relative_to(ROOT)),
                            "pixels": f"{im.width}x{im.height}", "sha256": sha(sample)})

    report = {
        "module": "soil-health", "language": "zu", "reviewStatus": "unreviewed-draft",
        "humanLanguageReview": False, "farmingReview": False,
        "source": str(SOURCE.relative_to(ROOT)), "sourceSha256": sha(SOURCE),
        "englishSource": "docs/narration/soil-health.en.md",
        "englishSourceSha256": sha(ROOT / "docs/narration/soil-health.en.md"),
        "slides": slides, "contactSheet": str((QA / "contact-sheet.jpg").relative_to(ROOT)),
        "phoneSamples": samples,
        "audioProof": "docs/media/soil-health/audio-proof/RUN.json",
        "mediaNote": "All slides are stills. Existing art is reused; slide 14 remains still-only.",
    }
    (MEDIA / "verification-zu.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Rendered {len(slides)} isiZulu stills to {OUT}")
    print(f"Contact sheet: {QA / 'contact-sheet.jpg'}")


if __name__ == "__main__":
    main()
