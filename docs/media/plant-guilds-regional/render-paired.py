#!/usr/bin/env python3
"""Render the Plant Guilds silent source-paired review decks for st, ve and ts."""
from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
MEDIA = Path(__file__).resolve().parent
QA = MEDIA / "qa"
PAIRED_TEMPLATE = ROOT / "docs/narration/plant-guilds.{lang}.paired-draft.json"
ENGLISH = ROOT / "docs/narration/plant-guilds.en.md"
LANGUAGES = ("st", "ve", "ts")
W, H = 1440, 5400
SLIDES = 51
REVIEW_SLIDES = (46, 47)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    QA.mkdir(parents=True, exist_ok=True)
    composite = Image.new("RGB", (3 * 480, 2 * 1840), (238, 233, 220))
    composite_draw = ImageDraw.Draw(composite)
    font = ImageFont.load_default()

    for language in LANGUAGES:
        paired = PAIRED_TEMPLATE.with_name(PAIRED_TEMPLATE.name.format(lang=language))
        output = ROOT / "public/course-decks/plant-guilds" / language
        rows: list[dict[str, object]] = []
        with tempfile.TemporaryDirectory(prefix=f"plant-guilds-{language}-") as temp:
            generated = Path(temp) / "slides"
            subprocess.run([
                "node", "scripts/make-lesson-slides.mjs", "plant-guilds", language,
                str(generated), "--paired-draft", str(paired),
            ], cwd=ROOT, check=True)

            expected = [generated / f"slide-{n:02d}.png" for n in range(1, SLIDES + 1)]
            if not all(path.is_file() for path in expected):
                raise SystemExit(f"{language}: renderer did not produce all {SLIDES} slides")
            output.mkdir(parents=True, exist_ok=True)
            for n, png in enumerate(expected, 1):
                with Image.open(png) as source:
                    if source.size != (W, H):
                        raise SystemExit(f"{language} slide {n}: unexpected size {source.size}")
                    image = source.convert("RGB")
                    target = output / f"slide-{n:02d}.webp"
                    if language == "st" and n not in REVIEW_SLIDES:
                        if not target.is_file():
                            raise SystemExit(f"preserving Sesotho slide {n}: existing frame is missing")
                        with Image.open(target) as existing:
                            if existing.size != (W, H):
                                raise SystemExit(f"preserving Sesotho slide {n}: unexpected size {existing.size}")
                        image = existing.convert("RGB")
                    else:
                        image.save(target, "WEBP", quality=88, method=6)
                    rows.append({
                        "slide": n,
                        "path": str(target.relative_to(ROOT)),
                        "pixels": f"{W}x{H}",
                        "bytes": target.stat().st_size,
                        "sha256": sha(target),
                    })
                    if n in REVIEW_SLIDES:
                        phone = image.resize((390, 1463), Image.Resampling.LANCZOS)
                        phone_path = QA / f"{language}-slide-{n:02d}-390.jpg"
                        phone.save(phone_path, quality=92, optimize=True)
                        thumb = image.resize((480, 1800), Image.Resampling.LANCZOS)
                        x = (LANGUAGES.index(language) * 480)
                        y = ((n - REVIEW_SLIDES[0]) * 1840)
                        composite.paste(thumb, (x, y))
                        composite_draw.text((x + 8, y + 1804), f"{language.upper()} · slide {n}",
                                            font=font, fill=(32, 25, 15))

        report = {
            "module": "plant-guilds",
            "language": language,
            "reviewStatus": "unreviewed-machine-draft",
            "humanLanguageReview": False,
            "localFarmingReview": False,
            "narration": None,
            "pairedSource": str(paired.relative_to(ROOT)),
            "pairedSourceSha256": sha(paired),
            "englishSource": str(ENGLISH.relative_to(ROOT)),
            "englishSourceSha256": sha(ENGLISH),
            "translatedScope": [46, 47],
            "slides": rows,
            "phoneSamples": [
                {"slide": n, "path": str((QA / f"{language}-slide-{n:02d}-390.jpg").relative_to(ROOT)),
                 "pixels": "390x1463", "sha256": sha(QA / f"{language}-slide-{n:02d}-390.jpg")}
                for n in REVIEW_SLIDES
            ],
            "note": "All 51 silent frames show the unchanged English illustration and exact English source. Only observation framing and a reflection prompt on slides 46–47 carry marked language drafts. Plant-growth observations and management advice remain in English. The word guild is retained. No regional narration or fluent/local farming approval is claimed.",
        }
        (QA / f"{language}-paired-verification.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

    contact = QA / "regional-observation-contact-sheet.jpg"
    composite.save(contact, quality=92, optimize=True)
    print(f"Rendered {SLIDES} source-paired stills for each of {', '.join(LANGUAGES)}")
    print(f"Contact sheet: {contact}")


if __name__ == "__main__":
    main()
