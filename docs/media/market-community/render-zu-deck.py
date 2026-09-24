#!/usr/bin/env python3
"""Render Market Gardening & Community's isiZulu slide stills and review evidence.

Source text comes from docs/narration/market-community.zu.md; content claims are not invented
here. The three Watch frames are static teaching diagrams, not animations.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "public/course-decks/market-community/zu"
MEDIA = ROOT / "docs/media/market-community"
W, H = 1920, 1080
BG = (245, 241, 232)
CARD = (253, 251, 247)
BORDER = (217, 208, 193)
INK = (44, 38, 32)
MUTED = (92, 82, 72)
GREEN = (45, 90, 39)
GREEN_LIGHT = (232, 240, 229)
GOLD = (198, 125, 10)
RUST = (166, 75, 42)

FONT_PATHS = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
]
FONT_PATH = next((p for p in FONT_PATHS if Path(p).exists()), None)
if not FONT_PATH:
    raise RuntimeError("Required Arial or DejaVu TrueType font not found")

def font(size: int, bold: bool = False):
    if bold:
        for p in ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
            if Path(p).exists(): return ImageFont.truetype(p, size)
    return ImageFont.truetype(FONT_PATH, size)

def wrap(draw, text, fnt, max_w):
    lines, cur = [], ""
    for word in text.split():
        test = f"{cur} {word}".strip()
        if draw.textlength(test, font=fnt) <= max_w:
            cur = test
        else:
            if cur: lines.append(cur)
            cur = word
    if cur: lines.append(cur)
    return lines

def centered(draw, text, xy, fnt, fill, max_w=None, line_gap=8):
    x, y = xy
    lines = wrap(draw, text, fnt, max_w) if max_w else [text]
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill, anchor="mt")
        y += fnt.size + line_gap
    return y

def base(title, caption):
    im = Image.new("RGB", (W,H), BG); d=ImageDraw.Draw(im)
    d.rounded_rectangle((70,30,1850,150), radius=18, fill=CARD, outline=BORDER, width=2)
    centered(d,title,(W//2,56),font(38,True),INK,1720,5)
    d.rounded_rectangle((70,865,1850,1035), radius=18, fill=CARD, outline=BORDER, width=2)
    centered(d,caption,(W//2,895),font(32),INK,1680,8)
    centered(d,"Umdwebo womqondo — awulinganiswanga",(W//2,1018),font(28),MUTED,1600,5)
    return im,d

def basket(d,cx,cy,s=26):
    d.polygon([(cx-s,cy-s//3),(cx+s,cy-s//3),(cx+s*3//4,cy+s),(cx-s*3//4,cy+s)],fill=GOLD,outline=INK)
    d.line([(cx-s,cy-s//3),(cx+s,cy-s//3)],fill=INK,width=3)
    d.ellipse((cx-s*4//5,cy-s*4//5,cx-s//5,cy-s//5),fill=RUST)
    d.ellipse((cx-s//4,cy-s,cx+s//3,cy-s*2//5),fill=GREEN)
    d.ellipse((cx+s//5,cy-s*4//5,cx+s*4//5,cy-s//5),fill=GOLD)

def check(d,cx,cy):
    d.line([(cx-18,cy),(cx-4,cy+15),(cx+24,cy-18)],fill=GREEN,width=8)

def render04(path):
    im,d=base("Buka: Okuboniswa Irekhodi Lepulazi", "Irekhodi lilandela isivuno esiya emndenini, ekuthengisweni, ekunikezweni noma ku-compost. Funda irekhodi lonke lesizini ngaphambi kwesinqumo sebhizinisi.")
    cols=["Ukuvuna","Ukudla komuzi","Ukuthengisa","Izipho","Compost"]
    widths=[275,335,320,300,300]; x0=185;y0=240; head=90; row=105
    x=x0
    for label,w in zip(cols,widths):
        d.rectangle((x,y0,x+w,y0+head),fill=GREEN_LIGHT,outline=BORDER,width=2)
        centered(d,label,(x+w//2,y0+27),font(30,True),INK,w-18,3);x+=w
    dests=[];x=x0
    for i,w in enumerate(widths):
        dests.append(x+w//2);x+=w
    for r in range(4):
        yy=y0+head+r*row
        d.rectangle((x0,yy,x0+sum(widths),yy+row),fill=CARD,outline=BORDER,width=2)
        basket(d,dests[0],yy+row//2,20);check(d,dests[r+1],yy+row//2)
    d.rounded_rectangle((650,770,1270,830),radius=8,fill=GREEN_LIGHT,outline=GREEN,width=3)
    centered(d,"Isifinyezo sesizini",(960,783),font(30,True),GREEN,580,3)
    im.save(path,quality=90,optimize=True)

def arrow(d,a,b,color=INK,width=6):
    d.line((a,b),fill=color,width=width)
    import math
    ang=math.atan2(b[1]-a[1],b[0]-a[0]);length=24
    p1=(b[0]+length*math.cos(ang+2.65),b[1]+length*math.sin(ang+2.65))
    p2=(b[0]+length*math.cos(ang-2.65),b[1]+length*math.sin(ang-2.65))
    d.polygon([b,p1,p2],fill=color)

def farm(d,cx,cy):
    d.rectangle((cx-55,cy-25,cx+55,cy+55),fill=RUST,outline=INK,width=3)
    d.polygon([(cx-70,cy-25),(cx,cy-85),(cx+70,cy-25)],fill=GREEN,outline=INK)
    d.rectangle((cx-18,cy+10,cx+18,cy+55),fill=CARD)

def render09(path):
    im,d=base("Buka: Lapho Okusele Kungaya Khona", "Okusele kungaya esitolo esiseceleni komgwaqo, ekulethweni kweqembu esitolo, noma ebhokisini elilethwa emzini. Imicibisholo ikhombisa indlela ngayinye.")
    farm(d,245,505)
    d.rounded_rectangle((105,395,400,615),radius=14,fill=GREEN_LIGHT,outline=BORDER,width=3)
    farm(d,250,495)
    labels=[("Itafula lokuthengisa\neceleni komgwaqo",1535),("Ukulethwa kweqembu\nesitolo",535), ("Ibhokisi eliya\nemzini",820)]
    ys=[320,520,720]
    for i,(label,x) in enumerate(labels):
        cy=ys[i]
        d.rounded_rectangle((1370,cy-75,1785,cy+75),radius=16,fill=CARD,outline=BORDER,width=3)
        centered(d,label,(1577,cy-40),font(30,True),INK,370,4)
        arrow(d,(400,505),(1300,cy),GREEN if i==1 else INK)
        if i==1:
            # Group delivery bundles the farm's boxes before they continue to the shop.
            for bx in (750,880,1010):
                d.rectangle((bx,cy-26,bx+66,cy+28),fill=RUST,outline=INK,width=2)
                d.ellipse((bx+15,cy-38,bx+35,cy-18),fill=GREEN)
                d.ellipse((bx+38,cy-38,bx+58,cy-18),fill=GOLD)
        else:
            basket(d,760,cy,24);arrow(d,(800,cy),(1320,cy),INK)
    im.save(path,quality=90,optimize=True)

def grower(d,cx,cy):
    d.ellipse((cx-34,cy-34,cx+34,cy+34),fill=GREEN_LIGHT,outline=GREEN,width=4)
    d.rectangle((cx-16,cy-5,cx+16,cy+27),fill=RUST)
    d.polygon([(cx-22,cy-5),(cx,cy-24),(cx+22,cy-5)],fill=GREEN)

def render14(path):
    im,d=base("Buka: Omakhelwane Basqinisa Kanjani Isivuno", "Iqembu lingabelana ngembewu, amathuluzi, amakhono nezokuthutha. Imizi eyahlukene iba inethiwekhi yokudla yasendaweni.")
    pts=[(960,275),(1340,405),(1195,690),(725,690),(580,405)]
    # Growers linked as peers; each label sits beside its own exchange node.
    for i,p in enumerate(pts):
        q=pts[(i+1)%len(pts)];arrow(d,p,q,GREEN,5)
    for p in pts: grower(d,*p)
    labels=[("Imbewu",960,210),("Amathuluzi",1450,385),("Amakhono",1260,755),("Ezokuthutha",660,755),("Abalimi",455,385)]
    for text,x,y in labels:
        centered(d,text,(x,y),font(29,True),INK,300,3)
    d.rounded_rectangle((700,455,1220,555),radius=14,fill=GREEN_LIGHT,outline=GOLD,width=3)
    centered(d,"Inethiwekhi yokudla yasendaweni",(960,481),font(30,True),GREEN,480,4)
    im.save(path,quality=90,optimize=True)

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    OUT.mkdir(parents=True,exist_ok=True); MEDIA.mkdir(parents=True,exist_ok=True)
    # These were temporary app assets in the first draft. The final diagrams are embedded in the
    # slides, so leaving copies in public/ would add needless downloads to the offline pack.
    for n in (4,9,14):
        stale=OUT/f"diagram-{n:02d}.jpg"
        if stale.exists(): stale.unlink()
    diagrams={4:MEDIA/"market-community-zu-diagram-04.jpg",9:MEDIA/"market-community-zu-diagram-09.jpg",14:MEDIA/"market-community-zu-diagram-14.jpg"}
    render04(diagrams[4]);render09(diagrams[9]);render14(diagrams[14])
    overrides={str(n):{"path":str(p.relative_to(ROOT)),"layout":"scene","reason":"isiZulu-labelled static concept diagram for this still slide."} for n,p in diagrams.items()}
    branding={"deckTitle":"Ingadi Yezimakethe Nomphakathi","deckTagline":"Ingadi yakho inikeza umndeni ukudla, imali, nolwazi oluwusizo.","eyebrow":"ImbewuField · Isifundo 10","footer":"ImbewuField","animationBadge":"Umdwebo","homeStudy":"ISIFUNDO SASEKHAYA","hideBilingualGloss":True}
    over_path=MEDIA/"market-community-zu-art-overrides.json";brand_path=MEDIA/"market-community-zu-branding.json"
    over_path.write_text(json.dumps(overrides,ensure_ascii=False,indent=2)+"\n")
    brand_path.write_text(json.dumps(branding,ensure_ascii=False,indent=2)+"\n")
    subprocess.run(["node","scripts/make-lesson-slides.mjs","market-community","zu",str(OUT),"--art-overrides",str(over_path),"--branding",str(brand_path)],cwd=ROOT,check=True)
    for n in range(1,21):
        png=OUT/f"slide-{n:02d}.png"; jpg=OUT/f"slide-{n:02d}.jpg"
        with Image.open(png) as im: im.convert("RGB").save(jpg,format="JPEG",quality=85,optimize=True)
        png.unlink()
    en=ROOT/"docs/narration/market-community.en.md";zu=ROOT/"docs/narration/market-community.zu.md"
    source={"module":"market-community","language":"zu","status":"unreviewed draft","sourceFiles":{str(p.relative_to(ROOT)):sha(p) for p in (en,zu)},"slides":[]}
    for n in range(1,21):
        p=OUT/f"slide-{n:02d}.jpg"
        if not p.exists(): raise RuntimeError(f"Missing generated slide {p}")
        with Image.open(p) as im:
            if im.size!=(1920,1080): raise RuntimeError(f"Unexpected slide size for {p}: {im.size}")
        source["slides"].append({"slide":n,"file":str(p.relative_to(ROOT)),"bytes":p.stat().st_size,"sha256":sha(p)})
    source["diagrams"]={str(n):{"file":str(p.relative_to(ROOT)),"bytes":p.stat().st_size,"sha256":sha(p)} for n,p in diagrams.items()}
    source["review"]={"visual":"20 generated stills inspected as contact sheet; representative slides inspected at 390px wide.","language":"No fluent-speaker or farming-expert review claimed.","motion":"No animation generated; three Watch slides are static diagrams."}
    (MEDIA/"verification-zu.json").write_text(json.dumps(source,ensure_ascii=False,indent=2)+"\n")
    print(f"Rendered 20 isiZulu stills to {OUT}")

if __name__=="__main__": main()
