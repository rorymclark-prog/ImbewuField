#!/usr/bin/env python3
"""Render the Xitsonga Vegetables and Staple Crops paired review deck."""
from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
MEDIA = Path(__file__).resolve().parent
OUT = ROOT / "public/course-decks/vegetables-staples/ts"
QA = MEDIA / "ts-paired-review"
PAIRED = ROOT / "docs/narration/vegetables-staples.ts.paired-draft.json"
ENGLISH = ROOT / "docs/narration/vegetables-staples.en.md"
W, H = 1440, 5400
SLIDES = 18


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="vegetables-staples-ts-") as temp:
        generated = Path(temp) / "slides"
        subprocess.run([
            "node", "scripts/make-lesson-slides.mjs", "vegetables-staples", "ts",
            str(generated), "--paired-draft", str(PAIRED),
        ], cwd=ROOT, check=True)

        expected = [generated / f"slide-{n:02d}.png" for n in range(1, SLIDES + 1)]
        if not all(path.is_file() for path in expected):
            raise SystemExit("Expected all 18 generated paired frames")

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

        contact = Image.new("RGB", (4 * 160, 5 * 555), (238, 233, 220))
        for index, (thumb, row) in enumerate(zip(thumbs, rows)):
            x, y = (index % 4) * 160 + 10, (index // 4) * 555 + 8
            # Preserve the entire tall frame in the overview grid.
            contact.paste(thumb, (x, y))
            from PIL import ImageDraw, ImageFont
            draw = ImageDraw.Draw(contact)
            draw.text((x, y + thumb.height + 4), f"Slide {row['slide']:02d}",
                      font=ImageFont.load_default(), fill=(32, 25, 15))
        contact.save(QA / "contact-sheet.jpg", quality=92, optimize=True)

        phone_samples = []
        for n in (1, 13, 14, 18):
            path = OUT / f"slide-{n:02d}.webp"
            with Image.open(path) as source:
                sample = source.convert("RGB").resize((390, 1463), Image.Resampling.LANCZOS)
                sample_path = QA / f"slide-{n:02d}-390.jpg"
                sample.save(sample_path, quality=92, optimize=True)
                phone_samples.append({
                    "slide": n,
                    "path": str(sample_path.relative_to(ROOT)),
                    "pixels": "390x1463",
                    "sha256": sha(sample_path),
                })

    report = {
        "module": "vegetables-staples",
        "language": "ts",
        "reviewStatus": "unreviewed-machine-draft",
        "humanLanguageReview": False,
        "localFarmingReview": False,
        "narration": None,
        "pairedSource": str(PAIRED.relative_to(ROOT)),
        "pairedSourceSha256": sha(PAIRED),
        "englishSource": str(ENGLISH.relative_to(ROOT)),
        "englishSourceSha256": sha(ENGLISH),
        "slides": rows,
        "contactSheet": str((QA / "contact-sheet.jpg").relative_to(ROOT)),
        "phoneSamples": phone_samples,
        "note": "Each frame pairs existing English artwork, the explicit draft/hold panel, and exact English narration. No audio is generated or registered.",
    }
    (QA / "verification.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Rendered {SLIDES} Xitsonga review stills to {OUT}")
    print(f"Contact sheet: {QA / 'contact-sheet.jpg'}")


if __name__ == "__main__":
    main()
