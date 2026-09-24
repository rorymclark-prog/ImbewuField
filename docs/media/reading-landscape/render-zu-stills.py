#!/usr/bin/env python3
"""Render the Reading the Landscape isiZulu still deck from the current paired scripts.

This renders individual static concept frames from the existing Pillow drawing helpers; it does
not encode or register an animation. The current-main narration is authoritative for learner text.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[3]
MEDIA = ROOT / "docs/media/reading-landscape"
OUT = ROOT / "public/course-decks/reading-landscape/zu"
SOURCE_STALE = Path("/tmp/reading-landscape.zu.source.md")
SOURCE_COMMIT = "b7fbda65a1e0e59de06a4365c6c5947babd270f2"
SOURCE_STALE_SHA = "5907cc0e4f1c8573f64855e1e8acde0d744ea65d0b596b3da5cf1689e8ca5c55"
REVIEW_DRAFTS = [ROOT / f"docs/narration-reviews/reading-landscape-l{i}.zu.full-draft.md" for i in range(1, 5)]

FONT_PATHS = ["/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
FONT_PATH = next((p for p in FONT_PATHS if Path(p).exists()), None)
if not FONT_PATH: raise RuntimeError("Required Arial or DejaVu font not found")

def font(size): return ImageFont.truetype(FONT_PATH, size)
def wrap(draw, text, fnt, maxw):
    lines=[]; cur=""
    for word in text.split():
        trial=f"{cur} {word}".strip()
        if draw.textlength(trial,font=fnt) <= maxw: cur=trial
        else:
            if cur: lines.append(cur)
            cur=word
    if cur: lines.append(cur)
    return lines

# The source renderer supplies the course's existing site diagrams. Call each drawing function
# once at a settled phase to make one still; no frame loop, encoder, or clip output is used.
spec=importlib.util.spec_from_file_location("landscape_concepts",ROOT/"scripts/render-landscape-concepts.py")
land=importlib.util.module_from_spec(spec); spec.loader.exec_module(land)
original_put_label=land.put_label
LABELS={
    "Speeds up":"Iyashesha",
    "Spreads and sinks":"Isabalala",
    "Gathers and leaves":"Iyaqoqana",
    "Sinks":"Iyangena",
    "North":"Enyakatho", "South":"Ningizimu",
    "Summer":"Ihlobo", "Winter":"Ubusika",
    "building":"Isakhiwo", "tree":"Isihlahla",
    "Wind across ridges and gap":"Umoya udlula emagqumeni nasezikhaleni",
    "Ridge":"Igquma", "Gap":"Isikhala", "Exposure":"Indawo evulekile", "Shelter":"Indawo evikelekile",
    "Cold air downhill into low ground":"Umoya obandayo uye phansi",
    "Cold air":"Umoya obandayo", "Low ground":"Indawo ephansi",
    "Boundary":"Umngcele", "Building":"Isakhiwo", "Road":"Umgwaqo", "Water":"Amanzi", "Slope":"Umthambeka",
}

def zu_label(draw,xy,text,font=None,fill=None,anchor="lt"):
    if text == "South": xy=(1030,xy[1])
    return original_put_label(draw,xy,LABELS.get(text,text),font=font or land.FONT_LABEL,fill=fill or land.C_TEXT,anchor=anchor)
land.put_label=zu_label

TITLES={
    "Watch: Water Slows, Sinks, and Leaves":"Buka: Amanzi Ayancipha, Angene, Aphume",
    "Watch: Follow the Sun Across the Site":"Buka: Landela Ilanga Endaweni",
    "Watch: See Wind and Cold Air on the Map":"Buka: Bona Umoya Nomoya Obandayo Kumephu",
    "Watch: Draw the Land You Already Have":"Buka: Dweba Umhlaba Osuvele Unawo",
}
CAPTIONS={
    "Watch: Water Slows, Sinks, and Leaves":"Isithombe sibonisa imvula yehla emthambekeni. Landela lapho ijubha khona, isabalale, ingene emhlabathini, iqoqane, bese iphuma endaweni.",
    "Watch: Follow the Sun Across the Site":"Landela ilanga, isakhiwo, isihlahla, kanye nemithunzi yakho emthambekeni. Qhathanisa ilanga lasehlobo eliphezulu nelasebusika eliphansi.",
    "Watch: See Wind and Cold Air on the Map":"Indawo evikelekile emoyeni isengaqongelela umoya obandayo. Hlola ngokwehlukana ukuvikeleka emoyeni nobungozi besithwathwa.",
    "Watch: Draw the Land You Already Have":"Sebenzisa isithombe njengesiqondiso: umngcele, izakhiwo, imigwaqo, amanzi, imithambeka nemicibisholo ekhombisa izikhombisi-ndlela. Dweba okukhona ngaphambi kokuhlela izinguquko.",
}

def zu_chrome(img,english_title,english_caption):
    d=ImageDraw.Draw(img);title=TITLES.get(english_title,english_title);caption=CAPTIONS.get(english_title,english_caption)
    d.text((70,24),"IMBEWUFIELD · ISIFUNDO 2 · FUNDA INDAWO",font=land.FONT_LABEL,fill=land.C_MUTED,anchor="lt")
    title_font=land.FONT_TITLE; maxw=1140; lines=wrap(d,title,title_font,maxw)
    if len(lines)>2: raise ValueError(f"ZU diagram heading overflows: {title}")
    y=63
    for line in lines: d.text((70,y),line,font=title_font,fill=land.C_TEXT,anchor="lt");y+=title_font.size+4
    d.line([(70,117),(1210,117)],fill=(215,210,200),width=2)
    capfont=land.FONT_BODY; caplines=wrap(d,caption,capfont,1140); lineh=capfont.size+8
    if len(caplines)*lineh>145: raise ValueError(f"ZU diagram caption overflows: {caption}")
    y=530+(145-len(caplines)*lineh)//2
    for line in caplines: d.text((70,y),line,font=capfont,fill=land.C_TEXT,anchor="lt");y+=lineh
    footer="Umdwebo awulinganisiwe ngesikali";fw=d.textbbox((0,0),footer,font=land.FONT_FOOTER)[2]
    d.text(((1280-fw)//2,688),footer,font=land.FONT_FOOTER,fill=land.C_MUTED,anchor="lt")
land.render_layout_chrome=zu_chrome
land.FOOTER_TEXT="Umdwebo awulinganisiwe ngesikali"

OUT.mkdir(parents=True,exist_ok=True);MEDIA.mkdir(parents=True,exist_ok=True)
DIAGRAMS={
    5: ("diagram-05.jpg",lambda:land.draw_slide_05(1.0)),
    8: ("diagram-08.jpg",lambda:land.draw_slide_09(0.0)),
    9: ("diagram-09.jpg",lambda:land.draw_slide_09(0.5)),
    13:("diagram-13.jpg",lambda:land.draw_slide_13(0.85)),
    17:("diagram-17.jpg",lambda:land.draw_slide_17(1.0)),
}
art={}
for slide,(filename,render) in DIAGRAMS.items():
    path=MEDIA/filename
    render().convert("RGB").save(path,format="JPEG",quality=90,optimize=True)
    art[str(slide)]={"path":str(path.relative_to(ROOT)),"layout":"scene","reason":"Static isiZulu-labelled diagram; no animation asset is generated."}
overrides_path=MEDIA/"reading-landscape-zu-art-overrides.json"
overrides_path.write_text(json.dumps(art,ensure_ascii=False,indent=2)+"\n")
branding={"deckTitle":"Ukufunda Indawo","deckTagline":"Lesi yisifundo se-permaculture sabalimi abancane baseNingizimu Afrika.","eyebrow":"ImbewuField · Isifundo 2","footer":"ImbewuField","homeStudy":"ISIFUNDO SOKUFUNDA EKHAYA","largeText":True}
branding_path=MEDIA/"reading-landscape-zu-branding.json"
branding_path.write_text(json.dumps(branding,ensure_ascii=False,indent=2)+"\n")
# This source snapshot is the exact corrected 21-slide script rebuilt from the four packets by the
# parallel audio task. Keeping the snapshot here makes deck rendering reproducible on this branch
# without changing or depending on that task's audio files or unpublished checkout.
source_path = MEDIA / "reading-landscape-zu-render-source.md"
if not source_path.exists() or hashlib.sha256(source_path.read_bytes()).hexdigest() != "a22e0b20fa037fe3ff7be065cc9423868fe1e74aca542fa4b881295bc6c8e26b":
    raise RuntimeError("Corrected isiZulu source snapshot hash does not match the reviewed build input")
source_text=source_path.read_text(encoding="utf-8")
if len(re.findall(r"^\*\*(?:Ikhasi|Slide)\s*\d+",source_text,re.M)) != 21:
    raise RuntimeError("Expected exactly 21 corrected isiZulu slide headings")
subprocess.run(["node","scripts/make-lesson-slides.mjs","reading-landscape","zu",str(OUT),"--source",str(source_path),"--art-overrides",str(overrides_path),"--branding",str(branding_path)],cwd=ROOT,check=True)
for n in range(1,22):
    png=OUT/f"slide-{n:02d}.png";jpg=OUT/f"slide-{n:02d}.jpg"
    with Image.open(png) as im:
        if im.size!=(1920,1080): raise RuntimeError(f"Unexpected size: {im.size}")
        final=im.convert("RGBA")
        captions={
            6:"I-A-frame imaka amaphuzu asezingeni elifanayo. Izimpawu zayo azisona isinqumo sokumba. Cela ukuba indawo ihlolwe ngaphambi komsebenzi womhlaba.",
            10:"Hlola imithunzi yangempela kuleyo ndawo ngaphambi kokwakha noma ukufaka isakhiwo somthunzi.",
            16:"Maka umdwebo ukuthi awukabi ngesikali kuze kube usuwahlolile amabanga.",
            18:"Ukuba khona kwe-khakibos noma i-blackjack kukodwa akubonisi ukuthi umhlabathi ucindezelekile. Hlola umhlabathi.",
            20:"Hamba kuphela uma sekuphephile ngemva kwemvula enkulu. Maka amanzi aphumayo nendawo engase idinge umzila ophephile.",
        }
        if n in captions:
            d=ImageDraw.Draw(final,"RGBA");panel=(70,890,1850,1032)
            d.rounded_rectangle(panel,radius=20,fill=(245,240,228,238),outline=(31,77,43,255),width=3)
            lines=wrap(d,captions[n],font(46),1700)
            if len(lines)>2:raise RuntimeError(f"Photo safety caption overflow on slide {n}: {lines}")
            y=890
            for line in lines:
                d.text((105,y),line,font=font(46),fill=(32,25,15,255),anchor="lt");y+=58
        final.convert("RGB").save(jpg,format="JPEG",quality=85,optimize=True)
    png.unlink()

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

# Reproducible visual QA artifacts: one labeled contact sheet and selected samples at the
# requested phone-width target. These are inspection copies, not player assets.
contact=MEDIA/"reading-landscape-zu-contact-sheet.jpg"
tile_w,tile_h=340,208
sheet=Image.new("RGB",(tile_w*3,tile_h*7),(235,235,235));qa_font=ImageFont.load_default()
for i in range(1,22):
    p=OUT/f"slide-{i:02d}.jpg"
    with Image.open(p) as im:
        thumb=im.convert("RGB").resize((320,180))
    tile=Image.new("RGB",(tile_w,tile_h),"white");tile.paste(thumb,(10,8))
    ImageDraw.Draw(tile).text((10,190),f"Slide {i:02d}",font=qa_font,fill="black")
    sheet.paste(tile,(((i-1)%3)*tile_w,((i-1)//3)*tile_h))
sheet.save(contact,format="JPEG",quality=90,optimize=True)
sample_dir=MEDIA/"reading-landscape-zu-390px";sample_dir.mkdir(exist_ok=True)
sample_slides=[2,3,5,6,13,14,16,17,18,20,21]
for i in sample_slides:
    with Image.open(OUT/f"slide-{i:02d}.jpg") as im:
        resized=im.convert("RGB").resize((390,round(im.height*390/im.width)))
        resized.save(sample_dir/f"slide-{i:02d}.jpg",format="JPEG",quality=90,optimize=True)

en=ROOT/"docs/narration/reading-landscape.en.md";zu=ROOT/"docs/narration/reading-landscape.zu.md"
if SOURCE_STALE.exists() and sha(SOURCE_STALE)!=SOURCE_STALE_SHA: raise RuntimeError("Provided snapshot SHA changed")
draft_meta={str(p.relative_to(ROOT)):sha(p) for p in REVIEW_DRAFTS}
source_hash=sha(source_path)
report={"module":"reading-landscape","language":"zu","status":"unreviewed draft","sourceFiles":{"englishNarration":{"path":str(en.relative_to(ROOT)),"sha256":sha(en)},"correctedIsiZuluReviewDrafts":draft_meta,"combinedRenderInput":{"path":str(source_path.relative_to(ROOT)),"sha256":source_hash}},"staleSources":{"checkedInIsiZuluNarration":{"path":str(zu.relative_to(ROOT)),"sha256":sha(zu),"usedForDeck":False,"reason":"The current-main handoff explicitly identifies this narration as stale and directs that it not be used as learner speech."},"providedAudioSnapshot":{"commit":SOURCE_COMMIT,"fileSha256":SOURCE_STALE_SHA,"scriptUsedForDeck":False,"audioChanged":False,"matchesDeck":False}},"staleClaimCorrections":{"slide4":"Old narration frames water leaving as a lost resource; corrected draft says some excess water needs a safe route away.","slide6":"Old A-frame claims include unsupported tracing rates and assurances; corrected draft limits it to equal-height observations and requires site assessment before earthworks.","slide7":"Old fixed high/middle/low placement rule removed; corrected slide says there is no universal placement rule.","slides8-9":"Corrected sun guidance is scoped to much of South Africa and season/location; observe the actual site.","slides10-12":"Unsupported shade timing and regional month/wind assertions removed; current drafts call for checking actual shadows, local weather records/adviser.","slides14-15":"No guaranteed frost-free slope; airflow and morning sun do not cure late blight; local records/adviser and crop-health advice remain.","slide16":"Sketch remains marked not to scale until distances have been checked.","slide18":"Khakibos/blackjack presence alone does not diagnose compaction.","slides20-21":"Field walk is conditional on safety; A-frame is observation, not earthworks design or approval."},"slides":[],"staticDiagrams":{},"review":{"visual":"21 slides checked in the contact sheet; slides 5, 6, 13, 16, 17, 18, 20 and 21 checked at 390px wide. Diagram overlaps were revised; localized safety captions inspected.","contactSheet":{"path":str(contact.relative_to(ROOT)),"bytes":contact.stat().st_size,"sha256":sha(contact)},"phoneSamples":[{"slide":i,"path":str((sample_dir/f"slide-{i:02d}.jpg").relative_to(ROOT)),"width":390,"height":round(1080*390/1920),"sha256":sha(sample_dir/f"slide-{i:02d}.jpg")} for i in sample_slides],"language":"No fluent-speaker or local farming review claimed.","motion":"No animations or video files generated. Slide 17 remains a still and its map says not to scale."}}
for n in range(1,22):
    p=OUT/f"slide-{n:02d}.jpg"
    with Image.open(p) as im:
        if im.size!=(1920,1080): raise RuntimeError(f"Unexpected slide dimensions: {p}")
    report["slides"].append({"slide":n,"file":str(p.relative_to(ROOT)),"bytes":p.stat().st_size,"sha256":sha(p)})
for n,(filename,_) in DIAGRAMS.items():
    p=MEDIA/filename;report["staticDiagrams"][str(n)]={"file":str(p.relative_to(ROOT)),"bytes":p.stat().st_size,"sha256":sha(p)}
(MEDIA/"verification-zu.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print(f"Rendered 21 isiZulu stills to {OUT}")
