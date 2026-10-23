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
LANGUAGES = {"st": "Sesotho", "ve": "Tshivenda", "ts": "Xitsonga"}
W, H = 1440, 5400
SLIDES = 51
# The opening, both support-plant slides with the longest bodies, the Bocking 14 propagation
# warning, the observation slides and the close.
PHONE_SAMPLES = (1, 2, 16, 22, 32, 43, 46, 47, 51)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    QA.mkdir(parents=True, exist_ok=True)
    for language, name in LANGUAGES.items():
        paired = PAIRED_TEMPLATE.with_name(PAIRED_TEMPLATE.name.format(lang=language))
        output_dir = ROOT / "public/course-decks/plant-guilds" / language
        rows: list[dict[str, object]] = []
        thumbs: list[Image.Image] = []
        with tempfile.TemporaryDirectory(prefix=f"plant-guilds-{language}-") as temp:
            generated = Path(temp) / "slides"
            subprocess.run([
                "node", "scripts/make-lesson-slides.mjs", "plant-guilds", language,
                str(generated), "--paired-draft", str(paired),
            ], cwd=ROOT, check=True)

            expected = [generated / f"slide-{n:02d}.png" for n in range(1, SLIDES + 1)]
            if not all(path.is_file() for path in expected):
                raise SystemExit(f"{language}: renderer did not produce all {SLIDES} slides")
            output_dir.mkdir(parents=True, exist_ok=True)
            for n, png in enumerate(expected, 1):
                with Image.open(png) as source:
                    if source.size != (W, H):
                        raise SystemExit(f"{language} slide {n}: unexpected size {source.size}")
                    image = source.convert("RGB")
                    target = output_dir / f"slide-{n:02d}.webp"
                    image.save(target, "WEBP", quality=88, method=6)
                    thumb = image.copy()
                    thumb.thumbnail((140, 525), Image.Resampling.LANCZOS)
                    thumbs.append(thumb)
                    rows.append({
                        "slide": n,
                        "path": str(target.relative_to(ROOT)),
                        "pixels": f"{W}x{H}",
                        "bytes": target.stat().st_size,
                        "sha256": sha(target),
                    })

        contact = Image.new("RGB", (9 * 160, 6 * 555), (238, 233, 220))
        for index, (thumb, row) in enumerate(zip(thumbs, rows)):
            x, y = (index % 9) * 160 + 10, (index // 9) * 555 + 8
            contact.paste(thumb, (x, y))
            ImageDraw.Draw(contact).text(
                (x, y + thumb.height + 4), f"Slide {row['slide']:02d}",
                font=ImageFont.load_default(), fill=(32, 25, 15),
            )
        contact_path = QA / f"{language}-contact-sheet.jpg"
        contact.save(contact_path, quality=92, optimize=True)

        samples = []
        for n in PHONE_SAMPLES:
            with Image.open(output_dir / f"slide-{n:02d}.webp") as source:
                phone = source.convert("RGB").resize((390, 1463), Image.Resampling.LANCZOS)
            phone_path = QA / f"{language}-slide-{n:02d}-390.jpg"
            phone.save(phone_path, quality=92, optimize=True)
            samples.append({"slide": n, "path": str(phone_path.relative_to(ROOT)),
                            "pixels": "390x1463", "sha256": sha(phone_path)})

        packet = json.loads(paired.read_text(encoding="utf-8"))
        passages = [item for slide in packet["slides"]
                    for item in [slide["target"]["heading"], *slide["target"]["body"]]]
        draft_count = sum(item["status"] == "draft" for item in passages)
        hold_count = len(passages) - draft_count
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
            "slides": rows,
            "contactSheet": str(contact_path.relative_to(ROOT)),
            "phoneSamples": samples,
            "draftPassageCount": draft_count,
            "englishHoldCount": hold_count,
            "note": (f"All {SLIDES} silent frames keep the unchanged English illustration. {draft_count} of {len(passages)} headings and passages are unreviewed machine drafts, each beside its exact English source"
                     + (f"; {hold_count} remain exact English holds. " if hold_count else "; no English holds remain. ")
                     + "Species names stay exact, and technical terms such as guild, support plant, mulch and chop-and-drop stay in English inside translated sentences. Optional narration stays exact English. No fluent-speaker, local-farming or translation approval is claimed."),
        }
        (QA / f"{language}-paired-verification.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"Rendered {SLIDES} {name} review frames to {output_dir}")
        print(f"Contact sheet: {contact_path}")


if __name__ == "__main__":
    main()
