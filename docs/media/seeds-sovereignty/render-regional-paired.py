#!/usr/bin/env python3
"""Render the source-paired Seeds learner drafts at native illustration resolution."""
from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
MEDIA = Path(__file__).resolve().parent
QA = MEDIA / "regional-paired-qa"
ENGLISH = ROOT / "docs/narration/seeds-sovereignty.en.md"
LANGUAGES = {"st": "Sesotho", "ve": "Tshivenda", "ts": "Xitsonga"}
W, H = 1440, 5400
SLIDES = 24


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    QA.mkdir(parents=True, exist_ok=True)
    for language, name in LANGUAGES.items():
        paired = ROOT / f"docs/narration-reviews/seeds-sovereignty.{language}.paired.json"
        output_dir = ROOT / f"public/course-decks/seeds-sovereignty/{language}"
        with tempfile.TemporaryDirectory(prefix=f"seeds-{language}-paired-") as temp:
            generated = Path(temp) / "slides"
            subprocess.run([
                "node", "scripts/make-lesson-slides.mjs", "seeds-sovereignty", language,
                str(generated), "--paired-draft", str(paired), "--paired-native-source",
            ], cwd=ROOT, check=True)

            expected = [generated / f"slide-{n:02d}.png" for n in range(1, SLIDES + 1)]
            if not all(path.is_file() for path in expected):
                raise SystemExit(f"Expected all {SLIDES} {name} paired frames")
            output_dir.mkdir(parents=True, exist_ok=True)
            thumbs: list[Image.Image] = []
            rows = []
            for n, png in enumerate(expected, 1):
                with Image.open(png) as source:
                    if source.size != (W, H):
                        raise SystemExit(f"{name} slide {n} has unexpected size {source.size}")
                    image = source.convert("RGB")
                    with Image.open(ROOT / f"public/course-decks/seeds-sovereignty/en/slide-{n:02d}.jpg") as english_source:
                        illustration = english_source.convert("RGB")
                    placed = image.crop((240, 290, 1200, 830))
                    if illustration.size != (960, 540) or placed.tobytes() != illustration.tobytes():
                        raise SystemExit(f"{name} slide {n} does not preserve the complete native English illustration")
                    output = output_dir / f"slide-{n:02d}.webp"
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
                        "sourceImagePixels": "960x540",
                        "sourceImageDisplayPixels": "960x540; native pixels, no resampling",
                    })

            contact = Image.new("RGB", (5 * 160, 5 * 555), (238, 233, 220))
            for index, (thumb, row) in enumerate(zip(thumbs, rows)):
                x, y = (index % 5) * 160 + 10, (index // 5) * 555 + 8
                contact.paste(thumb, (x, y))
                ImageDraw.Draw(contact).text(
                    (x, y + thumb.height + 4), f"Slide {row['slide']:02d}",
                    font=ImageFont.load_default(), fill=(32, 25, 15),
                )
            contact_path = QA / f"{language}-contact-sheet.jpg"
            contact.save(contact_path, quality=92, optimize=True)

            samples = []
            for n in (1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 21, 22, 23, 24):
                with Image.open(output_dir / f"slide-{n:02d}.webp") as source:
                    sample = source.convert("RGB").resize((390, 1463), Image.Resampling.LANCZOS)
                sample_path = QA / f"{language}-slide-{n:02d}-390.jpg"
                sample.save(sample_path, quality=93, optimize=True)
                samples.append({
                    "slide": n,
                    "path": str(sample_path.relative_to(ROOT)),
                    "pixels": "390x1463",
                    "sha256": sha(sample_path),
                })

        packet = json.loads(paired.read_text(encoding="utf-8"))
        passages = [item for slide in packet["slides"]
                    for item in [slide["target"]["heading"], *slide["target"]["body"]]]
        draft_count = sum(item["status"] == "draft" for item in passages)
        hold_count = len(passages) - draft_count
        report = {
            "module": "seeds-sovereignty",
            "language": language,
            "reviewStatus": "unreviewed-machine-draft",
            "humanLanguageReview": False,
            "localFarmingReview": False,
            "narration": None,
            "pairedSource": str(paired.relative_to(ROOT)),
            "pairedSourceSha256": sha(paired),
            "englishSource": str(ENGLISH.relative_to(ROOT)),
            "englishSourceSha256": sha(ENGLISH),
            "nativeSourceMode": True,
            "slides": rows,
            "contactSheet": str(contact_path.relative_to(ROOT)),
            "phoneSamples": samples,
            "draftPassageCount": draft_count,
            "englishHoldCount": hold_count,
            "note": (f"{draft_count} of {len(passages)} headings and passages are unreviewed machine drafts from the paired review packet, each beside its exact English source"
                     + (f"; {hold_count} remain exact English holds. " if hold_count else "; no English holds remain. ")
                     + "Difficult technical terms stay in English inside translated sentences. The 960x540 English illustrations are shown at native pixels without resampling. Optional narration stays exact English. No fluent-speaker, local-farming or translation approval is claimed."),
        }
        (QA / f"{language}-verification.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"Rendered {SLIDES} {name} review frames to {output_dir}")
        print(f"Contact sheet: {contact_path}")


if __name__ == "__main__":
    main()
