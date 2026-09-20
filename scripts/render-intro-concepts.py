#!/usr/bin/env python3
"""
Introduction to Permaculture — Deterministic Media Renderer
===========================================================
Outputs:
  - 3 silent H.264 video clips (1280x720, 24fps, yuv420p, faststart)
  - 3 posters (1280x720 PNG)
  - 3 contact sheets (1920x1080 PNG, 6 educational phases)
  - 1 narrated review reel (audio muxed with apad tail, burned review badge)
  - manifest.json (exact authored captions, byte sizes, durations, sha256)
"""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont

# Ensure standard binary search paths for ffmpeg / ffprobe
for extra_path in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"]:
    if extra_path not in os.environ.get("PATH", ""):
        os.environ["PATH"] = extra_path + ":" + os.environ.get("PATH", "")

WIDTH = 1280
HEIGHT = 720
FPS = 24

# Fixed Layout Regions
HEADER_BOX = (48, 20, 1232, 100)
DIAGRAM_BOX = (48, 150, 1232, 505)
CAPTION_BOX = (48, 530, 1232, 672)
DISCLAIMER_BOX = (950, 680, 1232, 712)

PALETTE = {
    "paper": (245, 242, 235),
    "paper_dark": (230, 224, 212),
    "card_bg": (255, 255, 255, 235),
    "card_border": (195, 188, 175),
    "ink": (35, 37, 40),
    "ink_muted": (95, 100, 105),
    "not_to_scale": (120, 125, 130),
    "soil_top": (115, 78, 58),
    "soil_sub": (155, 112, 86),
    "water_deep": (46, 107, 142),
    "water_light": (96, 155, 191),
    "water_pale": (205, 228, 242),
    "green_deep": (35, 77, 46),
    "green_mid": (62, 115, 72),
    "green_light": (142, 182, 129),
    "green_shelter": (198, 224, 192, 180),
    "earth_care": (46, 125, 50),
    "people_care": (216, 107, 42),
    "fair_share": (59, 115, 175),
    "warn_red": (192, 57, 43),
    "gold": (224, 168, 45),
    "hail_cloud": (85, 95, 105),
    "hail_ice": (225, 240, 250),
    "wind_stream": (190, 110, 50),
    "wind_gentle": (100, 145, 170),
}

# -----------------------------------------------------------------------------
# TYPOGRAPHY & MEASURED TEXT WRAPPING
# -----------------------------------------------------------------------------
def get_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    raise RuntimeError("A supported Arial or DejaVu font is required for readable captions")

FONT_TITLE = get_font(30, bold=True)
FONT_LABEL = get_font(28, bold=True)
FONT_CAPTION = get_font(28, bold=False)
FONT_DISCLAIMER = get_font(16, bold=False)
FONT_BADGE = get_font(28, bold=True)

def draw_text_box(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont,
                  box: tuple, fill: tuple, align: str = "left", line_spacing: int = 4):
    x0, y0, x1, y1 = box
    max_w = x1 - x0
    max_h = y1 - y0
    words = text.split()
    lines = []
    curr = []
    for w in words:
        test = " ".join(curr + [w])
        bbox = draw.textbbox((0, 0), test, font=font)
        if (bbox[2] - bbox[0]) <= max_w:
            curr.append(w)
        else:
            if curr:
                lines.append(" ".join(curr))
                curr = [w]
            else:
                lines.append(w)
                curr = []
    if curr:
        lines.append(" ".join(curr))

    sample_box = draw.textbbox((0, 0), "Ay", font=font)
    line_h = (sample_box[3] - sample_box[1]) + line_spacing
    total_h = len(lines) * line_h
    assert all(draw.textbbox((0, 0), line, font=font)[2] <= max_w for line in lines), f"Word exceeds box: {text}"
    assert total_h <= max_h, f"Overflow in {box}: needed {total_h}px, max {max_h}px for text '{text}'"

    y = y0 + (max_h - total_h) // 2 if align == "center_v" else y0
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        lw = bbox[2] - bbox[0]
        lx = x0 + (max_w - lw) // 2 if align == "center" else (x1 - lw if align == "right" else x0)
        draw.text((lx, y - bbox[1]), line, font=font, fill=fill)
        y += line_h

def draw_header_and_disclaimer(draw: ImageDraw.ImageDraw, title: str):
    draw_text_box(draw, title, FONT_TITLE, (HEADER_BOX[0], HEADER_BOX[1] + 15, 660 if "Three Ethics" in title else 1232, HEADER_BOX[3] - 10), PALETTE["ink"])
    draw.line([(HEADER_BOX[0], HEADER_BOX[3]), (HEADER_BOX[2], HEADER_BOX[3])], fill=PALETTE["card_border"], width=1)
    draw_text_box(draw, "Concept diagram — not to scale", FONT_DISCLAIMER, DISCLAIMER_BOX, PALETTE["not_to_scale"], align="right")

def draw_caption_card(draw: ImageDraw.ImageDraw, text: str):
    draw.rounded_rectangle(CAPTION_BOX, radius=10, fill=PALETTE["card_bg"], outline=PALETTE["card_border"], width=2)
    inner_box = (CAPTION_BOX[0] + 20, CAPTION_BOX[1] + 16, CAPTION_BOX[2] - 20, CAPTION_BOX[3] - 16)
    draw_text_box(draw, text, FONT_CAPTION, inner_box, PALETTE["ink"], align="center_v")

def draw_person(draw: ImageDraw.ImageDraw, x: int, y: int, scale: float = 1.0, color=(50, 50, 50), bucket: bool = False):
    r = int(8 * scale)
    draw.ellipse([x - r, y - int(34 * scale), x + r, y - int(18 * scale)], fill=color)
    tw = int(12 * scale)
    draw.rounded_rectangle([x - tw // 2, y - int(16 * scale), x + tw // 2, y + int(8 * scale)], radius=int(3 * scale), fill=color)
    draw.line([(x - 3 * scale, y + int(8 * scale)), (x - 4 * scale, y + int(26 * scale))], fill=color, width=max(2, int(3 * scale)))
    draw.line([(x + 3 * scale, y + int(8 * scale)), (x + 4 * scale, y + int(26 * scale))], fill=color, width=max(2, int(3 * scale)))
    if bucket:
        draw.line([(x + 5 * scale, y - int(10 * scale)), (x + 14 * scale, y + int(6 * scale))], fill=color, width=max(2, int(3 * scale)))
        bx, by = x + int(14 * scale), y + int(6 * scale)
        bw, bh = int(9 * scale), int(11 * scale)
        draw.polygon([(bx - bw // 2, by), (bx + bw // 2, by), (bx + bw // 3, by + bh), (bx - bw // 3, by + bh)], fill=PALETTE["water_deep"])
    else:
        draw.line([(x - 5 * scale, y - int(10 * scale)), (x - 8 * scale, y + int(6 * scale))], fill=color, width=max(2, int(3 * scale)))
        draw.line([(x + 5 * scale, y - int(10 * scale)), (x + 8 * scale, y + int(6 * scale))], fill=color, width=max(2, int(3 * scale)))

def draw_ethics_pill(draw: ImageDraw.ImageDraw, x: int, y: int, name: str, active: bool, color: tuple):
    w, h = 175, 42
    bg = color if active else (225, 222, 215)
    tc = (255, 255, 255) if active else (130, 130, 130)
    bc = color if active else (190, 185, 175)
    draw.rounded_rectangle([x, y, x + w, y + h], radius=18, fill=bg, outline=bc, width=2)
    draw_text_box(draw, name, FONT_BADGE, (x, y + 4, x + w, y + h - 4), tc, align="center")

# -----------------------------------------------------------------------------
# SCRIPT CAPTIONS & TIMING
# -----------------------------------------------------------------------------
SLIDE_07_CAPTIONS = [
    "A borehole is producing more water than your household needs.",
    "You could keep it closed.",
    "You could open it to everyone and watch the level drop.",
    "Sharing access with your neighbours while you monitor the water table serves all three at once.",
    "People Care and Fair Share in the sharing. Earth Care in the monitoring.",
    "The other choices each serve one ethic and ignore the rest.",
]

SLIDE_13_CAPTIONS = [
    "A monoculture maize field can be wiped out by one hailstorm. A mixed planting rarely is.",
    'That is the principle "use and value diversity", and it is insurance you plant rather than buy.',
    "Two others worth knowing: produce no waste, so scraps become compost and compost becomes soil.",
    "And use small and slow solutions — a bucket can irrigate a bed with no electricity at all.",
    "What would one bad day cost you right now?",
]

SLIDE_19_CAPTIONS = [
    "A Highveld farm gets hot, dry north-westerly winds in August.",
    "The windbreak goes on the north-west boundary, standing between the wind and the crops.",
    "That is all a windbreak does — it stands between the energy and the thing the energy would damage.",
    "Put it anywhere else and it is just a row of trees.",
    "The same logic places a firebreak, and it places your tender crops out of a frost pocket.",
]

def get_caption_by_progress(captions: list, p: float) -> str:
    total_words = sum(len(c.split()) for c in captions)
    cur_word = p * total_words
    cum = 0
    for c in captions:
        cum += len(c.split())
        if cur_word <= cum:
            return c
    return captions[-1]

# -----------------------------------------------------------------------------
# SLIDE RENDERERS
# -----------------------------------------------------------------------------
def render_frame_slide_07(t: float, total_d: float) -> Image.Image:
    base = Image.new("RGBA", (WIDTH, HEIGHT), PALETTE["paper"] + (255,))
    draw = ImageDraw.Draw(base)
    draw_header_and_disclaimer(draw, "Watch: One Decision, Three Ethics")

    p = min(1.0, t / (total_d - 1.0))
    counts = [len(c.split()) for c in SLIDE_07_CAPTIONS]
    closed_start = counts[0] / sum(counts)
    drop_start = sum(counts[:2]) / sum(counts)
    shared_start = sum(counts[:3]) / sum(counts)
    phase_closed = closed_start <= p < drop_start
    phase_drop = drop_start <= p < shared_start
    phase_shared = p >= shared_start
    draw_ethics_pill(draw, 690, 42, "Earth Care", phase_closed or phase_shared, PALETTE["earth_care"])
    draw_ethics_pill(draw, 875, 42, "People Care", phase_drop or phase_shared, PALETTE["people_care"])
    draw_ethics_pill(draw, 1060, 42, "Fair Share", phase_shared, PALETTE["fair_share"])

    # Diagram layout strictly y150..505
    ground_y = 330
    draw.rectangle([DIAGRAM_BOX[0], ground_y, DIAGRAM_BOX[2], ground_y + 16], fill=PALETTE["soil_top"])
    draw.rectangle([DIAGRAM_BOX[0], ground_y + 16, DIAGRAM_BOX[2], DIAGRAM_BOX[3]], fill=PALETTE["soil_sub"])

    # The same falling level continues into monitoring: measurement does not refill a borehole.
    if p < drop_start:
        water_y = 400
    elif phase_drop:
        water_y = int(400 + (p - drop_start) / (shared_start - drop_start) * 45)
    else:
        water_y = int(445 + (p - shared_start) / (1 - shared_start) * 15)

    draw.rectangle([DIAGRAM_BOX[0], water_y, DIAGRAM_BOX[2], DIAGRAM_BOX[3]], fill=PALETTE["water_deep"])
    draw.line([(DIAGRAM_BOX[0], water_y), (DIAGRAM_BOX[2], water_y)], fill=PALETTE["water_light"], width=3)
    draw_text_box(draw, "Water table", FONT_LABEL, (620, water_y - 34, 820, water_y - 2), (255, 255, 255) if water_y > 440 else PALETTE["ink"])

    # Household on left
    draw_text_box(draw, "Household", FONT_LABEL, (100, 160, 260, 200), PALETTE["ink"])
    draw.rectangle([110, ground_y - 80, 250, ground_y], fill=(210, 195, 175), outline=(120, 110, 100), width=2)
    draw.polygon([(90, ground_y - 80), (180, ground_y - 130), (270, ground_y - 80)], fill=(160, 80, 60))
    draw_person(draw, 310, ground_y - 2, scale=1.1, color=PALETTE["ink"], bucket=phase_shared)

    # Borehole well casing & pump
    well_x = 480
    draw_text_box(draw, "Borehole", FONT_LABEL, (well_x - 90, 160, well_x + 100, 205), PALETTE["ink"])
    draw.rectangle([well_x - 10, ground_y - 70, well_x + 10, 495], fill=(70, 75, 80))
    draw.rectangle([well_x - 22, ground_y - 80, well_x + 22, ground_y], fill=(50, 55, 60))
    draw.line([(well_x, ground_y - 80), (well_x + 35, ground_y - 80), (well_x + 35, ground_y - 45)], fill=(70, 75, 80), width=6)

    # Neighbours on right
    draw_text_box(draw, "Neighbours", FONT_LABEL, (800, 160, 1000, 200), PALETTE["ink"])
    if phase_closed:
        draw.rectangle([well_x + 24, ground_y - 65, well_x + 48, ground_y - 35], fill=PALETTE["warn_red"])
        draw_person(draw, 840, ground_y - 2, scale=1.0, color=(140, 80, 80))
        draw_person(draw, 910, ground_y - 2, scale=1.0, color=(140, 80, 80))
    elif phase_drop:
        draw.line([(well_x + 35, ground_y - 45), (well_x + 90, ground_y)], fill=PALETTE["water_light"], width=6)
        draw_person(draw, 580, ground_y - 2, scale=1.0, color=PALETTE["ink"], bucket=True)
        draw_person(draw, 640, ground_y - 2, scale=1.0, color=PALETTE["ink"], bucket=True)
        draw_person(draw, 840, ground_y - 2, scale=1.0, color=PALETTE["ink"], bucket=True)
    elif phase_shared:
        # Visible monitoring dip tape inside well (no recovery claimed)
        tape_y = int(ground_y - 75 + (water_y - ground_y + 75) * min(1, ((p - shared_start) / 0.08)))
        draw.line([(well_x, ground_y - 75), (well_x, tape_y)], fill=PALETTE["gold"], width=4)
        draw.ellipse([well_x - 5, tape_y - 5, well_x + 5, tape_y + 5], fill=PALETTE["gold"])
        draw_text_box(draw, "Monitoring", FONT_LABEL, (well_x + 130, 220, well_x + 360, 260), PALETTE["earth_care"])
        draw.line([(well_x + 35, ground_y - 45), (well_x + 35, ground_y - 15)], fill=PALETTE["water_light"], width=4)
        draw_person(draw, 560, ground_y - 2, scale=1.0, color=PALETTE["ink"], bucket=True)
        draw_person(draw, int(770 + 90 * ((t * 0.20) % 1)), ground_y - 2, scale=1.0, color=PALETTE["ink"], bucket=True)
    else:
        draw_person(draw, 840, ground_y - 2, scale=1.0, color=PALETTE["ink_muted"])

    caption = get_caption_by_progress(SLIDE_07_CAPTIONS, p)
    draw_caption_card(draw, caption)
    return Image.alpha_composite(Image.new("RGBA", base.size, PALETTE["paper"] + (255,)), base).convert("RGB")

def render_frame_slide_13(t: float, total_d: float) -> Image.Image:
    base = Image.new("RGBA", (WIDTH, HEIGHT), PALETTE["paper"] + (255,))
    draw = ImageDraw.Draw(base)
    draw_header_and_disclaimer(draw, "Watch: Diversity Against One Bad Day")

    p = min(1.0, t / (total_d - 1.0))

    if p < 0.44:
        # Part A: Maize Monoculture vs Generic Mixed Planting
        split_x = 640
        ground_y = 410
        draw.rectangle([DIAGRAM_BOX[0], ground_y, split_x - 15, DIAGRAM_BOX[3]], fill=PALETTE["soil_top"])
        draw.rectangle([split_x + 15, ground_y, DIAGRAM_BOX[2], DIAGRAM_BOX[3]], fill=PALETTE["soil_top"])

        draw_text_box(draw, "Maize", FONT_LABEL, (DIAGRAM_BOX[0] + 30, 215, 300, 255), PALETTE["ink"])
        draw_text_box(draw, "Mixed planting", FONT_LABEL, (split_x + 30, 215, split_x + 300, 255), PALETTE["ink"])

        damage = max(0.0, min(1.0, (p - 0.04) / 0.14))
        # Left: Uniform maize
        for i in range(7):
            cx = DIAGRAM_BOX[0] + 60 + i * 70
            lean = damage * 1.28
            tip_x, tip_y = cx + math.sin(lean) * 116, ground_y - math.cos(lean) * 116
            draw.line([(cx, ground_y), (tip_x, tip_y)], fill=PALETTE["green_mid"] if damage < 0.8 else PALETTE["soil_sub"], width=5)
            draw.ellipse([tip_x-4,tip_y-12,tip_x+4,tip_y+4],fill=PALETTE["gold"])
            for side in [-1,1]:
                mx,my=(cx+tip_x)/2,(ground_y+tip_y)/2
                draw.line([(mx,my),(mx+side*22,my-13)],fill=PALETTE["green_mid"],width=4)

        # Generic growth forms and varied damage: diversity does not make a planting immune.
        for i in range(7):
            cx = split_x + 55 + i * 75
            harm = damage * [0.85,0.25,0.65,0.35,0.7,0.2,0.45][i]
            height = [120,65,98,50,115,72,92][i]
            tx,ty=cx+harm*40,ground_y-height*(1-harm*0.40)
            draw.line([(cx,ground_y),(tx,ty)],fill=PALETTE["green_mid"],width=5)
            draw.ellipse([tx-18,ty-17,tx+18,ty+17],fill=PALETTE["green_light"] if harm<0.5 else PALETTE["soil_sub"])
            if i%2:
                draw.ellipse([cx-26,ground_y-25,cx+26,ground_y+4],fill=PALETTE["green_deep"])

        # Hail cloud strictly inside diagram region y150..505 (y155..205)
        draw.rounded_rectangle([100, 155, 1180, 205], radius=15, fill=PALETTE["hail_cloud"])
        draw_text_box(draw, "Hail", FONT_LABEL, (590, 162, 690, 198), (255, 255, 255), align="center")
        # Falling hail across both plantings
        for h in range(45):
            hx = 110 + (h * 97) % 1060
            hy = int(((t * 360 + h * 43) % 190) + 210)
            draw.ellipse([hx - 3, hy - 3, hx + 3, hy + 3], fill=PALETTE["hail_ice"])
    else:
        # Part B: Scraps -> Compost -> Soil & Moving Bucket Irrigation
        # Left: Scraps -> Compost -> Soil
        draw_text_box(draw, "Scraps", FONT_LABEL, (70, 165, 210, 205), PALETTE["ink"])
        draw_text_box(draw, "Compost", FONT_LABEL, (250, 165, 410, 205), PALETTE["ink"])
        draw_text_box(draw, "Soil", FONT_LABEL, (450, 165, 590, 205), PALETTE["ink"])

        # Containers & beds
        draw.arc([75,320,195,390],0,180,fill=PALETTE["soil_top"],width=7)
        for j in range(6):
            x,y=100+(j%3)*25,320+(j//3)*24
            draw.ellipse([x-12,y-6,x+12,y+8],fill=PALETTE["green_mid"] if j%2 else PALETTE["green_light"])
        draw.polygon([(260, 400), (330, 270), (400, 400)], fill=PALETTE["soil_top"])
        draw.rectangle([440, 340, 590, 420], fill=PALETTE["soil_sub"])

        # Visibly moving material particles
        cycle_t = (t * 1.5) % 1.0
        # Scraps to Compost moving dots
        s2c_x = int(190 + cycle_t * 70)
        s2c_y = int(330 - math.sin(cycle_t * math.pi) * 40)
        draw.ellipse([s2c_x - 5, s2c_y - 5, s2c_x + 5, s2c_y + 5], fill=PALETTE["green_deep"])
        draw.line([(190, 335), (260, 335)], fill=PALETTE["card_border"], width=2)

        # Compost to Soil moving dots
        c2s_x = int(390 + cycle_t * 60)
        c2s_y = int(350 - math.sin(cycle_t * math.pi) * 30)
        draw.ellipse([c2s_x - 5, c2s_y - 5, c2s_x + 5, c2s_y + 5], fill=PALETTE["soil_top"])
        draw.line([(390, 355), (450, 355)], fill=PALETTE["card_border"], width=2)

        # Sprouts in soil
        for sx in range(465, 580, 35):
            draw.line([(sx, 340), (sx, 315)], fill=PALETTE["green_mid"], width=3)
            draw.ellipse([sx - 5, 310, sx + 5, 318], fill=PALETTE["green_light"])

        # Right: Bucket Irrigation
        draw_text_box(draw, "Water", FONT_LABEL, (650, 165, 760, 205), PALETTE["ink"])
        draw_text_box(draw, "Bucket", FONT_LABEL, (800, 165, 930, 205), PALETTE["ink"])
        draw_text_box(draw, "Crops", FONT_LABEL, (1020, 165, 1160, 205), PALETTE["ink"])

        # Water barrel
        draw.rectangle([660, 310, 740, 430], fill=PALETTE["water_deep"], outline=(50, 70, 90), width=2)
        # Crop bed
        draw.rectangle([1010, 370, 1200, 430], fill=PALETTE["soil_top"])
        for cx in [1050,1110,1170]:
            draw.line([(cx,370),(cx,330)],fill=PALETTE["green_deep"],width=4)
            draw.ellipse([cx-20,330,cx,344],fill=PALETTE["green_mid"])
            draw.ellipse([cx,320,cx+20,336],fill=PALETTE["green_light"])

        # Person hand-carrying bucket moving with water stream
        cycle = (t * 0.2) % 1
        walk_x = int(780 + min(cycle / 0.65, 1) * 200)
        draw_person(draw, walk_x, 345, scale=1.5, color=PALETTE["ink"], bucket=True)
        if cycle >= 0.65:
            for j in range(6):
                q = ((t * 1.4 + j / 6) % 1)
                wx = int(1000 + q * 55)
                wy = int(357 + q * 31)
                draw.ellipse([wx - 3, wy - 3, wx + 3, wy + 3], fill=PALETTE["water_light"])

    caption = get_caption_by_progress(SLIDE_13_CAPTIONS, p)
    draw_caption_card(draw, caption)
    return Image.alpha_composite(Image.new("RGBA", base.size, PALETTE["paper"] + (255,)), base).convert("RGB")

def render_frame_slide_19(t: float, total_d: float) -> Image.Image:
    base = Image.new("RGBA", (WIDTH, HEIGHT), PALETTE["paper"] + (255,))
    draw = ImageDraw.Draw(base)
    draw_header_and_disclaimer(draw, "Watch: A Windbreak Belongs On The Wind Side")
    p = min(1.0, t / (total_d - 1.0))
    # A diagonal north-west boundary makes the direction unambiguous in a north-up plan.
    plot = [(360, 490), (650, 200), (1090, 300), (1090, 490)]
    draw.polygon(plot, fill=(220, 234, 210), outline=PALETTE["card_border"], width=3)
    draw_text_box(draw, "North-west wind", FONT_LABEL, (65, 160, 335, 200), PALETTE["wind_stream"])
    draw_text_box(draw, "Windbreak", FONT_LABEL, (655, 210, 860, 250), PALETTE["green_deep"])
    draw_text_box(draw, "Crops", FONT_LABEL, (935, 335, 1085, 375), PALETTE["ink"])
    nx = 1140
    draw_text_box(draw, "N", FONT_LABEL, (1120, 158, 1160, 196), PALETTE["ink"], align="center")
    draw.line([(nx, 262), (nx, 211)], fill=PALETTE["ink"], width=4)
    draw.polygon([(nx, 200), (nx-9, 215), (nx+9, 215)], fill=PALETTE["ink"])
    for i in range(8):
        x, y = 370 + i * 38, 480 - i * 38
        draw.ellipse([x-15,y-15,x+15,y+15],fill=PALETTE["green_deep"])
        draw.ellipse([x-7,y-7,x+7,y+7],fill=PALETTE["green_mid"])
    for row in range(3):
        for col in range(7):
            x,y=720+col*43,385+row*42
            draw.ellipse([x-7,y-7,x+7,y+7],fill=PALETTE["green_mid"])
    # Incoming and continuing traces share direction; gaps retain some flow behind the trees.
    for i in range(4):
        bx, by = 420 + i * 60, 430 - i * 60
        q = (t * 0.55 + i * 0.17) % 1
        x,y=bx-155+q*125,by-155+q*125
        draw.line([(x,y),(x+20,y+20)],fill=PALETTE["wind_stream"],width=4)
        draw.polygon([(x+25,y+25),(x+12,y+20),(x+20,y+12)],fill=PALETTE["wind_stream"])
        for j in range(2):
            q=(t*0.24+j*0.5+i*0.17)%1
            x,y=bx+23+q*240,by+23+q*240
            if y+12<495:
                draw.line([(x,y),(x+12,y+12)],fill=PALETTE["wind_gentle"],width=2)
    draw_caption_card(draw, get_caption_by_progress(SLIDE_19_CAPTIONS,p))
    return Image.alpha_composite(Image.new("RGBA",base.size,PALETTE["paper"]+(255,)),base).convert("RGB")

# -----------------------------------------------------------------------------
# AUDIO PROBING & FFMPEG HELPERS
# -----------------------------------------------------------------------------
def get_audio_info(slide_num: int, project_dir: Path) -> dict:
    filename = f"slide-{slide_num:02d}.mp3"
    candidates = [
        project_dir / "inputs" / "english-audio" / filename,
        Path("inputs/english-audio") / filename,
    ]
    audio_path = None
    for c in candidates:
        if c.is_file():
            audio_path = c.resolve()
            break
    if not audio_path:
        raise FileNotFoundError(f"Missing required audio file: inputs/english-audio/{filename}. Looked in: {[str(c) for c in candidates]}")

    hasher = hashlib.sha256()
    with open(audio_path, "rb") as f:
        hasher.update(f.read())
    sha = hasher.hexdigest()

    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    duration = float(res.stdout.strip())
    return {"path": str(audio_path), "duration": duration, "sha256": sha}

def compile_video_clip(render_fn, duration: float, output_path: Path, reuse: bool = False):
    total_frames = math.ceil(duration * FPS)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not (reuse and output_path.is_file()):
        cmd = [
            "ffmpeg", "-y", "-v", "error",
            "-f", "rawvideo", "-vcodec", "rawvideo",
            "-s", f"{WIDTH}x{HEIGHT}", "-pix_fmt", "rgb24", "-r", str(FPS),
            "-i", "-",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", "-crf", "19",
            "-movflags", "+faststart",
            str(output_path)
        ]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        for f in range(total_frames):
            t = f / FPS
            frame_img = render_fn(t, duration)
            proc.stdin.write(frame_img.tobytes())
        proc.stdin.close()
        proc.wait()
        if proc.returncode != 0:
            raise RuntimeError(f"FFmpeg encoding failed for {output_path}")

    hasher = hashlib.sha256()
    with open(output_path, "rb") as f:
        hasher.update(f.read())
    return {
        "path": str(output_path),
        "filename": output_path.name,
        "duration": float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(output_path)]).decode().strip()),
        "frames": total_frames,
        "size_bytes": output_path.stat().st_size,
        "sha256": hasher.hexdigest(),
    }

def generate_contact_sheet(sample_images: list, title: str, output_path: Path):
    cs_w, cs_h = 1920, 1080
    sheet = Image.new("RGB", (cs_w, cs_h), PALETTE["paper"])
    draw = ImageDraw.Draw(sheet)
    draw_text_box(draw, f"CONTACT SHEET: {title.upper()}", FONT_TITLE, (60, 30, cs_w - 60, 75), PALETTE["ink"])
    draw.line([(60, 95), (cs_w - 60, 95)], fill=PALETTE["card_border"], width=2)

    cols, rows = 3, 2
    margin_x, margin_y = 60, 130
    thumb_w, thumb_h = 560, 315
    gap_x, gap_y = 50, 120

    for idx, (label, img) in enumerate(sample_images[:6]):
        r = idx // cols
        c = idx % cols
        x = margin_x + c * (thumb_w + gap_x)
        y = margin_y + r * (thumb_h + gap_y)
        thumb = img.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x, y))
        draw.rectangle([x, y, x + thumb_w, y + thumb_h], outline=PALETTE["card_border"], width=2)
        draw.rounded_rectangle([x, y + thumb_h + 8, x + thumb_w, y + thumb_h + 46], radius=6, fill=PALETTE["paper_dark"])
        draw_text_box(draw, label, FONT_BADGE, (x + 10, y + thumb_h + 12, x + thumb_w - 10, y + thumb_h + 42), PALETTE["ink"])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, "PNG")

def build_review_reel(clips_meta: list, output_reel: Path) -> dict:
    output_reel.parent.mkdir(parents=True, exist_ok=True)
    seg_paths = []
    for idx, clip in enumerate(clips_meta):
        seg_path = output_reel.parent / f"review_seg_{idx}.mp4"
        cmd_mux = [
            "ffmpeg", "-y", "-v", "error",
            "-i", clip["path"],
            "-i", clip["audio_path"],
            "-filter_complex", "[1:a]apad[a]",
            "-map", "0:v", "-map", "[a]",
            "-c:v", "copy", "-c:a", "aac",
            "-shortest",
            str(seg_path)
        ]
        subprocess.run(cmd_mux, check=True)
        seg_paths.append(seg_path)

    list_file = output_reel.parent / "review_concat.txt"
    with open(list_file, "w") as f:
        for p in seg_paths:
            f.write(f"file '{p.resolve()}'\n")

    badge_path = output_reel.parent / "review-badge.png"
    badge = Image.new("RGBA", (520,32), (15,24,20,225))
    ImageDraw.Draw(badge).text((10,5), "REVIEW DRAFT — NOT FOR DISTRIBUTION", font=get_font(20,True), fill="white")
    badge.save(badge_path)
    cmd_concat = [
        "ffmpeg", "-y", "-v", "error",
        "-f", "concat", "-safe", "0",
        "-i", str(list_file),
        "-i", str(badge_path),
        "-filter_complex", "[0:v][1:v]overlay=48:112[v]",
        "-map", "[v]", "-map", "0:a",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast",
        "-c:a", "copy",
        "-movflags", "+faststart",
        str(output_reel)
    ]
    subprocess.run(cmd_concat, check=True)

    # Cleanup temporary segment files
    list_file.unlink(missing_ok=True)
    for p in seg_paths:
        p.unlink(missing_ok=True)

    # Verify review reel contains audio stream
    cmd_probe = ["ffprobe", "-v", "error", "-show_streams", "-select_streams", "a", "-of", "json", str(output_reel)]
    probe_out = subprocess.run(cmd_probe, capture_output=True, text=True, check=True)
    data = json.loads(probe_out.stdout)
    if not data.get("streams"):
        raise RuntimeError(f"Review reel {output_reel} contains no audio stream!")

    hasher = hashlib.sha256()
    with open(output_reel, "rb") as f:
        hasher.update(f.read())
    return {
        "path": str(output_reel),
        "filename": output_reel.name,
        "size_bytes": output_reel.stat().st_size,
        "sha256": hasher.hexdigest(),
    }

# -----------------------------------------------------------------------------
# MAIN PIPELINE & CLI
# -----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Deterministic Media Renderer for Introduction to Permaculture")
    parser.add_argument("--output", type=str, default="experiments/studies-intro-2026-09-20", help="Target output directory")
    parser.add_argument("--preview", action="store_true", help="Quickly render posters and contact sheets only (no video encoding)")
    parser.add_argument("--reuse-clips", action="store_true", help="Reuse already rendered clips to rebuild only the review reel; use only when frame code is unchanged")
    args = parser.parse_args()

    out_base = Path(args.output).resolve()
    clips_dir = out_base / "clips"
    clips_dir.mkdir(parents=True, exist_ok=True)

    slide_specs = [
        {
            "slide": 7,
            "title": "One Decision, Three Ethics",
            "name": "slide_07_one_decision_three_ethics",
            "render_fn": render_frame_slide_07,
            "captions": SLIDE_07_CAPTIONS,
        },
        {
            "slide": 13,
            "title": "Diversity Against One Bad Day",
            "name": "slide_13_diversity_against_one_bad_day",
            "render_fn": render_frame_slide_13,
            "captions": SLIDE_13_CAPTIONS,
        },
        {
            "slide": 19,
            "title": "A Windbreak Belongs On The Wind Side",
            "name": "slide_19_a_windbreak_belongs_on_the_wind_side",
            "render_fn": render_frame_slide_19,
            "captions": SLIDE_19_CAPTIONS,
        },
    ]

    manifest_clips = []
    manifest_posters = []
    manifest_sheets = []

    print("=" * 70)
    print(f"Introduction to Permaculture Media Generator {'(PREVIEW MODE)' if args.preview else ''}")
    print(f"Output Directory: {out_base}")
    print("=" * 70)

    for spec in slide_specs:
        s_num = spec["slide"]
        s_title = spec["title"]
        s_name = spec["name"]
        print(f"\nProcessing Slide {s_num}: {s_title}")

        audio_info = get_audio_info(s_num, out_base)
        clip_duration = math.ceil((audio_info["duration"] + 1.0) * FPS) / FPS
        print(f"  Source Audio: {Path(audio_info['path']).name} ({audio_info['duration']:.2f}s)")
        print(f"  Clip Duration: {clip_duration:.2f}s ({int(clip_duration * FPS)} frames)")

        # Sample frames for contact sheet and poster
        phases = {7: [0,0.17,0.32,0.50,0.75,0.99], 13: [0,0.15,0.35,0.51,0.77,0.99], 19: [0,0.22,0.45,0.68,0.88,0.99]}[s_num]
        sample_times = [(clip_duration-1)*phase for phase in phases]
        sample_frames = []
        for st in sample_times:
            lbl = f"T={st:.1f}s"
            img = spec["render_fn"](st, clip_duration)
            sample_frames.append((lbl, img))

        # Save Poster
        poster_path = clips_dir / f"{s_name}_poster.png"
        climax_img = sample_frames[3 if s_num == 7 else 2 if s_num == 13 else 1][1]
        climax_img.save(poster_path, "PNG")
        manifest_posters.append({
            "slide": s_num,
            "filename": poster_path.name,
            "path": str(poster_path),
            "size_bytes": poster_path.stat().st_size,
        })
        print(f"  Saved Poster: {poster_path.name}")

        # Save Contact Sheet
        sheet_path = clips_dir / f"{s_name}_contact_sheet.png"
        generate_contact_sheet(sample_frames, f"Slide {s_num}: {s_title}", sheet_path)
        manifest_sheets.append({
            "slide": s_num,
            "filename": sheet_path.name,
            "path": str(sheet_path),
            "size_bytes": sheet_path.stat().st_size,
        })
        print(f"  Saved Contact Sheet: {sheet_path.name}")

        if not args.preview:
            # Video Clip Generation
            video_path = clips_dir / f"{s_name}.mp4"
            print(f"  Encoding silent clip: {video_path.name}")
            clip_res = compile_video_clip(spec["render_fn"], clip_duration, video_path, args.reuse_clips)
            clip_res["audio_path"] = audio_info["path"]
            clip_res["audio_duration"] = audio_info["duration"]
            clip_res["audio_sha256"] = audio_info["sha256"]
            manifest_clips.append(clip_res)

    review_reel_info = None
    if not args.preview:
        print("\nBuilding Narrated Review Reel...")
        reel_path = clips_dir / "review_reel_permaculture_intro.mp4"
        review_reel_info = build_review_reel(manifest_clips, reel_path)
        print(f"  Review Reel Compiled: {reel_path.name}")

    # Build and write manifest
    manifest = {
        "module": "Introduction to Permaculture",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "preview_mode": args.preview,
        "format": {
            "resolution": f"{WIDTH}x{HEIGHT}",
            "framerate_fps": FPS,
            "regions": {
                "header": HEADER_BOX,
                "diagram": DIAGRAM_BOX,
                "caption": CAPTION_BOX,
                "disclaimer": DISCLAIMER_BOX,
            }
        },
        "review_status": {
            "mechanical_qa": "Generated; independent decoding and visual checks required",
            "human_review_status": "PENDING_HUMAN_REVIEW",
            "note": "Text layout assertions ran. Preview mode does not encode or mux audio. Consult independent verification for decoded durations and playback checks."
        },
        "authored_captions": {
            "slide_07": SLIDE_07_CAPTIONS,
            "slide_13": SLIDE_13_CAPTIONS,
            "slide_19": SLIDE_19_CAPTIONS,
        },
        "posters": manifest_posters,
        "contact_sheets": manifest_sheets,
        "clips": manifest_clips,
        "review_reel": review_reel_info,
    }

    manifest_path = out_base / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nSaved Manifest: {manifest_path}")
    print("=" * 70)
    return 0

if __name__ == "__main__":
    sys.exit(main())
