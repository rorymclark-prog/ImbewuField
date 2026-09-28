#!/usr/bin/env python3
"""Render the existing Sesotho and Xitsonga Market Gardening review decks."""
from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
MEDIA = Path(__file__).resolve().parent
W, H = 1440, 5400
SLIDES = 20
PHONE_SLIDES = (2, 3, 7, 20)
LANGS = {
    "st": ("Sesotho", "SESOTHO REVIEW · TRANSLATION PENDING"),
    "ts": ("Xitsonga", "XITSONGA REVIEW · TRANSLATION PENDING"),
}
PAPER = (245, 240, 228)
INK = (32, 25, 15)
GREEN = (31, 77, 43)
AMBER = (192, 122, 30)
RUST = (156, 74, 47)
RULE = (223, 213, 193)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def review_font(candidates: tuple[tuple[str, int], ...], size: int) -> ImageFont.FreeTypeFont:
    for name, index in candidates:
        for base in (Path("/System/Library/Fonts/Supplemental"),
                     Path("/System/Library/Fonts"), Path("/Library/Fonts")):
            path = base / name
            if path.is_file():
                try:
                    return ImageFont.truetype(str(path), size, index=index)
                except Exception:
                    pass
    fallback = Path("/usr/share/fonts/truetype/dejavu") / (
        "DejaVuSans-Bold.ttf" if candidates[0][0].startswith(("Avenir", "Helvetica", "Arial"))
        else "DejaVuSerif-Bold.ttf"
    )
    if fallback.is_file():
        return ImageFont.truetype(str(fallback), size)
    raise RuntimeError("source-only review cards need a scalable local font")


def wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont,
         max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = (current + " " + word).strip()
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def source_only_card(record: dict, slide_number: int, language: str) -> Image.Image:
    """Keep an English hold to one source block, never an English pseudo-translation."""
    name, banner = LANGS[language]
    image = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(image)
    status_font = review_font((("Avenir Next.ttc", 1), ("Arial Bold.ttf", 0)), 48)
    label_font = review_font((("Avenir Next.ttc", 1), ("Arial Bold.ttf", 0)), 43)
    title_font = review_font((("Georgia Bold.ttf", 0), ("Iowan Old Style.ttc", 1)), 76)
    body_font = review_font((("Avenir Next.ttc", 0), ("Arial.ttf", 0)), 58)
    draw.rounded_rectangle([64, 40, W - 64, 175], radius=20, fill=RUST)
    draw.text((96, 75), banner, font=status_font, fill=(255, 255, 255))
    draw.text((96, 220), f"{name} translation pending; English source",
              font=label_font, fill=AMBER)
    draw.rounded_rectangle([64, 290, W - 64, 5080], radius=26,
                           fill=(255, 252, 246), outline=RULE, width=4)
    x, max_width, y = 96, 1248, 390
    for line in wrap(draw, record["heading"], title_font, max_width):
        draw.text((x, y), line, font=title_font, fill=GREEN)
        y += 92
    y += 30
    for paragraph in record["body"]:
        lines = wrap(draw, paragraph, body_font, max_width)
        if any(draw.textlength(line, font=body_font) > max_width for line in lines):
            raise ValueError(f"slide {slide_number} has a source word wider than its panel")
        for line in lines:
            draw.text((x, y), line, font=body_font, fill=INK)
            y += 66
        y += 24
    if y > 5020:
        raise ValueError(f"slide {slide_number} English source exceeds the single panel")
    draw.text((96, 5220), f"ENGLISH SOURCE · {slide_number} / {SLIDES}",
              font=label_font, fill=GREEN)
    draw.text((W - 96, 5220), "IMBEWU FIELD", font=label_font,
              fill=GREEN, anchor="ra")
    return image


def render(language: str) -> dict:
    name, _ = LANGS[language]
    out = ROOT / f"public/course-decks/market-community/{language}"
    qa = MEDIA / f"{language}-paired-review"
    paired = ROOT / f"docs/narration/market-community.{language}.paired-draft.json"
    english = ROOT / "docs/narration/market-community.en.md"
    packet = json.loads(paired.read_text(encoding="utf-8"))
    out.mkdir(parents=True, exist_ok=True)
    qa.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=f"market-community-{language}-") as temp:
        generated = Path(temp) / "slides"
        subprocess.run([
            "node", "scripts/make-lesson-slides.mjs", "market-community", language,
            str(generated), "--paired-draft", str(paired),
        ], cwd=ROOT, check=True)
        expected = [generated / f"slide-{n:02d}.png" for n in range(1, SLIDES + 1)]
        if not all(path.is_file() for path in expected):
            raise SystemExit(f"Expected all 20 generated {language} paired frames")
        thumbs: list[Image.Image] = []
        rows = []
        for n, png in enumerate(expected, 1):
            with Image.open(png) as source:
                if source.size != (W, H):
                    raise SystemExit(f"{language} slide {n} has unexpected size {source.size}")
                image = source.convert("RGB")
                target = packet["slides"][n - 1]["target"]
                has_draft = target["heading"]["status"] == "draft" or any(
                    part["status"] == "draft" for part in target["body"]
                )
                if not has_draft:
                    image = source_only_card(packet["slides"][n - 1]["english"], n, language)
                output = out / f"slide-{n:02d}.webp"
                image.save(output, "WEBP", quality=88, method=6)
                thumb = image.copy()
                thumb.thumbnail((140, 525), Image.Resampling.LANCZOS)
                thumbs.append(thumb)
                rows.append({
                    "slide": n, "path": str(output.relative_to(ROOT)),
                    "pixels": f"{W}x{H}", "bytes": output.stat().st_size,
                    "sha256": sha(output),
                })
        contact = Image.new("RGB", (5 * 160, 4 * 555), (238, 233, 220))
        for index, (thumb, row) in enumerate(zip(thumbs, rows)):
            x, y = (index % 5) * 160 + 10, (index // 5) * 555 + 8
            contact.paste(thumb, (x, y))
            ImageDraw.Draw(contact).text((x, y + thumb.height + 4),
                f"Slide {row['slide']:02d}", font=ImageFont.load_default(), fill=(32, 25, 15))
        contact_path = qa / "contact-sheet.jpg"
        contact.save(contact_path, quality=92, optimize=True)
        phone_samples = []
        for n in PHONE_SLIDES:
            sample_path = qa / f"slide-{n:02d}-390.jpg"
            with Image.open(out / f"slide-{n:02d}.webp") as source:
                source.convert("RGB").resize((390, 1463), Image.Resampling.LANCZOS).save(
                    sample_path, quality=92, optimize=True)
            phone_samples.append({"slide": n, "path": str(sample_path.relative_to(ROOT)),
                                  "pixels": "390x1463", "sha256": sha(sample_path)})
    draft_count = sum(
        item["status"] == "draft"
        for slide in packet["slides"]
        for item in [slide["target"]["heading"], *slide["target"]["body"]]
    )
    report = {
        "module": "market-community", "language": language,
        "reviewStatus": "unreviewed-machine-draft", "humanLanguageReview": False,
        "localFarmingReview": False, "narration": None,
        "pairedSource": str(paired.relative_to(ROOT)), "pairedSourceSha256": sha(paired),
        "englishSource": str(english.relative_to(ROOT)), "englishSourceSha256": sha(english),
        "slides": rows, "contactSheet": str(contact_path.relative_to(ROOT)),
        "phoneSamples": phone_samples,
        "draftPassageCount": draft_count,
        "note": (f"All 20 silent frames use the validated existing {name} paired packet and exact English narration. "
                 "Only packet passages marked draft appear beside their exact English source. Slides with no draft show one English source card labelled translation pending; no pseudo-translation or repeated English artwork is shown. Business, prices, household-food guidance and seed or legal guidance remain English unless the existing packet marks a draft. No narration or farming approval is claimed."),
    }
    report_path = qa / "verification.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Rendered 20 {name} stills; {draft_count} draft passages")
    print(f"Contact sheet: {contact_path}")
    print(f"Verification: {report_path}")
    return report


if __name__ == "__main__":
    for lang in LANGS:
        render(lang)
