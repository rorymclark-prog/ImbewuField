from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
OUT = HERE / "water-l2-slide12-v2-phone-redesign.png"
PHONE = HERE / "water-l2-slide12-v2-phone-fit-269.png"
W, H = 1920, 1080
im = Image.new("RGB", (W, H), "#f3f0e6")
d = ImageDraw.Draw(im)

def font(size, bold=False):
    name = "Verdana Bold.ttf" if bold else "Verdana.ttf"
    return ImageFont.truetype(f"/System/Library/Fonts/Supplemental/{name}", size)

navy = "#071923"
green = "#315847"
blue = "#168ec7"
soil = "#98714c"
cream = "#f3f0e6"
white = "#ffffff"

# A short title and explicit concept limit survive a narrow phone view.
d.rectangle((0, 0, W, 150), fill=navy)
d.text((72, 37), "DAM AND SPILLWAY", font=font(64, True), fill=white)
d.text((1320, 55), "CONCEPT ONLY · NOT TO SCALE", font=font(31, True), fill="#d6e2dc")

# Unspecified runoff and a retained pond are shown as a broad concept, not a
# surveyed profile. No dimensions, construction layers, or safe capacity claim.
d.rectangle((0, 150, W, 820), fill="#dce9dc")
d.polygon([(0, 540), (370, 510), (730, 535), (1080, 550), (1470, 565), (1920, 590), (1920, 820), (0, 820)], fill="#b9d1af")
d.rectangle((0, 650, 1920, 820), fill="#9b7957")

# The pond is held behind an illustrative earth barrier.
d.polygon([(95, 550), (695, 555), (735, 615), (95, 615)], fill=blue)
for y in (574, 594):
    d.line((125, y, 660, y), fill="#8bd6ee", width=5)

# Simple earth barrier. Its stylised outline is not a buildable section.
d.polygon([(735, 820), (830, 515), (1050, 515), (1185, 820)], fill=soil)
d.line((830, 515, 1050, 515), fill="#5d4631", width=9)

# A distinct bypass route is drawn around the barrier at right, separate from it.
d.line([(1100, 575), (1260, 590), (1390, 625), (1500, 675), (1630, 710), (1820, 745)], fill="#4e8453", width=68, joint="curve")
d.line([(1100, 575), (1260, 590), (1390, 625), (1500, 675), (1630, 710), (1820, 745)], fill=blue, width=39, joint="curve")
d.polygon([(1825, 745), (1770, 709), (1777, 756)], fill=blue)

# Oversized labels point to the concepts, rather than to construction features.
d.rounded_rectangle((115, 292, 760, 390), radius=18, fill=navy)
d.text((148, 308), "EARTH DAM", font=font(56, True), fill=white)
d.line((760, 342, 900, 500), fill=navy, width=6)
d.rounded_rectangle((1200, 300, 1815, 398), radius=18, fill=green)
d.text((1234, 316), "SEPARATE SPILLWAY", font=font(43, True), fill=white)
d.line((1435, 398, 1405, 535), fill=green, width=6)
d.rounded_rectangle((150, 660, 515, 742), radius=16, fill="#075d87")
d.text((177, 676), "STORED WATER", font=font(39, True), fill=white)

# Phone-first statement: concise and readable, with full exact wording retained
# in the lesson narration and review packet rather than squeezed onto this slide.
d.rectangle((0, 820, W, H), fill=navy)
d.text((72, 846), "Catchment runoff is one input.", font=font(53, True), fill=white)
d.text((72, 925), "A qualified person must design the dam and spillway.", font=font(53, True), fill=white)

im.save(OUT, optimize=True)
im.resize((269, 151), Image.Resampling.LANCZOS).save(PHONE, optimize=True)
