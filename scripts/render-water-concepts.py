#!/usr/bin/env python3
"""
Usage: python3 scripts/render-water-concepts.py OUTPUT_DIRECTORY [SLIDE ...]
Requires Pillow, NumPy, Homebrew ffmpeg and the macOS Arial fonts.

Authored with Antigravity; diagram captions retain the existing English Watch text.
render_conceptual_animations.py — Renders the four remaining conceptual Watch animations
for Studies: Water Harvesting (Slides 9, 12, 16, 21).

Pure code-rendered motion graphics (Python + Pillow + NumPy + ffmpeg).
Matching visual palette:
- Canvas: 1448x1264 (1448x1088 body + 64 top + 112 bottom), scaled to 824x720 yuv420p faststart
- Header / footer: (10, 25, 33)
- Soil: warm loam (178, 147, 108) to (146, 125, 101)
- Air/sky: soft mint-grey (232, 239, 232)
- Water: blue (39, 156, 208) with highlights
- Vegetation: natural green tones (55, 95, 50) to (118, 153, 76)
- Typography: Arial / Arial Bold matching Mzomoyethu controlled profile
"""

import subprocess
import math
import sys
import time
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) > 1 else Path.cwd() / "water-media-review"
CLIPS_DIR = BASE_DIR / "clips"
SCRIPTS_DIR = BASE_DIR / "scripts"
SCRATCH_DIR = BASE_DIR / "scratch"
CLIPS_DIR.mkdir(parents=True, exist_ok=True)
SCRATCH_DIR.mkdir(parents=True, exist_ok=True)

FFMPEG = "/opt/homebrew/bin/ffmpeg"
FFPROBE = "/opt/homebrew/bin/ffprobe"

W, H, TOP, BOTTOM, FPS = 1448, 1088, 64, 112, 24
FONT_PATH = "/System/Library/Fonts/Supplemental/"

def font(size, bold=False):
    try:
        fname = "Arial Bold.ttf" if bold else "Arial.ttf"
        return ImageFont.truetype(FONT_PATH + fname, size)
    except:
        return ImageFont.load_default()

def smooth(v):
    v = np.clip(v, 0, 1)
    return float(v * v * (3 - 2 * v))

def ramp(t, a, b):
    return smooth((t - a) / (b - a))

def draw_badge(draw, text, xy, size=21, fill=(23, 47, 54), fg=(245, 248, 246)):
    x, y = xy
    f = font(size, True)
    w = draw.textlength(text, font=f)
    draw.rounded_rectangle((x, y, x + w + 24, y + size + 18), 7, fill=fill)
    draw.text((x + 12, y + 6), text, font=f, fill=fg)

def wrap_frame(body_img, header_title, top_right, phase_title, phase_sub):
    canvas = Image.new("RGB", (W, H + TOP + BOTTOM), (10, 25, 33))
    canvas.paste(body_img.convert("RGB"), (0, TOP))
    d = ImageDraw.Draw(canvas)

    # Top header
    d.text((30, 19), header_title, font=font(24, True), fill=(230, 243, 247))
    d.text((W - 440, 20), top_right, font=font(18, True), fill=(185, 215, 225))

    # Bottom captions
    d.text((30, H + TOP + 16), phase_title, font=font(27, True), fill=(239, 249, 250))
    d.text((31, H + TOP + 62), phase_sub, font=font(22), fill=(187, 212, 221))
    return canvas

# ==============================================================================
# 1. SLIDE 09: VETIVER TAKES OVER (Steep slope, vetiver contour lines & roots)
# ==============================================================================
def render_frame_slide09(t):
    # Total duration: 16s
    body = Image.new("RGBA", (W, H), (232, 239, 232, 255))
    d = ImageDraw.Draw(body)

    # Slope curve: steep 25-30% incline
    def surface_y(x):
        return 220 + (x / W) * 650

    # Draw soil layers
    soil_pts = [(0, int(surface_y(0)))] + [(x, int(surface_y(x))) for x in range(0, W + 1, 20)] + [(W, H), (0, H)]
    d.polygon(soil_pts, fill=(165, 136, 100))

    # Darker subsoil
    subsoil_pts = [(0, int(surface_y(0)) + 120)] + [(x, int(surface_y(x)) + 120) for x in range(0, W + 1, 20)] + [(W, H), (0, H)]
    d.polygon(subsoil_pts, fill=(142, 115, 82))

    # Surface grass layer
    d.line([(x, surface_y(x)) for x in range(0, W, 5)], fill=(110, 135, 75), width=4)

    # Vetiver clumps positioned on contour along the slope
    clump_xs = [280, 680, 1080]

    # Growth of vetiver roots over time (ramp from t=2.0 to t=8.5)
    root_growth = min(1.0, max(0.0, (t - 2.0) / 6.5)) if t > 2.0 else 0.0

    # NOTE: Moisture rectangles have been REMOVED per Visual QA correction.
    # Roots remain 100% visible, sharp, and clean against the soil layers.

    for cx in clump_xs:
        cy = surface_y(cx)

        # Draw fibrous vertical root network
        if root_growth > 0.05:
            max_depth = 460 * root_growth
            for dx in np.linspace(-35, 35, 15):
                root_end_y = cy + max_depth + np.sin(dx * 0.4) * 30
                root_end_x = cx + dx * 0.85
                pts = [(cx + dx * 0.5, cy), (cx + dx * 0.7, cy + max_depth * 0.5), (root_end_x, root_end_y)]
                d.line(pts, fill=(75, 45, 25, 240), width=3)
                # Fine root hairs
                for rstep in range(1, 6):
                    hy = cy + max_depth * (rstep / 6.0)
                    hx = cx + dx * 0.7 + (1 if dx >= 0 else -1) * 12
                    d.line([(cx + dx * 0.7, hy), (hx, hy + 8)], fill=(95, 65, 38, 210), width=1)

        # Vetiver dense aerial foliage (clump)
        clump_alpha = 255
        for dx in np.linspace(-28, 28, 12):
            fh = 110 + abs(dx) * 0.5
            curve = dx * 0.4
            leaf_pts = [(cx + dx, cy + 2), (cx + dx * 0.6, cy - fh * 0.5), (cx + dx * 0.4 + curve * 4, cy - fh)]
            d.line(leaf_pts, fill=(58, 115, 52, clump_alpha), width=3)

    # Surface water movement: Runoff streams down slope
    for stream_x in range(40, W - 40, 90):
        sy = surface_y(stream_x)
        near_clump = any(abs(stream_x - cx) < 60 for cx in clump_xs)
        if near_clump and t > 6.0:
            d.ellipse((stream_x - 15, sy - 8, stream_x + 15, sy + 4), fill=(60, 160, 210, 200))
        else:
            pts = [(stream_x, sy - 4), (stream_x + 18, surface_y(stream_x + 18) - 4)]
            d.line(pts, fill=(45, 145, 205, 190), width=4)

    # Badges
    draw_badge(d, "Slope > 15–20%", (40, 100), 22, fill=(35, 75, 95))
    d.line([(40, 160), (140, surface_y(140) - 10)], fill=(75, 125, 145), width=2)

    draw_badge(d, "Vetiver grass lines on contour", (340, surface_y(280) - 140), 21, fill=(28, 85, 45))
    d.line([(420, surface_y(280) - 95), (290, surface_y(280) - 30)], fill=(65, 140, 85), width=2)

    draw_badge(d, "Roots anchor soil", (760, surface_y(680) + 140), 21, fill=(30, 55, 68))
    d.line([(760, surface_y(680) + 160), (705, surface_y(680) + 180)], fill=(75, 125, 145), width=2)

    # Exact Watch-slide sentences
    if t < 8.0:
        title = "Above 15–20% slope, use vetiver grass lines or terraces instead."
        sub = "Swales work well on 1 to 15% slopes."
    else:
        title = "Swales work well on 1 to 15% slopes."
        sub = "Above 15–20% slope, use vetiver grass lines or terraces instead."

    return wrap_frame(body, "IMBEWUFIELD • WATER HARVESTING", "Concept diagram — not to scale", title, sub)

# ==============================================================================
# 2. SLIDE 12: DAM AND SPILLWAY (Catchment, raised brown wall crest, separate spillway)
# ==============================================================================
def render_frame_slide12(t):
    # Total duration: 16s
    body = Image.new("RGBA", (W, H), (230, 238, 232, 255))
    d = ImageDraw.Draw(body)

    # Background: continuous sky and hills across full width
    d.polygon([(0, 0), (W, 0), (W, 260), (0, 220)], fill=(210, 225, 212))
    d.polygon([(0, 220), (W, 260), (W, 400), (0, 360)], fill=(182, 205, 172))
    d.polygon([(0, 360), (W, 400), (W, 540), (0, 500)], fill=(158, 185, 145))

    # Valley floor and foundations across full width
    ground_y = 760
    d.rectangle((0, ground_y, W, H), fill=(135, 108, 78)) # native ground / bedrock
    d.line([(0, ground_y), (W, ground_y)], fill=(110, 85, 58), width=3)

    # Runoff streams from catchment in upper left (t=0..6s)
    for cx in [120, 270, 420]:
        pts = [(cx - 40, 60), (cx, 190), (cx + 30, 420)]
        d.line(pts, fill=(45, 145, 210, 190), width=4)
        d.polygon([(pts[-1][0]-7, pts[-1][1]-10), (pts[-1][0]+7, pts[-1][1]-10), (pts[-1][0], pts[-1][1]+4)], fill=(45, 145, 210, 230))

    # Left side: Dam reservoir / basin excavation
    basin_bed = [(0, 520), (140, 660), (480, 740), (560, ground_y)]
    d.polygon([(0, 520)] + basin_bed + [(0, ground_y)], fill=(155, 128, 92))

    # Water fill dynamics: rises from t=1.0s to 7.0s up to spillway sill y=520
    fill_p = min(1.0, max(0.05, (t - 1.0) / 6.0)) if t > 1.0 else 0.05
    water_y = int(ground_y - (ground_y - 520) * fill_p)

    # Stored water polygon
    water_poly = [(0, water_y), (560 - (water_y - 520)*0.4, water_y), (560, ground_y), (140, 660), (0, 660)]
    d.polygon(water_poly, fill=(38, 148, 208, 240))
    for wy in range(water_y + 16, ground_y - 15, 36):
        d.line([(30, wy), (540 - (wy - water_y)*0.6, wy)], fill=(170, 230, 255, 130), width=2)
    d.line([(0, water_y), (560 - (water_y - 520)*0.4, water_y)], fill=(200, 240, 255), width=4)
    d.text((160, max(water_y + 35, 560)), "STORED WATER IN DAM", font=font(24, True), fill=(235, 250, 255))

    # RIGHT SIDE: SOLID NATURAL GROUND BANK (HOUSING THE SPILLWAY)
    bank_pts = [(960, 360), (W, 360), (W, ground_y), (960, ground_y)]
    d.polygon(bank_pts, fill=(145, 172, 130)) # solid undisturbed hillside

    # Spillway excavation into the solid right bank
    # SILL ELEVATION IS AT y = 520 (visibly 140px LOWER than wall crest at 380!)
    spill_sill_y = 520
    spill_poly = [
        (940, spill_sill_y - 20), (1080, 545), (1200, 620), (1320, 715),
        (1448, 775), (1448, 860), (1310, 815), (1180, 710), (1060, 615), (940, spill_sill_y + 45)
    ]
    d.polygon(spill_poly, fill=(112, 142, 98)) # excavated vegetated invert

    # Spillway inlet connection channel from reservoir (behind wall) to spillway sill
    d.polygon([(520, spill_sill_y), (950, spill_sill_y), (950, spill_sill_y + 40), (520, spill_sill_y + 40)], fill=(125, 155, 110))

    # Overflow water through spillway (when t >= 6.5s, full reservoir)
    if t >= 6.5:
        flow_alpha = min(1.0, (t - 6.5) / 2.5)
        d.polygon([(520, spill_sill_y), (950, spill_sill_y), (950, spill_sill_y + 25), (520, spill_sill_y + 25)],
                  fill=(42, 155, 220, int(230 * flow_alpha)))
        spill_water_poly = [
            (940, spill_sill_y + 5), (1080, 555), (1200, 630), (1320, 725), (1448, 785),
            (1448, 825), (1310, 780), (1190, 680), (1070, 585), (940, spill_sill_y + 25)
        ]
        d.polygon(spill_water_poly, fill=(45, 160, 225, int(235 * flow_alpha)))
        d.line([(940, spill_sill_y + 15), (1080, 565), (1200, 640), (1320, 735), (1448, 795)],
               fill=(195, 240, 255, int(240 * flow_alpha)), width=4)

    # EARTHEN DAM EMBANKMENT WALL (Brown, visibly raised crest)
    # Built between reservoir and spillway (x: 480 to 960)
    wall_crest_x0 = 640
    wall_crest_x1 = 760
    wall_crest_y = 380 # Crest is 140px HIGHER than stored water at 520!
    upstream_toe = (480, ground_y)
    downstream_toe = (960, ground_y)

    # Wall cross section / embankment body
    wall_poly = [upstream_toe, (wall_crest_x0, wall_crest_y), (wall_crest_x1, wall_crest_y), downstream_toe]
    d.polygon(wall_poly, fill=(132, 96, 62)) # solid brown compacted earth

    # Submerged upstream slope (wet earth)
    d.polygon([(480, ground_y), (560 - (water_y - 520)*0.4, water_y), (560, ground_y)], fill=(105, 75, 48))

    # Flat brown crest top
    d.polygon([(wall_crest_x0, wall_crest_y), (wall_crest_x1, wall_crest_y),
                 (wall_crest_x1 + 15, wall_crest_y + 15), (wall_crest_x0 - 5, wall_crest_y + 15)], fill=(168, 128, 86))
    d.line([(wall_crest_x0, wall_crest_y), (wall_crest_x1, wall_crest_y)], fill=(195, 150, 105), width=4)

    # Downhill face compaction lines & texture
    for dy in range(wall_crest_y + 40, ground_y - 10, 45):
        x_left = wall_crest_x0 - (dy - wall_crest_y) * 0.3
        x_right = wall_crest_x1 + (dy - wall_crest_y) * 0.55
        d.line([(max(520, x_left), dy), (min(downstream_toe[0], x_right), dy)], fill=(118, 85, 54), width=2)
    d.line([(wall_crest_x1, wall_crest_y), downstream_toe], fill=(110, 78, 48), width=4)

    # Grass on downstream toe
    d.polygon([(wall_crest_x1 + 120, ground_y - 60), downstream_toe, (downstream_toe[0] + 30, ground_y)], fill=(98, 132, 72))

    # FREEBOARD VISUAL BRACKET
    # Showing clearly that wall crest (380) is higher than stored water (520)
    d.line([(620, wall_crest_y), (620, 520)], fill=(245, 245, 245), width=3)
    d.line([(605, wall_crest_y), (635, wall_crest_y)], fill=(245, 245, 245), width=3)
    d.line([(605, 520), (635, 520)], fill=(245, 245, 245), width=3)
    draw_badge(d, "Freeboard: wall crest higher than spillway", (360, 420), 19, fill=(75, 48, 30))
    d.line([(580, 455), (615, 455)], fill=(245, 245, 245), width=2)

    # BADGES & LABELS
    draw_badge(d, "Catchment runoff", (60, 100), 22, fill=(35, 75, 95))
    d.line([(160, 150), (240, 220)], fill=(75, 125, 145), width=2)

    draw_badge(d, "Dam wall crest", (600, 280), 22, fill=(95, 68, 42))
    d.line([(740, 330), (710, wall_crest_y)], fill=(130, 95, 60), width=2)

    draw_badge(d, "Lower separate side spillway", (980, 440), 22, fill=(28, 85, 65))
    d.line([(1060, 490), (1050, spill_sill_y + 15)], fill=(65, 140, 95), width=2)

    if t >= 7.0:
        draw_badge(d, "Spillway overflow bypasses wall", (920, 870), 22, fill=(30, 85, 120))
        d.line([(1040, 870), (1260, 720)], fill=(65, 135, 185), width=2)

    # Exact Watch-slide sentences
    if t < 8.0:
        title = "Design the spillway before the wall — an overtopped wall can breach catastrophically."
        sub = "Size the dam to the catchment area draining toward it."
    else:
        title = "Size the dam to the catchment area draining toward it."
        sub = "Design the spillway before the wall — an overtopped wall can breach catastrophically."

    return wrap_frame(body, "IMBEWUFIELD • WATER HARVESTING", "Concept diagram — not to scale", title, sub)

# ==============================================================================
# 3. SLIDE 16: FIRST FLUSH TO TANK (Dirty first rain diverted, then clean to tank)
# ==============================================================================
def render_frame_slide16(t):
    # Total duration: 17s
    body = Image.new("RGBA", (W, H), (232, 238, 240, 255))
    d = ImageDraw.Draw(body)

    # House roof section on left
    roof_pts = [(40, 300), (240, 150), (460, 300)]
    d.polygon(roof_pts, fill=(160, 75, 65))
    d.line(roof_pts, fill=(120, 50, 40), width=6)

    d.polygon([(80, 300), (420, 300), (420, 620), (80, 620)], fill=(215, 205, 190))
    d.line([(80, 300), (80, 620), (420, 620), (420, 300)], fill=(160, 150, 135), width=3)

    # Rain on roof
    rain_vis = ramp(t, 0.5, 2.5)
    if rain_vis > 0:
        for rx in range(60, 440, 30):
            ry = 120 + ((rx - 60) * 17) % 80
            d.line([(rx, ry), (rx - 8, ry + 24)], fill=(110, 140, 160, int(150 * rain_vis)), width=2)

    gutter_box = (450, 290, 480, 320)
    d.rectangle(gutter_box, fill=(90, 105, 115))

    # Downpipe
    d.line([(470, 310), (560, 360), (560, 440)], fill=(80, 95, 105), width=16)

    # Vertical first flush pipe
    ff_x = 560
    ff_top_y = 440
    ff_bot_y = 860
    ff_w = 34
    d.rectangle((ff_x - ff_w // 2, ff_top_y, ff_x + ff_w // 2, ff_bot_y), fill=(70, 85, 95), outline=(50, 65, 75), width=2)

    # Horizontal branch to tank
    tank_inlet_x = 900
    d.line([(ff_x, ff_top_y), (tank_inlet_x, ff_top_y)], fill=(80, 95, 105), width=16)

    # Storage tank on right
    tank_x0, tank_y0, tank_x1, tank_y1 = 900, 380, 1340, 920
    d.rounded_rectangle((tank_x0, tank_y0, tank_x1, tank_y1), radius=20, fill=(45, 90, 75), outline=(30, 65, 55), width=4)
    for rib_y in range(tank_y0 + 70, tank_y1 - 30, 80):
        d.line([(tank_x0 + 10, rib_y), (tank_x1 - 10, rib_y)], fill=(35, 75, 60), width=3)
    d.text((tank_x0 + 130, tank_y0 + 25), "STORAGE TANK", font=font(22, True), fill=(210, 240, 225))

    # First flush filling dynamics
    ff_fill = ramp(t, 1.5, 7.5)
    if ff_fill > 0.02:
        filled_h = (ff_bot_y - ff_top_y - 20) * ff_fill
        water_top_y = ff_bot_y - filled_h
        if water_top_y < ff_bot_y - 3:
            d.rectangle((ff_x - ff_w // 2 + 3, int(water_top_y), ff_x + ff_w // 2 - 3, ff_bot_y - 3),
                        fill=(135, 120, 95))

        ball_y = min(ff_bot_y - 18, max(ff_top_y + 18, water_top_y + 16))
        ball_r = 13
        d.ellipse((ff_x - ball_r, ball_y - ball_r, ff_x + ball_r, ball_y + ball_r), fill=(220, 90, 45))

    # Phase 2: Diverter is full and sealed; clean water to tank
    clean_flow = ramp(t, 8.0, 12.0)
    if clean_flow > 0.05:
        d.ellipse((ff_x - 14, ff_top_y + 18 - 14, ff_x + 14, ff_top_y + 18 + 14), fill=(220, 90, 45))
        d.line([(ff_x, ff_top_y), (tank_inlet_x, ff_top_y)], fill=(40, 165, 225), width=10)

        tank_fill = ramp(t, 8.5, 16.5)
        if tank_fill > 0.01:
            total_rise = float(tank_y1 - 12 - (tank_y0 + 80))
            tw_top_y = float(tank_y1 - 8) - total_rise * tank_fill
            if tw_top_y < tank_y1 - 10:
                d.rounded_rectangle((tank_x0 + 8, int(tw_top_y), tank_x1 - 8, tank_y1 - 8), radius=12, fill=(35, 150, 215, 230))
                d.line([(tank_x0 + 12, int(tw_top_y)), (tank_x1 - 12, int(tw_top_y))], fill=(180, 235, 255), width=3)

    # Slow drain reset at base
    d.line([(ff_x, ff_bot_y), (ff_x, ff_bot_y + 25)], fill=(70, 85, 95), width=6)
    if t > 4.0:
        d.ellipse((ff_x - 3, ff_bot_y + 28, ff_x + 3, ff_bot_y + 36), fill=(120, 110, 90))

    # Badges
    draw_badge(d, "Roof runoff", (80, 100), 22, fill=(75, 45, 40))
    d.line([(220, 150), (320, 240)], fill=(120, 70, 60), width=2)

    if t < 8.0:
        draw_badge(d, "First-flush diverter chamber", (340, 560), 21, fill=(90, 75, 50))
        d.line([(520, 590), (ff_x - 20, 600)], fill=(120, 100, 70), width=2)
    else:
        draw_badge(d, "Floating seal", (340, 520), 21, fill=(160, 70, 30))
        d.line([(500, 540), (ff_x - 10, ff_top_y + 20)], fill=(180, 80, 40), width=2)

    if t >= 8.5:
        draw_badge(d, "Clean water to tank", (720, 320), 21, fill=(25, 95, 135))
        d.line([(860, 370), (tank_inlet_x - 30, ff_top_y)], fill=(45, 150, 210), width=2)

    # Exact Watch-slide sentences
    if t < 8.5:
        title = "A first-flush diverter removes the dirty first flush from every rain event."
        sub = "The first 20 to 30 litres should be diverted before clean water reaches the tank."
    else:
        title = "The first 20 to 30 litres should be diverted before clean water reaches the tank."
        sub = "A first-flush diverter removes the dirty first flush from every rain event."

    return wrap_frame(body, "IMBEWUFIELD • WATER HARVESTING", "Concept diagram — not to scale", title, sub)

# ==============================================================================
# 4. SLIDE 21: GREYWATER UNDER MULCH (Fruit tree basin, sub-surface mulch filtration)
# ==============================================================================
def render_frame_slide21(t):
    # Total duration: 17s
    body = Image.new("RGBA", (W, H), (232, 238, 232, 255))
    d = ImageDraw.Draw(body)

    surface_y = 480
    d.rectangle((0, surface_y, W, H), fill=(162, 132, 98))

    basin_x0, basin_x1 = 400, 1200
    basin_depth = 170
    basin_bot_y = surface_y + basin_depth
    tx, ty = 820, surface_y + 20

    basin_pts = [(basin_x0, surface_y), (basin_x0 + 40, basin_bot_y), (basin_x1 - 40, basin_bot_y), (basin_x1, surface_y)]
    d.polygon(basin_pts, fill=(115, 82, 52))

    rng = np.random.default_rng(999)
    for _ in range(400):
        wx = rng.integers(basin_x0 + 45, basin_x1 - 45)
        wy = rng.integers(surface_y + 10, basin_bot_y - 10)
        chip_col = (int(rng.integers(90, 140)), int(rng.integers(65, 105)), int(rng.integers(40, 75)))
        d.rectangle((wx, wy, wx + int(rng.integers(8, 20)), wy + int(rng.integers(4, 9))), fill=chip_col)

    pipe_pts = [(40, 320), (280, 380), (basin_x0 + 80, surface_y + 70)]
    d.line(pipe_pts, fill=(110, 125, 135), width=16)

    disp_box = (basin_x0 + 60, surface_y + 40, basin_x0 + 170, surface_y + 120)
    d.rounded_rectangle(disp_box, radius=8, fill=(60, 75, 85), outline=(40, 55, 65), width=2)
    for px in range(disp_box[0] + 15, disp_box[2] - 10, 18):
        for py in range(disp_box[1] + 15, disp_box[3] - 10, 20):
            d.ellipse((px - 3, py - 3, px + 3, py + 3), fill=(30, 45, 55))

    flow_vis = ramp(t, 1.5, 4.5)
    if flow_vis > 0:
        d.line(pipe_pts, fill=(80, 175, 215, int(220 * flow_vis)), width=8)

    infil_p = ramp(t, 4.5, 12.0)
    if infil_p > 0.05:
        wet_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        wd = ImageDraw.Draw(wet_layer)
        wet_w = 260 * infil_p
        wet_h = 90 * infil_p
        wd.ellipse((basin_x0 + 115 - wet_w, surface_y + 80 - wet_h * 0.5,
                   basin_x0 + 115 + wet_w, surface_y + 80 + wet_h),
                  fill=(45, 130, 175, int(75 * infil_p)))

        root_wet = ramp(t, 8.0, 15.0)
        if root_wet > 0.05:
            wd.ellipse((tx - 260 * root_wet, basin_bot_y - 20,
                       tx + 260 * root_wet, basin_bot_y + 180 * root_wet),
                      fill=(50, 140, 185, int(70 * root_wet)))
        body = Image.alpha_composite(body, wet_layer)
        d = ImageDraw.Draw(body)

    # Roots
    for rdx in [-260, -180, -90, 60, 160, 260]:
        r_end = (tx + rdx, basin_bot_y + 120 + abs(rdx) * 0.4)
        pts = [(tx, ty), (tx + rdx * 0.4, basin_bot_y + 20), r_end]
        d.line(pts, fill=(85, 54, 32), width=6)
        d.line([(tx + rdx * 0.4, basin_bot_y + 20), (tx + rdx * 0.8, basin_bot_y + 160)], fill=(98, 68, 44), width=3)

    # Tree trunk and canopy
    d.polygon([(tx - 18, ty), (tx + 18, ty), (tx + 12, ty - 260), (tx - 12, ty - 260)], fill=(95, 68, 42))
    for fx, fy, fr in [(tx, ty - 320, 110), (tx - 70, ty - 270, 85), (tx + 75, ty - 280, 90), (tx, ty - 230, 80)]:
        d.ellipse((fx - fr, fy - fr * 0.85, fx + fr, fy + fr * 0.85), fill=(65, 125, 55))
    for ox, oy in [(-45, -310), (35, -290), (-20, -250), (60, -320), (-60, -230)]:
        d.ellipse((tx + ox - 8, ty + oy - 8, tx + ox + 8, ty + oy + 8), fill=(235, 145, 35))

    d.line([(basin_x0, surface_y), (basin_x1, surface_y)], fill=(130, 95, 60), width=6)

    # Badges
    draw_badge(d, "Washwater pipe (no toilet)", (40, 240), 21, fill=(45, 75, 90))
    d.line([(240, 290), (220, 365)], fill=(75, 125, 145), width=2)

    draw_badge(d, "Mulch basin", (440, 410), 21, fill=(80, 55, 35))
    d.line([(530, 460), (560, surface_y + 30)], fill=(120, 85, 55), width=2)

    if t >= 5.0:
        draw_badge(d, "Discharge below mulch surface", (200, 680), 21, fill=(30, 75, 65))
        d.line([(440, 680), (basin_x0 + 140, surface_y + 90)], fill=(65, 140, 115), width=2)

    if t >= 8.5:
        draw_badge(d, "Filtered water reaches roots", (780, 880), 21, fill=(25, 80, 110))
        d.line([(880, 880), (tx + 50, basin_bot_y + 70)], fill=(65, 140, 185), width=2)

    # Exact Watch-slide sentences
    if t < 8.5:
        title = "Direct greywater into a mulch-filled basin around fruit trees rather than onto bare ground."
        sub = "It filters through organic matter before reaching roots."
    else:
        title = "It filters through organic matter before reaching roots."
        sub = "Direct greywater into a mulch-filled basin around fruit trees rather than onto bare ground."

    return wrap_frame(body, "IMBEWUFIELD • WATER HARVESTING", "Concept diagram — not to scale", title, sub)

# ==============================================================================
# RENDER PIPELINE
# ==============================================================================
CONFIGS = [
    {
        "id": "watch-09-vetiver-contour",
        "slide": 9,
        "title": "Watch: Vetiver Takes Over",
        "duration_sec": 16.0,
        "render_func": render_frame_slide09,
        "poster_time": 10.0,
        "mp4_target": CLIPS_DIR / "watch-09-vetiver-contour.mp4",
        "jpg_target": CLIPS_DIR / "watch-09-vetiver-contour.jpg",
        "sheet_target": CLIPS_DIR / "contact-sheet-watch-09.jpg",
        "sheet_times": [2.0, 5.0, 8.0, 10.5, 13.0, 15.5],
        "language_notes": "Visibly contains baked-in English labels ('Slope > 15–20%', 'Vetiver grass lines on contour', 'Roots anchor soil', 'Concept diagram — not to scale'). Pure conceptual diagram; not localized to isiZulu."
    },
    {
        "id": "watch-12-dam-spillway",
        "slide": 12,
        "title": "Watch: Dam and Spillway",
        "duration_sec": 16.0,
        "render_func": render_frame_slide12,
        "poster_time": 10.0,
        "mp4_target": CLIPS_DIR / "watch-12-dam-spillway.mp4",
        "jpg_target": CLIPS_DIR / "watch-12-dam-spillway.jpg",
        "sheet_target": CLIPS_DIR / "contact-sheet-watch-12.jpg",
        "sheet_times": [2.0, 5.5, 8.5, 11.0, 13.5, 15.5],
        "language_notes": "Visibly contains baked-in English labels ('Catchment runoff', 'Dam wall crest', 'Freeboard: wall crest higher than spillway', 'Lower separate side spillway', 'Spillway overflow bypasses wall', 'Concept diagram — not to scale'). Pure conceptual diagram; not localized to isiZulu."
    },
    {
        "id": "watch-16-first-flush-tank",
        "slide": 16,
        "title": "Watch: First Flush to Tank",
        "duration_sec": 17.0,
        "render_func": render_frame_slide16,
        "poster_time": 11.0,
        "mp4_target": CLIPS_DIR / "watch-16-first-flush-tank.mp4",
        "jpg_target": CLIPS_DIR / "watch-16-first-flush-tank.jpg",
        "sheet_target": CLIPS_DIR / "contact-sheet-watch-16.jpg",
        "sheet_times": [2.0, 5.0, 8.5, 11.5, 14.0, 16.5],
        "language_notes": "Visibly contains baked-in English labels ('Roof runoff', 'First-flush diverter chamber', 'Floating seal', 'Clean water to tank', 'STORAGE TANK', 'Concept diagram — not to scale'). Pure conceptual diagram; not localized to isiZulu."
    },
    {
        "id": "watch-21-greywater-mulch",
        "slide": 21,
        "title": "Watch: Greywater Under Mulch",
        "duration_sec": 17.0,
        "render_func": render_frame_slide21,
        "poster_time": 11.0,
        "mp4_target": CLIPS_DIR / "watch-21-greywater-mulch.mp4",
        "jpg_target": CLIPS_DIR / "watch-21-greywater-mulch.jpg",
        "sheet_target": CLIPS_DIR / "contact-sheet-watch-21.jpg",
        "sheet_times": [2.0, 5.5, 8.5, 11.5, 14.0, 16.5],
        "language_notes": "Visibly contains baked-in English labels ('Washwater pipe (no toilet)', 'Mulch basin', 'Discharge below mulch surface', 'Filtered water reaches roots', 'Concept diagram — not to scale'). Pure conceptual diagram; not localized to isiZulu."
    }
]

def render_clip(cfg):
    print(f"=== Rendering {cfg['id']} ({cfg['duration_sec']}s) ===", flush=True)
    target_mp4 = cfg["mp4_target"]
    target_jpg = cfg["jpg_target"]
    target_sheet = cfg["sheet_target"]
    render_func = cfg["render_func"]
    total_frames = int(cfg["duration_sec"] * FPS)

    cmd = [
        FFMPEG, "-y", "-v", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{W}x{H + TOP + BOTTOM}",
        "-r", str(FPS),
        "-i", "-",
        "-vf", "scale=824:720",
        "-an",
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(target_mp4)
    ]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    start_t = time.time()

    for f_idx in range(total_frames):
        t_sec = f_idx / FPS
        frame_img = render_func(t_sec)
        p.stdin.write(frame_img.tobytes())
        if f_idx % (FPS * 4) == 0:
            print(f"  frame {f_idx}/{total_frames} ({t_sec:.1f}s) - elapsed {time.time()-start_t:.1f}s", flush=True)

    p.stdin.close()
    assert p.wait() == 0
    print(f"  Rendered MP4: {target_mp4} ({target_mp4.stat().st_size} bytes)", flush=True)

    # Poster frame
    poster_img = render_func(cfg["poster_time"]).resize((824, 720), Image.Resampling.LANCZOS)
    poster_img.save(target_jpg, quality=94)
    print(f"  Saved poster: {target_jpg}", flush=True)

    # Contact sheet
    sheet_imgs = [render_func(st).resize((412, 360), Image.Resampling.LANCZOS) for st in cfg["sheet_times"]]
    sheet_w, sheet_h = 1236, 840
    sheet = Image.new("RGB", (sheet_w, sheet_h), (18, 28, 36))
    sd = ImageDraw.Draw(sheet)
    sd.text((20, 18), f"{cfg['title']} ({cfg['duration_sec']:.1f}s, 824x720, silent)", font=font(22, True), fill=(240, 245, 248))

    for i, (sim, st) in enumerate(zip(sheet_imgs, cfg["sheet_times"])):
        c, r = i % 3, i // 3
        x, y = c * 412, 60 + r * (360 + 30)
        sheet.paste(sim, (x, y))
        sd.rectangle((x, y + 360, x + 412, y + 390), fill=(10, 18, 24))
        sd.text((x + 10, y + 366), f"t = {st:.1f}s", font=font(16), fill=(180, 205, 215))

    sheet.save(target_sheet, quality=94)
    print(f"  Saved contact sheet: {target_sheet}", flush=True)

if __name__ == "__main__":
    selected = {int(n) for n in sys.argv[2:]}
    for c in CONFIGS:
        if not selected or c["slide"] in selected:
            render_clip(c)
    print("All 4 conceptual animations rendered successfully!", flush=True)
