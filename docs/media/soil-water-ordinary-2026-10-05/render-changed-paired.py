#!/usr/bin/env python3
"""Redraw only the Soil Health and Water Harvesting regional frames whose paired target text changed.

The source-paired decks (docs/narration/<module>.<lang>.paired-draft.json) are rendered with the shared
scripts/make-lesson-slides.mjs renderer. A frame is replaced only when its target panel differs from the
baseline commit, so untouched frames keep their reviewed bytes. Each replaced frame is written as WEBP
(quality 88, method 6) like the earlier regional renders, and a contact sheet plus 390 px phone samples are
saved for visual review. No narration or audio is generated.

Usage: python3 docs/media/soil-water-ordinary-2026-10-05/render-changed-paired.py --base <git-ref>
"""
import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
MODULES = {"soil-health": 20, "water-harvesting": 24}
LANGUAGES = ("st", "ve", "ts")


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_bytes(ref: str, path: str) -> bytes:
    return subprocess.run(["git", "show", f"{ref}:{path}"], cwd=ROOT, check=True, capture_output=True).stdout


def text_weight(target: dict) -> int:
    parts = [target["heading"], *target["body"]]
    total = 0
    for part in parts:
        if part.get("status") == "draft":
            total += len(part.get("text", ""))
        elif part.get("status") == "mixed":
            total += sum(len(s.get("text") or s["sourceEnglish"]) for s in part["segments"])
    return total


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True, help="baseline git ref whose frames and targets are compared")
    args = parser.parse_args()
    manifest = {"baseline": subprocess.run(["git", "rev-parse", args.base], cwd=ROOT, check=True,
                                           capture_output=True, text=True).stdout.strip(),
                "renderer": "scripts/make-lesson-slides.mjs --paired-draft", "webp": {"quality": 88, "method": 6},
                "narration": None, "decks": []}
    for module, count in MODULES.items():
        for language in LANGUAGES:
            rel = f"docs/narration/{module}.{language}.paired-draft.json"
            current = json.loads((ROOT / rel).read_text(encoding="utf-8"))
            baseline = json.loads(git_bytes(args.base, rel))
            changed = [s["n"] for s, b in zip(current["slides"], baseline["slides"])
                       if json.dumps(s["target"], sort_keys=True) != json.dumps(b["target"], sort_keys=True)]
            out_dir = ROOT / f"public/course-decks/{module}/{language}"
            deck = {"module": module, "language": language, "pairedSource": rel,
                    "pairedSourceSha256": sha((ROOT / rel).read_bytes()), "changedSlides": changed,
                    "changed": [], "preserved": []}
            if changed:
                with tempfile.TemporaryDirectory(prefix=f"{module}-{language}-") as temp:
                    generated = Path(temp) / "slides"
                    subprocess.run(["node", "scripts/make-lesson-slides.mjs", module, language, str(generated),
                                    "--paired-draft", str(ROOT / rel)], cwd=ROOT, check=True)
                    thumbs = []
                    for number in changed:
                        png = generated / f"slide-{number:02d}.png"
                        with Image.open(png) as source:
                            if source.size != (1440, 5400):
                                raise SystemExit(f"{module} {language} slide {number}: unexpected size {source.size}")
                            image = source.convert("RGB")
                        target = out_dir / f"slide-{number:02d}.webp"
                        image.save(target, "WEBP", quality=88, method=6)
                        thumb = image.copy()
                        thumb.thumbnail((180, 675), Image.Resampling.LANCZOS)
                        thumbs.append((number, thumb, image))
                    columns = min(5, len(thumbs))
                    rows = (len(thumbs) + columns - 1) // columns
                    sheet = Image.new("RGB", (columns * 200, rows * 715), (238, 233, 220))
                    draw = ImageDraw.Draw(sheet)
                    for index, (number, thumb, _) in enumerate(thumbs):
                        x, y = (index % columns) * 200 + 10, (index // columns) * 715 + 30
                        sheet.paste(thumb, (x, y))
                        draw.text((x, y - 22), f"{language.upper()} slide {number}", fill=(60, 40, 20))
                    qa = ROOT / f"docs/media/{module}/qa"
                    qa.mkdir(parents=True, exist_ok=True)
                    sheet_path = qa / f"{language}-ordinary-20261005-contact-sheet.jpg"
                    sheet.save(sheet_path, quality=90, optimize=True)
                    deck["contactSheet"] = str(sheet_path.relative_to(ROOT))
                    densest = sorted(changed, key=lambda n: -text_weight(current["slides"][n - 1]["target"]))[:2]
                    deck["phoneSamples"] = []
                    for number, _, image in thumbs:
                        if number not in densest:
                            continue
                        sample = image.resize((390, 1463), Image.Resampling.LANCZOS)
                        sample_path = qa / f"{language}-ordinary-20261005-slide-{number:02d}-390.jpg"
                        sample.save(sample_path, quality=92, optimize=True)
                        deck["phoneSamples"].append(str(sample_path.relative_to(ROOT)))
            for number in range(1, count + 1):
                path = f"public/course-decks/{module}/{language}/slide-{number:02d}.webp"
                data = (ROOT / path).read_bytes()
                before = git_bytes(args.base, path)
                row = {"path": path, "sha256": sha(data), "baselineSha256": sha(before), "bytes": len(data)}
                if number in changed:
                    if row["sha256"] == row["baselineSha256"]:
                        raise SystemExit(f"{path}: changed target did not redraw the frame")
                    deck["changed"].append(row)
                else:
                    if row["sha256"] != row["baselineSha256"]:
                        raise SystemExit(f"{path}: untouched frame differs from the baseline")
                    deck["preserved"].append(row)
            manifest["decks"].append(deck)
            print(f"{module} {language}: {len(deck['changed'])} frames redrawn, {len(deck['preserved'])} preserved")
    (HERE / "frames.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
