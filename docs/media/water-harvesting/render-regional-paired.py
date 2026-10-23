#!/usr/bin/env python3
"""Render the source-paired Water Harvesting regional silent review decks."""
from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
MEDIA = Path(__file__).resolve().parent
LANGUAGES = ("st", "ve", "ts")
SLIDES = 24
PHONE_SLIDES = (10, 18, 20, 23)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    reports = {}
    for language in LANGUAGES:
        paired = ROOT / f"docs/narration/water-harvesting.{language}.paired-draft.json"
        output = ROOT / f"public/course-decks/water-harvesting/{language}"
        qa = MEDIA / "qa" / language
        qa.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix=f"water-harvesting-{language}-") as temp:
            generated = Path(temp) / "slides"
            subprocess.run([
                "node", "scripts/make-lesson-slides.mjs", "water-harvesting", language,
                str(generated), "--paired-draft", str(paired),
            ], cwd=ROOT, check=True)
            expected = [generated / f"slide-{number:02d}.png" for number in range(1, SLIDES + 1)]
            if not all(path.is_file() for path in expected):
                raise SystemExit(f"{language}: expected exactly {SLIDES} generated frames")
            output.mkdir(parents=True, exist_ok=True)
            rows = []
            thumbs = []
            for number, png in enumerate(expected, 1):
                with Image.open(png) as source:
                    if source.size != (1440, 5400):
                        raise SystemExit(f"{language} slide {number}: unexpected dimensions {source.size}")
                    image = source.convert("RGB")
                    target = output / f"slide-{number:02d}.webp"
                    image.save(target, "WEBP", quality=88, method=6)
                    thumb = image.copy()
                    thumb.thumbnail((140, 525), Image.Resampling.LANCZOS)
                    thumbs.append(thumb)
                    rows.append({
                        "slide": number,
                        "path": str(target.relative_to(ROOT)),
                        "pixels": "1440x5400",
                        "bytes": target.stat().st_size,
                        "sha256": sha(target),
                    })

            contact = Image.new("RGB", (5 * 160, 5 * 555), (238, 233, 220))
            draw = ImageDraw.Draw(contact)
            for index, (thumb, row) in enumerate(zip(thumbs, rows)):
                x, y = (index % 5) * 160 + 10, (index // 5) * 555 + 8
                contact.paste(thumb, (x, y))
                draw.text((x, y + thumb.height + 4), f"Slide {row['slide']:02d}",
                          font=ImageFont.load_default(), fill=(32, 25, 15))
            contact_path = qa / "contact-sheet.jpg"
            contact.save(contact_path, quality=92, optimize=True)

            phones = []
            for number in PHONE_SLIDES:
                source_path = output / f"slide-{number:02d}.webp"
                with Image.open(source_path) as source:
                    sample = source.convert("RGB").resize((390, 1463), Image.Resampling.LANCZOS)
                    sample_path = qa / f"slide-{number:02d}-390.jpg"
                    sample.save(sample_path, quality=92, optimize=True)
                phones.append({
                    "slide": number,
                    "path": str(sample_path.relative_to(ROOT)),
                    "pixels": "390x1463",
                    "sha256": sha(sample_path),
                })

        reports[language] = {
            "language": language,
            "reviewStatus": "unreviewed-machine-draft",
            "humanLanguageReview": False,
            "localWaterSafetyReview": False,
            "narration": None,
            "optionalSourceNarration": "English, only after an explicit learner choice",
            "pairedSource": str(paired.relative_to(ROOT)),
            "pairedSourceSha256": sha(paired),
            "englishSource": "docs/narration/water-harvesting.en.md",
            "englishSourceSha256": sha(ROOT / "docs/narration/water-harvesting.en.md"),
            "slides": rows,
            "contactSheet": str(contact_path.relative_to(ROOT)),
            "phoneSamples": phones,
            "note": "All 24 frames retain the exact English source beside the candidate panel and the existing illustrated English source slide. Only the rainfall-seasons sentence on slide 10 is a regional draft; every other title and passage is held in exact English. This is not an approved translation or a substitute for local water and sanitation advice.",
        }

    report_path = MEDIA / "qa" / "verification.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(reports, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Rendered 3 source-paired silent decks with {SLIDES} slides each")
    print(f"Verification: {report_path}")


if __name__ == "__main__":
    main()
