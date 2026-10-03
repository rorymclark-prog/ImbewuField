#!/usr/bin/env python3
"""Rebuild silent regional frames from their checked, exact-source paired packets."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
MODULE = "reading-landscape"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render(language):
    paired = ROOT / f"docs/narration/{MODULE}.{language}.paired-draft.json"
    english = ROOT / f"docs/narration/{MODULE}.en.md"
    packet = json.loads(paired.read_text())
    output = ROOT / f"public/course-decks/{MODULE}/{language}"
    rows = []
    # The shared renderer validates current English and fails on panel overflow.
    # Render sequentially because it uses a shared temporary Python entry point.
    with tempfile.TemporaryDirectory(prefix=f"reading-{language}-") as temp:
        subprocess.run([
            "node", "scripts/make-lesson-slides.mjs", MODULE, language, temp,
            "--paired-draft", str(paired),
        ], cwd=ROOT, check=True)
        output.mkdir(parents=True, exist_ok=True)
        for slide in packet["slides"]:
            number = slide["n"]
            source = Path(temp) / f"slide-{number:02d}.png"
            destination = output / f"slide-{number:02d}.webp"
            with Image.open(source) as image:
                if image.size != (1440, 5400):
                    raise ValueError(f"Unexpected frame size: {source}")
                image.convert("RGB").save(destination, "WEBP", quality=88, method=6)
            rows.append({"slide": number, "path": str(destination.relative_to(ROOT)),
                         "bytes": destination.stat().st_size, "sha256": sha(destination)})
    report = {
        "module": MODULE, "language": language,
        "reviewStatus": "unreviewed-machine-draft", "humanLanguageReview": False,
        "localFarmingReview": False, "narration": None,
        "pairedSourceSha256": sha(paired), "englishSourceSha256": sha(english),
        "slides": rows,
        "note": "Silent source-paired frames. Rust text remains exact English; mixed drafts retain difficult technical English. No fluent or farming approval.",
    }
    (ROOT / f"docs/media/{MODULE}/verification-{language}-paired.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    for language in ("st", "ve", "ts"):
        render(language)
