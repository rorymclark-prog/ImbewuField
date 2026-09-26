#!/usr/bin/env python3
"""Rebuild the Food Forest isiZulu still deck and review artifacts from checked-in sources."""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
MEDIA = Path(__file__).resolve().parent
SOURCE = MEDIA / "food-forest-zu-render-source.md"
OUT = ROOT / "public/course-decks/food-forest/zu"
STAGING = MEDIA / "rendered-png"
QA = MEDIA / "qa"
W, H = 1920, 1080
GREEN = (31, 77, 43)
PAPER = (245, 240, 228)
INK = (32, 25, 15)
AMBER = (192, 122, 30)
WHITE = (255, 255, 255)

def font(size: int, bold: bool = False):
    candidates = (["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf"] if bold else []) + [
        "/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttc", "/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()

def cover(path: Path, size: tuple[int, int]) -> Image.Image:
    im = Image.open(path).convert("RGB")
    scale = max(size[0] / im.width, size[1] / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS)
    x, y = (im.width - size[0]) // 2, (im.height - size[1]) // 2
    return im.crop((x, y, x + size[0], y + size[1]))

def wrap(draw, text, fnt, width):
    lines, current = [], ""
    for word in text.split():
        candidate = (current + " " + word).strip()
        if draw.textbbox((0, 0), candidate, font=fnt)[2] <= width:
            current = candidate
        else:
            if current: lines.append(current)
            current = word
    if current: lines.append(current)
    return lines

def text_block(draw, xy, text, fnt, fill, width, leading=1.22):
    x, y = xy
    for line in wrap(draw, text, fnt, width):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += int(fnt.size * leading)
    return y

def diagram_layers(path: Path):
    im = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(im)
    d.text((92, 48), "Funda Izendlalelo Eziyisikhombisa Zokutshala", font=font(66, True), fill=GREEN)
    source = cover(ROOT / "public/course-images/food-forest/food-forest-l1.jpg", (780, 665))
    im.paste(source, (92, 202))
    labels = [
        ("I-canopy", "Uphahla lwezihlahla ezinde"),
        ("I-sub-canopy", "Izihlahla ezincane"),
        ("Ama-shrub", "Izihlahlana ezinamagatsha aqinile"),
        ("I-herbaceous", "Izitshalo ezineziqu ezithambile"),
        ("I-ground cover", "Izitshalo ezimboza umhlabathi"),
        ("Ama-root crops", "Izitshalo zezimpande"),
        ("Ama-climbers", "Izitshalo ezikhuphukayo"),
    ]
    y = 192
    for i, (term, gloss) in enumerate(labels):
        d.rounded_rectangle((930, y, 1816, y + 91), radius=14, fill=WHITE, outline=(218, 208, 188), width=2)
        d.text((963, y + 7), term, font=font(32, True), fill=GREEN)
        text_block(d, (963, y + 48), gloss, font(32), INK, 820, 1.12)
        y += 99
    d.rectangle((0, 900, W, H), fill=GREEN)
    text_block(d, (92, 930), "Lezi yizingxenye zokuhlela, azizona izilinganiso zokuphakama ezimisiwe. Khetha izitshalo nezikhala ngokwendawo yakho.", font(35, True), WHITE, 1736, 1.14)
    im.save(path, quality=94)

def diagram_climate(path: Path):
    im = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(im)
    d.text((92, 54), "Qondanisa Izinhlobo Nesimo Sezulu", font=font(66, True), fill=GREEN)
    m = Image.open(ROOT / "public/course-images/food-forest/food-forest-l2.jpg").convert("RGB")
    m.thumbnail((810, 700), Image.Resampling.LANCZOS)
    im.paste(m, (80, 195))
    cards = [
        ("E-Highveld", "Cabanga ngezihlahla nezihlahlana ezimelana namakhaza. Hlola isithwathwa sendawo."),
        ("Ugu lwase-KZN nase-Lowveld", "Cabanga ngezitshalo ezithanda izindawo ezifudumele. Hlola ukushisa nemvula yendawo."),
    ]
    y = 240
    for title, body in cards:
        d.rounded_rectangle((935, y, 1815, y + 255), radius=24, fill=WHITE, outline=(218, 208, 188), width=3)
        d.text((978, y + 34), title, font=font(46, True), fill=GREEN)
        text_block(d, (978, y + 104), body, font(39), INK, 785, 1.2)
        y += 290
    d.rectangle((0, 900, W, H), fill=GREEN)
    text_block(d, (92, 925), "Isimo sezulu siyasiza ekunqumeni ukuthi izitshalo zingase ziyifanele yini indawo. Hlola isitshalo ngasinye ngokwendawo yakho.", font(35, True), WHITE, 1736, 1.14)
    im.save(path, quality=94)

def label_scene(image_path: Path, heading: str, caption: str):
    im = cover(image_path, (W, H)).convert("RGBA")
    overlay = Image.new("RGBA", (W, 270), (18, 43, 27, 222))
    im.alpha_composite(overlay, (0, H - 270))
    d = ImageDraw.Draw(im)
    d.text((88, H - 238), heading, font=font(43, True), fill=(255, 255, 255, 255))
    text_block(d, (88, H - 173), caption, font(28), (255, 255, 255, 255), 1730, 1.18)
    return im.convert("RGB")

def main():
    expected = "6390548164490a05f96553201ce048eddbb84fb349746371268bb36271ab697e"
    sha = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if sha != expected:
        raise SystemExit(f"source SHA mismatch: expected {expected}, got {sha}")
    OUT.mkdir(parents=True, exist_ok=True); QA.mkdir(parents=True, exist_ok=True)
    diagram_layers(MEDIA / "layers-zu.jpg")
    diagram_climate(MEDIA / "climate-match-zu.jpg")
    override = {
        "5": {"path": str(MEDIA / "layers-zu.jpg"), "layout": "scene"},
        "8": {"path": str(ROOT / "docs/media/studies-illustrated-release/art/food-forest/establish-the-forest.jpg"), "layout": "scene"},
        "10": {"path": str(MEDIA / "climate-match-zu.jpg"), "layout": "scene"},
        "13": {"path": str(ROOT / "docs/media/studies-illustrated-release/art/food-forest/living-ecosystem.jpg"), "layout": "scene"},
        "15": {"path": str(ROOT / "docs/media/studies-illustrated-release/art/food-forest/establish-the-forest.jpg"), "layout": "scene"},
        "16": {"path": str(ROOT / "docs/media/studies-illustrated-release/art/food-forest/sheet-mulching.jpg"), "layout": "scene"},
        "18": {"path": str(ROOT / "docs/media/studies-illustrated-release/art/food-forest/plant-with-rain.jpg"), "layout": "scene"},
    }
    branding = {"largeText": True, "deckTagline": "Hlela indawo, khetha izitshalo, futhi unakekele njengoba zikhula", "footer": "ImbewuField · Ukuklama I-Food Forest"}
    op, bp = MEDIA / "art-overrides.json", MEDIA / "branding.json"
    op.write_text(json.dumps(override, ensure_ascii=False, indent=2) + "\n")
    bp.write_text(json.dumps(branding, ensure_ascii=False, indent=2) + "\n")
    # Render the current English-aligned source headings and narration without using the older
    # canonical module narration, which carries stale claims and wording.
    STAGING.mkdir(parents=True, exist_ok=True)
    subprocess.run(["node", "scripts/make-lesson-slides.mjs", "food-forest", "zu", str(STAGING), "--source", str(SOURCE), "--art-overrides", str(op), "--branding", str(bp)], cwd=ROOT, check=True)
    for n in range(1, 21):
        src = STAGING / f"slide-{n:02}.png"
        Image.open(src).convert("RGB").save(OUT / f"slide-{n:02}.jpg", quality=93, optimize=True)
    shutil.rmtree(STAGING)
    scenes = {
        8: ("Ukunakekela Kuyashintsha Njengoba Izitshalo Zikhula", "Hlola umswakama, ukhula nokuncintisana; lungisa lapho okubonayo kukukhombisa ukuthi kudingeka."),
        13: ("Izinhlobo Zomdabu Zakha I-Ecosystem", "Khetha ngokwemvelo yakini. Vikela izitshalo zemvelo ezikhona notshani bemvelo obunempilo."),
        15: ("Vikela Umhlabathi Ngesembozo", "Sebenzisa i-mulch lapho ifaneleka; hlola ukukhula kabusha kokhula nokungena kwamanzi."),
        16: ("Beka I-Cardboard Ne-Mulch Ngokucophelela", "Shiya isiqu sesihlahla singamboziwe futhi uhlole ukuthi amanzi ayakwazi ukungena."),
        18: ("Tshala Lapho Izimo Zivuma", "Landela izimo zendawo; le foto ayithembisi ukuthi imvula izofika ngesikhathi esithile."),
    }
    for n, (title, caption) in scenes.items():
        p = OUT / f"slide-{n:02}.jpg"
        im = label_scene(p, title, caption)
        im.save(p, quality=92, optimize=True)
    # Contact sheet is review material only; source deck remains individual slides.
    thumbs = Image.new("RGB", (5 * 384, 4 * 216), PAPER)
    for n in range(1, 21):
        im = Image.open(OUT / f"slide-{n:02}.jpg").convert("RGB").resize((384, 216), Image.Resampling.LANCZOS)
        thumbs.paste(im, (((n - 1) % 5) * 384, ((n - 1) // 5) * 216))
    thumbs.save(QA / "contact-sheet.jpg", quality=90)
    for n in (5, 8, 10, 15, 16, 18):
        im = Image.open(OUT / f"slide-{n:02}.jpg").convert("RGB")
        im.resize((390, round(390 * H / W)), Image.Resampling.LANCZOS).save(QA / f"slide-{n:02}-390.jpg", quality=90)
    metadata = {
        "moduleId": "food-forest", "lang": "zu", "slideCount": 20,
        "source": "docs/media/food-forest/food-forest-zu-render-source.md",
        "sourceSha256": sha, "sourceWordCount": 806,
        "sourceHashes": {
            "foodForestL1Draft": "bbd4c5a5615a2ddfdb7dd129940f8717cc4b3dcdf6605717d8afc5af3b0007af",
            "foodForestL2Draft": "4d4da97b5cebf7166517f6c73cdd90cb9db21f4f90ba4491de849cbcb63d9d38",
            "foodForestL3Draft": "699fb952b901b6847295520fffdbe71c194cd55cd780feb1e146b5d1545d7e84",
            "currentEnglishNarration": "ed16fe05d1608259c293e4957f939095515fbfb9f1ed6a97a9ebc27b490fcfc5",
        },
        "sourceBasis": "current packet proposals slides 3–18 plus current-English-aligned opening and closing from audio lane; not the stale canonical narration file",
        "slidePixels": "1920x1080 JPEG", "renderScript": "docs/media/food-forest/render-zu-stills.py",
        "stillOnly": True, "audioChanged": False, "humanLanguageApproval": False,
        "reviewArtifacts": [
            "docs/media/food-forest/qa/contact-sheet.jpg",
            "docs/media/food-forest/qa/slide-05-390.jpg",
            "docs/media/food-forest/qa/slide-08-390.jpg",
            "docs/media/food-forest/qa/slide-10-390.jpg",
            "docs/media/food-forest/qa/slide-15-390.jpg",
            "docs/media/food-forest/qa/slide-16-390.jpg",
            "docs/media/food-forest/qa/slide-18-390.jpg",
        ],
        "visualChecks": "Contact sheet and listed 390px samples inspected at full resolution on 2026-09-24.",
        "holds": [
            "Slide 10 climate wording remains pending English source-owner alignment: English is categorical; isiZulu is qualified per current reviewed draft.",
            "L2 slide 9 mango frost and quince chill nuance remains under source review; no new species or suitability recommendation added.",
            "Existing English examples include species names; no names were added and the deck does not imply legal approval or local suitability.",
            "Slide 5 layers are planning roles, not fixed heights; scene slides are still photographs and do not imply animation.",
        ],
    }
    (QA / "report.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")

if __name__ == "__main__": main()
