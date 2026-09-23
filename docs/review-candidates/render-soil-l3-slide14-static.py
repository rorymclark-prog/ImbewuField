#!/usr/bin/env python3
"""Render the static Soil Health L3 slide 14 comparison and its review copy."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUTPUTS = (
    ROOT / 'public/course-decks/soil-health/en/slide-14.jpg',
    ROOT / 'docs/review-candidates/soil-l3-slide14-static-comparison.jpg',
)
W, H = 1920, 1080
PAPER = (248, 245, 233)
PANEL = (255, 253, 248)
INK = (39, 45, 36)
GREEN = (34, 82, 48)
GOLD = (185, 118, 34)
SKY = (233, 241, 243)
RAIN = (61, 143, 190)
SOIL = (91, 57, 38)
SOIL_LIGHT = (117, 76, 47)
MULCH = (177, 132, 64)
MULCH_LIGHT = (213, 176, 102)
REGULAR = Path('/System/Library/Fonts/Supplemental/Arial.ttf')
BOLD = Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
FALLBACK_REGULAR = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
FALLBACK_BOLD = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')


def font(size, bold=False):
    candidates = (BOLD, FALLBACK_BOLD) if bold else (REGULAR, FALLBACK_REGULAR)
    path = next((candidate for candidate in candidates if candidate.exists()), None)
    if path is None:
        raise FileNotFoundError('Arial or DejaVu Sans is required to render this still')
    return ImageFont.truetype(str(path), size)


def centered(draw, bounds, text, face, fill):
    x1, y1, x2, y2 = bounds
    box = draw.textbbox((0, 0), text, font=face)
    tw, th = box[2]-box[0], box[3]-box[1]
    draw.text((x1+(x2-x1-tw)/2-box[0], y1+(y2-y1-th)/2-box[1]), text,
              font=face, fill=fill)


def draw_drop(draw, x, y, surface_y):
    # A fixed teardrop and short strike line are a still symbol, not a trajectory.
    draw.ellipse((x-15, y-12, x+15, y+18), fill=RAIN)
    draw.line((x, y+20, x, surface_y-2), fill=RAIN, width=7)


def draw_leaf(draw, x, y, flip=False):
    direction = -1 if flip else 1
    polygon = [(x-48*direction, y), (x-29*direction, y-20),
               (x+34*direction, y-15), (x+51*direction, y+2),
               (x+24*direction, y+20), (x-34*direction, y+16)]
    draw.polygon(polygon, fill=MULCH_LIGHT, outline=SOIL)
    draw.line((x-39*direction, y+2, x+39*direction, y+2), fill=SOIL_LIGHT, width=3)


def main():
    image = Image.new('RGB', (W, H), PAPER)
    draw = ImageDraw.Draw(image)
    draw.text((72, 24), 'SOIL HEALTH · LESSON 3', font=font(26, True), fill=GOLD)
    draw.text((72, 66), 'Rain Meets Two Soil Surfaces', font=font(62, True), fill=GREEN)
    draw.line((72, 148, 1848, 148), fill=(213, 205, 190), width=4)

    panels = [(72, 174, 920, 866), (1000, 174, 1848, 866)]
    surfaces = []
    for index, (x1, y1, x2, y2) in enumerate(panels):
        draw.rounded_rectangle((x1, y1, x2, y2), radius=22, fill=PANEL,
                               outline=(212, 204, 190), width=4)
        draw.rectangle((x1+4, y1+4, x2-4, y1+174), fill=SKY)
        label = 'BARE SOIL' if index == 0 else 'LOOSE MULCH'
        centered(draw, (x1+20, y1+15, x2-20, y1+111), label,
                 font(54, True), GREEN)
        # Equal panel geometry, surface height and raindrop count support comparison.
        surface_y = y1 + 392
        surfaces.append(surface_y)
        draw.rectangle((x1+4, surface_y, x2-4, y2-4), fill=SOIL)
        draw.line((x1+4, surface_y, x2-4, surface_y), fill=SOIL_LIGHT, width=8)
        for k in range(14):
            px = x1+45+(k*59) % (x2-x1-90)
            py = surface_y+52+(k*71) % 160
            r = 5+(k % 3)*2
            draw.ellipse((px-r, py-r, px+r, py+r), fill=SOIL_LIGHT)

    # Six sparse, evenly paired impacts. Bare soil has only a few small particles;
    # drops terminate at each surface, with no flow path, pooling or infiltration cue.
    left_x1, _, left_x2, _ = panels[0]
    right_x1, _, right_x2, _ = panels[1]
    surface_left, surface_right = surfaces
    for n in range(6):
        xl = left_x1+115+n*119
        xr = right_x1+115+n*119
        yy = 320+(n % 2)*24
        draw_drop(draw, xl, yy, surface_left)
        draw_drop(draw, xr, yy, surface_right-31)
        # Three restrained flecks at the bare impacts only.
        if n in (1, 3, 5):
            # Few large-enough-to-see, low flecks represent only small bare-soil splash.
            for ox, oy, r in ((-25, -26, 15), (0, -40, 14), (25, -24, 13)):
                cx = xl+ox
                cy = surface_left+oy
                draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=SOIL_LIGHT)

    # Separate, overlapping leaf/straw pieces leave gaps rather than forming a seal.
    cover_tops = []
    for n in range(8):
        x = right_x1+80+n*96
        y = surface_right-20-(n % 3)*7
        draw_leaf(draw, x, y, flip=bool(n % 2))
        cover_tops.append((x, y-20))
    # Rain marks end at the cover pieces, with no path through the soil.
    for n in range(6):
        x = right_x1+115+n*119
        yy = 320+(n % 2)*24
        draw.line((x, yy+20, x, surface_right-43-(n % 3)*7), fill=RAIN, width=7)

    draw.rounded_rectangle((72, 885, 1848, 1006), radius=18, fill=(230, 238, 226))
    centered(draw, (90, 896, 1830, 954), 'Loose cover can cushion raindrop impact',
             font(44, True), GREEN)
    centered(draw, (90, 954, 1830, 1000), 'CONCEPT DIAGRAM · NOT TO SCALE',
             font(28, True), (94, 86, 72))
    draw.text((72, 1032), 'ImbewuField · Imbewu Yohsintso', font=font(22, True), fill=(110, 99, 81))
    draw.text((1752, 1031), '14/18', font=font(24, True), fill=(110, 99, 81))
    for output in OUTPUTS:
        output.parent.mkdir(parents=True, exist_ok=True)
        image.save(output, 'JPEG', quality=94, subsampling=0, optimize=True)

if __name__ == '__main__':
    main()
