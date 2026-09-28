#!/usr/bin/env python3
"""Render the existing Sesotho Food Forest source-paired review deck."""
from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
MEDIA = Path(__file__).resolve().parent
OUT = ROOT / "public/course-decks/food-forest/st"
QA = MEDIA / "qa"
PAIRED = ROOT / "docs/narration/food-forest.st.paired-draft.json"
ENGLISH = ROOT / "docs/narration/food-forest.en.md"
W, H = 1440, 5400
SLIDES = 20


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="food-forest-st-") as temp:
        generated = Path(temp) / "slides"
        subprocess.run([
            "node", "scripts/make-lesson-slides.mjs", "food-forest", "st",
            str(generated), "--paired-draft", str(PAIRED),
        ], cwd=ROOT, check=True)

        expected = [generated / f"slide-{n:02d}.png" for n in range(1, SLIDES + 1)]
        if not all(path.is_file() for path in expected):
            raise SystemExit("Expected all 20 generated paired frames")

        thumbs: list[Image.Image] = []
        rows = []
        for n, png in enumerate(expected, 1):
            with Image.open(png) as source:
                if source.size != (W, H):
                    raise SystemExit(f"Slide {n} has unexpected size {source.size}")
                image = source.convert("RGB")
                output = OUT / f"slide-{n:02d}.webp"
                image.save(output, "WEBP", quality=88, method=6)
                thumb = image.copy()
                thumb.thumbnail((140, 525), Image.Resampling.LANCZOS)
                thumbs.append(thumb)
                rows.append({
                    "slide": n,
                    "path": str(output.relative_to(ROOT)),
                    "pixels": f"{W}x{H}",
                    "bytes": output.stat().st_size,
                    "sha256": sha(output),
                })

        contact = Image.new("RGB", (5 * 160, 4 * 555), (238, 233, 220))
        for index, (thumb, row) in enumerate(zip(thumbs, rows)):
            x, y = (index % 5) * 160 + 10, (index // 5) * 555 + 8
            contact.paste(thumb, (x, y))
            draw = ImageDraw.Draw(contact)
            draw.text((x, y + thumb.height + 4), f"Slide {row['slide']:02d}",
                      font=ImageFont.load_default(), fill=(32, 25, 15))
        contact_path = QA / "st-paired-contact-sheet.jpg"
        contact.save(contact_path, quality=92, optimize=True)

        phone_samples = []
        for n in (4, 8):
            path = OUT / f"slide-{n:02d}.webp"
            with Image.open(path) as source:
                sample = source.convert("RGB").resize((390, 1463), Image.Resampling.LANCZOS)
                sample_path = QA / f"st-slide-{n:02d}-390.jpg"
                sample.save(sample_path, quality=92, optimize=True)
                phone_samples.append({
                    "slide": n,
                    "path": str(sample_path.relative_to(ROOT)),
                    "pixels": "390x1463",
                    "sha256": sha(sample_path),
                })

    report = {
        "module": "food-forest",
        "language": "st",
        "reviewStatus": "unreviewed-machine-draft",
        "humanLanguageReview": False,
        "localFarmingReview": False,
        "narration": None,
        "pairedSource": str(PAIRED.relative_to(ROOT)),
        "pairedSourceSha256": sha(PAIRED),
        "englishSource": str(ENGLISH.relative_to(ROOT)),
        "englishSourceSha256": sha(ENGLISH),
        "slides": rows,
        "contactSheet": str(contact_path.relative_to(ROOT)),
        "phoneSamples": phone_samples,
        "note": "All 20 silent frames pair the unchanged English illustration and exact English source with the existing three marked Sesotho machine-draft sentences. Every other heading and passage is held in English. No Sesotho narration or farming approval is claimed.",
    }
    (QA / "st-paired-verification.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Rendered {SLIDES} Sesotho review stills to {OUT}")
    print(f"Contact sheet: {contact_path}")


if __name__ == "__main__":
    main()
