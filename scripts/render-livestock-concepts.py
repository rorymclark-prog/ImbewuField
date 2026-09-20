#!/usr/bin/env python3
"""
Small Livestock authored Watch animations for ImbewuField.
Generates deterministic 1280x720 24fps H.264 clips, posters, contact sheets, and manifest.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT, FPS = 1280, 720, 24
DIAGRAM_Y0, DIAGRAM_Y1 = 150, 505

FONT_CACHE = {}


def get_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    size = max(28, size)
    key = (size, bold)
    if key in FONT_CACHE:
        return FONT_CACHE[key]
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "Arial Bold.ttf" if bold else "Arial.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
        "arial.ttf", "DejaVuSans.ttf",
    ]
    for cand in candidates:
        try:
            font = ImageFont.truetype(cand, size)
            FONT_CACHE[key] = font
            return font
        except Exception:
            continue
    raise RuntimeError(f"Missing required font Arial/DejaVu >= 28px (requested {size}px).")


def draw_centered_text(draw: ImageDraw.ImageDraw, xy, text: str, font, fill):
    bbox = font.getbbox(text)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    canvas_w,canvas_h=draw._image.size
    assert 0<=xy[0]-w/2 and xy[0]+w/2<=canvas_w and 0<=xy[1]-h/2 and xy[1]+h/2<=canvas_h, f"Text outside canvas: {text}"
    draw.text((xy[0] - w / 2 - bbox[0], xy[1] - h / 2 - bbox[1]), text, font=font, fill=fill)


def wrap_text(text: str, font, max_width: int):
    words = text.split()
    lines, curr = [], []
    for word in words:
        cand = " ".join(curr + [word])
        bbox = font.getbbox(cand)
        if (bbox[2] - bbox[0]) <= max_width:
            curr.append(word)
        else:
            if curr:
                lines.append(" ".join(curr))
            curr = [word]
    if curr:
        lines.append(" ".join(curr))
    return lines


def create_base_canvas(title: str, caption: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGBA", (WIDTH, HEIGHT), (246, 243, 235, 255))
    draw = ImageDraw.Draw(img)

    # Title zone (20..105)
    f_title = get_font(32, bold=True)
    draw_centered_text(draw, (WIDTH // 2, 58), title, f_title, (44, 34, 30, 255))

    # Diagram boundary card (150..505)
    draw.rounded_rectangle([40, 140, WIDTH - 40, 515], radius=14, fill=(251, 249, 243, 255), outline=(222, 214, 198, 255), width=2)

    # Caption card (530..675)
    draw.rounded_rectangle([40, 530, WIDTH - 40, 675], radius=12, fill=(238, 232, 220, 255), outline=(214, 204, 186, 255), width=2)
    f_cap = get_font(28, bold=False)
    lines = wrap_text(caption, f_cap, WIDTH - 120)
    line_h = 36
    assert len(lines)*line_h<=145, "Caption exceeds its card"
    start_y = 530 + (145 - len(lines) * line_h) // 2 + line_h // 2
    for i, line in enumerate(lines):
        draw_centered_text(draw, (WIDTH // 2, start_y + i * line_h), line, f_cap, (36, 26, 20, 255))

    # Footer
    f_foot = get_font(28, bold=False)
    draw_centered_text(draw, (WIDTH // 2, 696), "Concept diagram — not to scale", f_foot, (126, 114, 104, 255))
    return img, draw


# ---------------- Slide 4: Chicken Tractor ----------------
def render_chicken_tractor(t: float) -> Image.Image:
    title = "Watch: Chicken Tractor Moving Across an Empty Bed"
    caption = "Watch the chicken tractor move across an empty bed. Scratching clears old material and pests; manure stays behind as the pen prepares the soil for planting."
    img, draw = create_base_canvas(title, caption)

    # Tractor position stops and glides across the empty bed
    if t < 0.28:
        pen_x = 130.0
        scratch = True
    elif t < 0.42:
        pen_x = 130.0 + ((t - 0.28) / 0.14) * 360.0
        scratch = False
    elif t < 0.70:
        pen_x = 490.0
        scratch = True
    elif t < 0.84:
        pen_x = 490.0 + ((t - 0.70) / 0.14) * 360.0
        scratch = False
    else:
        pen_x = 850.0
        scratch = True

    pen_w, pen_h = 280, 160
    pen_y = 260
    bed_y = 420

    # Long empty bed
    draw.rectangle([70, bed_y, WIDTH - 70, 485], fill=(95, 64, 38, 255))
    draw.line([70, bed_y, WIDTH - 70, bed_y], fill=(125, 85, 50, 255), width=3)

    # A resting pen clears only the patch it has actually covered.
    def worked(x):
        for start,begin,span in [(130,0,.28),(490,.42,.28),(850,.84,.16)]:
            progress=min(1,max(0,(t-begin)/span))
            if progress>0 and start<=x<=start+pen_w*progress:return True
        return False
    for i,sx in enumerate(range(90,WIDTH-90,24)):
        if not worked(sx):
            draw.line((sx,bed_y,sx+4,bed_y-12),fill=(148,120,80,255),width=2)
            if i%3==0:
                draw.ellipse((sx+8,bed_y-7,sx+15,bed_y-1),fill=(40,30,20,255))
    for mx in range(140,1160,22):
        if worked(mx):
            draw.ellipse((mx,bed_y-5,mx+7,bed_y+1),fill=(49,30,17,255))

    # Tractor background wire mesh
    mesh_layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    m_draw = ImageDraw.Draw(mesh_layer)
    for gx in range(int(pen_x) + 12, int(pen_x + pen_w), 16):
        m_draw.line([gx, pen_y + 24, gx, bed_y], fill=(185, 175, 160, 130), width=1)
    for gy in range(pen_y + 30, bed_y, 16):
        m_draw.line([pen_x + 8, gy, pen_x + pen_w - 8, gy], fill=(185, 175, 160, 130), width=1)
    img.alpha_composite(mesh_layer)
    draw = ImageDraw.Draw(img)

    draw.line([pen_x + pen_w // 2, pen_y + 16, pen_x + pen_w // 2, bed_y], fill=(125, 78, 42, 255), width=4)

    # Chickens inside pen (feet on bed, scratching motion)
    chick_offsets = [50, 135, 215]
    for idx, off in enumerate(chick_offsets):
        cx = pen_x + off
        cy = bed_y - 28
        leg_rot = math.sin(t * 32 + idx * 2.1) * (12 if scratch else 4)
        head_bob = math.sin(t * 24 + idx * 1.7) * (5 if scratch else 1)

        # Legs
        draw.line([cx - 5, cy + 12, cx - 7 + leg_rot, bed_y], fill=(210, 150, 20, 255), width=2)
        draw.line([cx + 5, cy + 12, cx + 7 - leg_rot, bed_y], fill=(210, 150, 20, 255), width=2)
        # Body
        draw.ellipse([cx - 22, cy - 16, cx + 20, cy + 14], fill=(200, 95, 30, 255))
        # Tail
        draw.polygon([(cx - 20, cy), (cx - 36, cy - 14), (cx - 24, cy + 4)], fill=(140, 50, 15, 255))
        # Head & Comb
        hx, hy = cx + 18, cy - 14 + head_bob
        draw.ellipse([hx - 9, hy - 9, hx + 9, hy + 9], fill=(215, 110, 40, 255))
        draw.polygon([(hx + 7, hy - 2), (hx + 17, hy + 2), (hx + 7, hy + 5)], fill=(230, 165, 10, 255))
        draw.polygon([(hx - 4, hy - 9), (hx, hy - 17), (hx + 5, hy - 8)], fill=(190, 30, 30, 255))

    # Tractor wooden frame & roof
    draw.rectangle([pen_x, pen_y + 16, pen_x + pen_w, bed_y], outline=(125, 78, 42, 255), width=5)

    # Roof apex
    draw.polygon([(pen_x - 10, pen_y + 20), (pen_x + pen_w // 2, pen_y - 15), (pen_x + pen_w + 10, pen_y + 20)], fill=(95, 105, 115, 255), outline=(70, 80, 90, 255))
    # Skid wheels
    draw.ellipse([pen_x + 10, bed_y - 8, pen_x + 36, bed_y + 18], fill=(60, 60, 60, 255))
    draw.ellipse([pen_x + pen_w - 36, bed_y - 8, pen_x + pen_w - 10, bed_y + 18], fill=(60, 60, 60, 255))

    # Minimal light front wire lines
    for gy in [pen_y + 60, pen_y + 105]:
        draw.line([pen_x, gy, pen_x + pen_w, gy], fill=(210, 205, 195, 180), width=1)

    # Authentic concept labels
    f_lbl = get_font(28, bold=True)
    draw_centered_text(draw, (pen_x + pen_w // 2, pen_y - 35), "Chicken tractor", f_lbl, (55, 38, 25, 255))
    draw_centered_text(draw, (WIDTH - 180, 175), "Empty bed", f_lbl, (110, 80, 50, 255))
    if t>=.30:
        draw_centered_text(draw, (170, 175), "Manure", f_lbl, (70, 42, 22, 255))
        draw.line((170,195,170,408),fill=(160,139,108,255),width=2)
    return img


# ---------------- Slide 9: Bee Pollination ----------------
def render_bee_pollination(t: float) -> Image.Image:
    title = "Watch: Bees Moving Between Hive and Crops"
    caption = "Watch the bees leave the hive and move among flowering crops. Their movement carries pollen between flowers across the site."
    img, draw = create_base_canvas(title, caption)

    soil_y = 455
    draw.rectangle([70, soil_y, WIDTH - 70, 485], fill=(85, 60, 36, 255))
    draw.line([70, soil_y, WIDTH - 70, soil_y], fill=(60, 100, 45, 255), width=3)

    # Hive at left
    hx, hy = 110, 320
    draw.rectangle([hx, hy, hx + 110, soil_y], fill=(185, 140, 80, 255), outline=(130, 95, 50, 255), width=3)
    draw.rectangle([hx - 8, hy - 14, hx + 118, hy], fill=(140, 100, 55, 255))
    draw.rectangle([hx + 30, soil_y - 18, hx + 80, soil_y - 6], fill=(30, 25, 20, 255))  # Entrance
    entrance_pt = (hx + 55, soil_y - 12)

    # Flowering crops across bed
    flowers = [(430, 320), (710, 275), (990, 330)]
    visited = [t >= 0.22, t >= 0.52, t >= 0.82]

    for i, (fx, fy) in enumerate(flowers):
        # Stems rooted at soil line
        draw.line([fx, soil_y, fx, fy + 24], fill=(50, 120, 40, 255), width=5)
        draw.arc([fx - 25, fy + 45, fx + 5, fy + 75], 40, 160, fill=(50, 120, 40, 255), width=4)
        draw.arc([fx, fy + 25, fx + 30, fy + 55], 20, 140, fill=(50, 120, 40, 255), width=4)

        # Petals
        for ang in range(0, 360, 45):
            rad = math.radians(ang)
            px = fx + math.cos(rad) * 26
            py = fy + math.sin(rad) * 26
            draw.ellipse([px - 11, py - 11, px + 11, py + 11], fill=(248, 242, 224, 255), outline=(215, 195, 150, 255), width=2)
        # Center
        draw.ellipse([fx - 18, fy - 18, fx + 18, fy + 18], fill=(230, 140, 25, 255))

        # Transferred pollen particles on landing
        if visited[i]:
            for d in [(-6, -5), (6, -4), (0, 7), (-5, 6), (7, 4)]:
                draw.ellipse([fx + d[0] - 2, fy + d[1] - 2, fx + d[0] + 2, fy + d[1] + 2], fill=(255, 205, 10, 255))

    # Bee trajectory segments
    f1, f2, f3 = flowers[0], flowers[1], flowers[2]
    has_pollen = False
    if t < 0.18:  # Hive -> F1
        p = t / 0.18
        bx = entrance_pt[0] + p * (f1[0] - entrance_pt[0])
        by = entrance_pt[1] + p * (f1[1] - entrance_pt[1]) - math.sin(p * math.pi) * 70
    elif t < 0.28:  # At F1
        bx, by = f1[0], f1[1]
        has_pollen = True
    elif t < 0.48:  # F1 -> F2
        p = (t - 0.28) / 0.20
        bx = f1[0] + p * (f2[0] - f1[0])
        by = f1[1] + p * (f2[1] - f1[1]) - math.sin(p * math.pi) * 60
        has_pollen = True
    elif t < 0.58:  # At F2
        bx, by = f2[0], f2[1]
        has_pollen = True
    elif t < 0.78:  # F2 -> F3
        p = (t - 0.58) / 0.20
        bx = f2[0] + p * (f3[0] - f2[0])
        by = f2[1] + p * (f3[1] - f2[1]) - math.sin(p * math.pi) * 55
        has_pollen = True
    elif t < 0.88:  # At F3
        bx, by = f3[0], f3[1]
        has_pollen = True
    else:  # Return to hive
        p = (t - 0.88) / 0.12
        bx = f3[0] + p * (entrance_pt[0] - f3[0])
        by = f3[1] + p * (entrance_pt[1] - f3[1]) - math.sin(p * math.pi) * 90

    # Draw bee
    bee_lyr = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(bee_lyr)
    # Wings
    wing_w = math.sin(t * 60) * 14
    b_draw.ellipse([bx - 12, by - 24 + wing_w, bx + 2, by - 4], fill=(225, 240, 255, 180))
    b_draw.ellipse([bx - 2, by - 24 - wing_w, bx + 12, by - 4], fill=(225, 240, 255, 180))
    # Body (Striped)
    b_draw.ellipse([bx - 18, by - 10, bx + 18, by + 10], fill=(245, 175, 20, 255))
    b_draw.rectangle([bx - 8, by - 10, bx - 3, by + 10], fill=(25, 20, 15, 255))
    b_draw.rectangle([bx + 4, by - 9, bx + 9, by + 9], fill=(25, 20, 15, 255))
    # Pollen payload on bee legs
    if has_pollen:
        b_draw.ellipse([bx - 5, by + 8, bx + 3, by + 16], fill=(255, 210, 0, 255))
        b_draw.ellipse([bx + 4, by + 7, bx + 12, by + 15], fill=(255, 210, 0, 255))
    img.alpha_composite(bee_lyr)
    draw = ImageDraw.Draw(img)

    f_lbl = get_font(28, bold=True)
    draw_centered_text(draw, (hx + 55, hy - 40), "Hive", f_lbl, (55, 38, 25, 255))
    draw_centered_text(draw, (710, 190), "Flowering crops", f_lbl, (40, 85, 30, 255))
    draw_centered_text(draw, (1020, 220), "Pollen", f_lbl, (175, 115, 10, 255))
    return img


# ---------------- Slide 14: Nutrient Loop ----------------
def render_nutrient_loop(t: float) -> Image.Image:
    title = "Watch: Nutrients Moving in a Closed Livestock Loop"
    caption = "Watch nutrients move from plants to animals, then through manure and compost back to the growing bed."
    img, draw = create_base_canvas(title, caption)

    # 5 nodes arranged clockwise
    nodes = {
        "plants": {"pos": (420, 225), "label": "Plants", "col": (45, 115, 45, 255)},
        "animals": {"pos": (860, 225), "label": "Animals", "col": (195, 95, 30, 255)},
        "manure": {"pos": (1050, 345), "label": "Manure", "col": (95, 60, 35, 255)},
        "compost": {"pos": (640, 425), "label": "Compost", "col": (70, 45, 25, 255)},
        "bed": {"pos": (230, 345), "label": "Growing bed", "col": (110, 75, 45, 255)},
    }

    # Loop path: Plants -> Animals -> Manure -> Compost -> Growing bed -> Plants
    # Arrows curve clockwise. Compost is strictly visited BEFORE Growing bed.
    segments = [
        ("plants", "animals", (640, 185)),
        ("animals", "manure", (980, 255)),
        ("manure", "compost", (880, 425)),
        ("compost", "bed", (400, 425)),
        ("bed", "plants", (300, 255)),
    ]

    for n1, n2, ctrl in segments:
        p1 = nodes[n1]["pos"]
        p2 = nodes[n2]["pos"]
        pts = []
        for step in range(21):
            u = step / 20.0
            x = (1 - u) ** 2 * p1[0] + 2 * (1 - u) * u * ctrl[0] + u ** 2 * p2[0]
            y = (1 - u) ** 2 * p1[1] + 2 * (1 - u) * u * ctrl[1] + u ** 2 * p2[1]
            pts.append((x, y))
        for step in range(len(pts) - 1):
            draw.line([pts[step], pts[step + 1]], fill=(195, 182, 160, 255), width=4)
        # Arrowheads stop before node circles so the direction remains visible.
        u=.78
        bx=(1-u)**2*p1[0]+2*(1-u)*u*ctrl[0]+u*u*p2[0]
        by=(1-u)**2*p1[1]+2*(1-u)*u*ctrl[1]+u*u*p2[1]
        dx=2*(1-u)*(ctrl[0]-p1[0])+2*u*(p2[0]-ctrl[0])
        dy=2*(1-u)*(ctrl[1]-p1[1])+2*u*(p2[1]-ctrl[1])
        length=math.hypot(dx,dy);ux,uy=dx/length,dy/length
        draw.polygon([(bx,by),(bx-16*ux+7*uy,by-16*uy-7*ux),(bx-16*ux-7*uy,by-16*uy+7*ux)],fill=(125,105,78,255))

    # Draw Nodes
    f_lbl = get_font(28, bold=True)
    for key, data in nodes.items():
        x, y = data["pos"]
        draw.ellipse([x - 48, y - 48, x + 48, y + 48], fill=(255, 255, 255, 255), outline=data["col"], width=4)

        # Node Icon sketches
        if key == "plants":
            draw.line([x, y + 20, x, y - 10], fill=(45, 115, 45, 255), width=3)
            draw.arc([x - 18, y - 18, x, y], 180, 360, fill=(45, 115, 45, 255), width=3)
            draw.arc([x, y - 18, x + 18, y], 180, 360, fill=(45, 115, 45, 255), width=3)
            draw_centered_text(draw, (x, y - 58), data["label"], f_lbl, (35, 25, 20, 255))
        elif key == "animals":
            draw.ellipse([x - 15, y - 5, x + 15, y + 15], fill=(195, 95, 30, 255))
            draw.ellipse([x + 8, y - 16, x + 20, y - 4], fill=(215, 110, 40, 255))
            draw.polygon([(x+20,y-12),(x+28,y-8),(x+20,y-5)],fill=(225,155,15,255))
            draw.line((x-5,y+13,x-8,y+23),fill=(185,120,20,255),width=2)
            draw.line((x+5,y+13,x+8,y+23),fill=(185,120,20,255),width=2)
            draw.polygon([(x-14,y+4),(x-25,y-6),(x-20,y+10)],fill=(150,65,20,255))
            draw_centered_text(draw, (x, y - 58), data["label"], f_lbl, (35, 25, 20, 255))
        elif key == "manure":
            draw.ellipse([x - 14, y + 2, x + 14, y + 16], fill=(95, 60, 35, 255))
            draw.ellipse([x - 10, y - 10, x + 10, y + 2], fill=(85, 50, 30, 255))
            draw_centered_text(draw, (x + 108, y), data["label"], f_lbl, (35, 25, 20, 255))
        elif key == "compost":
            # Layered compost pile
            draw.polygon([(x - 24, y + 16), (x + 24, y + 16), (x + 14, y - 14), (x - 14, y - 14)], fill=(65, 42, 22, 255))
            draw.line([x - 18, y + 4, x + 18, y + 4], fill=(105, 80, 45, 255), width=2)
            draw.line([x - 12, y - 6, x + 12, y - 6], fill=(145, 115, 65, 255), width=2)
            draw_centered_text(draw, (x, y + 62), data["label"], f_lbl, (35, 25, 20, 255))
        elif key == "bed":
            draw.rectangle([x - 26, y - 6, x + 26, y + 16], fill=(110, 75, 45, 255))
            draw.line([x - 12, y - 6, x - 12, y - 16], fill=(50, 130, 45, 255), width=2)
            draw.line([x + 10, y - 6, x + 10, y - 16], fill=(50, 130, 45, 255), width=2)
            draw_centered_text(draw, (x, y + 62), data["label"], f_lbl, (35, 25, 20, 255))

    # Animated circulating nutrient tokens (visibly passing compost before bed)
    num_tokens = 3
    for k in range(num_tokens):
        tok_t = (t + k / num_tokens) % 1.0
        seg_idx = int(tok_t * 5)
        seg_u = (tok_t * 5) - seg_idx
        n1, n2, ctrl = segments[seg_idx]
        p1, p2 = nodes[n1]["pos"], nodes[n2]["pos"]
        tx = (1 - seg_u) ** 2 * p1[0] + 2 * (1 - seg_u) * seg_u * ctrl[0] + seg_u ** 2 * p2[0]
        ty = (1 - seg_u) ** 2 * p1[1] + 2 * (1 - seg_u) * seg_u * ctrl[1] + seg_u ** 2 * p2[1]

        # Token color reflects stage of cycle
        cols = [
            (50, 150, 50, 255),   # Plants -> Animals (green feed)
            (180, 100, 30, 255),  # Animals -> Manure (organic)
            (100, 65, 35, 255),   # Manure -> Compost (raw manure)
            (215, 165, 25, 255),  # Compost -> Bed (stabilized rich fertility)
            (70, 160, 60, 255),   # Bed -> Plants (assimilated nutrients)
        ]
        draw.ellipse([tx - 11, ty - 11, tx + 11, ty + 11], fill=cols[seg_idx], outline=(255, 255, 255, 255), width=3)
    return img


SLIDES = [
    {
        "id": "watch-04-chicken-tractor",
        "title": "Watch: Chicken Tractor Moving Across an Empty Bed",
        "caption": "Watch the chicken tractor move across an empty bed. Scratching clears old material and pests; manure stays behind as the pen prepares the soil for planting.",
        "render": render_chicken_tractor,
        "slide_num": 4,
    },
    {
        "id": "watch-09-bee-pollination",
        "title": "Watch: Bees Moving Between Hive and Crops",
        "caption": "Watch the bees leave the hive and move among flowering crops. Their movement carries pollen between flowers across the site.",
        "render": render_bee_pollination,
        "slide_num": 9,
    },
    {
        "id": "watch-14-nutrient-loop",
        "title": "Watch: Nutrients Moving in a Closed Livestock Loop",
        "caption": "Watch nutrients move from plants to animals, then through manure and compost back to the growing bed.",
        "render": render_nutrient_loop,
        "slide_num": 14,
    },
]


def render_contact_sheet(slide: dict, out_path: Path):
    samples = [0.10, 0.35, 0.60, 0.85, 0.98]
    tile_w, tile_h = 640, 360
    badge_h = 44
    cell_h = tile_h + badge_h + 20
    cw = tile_w * 2 + 60
    ch = cell_h * 3 + 40
    contact = Image.new("RGBA", (cw, ch), (240, 236, 226, 255))
    c_draw = ImageDraw.Draw(contact)
    f_badge = get_font(28, bold=True)

    for idx, s in enumerate(samples):
        r, c = divmod(idx, 2)
        x = 20 + c * (tile_w + 20)
        y = 20 + r * cell_h

        # Phase badge outside frame
        badge_text = f"Phase t = {s:.2f}"
        c_draw.rounded_rectangle([x, y, x + 210, y + badge_h - 6], radius=6, fill=(50, 40, 32, 255))
        draw_centered_text(c_draw, (x + 105, y + (badge_h - 6) // 2), badge_text, f_badge, (245, 240, 230, 255))

        frame = slide["render"](s).resize((tile_w, tile_h), Image.Resampling.LANCZOS)
        contact.paste(frame, (x, y + badge_h))
        c_draw.rectangle([x, y + badge_h, x + tile_w, y + badge_h + tile_h], outline=(180, 170, 155, 255), width=1)

    contact.convert("RGB").save(out_path)


def probe_audio(audio_path: Path) -> tuple[float, str]:
    if not audio_path.is_file():
        raise FileNotFoundError(f"Missing required audio file: {audio_path}")
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0 or not res.stdout.strip():
        raise ValueError(f"Invalid audio file or failed ffprobe on {audio_path}")
    dur = float(res.stdout.strip())
    if not math.isfinite(dur) or dur <= 0:
        raise ValueError(f"Audio duration must be > 0 in {audio_path}")
    sha = hashlib.sha256(audio_path.read_bytes()).hexdigest()
    return dur, sha


def main():
    parser = argparse.ArgumentParser(description="Author Small Livestock Watch animations.")
    parser.add_argument("--output", required=True, help="Output root directory")
    parser.add_argument("--preview", action="store_true", help="Generate posters/contacts only")
    parser.add_argument("--audio-dir", help="Optional audio directory; defaults to ROOT/inputs/english-audio")
    args = parser.parse_args()

    root = Path(args.output).resolve()
    clips_dir = root / "clips"
    posters_dir = root / "posters"
    contacts_dir = root / "contacts"
    for d in [clips_dir, posters_dir, contacts_dir]:
        d.mkdir(parents=True, exist_ok=True)

    audio_dir = Path(args.audio_dir).resolve() if args.audio_dir else root / "inputs" / "english-audio"
    manifest_rows = []

    for slide in SLIDES:
        s_num = slide["slide_num"]
        audio_path = audio_dir / f"slide-{s_num:02d}.mp3"
        audio_dur, audio_sha = probe_audio(audio_path)

        # Poster at main concept
        poster_path = posters_dir / f"{slide['id']}.png"
        poster_img = slide["render"](0.60)
        poster_img.convert("RGB").save(poster_path)

        # Contact sheet
        contact_path = contacts_dir / f"slide-{s_num:02d}.png"
        render_contact_sheet(slide, contact_path)

        clip_path = clips_dir / f"{slide['id']}.mp4"
        duration_sec = max(14.0, audio_dur + 1.0)
        total_frames = int(math.ceil(duration_sec * FPS))

        if not args.preview:
            cmd = [
                "ffmpeg", "-v", "error", "-y",
                "-f", "rawvideo", "-pix_fmt", "rgba",
                "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS),
                "-i", "-",
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                str(clip_path)
            ]
            proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
            for f in range(total_frames):
                t = f / (total_frames - 1) if total_frames > 1 else 0.0
                frame = slide["render"](t)
                proc.stdin.write(frame.tobytes())
            proc.stdin.close()
            proc.wait()
            if proc.returncode != 0:
                raise RuntimeError(f"FFmpeg encoding failed for {clip_path}")

            # Probe generated clip
            p_cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(clip_path)]
            p_res = subprocess.run(p_cmd, capture_output=True, text=True)
            encoded_sec = float(p_res.stdout.strip())
            clip_bytes = clip_path.stat().st_size
            clip_sha = hashlib.sha256(clip_path.read_bytes()).hexdigest()
        else:
            encoded_sec = duration_sec
            clip_bytes = 0
            clip_sha = ""

        manifest_rows.append({
            "slide": s_num,
            "path": str(clip_path.relative_to(root)),
            "poster": str(poster_path.relative_to(root)),
            "seconds": encoded_sec,
            "bytes": clip_bytes,
            "sha256": clip_sha,
            "audio_path": str(audio_path.relative_to(root)) if audio_path.is_relative_to(root) else str(audio_path),
            "audio_seconds": audio_dur,
            "audio_sha256": audio_sha,
            "caption": slide["caption"],
        })

    with open(root / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest_rows, f, indent=2)


if __name__ == "__main__":
    main()
