#!/usr/bin/env python3
"""
ImbewuField Studies — Reading the Landscape
Authored Watch Animations: Slides 5, 9, 13, and 17.

Deterministic Pillow + FFmpeg animation generator.
Renders 1280x720 @ 24fps silent H.264 clips, poster frames,
phase contact sheets, and manifest.json.
"""

import argparse
import hashlib
from datetime import datetime, timezone
import json
import math
import os
import subprocess
import sys
from typing import Callable, Dict, List, Tuple
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

# ==============================================================================
# CONSTANTS & DESIGN PALETTE
# ==============================================================================
WIDTH, HEIGHT, FPS = 1280, 720, 24
MIN_DURATION = 14.0  # Visual teaching pacing minimum

# BewuField Warm Earth & Paper Palette
C_PAPER = (245, 242, 235)       # Base warm paper background
C_TEXT = (35, 39, 42)           # Slate dark text
C_MUTED = (95, 105, 112)        # Muted structural lines / subtitles
C_GREEN_DARK = (46, 90, 54)     # Foliage / tree canopy
C_GREEN_LIGHT = (92, 148, 88)   # Vegetation / contour
C_SOIL_DARK = (110, 71, 42)     # Subsoil / deep earth
C_SOIL_MID = (166, 124, 82)     # Topsoil / slope
C_SOIL_LIGHT = (214, 188, 152)  # Dry earth / sublayer
C_WATER = (42, 110, 160)        # Surface water flow
C_WATER_PALE = (112, 172, 214)  # Water highlight / spread
C_COLD_AIR = (175, 210, 235)    # Translucent cold air mass
C_SUN = (235, 162, 34)          # Solar disk / rays
C_SHADOW = (50, 58, 64)         # Ground shadow tone
C_ROAD = (185, 175, 160)        # Earthen farm road

# Vertical Layout Bounds
Y_HEADER_TOP, Y_HEADER_BOT = 20, 105
Y_DIAGRAM_TOP, Y_DIAGRAM_BOT = 150, 505
Y_CAPTION_TOP, Y_CAPTION_BOT = 530, 675
Y_FOOTER = 688

FOOTER_TEXT = "Concept diagram — not to scale"

# ==============================================================================
# FONT & TYPOGRAPHY SUBSYSTEM (Strict >= 28px, No Fallback Font)
# ==============================================================================
def load_strict_font(size: int) -> ImageFont.FreeTypeFont:
    """Load Arial or DejaVu font at or above 28px. Fail if unavailable."""
    assert size >= 28, f"Font size {size} is below the 28px accessibility floor."
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        if os.path.isfile(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    try:
        match = subprocess.check_output(["fc-match", "-f", "%{file}", "DejaVuSans.ttf"], text=True).strip()
        if match and os.path.isfile(match):
            return ImageFont.truetype(match, size)
    except Exception:
        pass
    raise RuntimeError("Arial or DejaVu font not found. Tiny fallback font is prohibited.")

FONT_TITLE = load_strict_font(32)
FONT_BODY = load_strict_font(28)
FONT_LABEL = load_strict_font(28)
FONT_FOOTER = load_strict_font(28)

def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> List[str]:
    """Break text into lines bounded by max_width."""
    dummy = Image.new("RGB", (1, 1))
    draw = ImageDraw.Draw(dummy)
    words = text.split()
    lines, curr = [], []
    for word in words:
        trial = " ".join(curr + [word])
        box = draw.textbbox((0, 0), trial, font=font)
        if (box[2] - box[0]) <= max_width or not curr:
            curr.append(word)
        else:
            lines.append(" ".join(curr))
            curr = [word]
    if curr:
        lines.append(" ".join(curr))
    return lines

def put_label(draw, xy, text, font=FONT_LABEL, fill=C_TEXT, anchor="lt"):
    x,y=xy
    lines=wrap_text(text,font,min(470,1210-x))
    assert y>=Y_DIAGRAM_TOP and y+len(lines)*(font.size+4)<=Y_DIAGRAM_BOT, (text,xy)
    for i,line in enumerate(lines):
        assert draw.textbbox((0,0),line,font=font)[2]<=1210-x,(text,xy)
        draw.text((x,y+i*(font.size+4)),line,font=font,fill=fill,anchor="lt")

def render_layout_chrome(img: Image.Image, slide_title: str, caption_text: str):
    """Draw common header, verbatim caption, and mandatory footer."""
    draw = ImageDraw.Draw(img)
    # Header zone: 20..105
    draw.text((70, Y_HEADER_TOP + 4), "IMBEWUFIELD STUDIES · READING THE LANDSCAPE", font=FONT_LABEL, fill=C_MUTED, anchor="lt")
    draw.text((70, Y_HEADER_TOP + 42), slide_title, font=FONT_TITLE, fill=C_TEXT, anchor="lt")
    draw.line([(70, Y_HEADER_BOT + 12), (WIDTH - 70, Y_HEADER_BOT + 12)], fill=(215, 210, 200), width=2)

    # Caption zone: 530..675
    box_w = WIDTH - 140
    box_h = Y_CAPTION_BOT - Y_CAPTION_TOP
    lines = wrap_text(caption_text, FONT_BODY, box_w)
    line_h = FONT_BODY.size + 8
    total_h = len(lines) * line_h
    assert total_h <= box_h, f"Caption exceeded vertical allotment: {total_h} > {box_h}"

    cy_start = Y_CAPTION_TOP + (box_h - total_h) // 2
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=FONT_BODY)
        lw = bbox[2] - bbox[0]
        assert lw <= box_w, f"Line width {lw} exceeded {box_w}"
        draw.text((70 + (box_w - lw) // 2, cy_start + i * line_h), line, font=FONT_BODY, fill=C_TEXT, anchor="lt")

    # Footer: Concept diagram — not to scale
    bbox_f = draw.textbbox((0, 0), FOOTER_TEXT, font=FONT_FOOTER)
    fw = bbox_f[2] - bbox_f[0]
    draw.text(((WIDTH - fw) // 2, Y_FOOTER), FOOTER_TEXT, font=FONT_FOOTER, fill=C_MUTED, anchor="lt")

# ==============================================================================
# WATCH ANIMATION 1: SLIDE 5 (WATER SLOWS, SINKS, AND LEAVES)
# ==============================================================================
def draw_slide_05(t: float) -> Image.Image:
    base = Image.new("RGB", (WIDTH, HEIGHT), C_PAPER)
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    d_base = ImageDraw.Draw(base)
    d_over = ImageDraw.Draw(overlay)

    # Side-profile slope coordinates descending left-to-right (strictly within 150..505)
    # x: 70 -> 1210; y: 220 -> 450
    def slope_y(x: float) -> float:
        if x <= 140:
            return 220.0
        elif x <= 460:
            nx = (x - 140) / 320.0
            return 220.0 + nx * 105.0  # steep descent (speeds up)
        elif x <= 860:
            nx = (x - 460) / 400.0
            return 325.0 + nx * 113.0   # mid slope (spreads & sinks)
        else:
            nx = min(1.0, (x - 860) / 300.0)
            return 438.0   # low ground gathering & exit

    # Ground soil profile
    ground_poly = [(70, 505)]
    for sx in range(70, 1211, 20):
        ground_poly.append((sx, int(slope_y(sx))))
    ground_poly.append((1210, 505))
    d_base.polygon(ground_poly, fill=C_SOIL_MID)
    d_base.line([(p[0], p[1]) for p in ground_poly[1:-1]], fill=C_SOIL_DARK, width=3)

    # Mid-slope infiltration damp plume in soil (x: 580..820)
    infilt_alpha = int(min(1.0, t * 1.5) * 180)
    d_over.ellipse([590, 390, 810, 495], fill=(C_SOIL_DARK[0], C_SOIL_DARK[1], C_SOIL_DARK[2], infilt_alpha))

    # 1. Rain falling across sky (drops landing on slope)
    rain_phase = (t * 6.0) % 1.0
    for rx in range(120, 1160, 45):
        sy = slope_y(rx)
        ry = 155 + ((rx * 17) % 60) + rain_phase * (sy - 155)
        if ry < sy:
            d_base.line([(rx, ry), (rx - 3, ry + 12)], fill=C_WATER_PALE, width=2)

    # 2. Surface water runoff particles flowing along the slope
    flow_cycle = (t * 3.5) % 1.0
    for i in range(24):
        p_t = (flow_cycle + i / 24.0) % 1.0
        px = (120 + 340 * (p_t / 0.30) ** 1.5) if p_t < 0.30 else (460 + 400 * (p_t-0.30)/0.45) if p_t < 0.75 else (860 + 350 * (p_t-0.75)/0.25)
        py = slope_y(px) if px < 860 else 432.0
        if px < 460:
            # High slope: speeds up, tight stream
            d_base.ellipse([px - 4, py - 6, px + 4, py + 2], fill=C_WATER)
        elif px < 860:
            # Mid-slope: spreads out and sinks
            spread_offset = math.sin(i * 1.7) * 9.0
            d_base.ellipse([px - 5, py - 4 + spread_offset, px + 5, py + 4 + spread_offset], fill=C_WATER_PALE)
            # Infiltration droplets entering soil
            if i % 3 == 0:
                sink_d = ((t * 2.5 + i * 0.2) % 1.0) * 55.0
                d_over.ellipse([px - 3, py + 6 + sink_d, px + 3, py + 12 + sink_d], fill=(C_WATER[0], C_WATER[1], C_WATER[2], 180))
        else:
            # Low ground: gathering pool & leaving right boundary
            pool_offset = math.sin(i * 0.8) * 5.0
            d_base.ellipse([px - 5, py - 3 + pool_offset, px + 5, py + 5 + pool_offset], fill=C_WATER)

    # Low ground water body
    d_over.rectangle([880, 430, 1210, 438], fill=(C_WATER[0], C_WATER[1], C_WATER[2], 160))

    # Short source labels (all >= 28px, strictly within 150..505)
    put_label(d_base, (120, 160), "Speeds up", font=FONT_LABEL, fill=C_TEXT, anchor="lt")
    put_label(d_base, (490, 240), "Spreads and sinks", font=FONT_LABEL, fill=C_TEXT, anchor="lt")
    put_label(d_base, (880, 390), "Gathers and leaves", font=FONT_LABEL, fill=C_TEXT, anchor="lt")

    img = Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")
    put_label(ImageDraw.Draw(img), (640, 462), "Sinks", fill=(255, 250, 240))
    render_layout_chrome(img, "Watch: Water Slows, Sinks, and Leaves",
                         "The picture shows rain moving downhill. Follow where it speeds up, spreads, sinks, gathers, and leaves the land.")
    return img

# ==============================================================================
# WATCH ANIMATION 2: SLIDE 9 (FOLLOW THE SUN ACROSS THE SITE)
# ==============================================================================
def draw_slide_09(t: float) -> Image.Image:
    base = Image.new("RGB", (WIDTH, HEIGHT), C_PAPER)
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    d_base = ImageDraw.Draw(base)
    d_over = ImageDraw.Draw(overlay)

    # Section layout: North is LEFT, South is RIGHT
    # Shallow ground slope strictly in bounds
    ground_y_left, ground_y_right = 432.0, 442.0
    def ground_y(x: float) -> float:
        return ground_y_left + (x - 70.0) / (WIDTH - 140.0) * (ground_y_right - ground_y_left)

    # Ground polygon
    d_base.polygon([(70, 505), (70, int(ground_y(70))), (WIDTH - 70, int(ground_y(WIDTH - 70))), (WIDTH - 70, 505)], fill=C_SOIL_MID)
    d_base.line([(70, ground_y(70)), (WIDTH - 70, ground_y(WIDTH - 70))], fill=C_SOIL_DARK, width=3)

    # Seasonal sun cycle: Smoothly oscillates between Summer (high) and Winter (lower)
    # Sun remains strictly on the northern side (left)
    season_alpha = 0.5 - 0.5 * math.cos(2.0 * math.pi * t)
    # Summer high sun: xs=250, ys=175; Winter lower sun: xs=160, ys=290
    sun_x = (1.0 - season_alpha) * 250.0 + season_alpha * 160.0
    sun_y = (1.0 - season_alpha) * 175.0 + season_alpha * 235.0

    # Building: x=360..490; roof ridge at (425, 330), eaves y=365; base at ground_y
    b_x1, b_x2 = 360.0, 490.0
    b_base = ground_y(b_x2)
    b_ridge = (425.0, 330.0)
    d_base.rectangle([b_x1, 365, b_x2, b_base], fill=(200, 185, 170), outline=C_TEXT, width=2)
    d_base.polygon([(b_x1 - 6, 365), b_ridge, (b_x2 + 6, 365)], fill=(155, 75, 60), outline=C_TEXT)

    # Tree: trunk at x=780, ground_y(780); canopy center at (780, 320), radius 48
    t_x = 650.0
    t_base = ground_y(t_x)
    d_base.rectangle([t_x - 8, 380, t_x + 8, t_base], fill=C_SOIL_DARK)
    d_base.ellipse([t_x - 32, 335, t_x + 32, 399], fill=C_GREEN_DARK, outline=C_TEXT, width=2)

    # Shadow geometry through exact ray-ground intersection away from northern sun
    # Ray from sun through building roof ridge (425, 330)
    m_b = (b_ridge[1] - sun_y) / (b_ridge[0] - sun_x)
    x_shadow_b = min(WIDTH - 80.0, (ground_y(0) - sun_y + m_b * sun_x) / (m_b - (ground_y(1)-ground_y(0))))
    # Building shadow on ground (extends South / right)
    d_over.polygon([(b_x2, ground_y(b_x2) - 2), (x_shadow_b, ground_y(x_shadow_b) - 2),
                    (x_shadow_b, ground_y(x_shadow_b) + 8), (b_x2, ground_y(b_x2) + 8)],
                   fill=(C_SHADOW[0], C_SHADOW[1], C_SHADOW[2], 150))

    # Ray from sun through tree top-right edge (780 + 35, 320 - 35)
    t_top = (t_x, 335.0)
    m_t = (t_top[1] - sun_y) / (t_top[0] - sun_x)
    x_shadow_t = min(WIDTH - 80.0, (ground_y(0) - sun_y + m_t * sun_x) / (m_t - (ground_y(1)-ground_y(0))))
    d_over.polygon([(t_x, ground_y(t_x) - 2), (x_shadow_t, ground_y(x_shadow_t) - 2),
                    (x_shadow_t, ground_y(x_shadow_t) + 8), (t_x, ground_y(t_x) + 8)],
                   fill=(C_SHADOW[0], C_SHADOW[1], C_SHADOW[2], 150))

    # Sun rays (dashed lines from sun through geometry)
    d_over.line([(sun_x, sun_y), (x_shadow_b, ground_y(x_shadow_b))], fill=(C_SUN[0], C_SUN[1], C_SUN[2], 90), width=2)
    d_over.line([(sun_x, sun_y), (x_shadow_t, ground_y(x_shadow_t))], fill=(C_SUN[0], C_SUN[1], C_SUN[2], 90), width=2)

    # Sun disk
    d_base.ellipse([sun_x - 22, sun_y - 22, sun_x + 22, sun_y + 22], fill=C_SUN, outline=(200, 130, 20), width=3)

    # Verbatim allowed labels ONLY: Summer, Winter, North, South, building, tree (all >= 28px)
    put_label(d_base, (80, 160), "North", font=FONT_LABEL, fill=C_TEXT, anchor="lt")
    put_label(d_base, (WIDTH - 160, 160), "South", font=FONT_LABEL, fill=C_TEXT, anchor="lt")
    put_label(d_base, (375, 385), "building", font=FONT_LABEL, fill=C_TEXT, anchor="lt")
    put_label(d_base, (624, 358), "tree", font=FONT_LABEL, fill=(245, 245, 235), anchor="lt")

    if season_alpha < 0.45:
        put_label(d_base, (290, 160), "Summer", font=FONT_LABEL, fill=C_TEXT, anchor="lt")
    elif season_alpha > 0.55:
        put_label(d_base, (200, 250), "Winter", font=FONT_LABEL, fill=C_TEXT, anchor="lt")
    else:
        put_label(d_base, (290, 160), "Summer", font=FONT_LABEL, fill=C_MUTED, anchor="lt")
        put_label(d_base, (200, 250), "Winter", font=FONT_LABEL, fill=C_MUTED, anchor="lt")

    img = Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")
    render_layout_chrome(img, "Watch: Follow the Sun Across the Site",
                         "Follow the sun, building, tree, and their shadows across the slope. Compare summer’s high sun with winter’s lower sun.")
    return img

# ==============================================================================
# WATCH ANIMATION 3: SLIDE 13 (SEE WIND AND COLD AIR ON THE MAP)
# ==============================================================================
def draw_slide_13(t: float) -> Image.Image:
    base = Image.new("RGB", (WIDTH, HEIGHT), C_PAPER)
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    d_base = ImageDraw.Draw(base)
    d_over = ImageDraw.Draw(overlay)

    # Distinct stages: Stage 1 (t < 0.5) Wind crossing ridges; Stage 2 (t >= 0.5) Cold air pooling
    if t < 0.2:
        st_t = t / 0.2
        put_label(d_base, (80, 155), "Wind across ridges and gap", font=FONT_LABEL, fill=C_TEXT, anchor="lt")
        # Plan-view landforms: Upper ridge & Lower ridge forming a central gap
        d_base.ellipse([450, 170, 720, 290], fill=(215, 205, 185), outline=C_MUTED, width=2)
        d_base.ellipse([450, 360, 720, 480], fill=(215, 205, 185), outline=C_MUTED, width=2)
        put_label(d_base, (540, 210), "Ridge", font=FONT_LABEL, fill=C_TEXT, anchor="lt")
        put_label(d_base, (540, 400), "Ridge", font=FONT_LABEL, fill=C_TEXT, anchor="lt")
        put_label(d_base, (560, 312), "Gap", font=FONT_LABEL, fill=C_TEXT, anchor="lt")
        put_label(d_base, (170, 470), "Exposure", font=FONT_LABEL, fill=C_TEXT, anchor="lt")
        put_label(d_base, (880, 470), "Shelter", font=FONT_LABEL, fill=C_TEXT, anchor="lt")

        # Wind streamlines & moving air markers funneling through gap
        wind_cycle = (st_t * 3.5) % 1.0
        for row in range(7):
            init_y = 190 + row * 45
            for k in range(5):
                wx = 100 + ((wind_cycle + k / 5.0) % 1.0) * 1050
                if wx > 760 and row in [0,1,5,6] and k%2==0:continue
                # Funneling geometry towards gap center (y=325)
                gap_factor = math.exp(-((wx - 585) ** 2) / 32000.0)
                wy = init_y + (325 - init_y) * gap_factor * 0.65
                d_base.line([(wx - 18, wy), (wx + 18, wy)], fill=C_MUTED, width=3)
                d_base.polygon([(wx + 22, wy), (wx + 10, wy - 5), (wx + 10, wy + 5)], fill=C_MUTED)
    else:
        st_t = (t - 0.2) / 0.8
        put_label(d_base, (80, 155), "Cold air downhill into low ground", font=FONT_LABEL, fill=C_TEXT, anchor="lt")
        # Terrain side-section: High ridge on left descending to a sheltered hollow on right
        def cold_slope(x: float) -> float:
            if x < 200:
                return 240.0
            elif x < 780:
                nx = (x - 200) / 580.0
                return 240.0 + nx * 190.0  # downhill slope into low ground
            else:
                nx = (x - 780) / 420.0
                return 430.0 + math.sin(nx * math.pi) * 25.0

        # Ground polygon
        g_poly = [(70, 505)]
        for gx in range(70, 1211, 25):
            g_poly.append((gx, int(cold_slope(gx))))
        g_poly.extend([(1210,int(cold_slope(1210))),(1210,505)])
        d_base.polygon(g_poly, fill=C_SOIL_MID)
        d_base.line([(p[0], p[1]) for p in g_poly[1:-1]], fill=C_SOIL_DARK, width=3)

        # Air gathers ABOVE the soil, with soft edges; an opaque rectangle read as pond water.
        air = Image.new("RGBA",base.size,(0,0,0,0)); ad=ImageDraw.Draw(air)
        strength=int(min(1,st_t*2)*130)
        for j in range(5):
            ad.ellipse([765+j*45,398-(j%2)*8,965+j*45,470],fill=(*C_COLD_AIR,strength))
        blurred_alpha=air.getchannel("A").filter(ImageFilter.GaussianBlur(13))
        air=Image.new("RGBA",base.size,(*C_COLD_AIR,0));air.putalpha(blurred_alpha)
        mask=Image.new("L",base.size,0)
        ImageDraw.Draw(mask).polygon([(70,150),(1210,150)]+[(x,int(cold_slope(x))-1) for x in range(1210,69,-10)],fill=255)
        air.putalpha(ImageChops.multiply(air.getchannel("A"),mask))
        overlay=Image.alpha_composite(overlay,air);d_over=ImageDraw.Draw(overlay)

        # Downhill cold-air particles following slope and coming to rest
        air_cycle = (st_t * 2.8) % 1.0
        for i in range(20):
            pt = (air_cycle + i / 20.0) % 1.0
            px = 160 + pt * (980 - 160)
            py = cold_slope(px) - 12 - math.sin(i * 1.5) * 6
            if px > 760:
                # Settle in hollow
                py = min(cold_slope(px)-8.0, py + 5.0)
            d_over.line([(px-12,py),(px+12,py)],fill=(*C_COLD_AIR,210),width=4)

        # Labels strictly from source
        put_label(d_base, (120, 200), "Ridge", font=FONT_LABEL, fill=C_TEXT, anchor="lt")
        put_label(d_base, (410, 290), "Cold air", font=FONT_LABEL, fill=C_TEXT, anchor="lt")
        put_label(d_base, (820, 360), "Shelter", font=FONT_LABEL, fill=C_TEXT, anchor="lt")
        put_label(d_base, (820, 460), "Low ground", font=FONT_LABEL, fill=C_TEXT, anchor="lt")

    img = Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")
    render_layout_chrome(img, "Watch: See Wind and Cold Air on the Map",
                         "Follow wind across the ridges and gaps. Trace cold air downhill into low ground, and notice where the land creates shelter or exposure.")
    return img

# ==============================================================================
# WATCH ANIMATION 4: SLIDE 17 (DRAW THE LAND YOU ALREADY HAVE)
# ==============================================================================
def draw_slide_17(t: float) -> Image.Image:
    base = Image.new("RGB", (WIDTH, HEIGHT), C_PAPER)
    d = ImageDraw.Draw(base)

    # Drawing progressive reveal thresholds:
    # 0.00..0.22 -> Boundary
    # 0.22..0.38 -> North direction arrow
    # 0.38..0.54 -> Building
    # 0.54..0.70 -> Road
    # 0.70..0.85 -> Water feature
    # 0.85..1.00 -> Slopes / contours & direction arrows

    # 1. Boundary progressive stroke
    boundary_pts = [(160, 210), (1050, 180), (1120, 460), (420, 480), (140, 420), (160, 210)]
    t_b = min(1.0, t / 0.22)
    tot_segs = len(boundary_pts) - 1
    cur_segs = int(t_b * tot_segs)
    for s in range(cur_segs):
        d.line([boundary_pts[s], boundary_pts[s + 1]], fill=C_TEXT, width=4)
    if cur_segs < tot_segs and t_b > 0.0:
        frac = (t_b * tot_segs) - cur_segs
        p1, p2 = boundary_pts[cur_segs], boundary_pts[cur_segs + 1]
        interp = (p1[0] + frac * (p2[0] - p1[0]), p1[1] + frac * (p2[1] - p1[1]))
        d.line([p1, interp], fill=C_TEXT, width=4)
    if t >= 0.18:
        put_label(d, (180, 165), "Boundary", font=FONT_LABEL, fill=C_TEXT, anchor="lt")

    # 2. North direction arrow
    if t >= 0.22:
        t_n = min(1.0, (t - 0.22) / 0.16)
        nx, ny = 960, 230
        d.line([(nx, ny + 40), (nx, ny - int(t_n * 35))], fill=C_TEXT, width=3)
        if t_n > 0.6:
            d.polygon([(nx, ny - 40), (nx - 9, ny - 18), (nx + 9, ny - 18)], fill=C_TEXT)
            put_label(d, (nx - 8, ny - 78), "North", font=FONT_LABEL, fill=C_TEXT, anchor="lt")

    # 3. Existing building
    if t >= 0.38:
        t_bld = min(1.0, (t - 0.38) / 0.16)
        bw, bh = int(t_bld * 110), int(t_bld * 75)
        d.rectangle([340, 250, 340 + bw, 250 + bh], fill=(225, 215, 200), outline=C_TEXT, width=3)
        if t_bld > 0.8:
            put_label(d, (350, 270), "Building", font=FONT_LABEL, fill=C_TEXT, anchor="lt")

    # 4. Road from boundary to building
    if t >= 0.54:
        t_rd = min(1.0, (t - 0.54) / 0.16)
        road_pts = [(145,380),(220,360),(340,310)]
        q=t_rd*2
        for i in range(min(2,int(q))):d.line(road_pts[i:i+2],fill=C_ROAD,width=12)
        if q<2:
            i=int(q);f=q-i;a,b=road_pts[i:i+2]
            d.line([a,(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f)],fill=C_ROAD,width=12)
        if t_rd>0.5:put_label(d,(190,395),"Road")

    # 6. Slopes / contours and direction arrows
    if t >= 0.85:
        t_c = min(1.0, (t - 0.85) / 0.15)
        # Gentle contour curves across site
        d.arc([220, 120, 950, 430], start=10, end=int(10 + t_c * 80), fill=C_GREEN_LIGHT, width=2)
        d.arc([300, 140, 1020, 450], start=10, end=int(10 + t_c * 80), fill=C_GREEN_LIGHT, width=2)
        # Downhill slope direction arrows
        if t_c > 0.6:
            d.line([(580, 240), (620, 270)], fill=C_MUTED, width=3)
            d.polygon([(624, 273), (618, 258), (608, 268)], fill=C_MUTED)
            put_label(d, (635, 230), "Slope", font=FONT_LABEL, fill=C_TEXT, anchor="lt")

    # 5. Water feature (pond contour)
    if t >= 0.70:
        t_w = min(1.0, (t - 0.70) / 0.15)
        pw, ph = int(t_w * 75), int(t_w * 45)
        d.ellipse([780 - pw, 390 - ph, 780 + pw, 390 + ph], fill=C_WATER_PALE, outline=C_WATER, width=3)
        if t_w > 0.8:
            put_label(d, (740, 375), "Water", font=FONT_LABEL, fill=C_TEXT, anchor="lt")

    render_layout_chrome(base, "Watch: Draw the Land You Already Have",
                         "Use the picture as a guide: boundary, buildings, roads, water, slopes, and direction arrows. Draw what already exists before planning changes.")
    return base

# ==============================================================================
# CONTACT SHEET & POSTER PIPELINE
# ==============================================================================
def create_contact_sheet(draw_func: Callable[[float], Image.Image]) -> Image.Image:
    """Generate 2x2 phase contact sheet from t=0.20, 0.45, 0.70, 0.95."""
    phases = [0.05, 0.15, 0.50, 0.95] if draw_func == draw_slide_13 else [0.20, 0.45, 0.70, 0.95]
    contact = Image.new("RGB", (WIDTH, HEIGHT), C_PAPER)
    tw, th = WIDTH // 2, HEIGHT // 2
    for idx, ph in enumerate(phases):
        frame = draw_func(ph).resize((tw, th), Image.Resampling.LANCZOS)
        cx = (idx % 2) * tw
        cy = (idx // 2) * th
        contact.paste(frame, (cx, cy))
    # Outer & divider borders
    d = ImageDraw.Draw(contact)
    d.line([(tw, 0), (tw, HEIGHT)], fill=C_TEXT, width=2)
    d.line([(0, th), (WIDTH, th)], fill=C_TEXT, width=2)
    return contact

def probe_audio(audio_path: str) -> float:
    if not os.path.isfile(audio_path):raise FileNotFoundError(audio_path)
    return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",audio_path],text=True).strip())

# ==============================================================================
# MAIN WORKFLOW & CLI
# ==============================================================================
SLIDES = [
    {
        "id": 5, "key": "slide-05",
        "title": "Watch: Water Slows, Sinks, and Leaves",
        "caption": "The picture shows rain moving downhill. Follow where it speeds up, spreads, sinks, gathers, and leaves the land.",
        "func": draw_slide_05, "poster_t": 0.65
    },
    {
        "id": 9, "key": "slide-09",
        "title": "Watch: Follow the Sun Across the Site",
        "caption": "Follow the sun, building, tree, and their shadows across the slope. Compare summer’s high sun with winter’s lower sun.",
        "func": draw_slide_09, "poster_t": 0.50
    },
    {
        "id": 13, "key": "slide-13",
        "title": "Watch: See Wind and Cold Air on the Map",
        "caption": "Follow wind across the ridges and gaps. Trace cold air downhill into low ground, and notice where the land creates shelter or exposure.",
        "func": draw_slide_13, "poster_t": 0.85
    },
    {
        "id": 17, "key": "slide-17",
        "title": "Watch: Draw the Land You Already Have",
        "caption": "Use the picture as a guide: boundary, buildings, roads, water, slopes, and direction arrows. Draw what already exists before planning changes.",
        "func": draw_slide_17, "poster_t": 1.0
    },
]

def main():
    parser = argparse.ArgumentParser(description="Render ImbewuField Studies Reading the Landscape Watch animations.")
    parser.add_argument("--output", default="output", help="Directory for clips, posters, contacts, and manifest.")
    parser.add_argument("--preview", action="store_true", help="Render only phase contacts and poster images.")
    parser.add_argument("--audio-dir", default="inputs/english-audio", help="Directory containing slide-NN.mp3.")
    args = parser.parse_args()

    clips_dir = os.path.join(args.output, "clips")
    posters_dir = os.path.join(args.output, "posters")
    contacts_dir = os.path.join(args.output, "contacts")
    for d in [clips_dir, posters_dir, contacts_dir]:
        os.makedirs(d, exist_ok=True)

    manifest_data = {
        "module": "Reading the Landscape",
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "preview": args.preview,
        "fps": FPS,
        "resolution": [WIDTH, HEIGHT],
        "slides": {}
    }

    for meta in SLIDES:
        s_key = meta["key"]
        audio_file = os.path.join(args.audio_dir, f"{s_key}.mp3")
        audio_duration = probe_audio(audio_file)
        total_frames = math.ceil(max(audio_duration+1.0,MIN_DURATION)*FPS)
        duration = total_frames/FPS

        # 1. Poster image (chosen at the defining teaching concept phase)
        poster_path = os.path.join(posters_dir, f"{s_key}.png")
        poster_img = meta["func"](meta["poster_t"])
        poster_img.save(poster_path)

        # 2. Contact sheet
        contact_path = os.path.join(contacts_dir, f"{s_key}.png")
        contact_img = create_contact_sheet(meta["func"])
        contact_img.save(contact_path)

        clip_rel_path = None
        if not args.preview:
            # 3. Deterministic H.264 silent video clip piped to FFmpeg
            clip_path = os.path.join(clips_dir, f"{s_key}.mp4")
            clip_rel_path = os.path.join("clips", f"{s_key}.mp4")
            ffmpeg_cmd = [
                "ffmpeg", "-y", "-v", "error",
                "-f", "rawvideo", "-vcodec", "rawvideo",
                "-s", f"{WIDTH}x{HEIGHT}", "-pix_fmt", "rgb24",
                "-r", str(FPS), "-i", "-",
                "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-movflags", "+faststart", clip_path
            ]
            proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
            for f in range(total_frames):
                tf = min(1.0, (f / FPS) / (duration - 1.0))
                frame = meta["func"](tf)
                proc.stdin.write(frame.tobytes())
            proc.stdin.close()
            proc.stdin = None
            _, err = proc.communicate()
            if proc.returncode != 0:
                raise RuntimeError(f"FFmpeg error on {s_key}: {err.decode('utf-8')}")

        # JSON record contains purely serializable strings/floats/ints
        manifest_data["slides"][s_key] = {
            "slide_id": meta["id"],
            "title": meta["title"],
            "caption": meta["caption"],
            "duration_sec": probe_audio(clip_path) if not args.preview else duration,
            "audio_duration_sec": audio_duration,
            "audio_sha256": hashlib.sha256(open(audio_file,"rb").read()).hexdigest(),
            "bytes": os.path.getsize(clip_path) if not args.preview else None,
            "sha256": hashlib.sha256(open(clip_path,"rb").read()).hexdigest() if not args.preview else None,
            "total_frames": total_frames,
            "poster": os.path.join("posters", f"{s_key}.png"),
            "contact": os.path.join("contacts", f"{s_key}.png"),
            "clip": clip_rel_path
        }

    manifest_path = os.path.join(args.output, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)

if __name__ == "__main__":
    main()
