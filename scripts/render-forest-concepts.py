#!/usr/bin/env python3
"""ImbewuField authored Food Forest Watch animations (Slides 5, 10, 15)."""

import argparse
from functools import lru_cache
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1280, 720, 24
PHASES = [0.10, 0.35, 0.60, 0.85, 0.98]

CAPTIONS = {
    5: (
        "Read the planting downwards, from the tall canopy to the roots.\n"
        "Climbers use the open vertical space between the layers.\n"
        "One piece of ground, working at every level."
    ),
    10: (
        "Climate decides which species belong.\n"
        "On the Highveld, choose cold-tolerant trees and shrubs; on the KZN"
        " coast and Lowveld, choose warm-climate species.\n"
        "Match every plant to your site."
    ),
    15: (
        "Sheet-mulch first.\n"
        "Pioneers build soil while fruit trees establish.\n"
        "As shelter grows, plant the lower layers, ground covers, and climbers."
    ),
}

TITLES = {
    5: ("Watch: The Seven Layers Working Together", "Slide 5 · Food Forest Design"),
    10: ("Watch: Match the Species to the Climate", "Slide 10 · Climate Matching"),
    15: ("Watch: From Bare Ground to Food Forest", "Slide 15 · Planting Sequence"),
}

SLUGS = {
    5: "watch-05-seven-layers",
    10: "watch-10-climate-match",
    15: "watch-15-forest-sequence",
}


@lru_cache(maxsize=16)
def load_font(size=28, bold=False):
    target_size = max(28, int(size))
    candidates = [
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
        "Arial Bold.ttf" if bold else "Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
        "arial.ttf",
    ]
    for cand in candidates:
        try:
            return ImageFont.truetype(cand, target_size)
        except Exception:
            continue
    raise RuntimeError("Arial or DejaVu font >=28px required but unavailable.")


def get_text_size(font, text):
    b = font.getbbox(text)
    return b[2] - b[0], b[3] - b[1], b[0], b[1]


def wrap_text(text, font, max_width):
    lines = []
    for para in text.split("\n"):
        words = para.split()
        if not words:
            lines.append("")
            continue
        cur = words[0]
        for w in words[1:]:
            test = f"{cur} {w}"
            b = font.getbbox(test)
            if (b[2] - b[0]) <= max_width:
                cur = test
            else:
                lines.append(cur)
                cur = w
        lines.append(cur)
    return lines


def draw_centered_text(draw, box, text, font, fill):
    tx0, ty0, tx1, ty1 = font.getbbox(text)
    tw, th = tx1 - tx0, ty1 - ty0
    assert tw <= box[2]-box[0] and th <= box[3]-box[1], f"Label outside box: {text}"
    cx = (box[0] + box[2]) / 2.0
    cy = (box[1] + box[3]) / 2.0
    draw.text((cx - tw / 2.0 - tx0, cy - th / 2.0 - ty0), text, font=font, fill=fill)


def draw_rounded_rect(draw, box, radius=8, fill=None, outline=None, width=1):
    try:
        draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)
    except Exception:
        draw.rectangle(box, fill=fill, outline=outline, width=width)


def draw_base_frame(slide_num):
    img = Image.new("RGBA", (W, H), (251, 249, 245, 255))
    draw = ImageDraw.Draw(img)
    title, kicker = TITLES[slide_num]
    font_kicker = load_font(28, bold=False)
    font_title = load_font(34, bold=True)
    draw.text((60, 24), kicker.upper(), font=font_kicker, fill=(108, 98, 88, 255))
    draw.text((60, 58), title, font=font_title, fill=(38, 33, 28, 255))
    draw.line([(60, 105), (1220, 105)], fill=(218, 210, 200, 255), width=2)

    font_cap = load_font(28, bold=False)
    cap_lines = wrap_text(CAPTIONS[slide_num], font_cap, 1160)
    assert len(cap_lines)*34<=140, "Caption exceeds teaching zone"
    y_cap = 534
    for line in cap_lines:
        bw,bh,bx,by=get_text_size(font_cap,line)
        assert bw<=1160 and y_cap+bh<=675, "Caption outside bounds"
        draw.text((60-bx, y_cap-by), line, font=font_cap, fill=(44, 38, 34, 255))
        y_cap += 34

    font_foot = load_font(28, bold=False)
    foot_text = "Concept diagram — not to scale"
    fw, _, fx0, fy0 = get_text_size(font_foot, foot_text)
    draw.text((1220 - fw - fx0, 684 - fy0), foot_text, font=font_foot, fill=(130, 120, 110, 255))
    return img


def draw_tree_profile(draw, cx, base_y, height, rx, ry, trunk_w, trunk_c, fol_c, scale=1.0):
    if scale <= 0.01:
        return
    h = height * scale
    top_y = base_y - h
    draw.line([(cx, base_y), (cx - rx * 0.45, base_y + 24 * scale)], fill=(145, 100, 60, 255), width=2)
    draw.line([(cx, base_y), (cx + rx * 0.45, base_y + 20 * scale)], fill=(145, 100, 60, 255), width=2)
    draw.line([(cx, base_y), (cx, base_y + 36 * scale)], fill=(145, 100, 60, 255), width=2)
    tw = max(2, int(trunk_w * scale / 2))
    draw.polygon([(cx - tw, base_y), (cx + tw, base_y), (cx + tw * 0.7, top_y + ry * 0.5 * scale), (cx - tw * 0.7, top_y + ry * 0.5 * scale)], fill=trunk_c)
    cy = top_y + ry * 0.6 * scale
    crx, cry = rx * scale, ry * scale
    draw.ellipse([cx - crx, cy - cry, cx + crx, cy + cry], fill=fol_c)
    draw.ellipse([cx - crx * 0.78, cy - cry * 0.92, cx + crx * 0.78, cy + cry * 0.45], fill=(min(255, fol_c[0] + 16), min(255, fol_c[1] + 18), min(255, fol_c[2] + 12), fol_c[3]))


def draw_climber_profile(draw, cx, base_y, max_h, scale=1.0):
    if scale <= 0.01:
        return
    draw.line([(cx, base_y), (cx, base_y - max_h)], fill=(145, 125, 110, 255), width=3)
    draw.line([(cx, base_y), (cx - 12, base_y + 18 * scale)], fill=(140, 95, 55, 255), width=2)
    steps = int(24 * scale)
    pts = []
    for s in range(steps + 1):
        frac = s / 24.0
        vy = base_y - frac * max_h
        vx = cx + math.sin(frac * math.pi * 6) * 12
        pts.append((vx, vy))
        if s > 0 and s % 3 == 0:
            draw.ellipse([vx - 5, vy - 4, vx + 5, vy + 4], fill=(62, 132, 48, 255))
    if len(pts) > 1:
        draw.line(pts, fill=(45, 110, 38, 255), width=3)


def draw_ground_cover_profile(draw, x1, x2, base_y, scale=1.0):
    if scale <= 0.01:
        return
    cur_x2 = x1 + (x2 - x1) * scale
    draw.line([(x1 + 15, base_y), (x1 + 15, base_y + 12 * scale)], fill=(140, 95, 55, 255), width=1)
    draw.line([(cur_x2 - 15, base_y), (cur_x2 - 15, base_y + 12 * scale)], fill=(140, 95, 55, 255), width=1)
    cx = x1 + 12
    while cx < cur_x2:
        draw.ellipse([cx - 10, base_y - 12, cx + 10, base_y + 2], fill=(111, 168, 68, 255))
        cx += 18


def draw_root_crop_profile(draw, cx, base_y, scale=1.0):
    if scale <= 0.01:
        return
    rw, rh = 16 * scale, 36 * scale
    draw.polygon([(cx - rw, base_y + 6), (cx + rw, base_y + 6), (cx, base_y + rh + 10)], fill=(154, 98, 51, 255))
    draw.line([(cx, base_y + rh + 10), (cx, base_y + rh + 20 * scale)], fill=(154, 98, 51, 255), width=2)
    sh = 16 * scale
    draw.polygon([(cx - 7, base_y), (cx, base_y - sh), (cx + 7, base_y)], fill=(94, 156, 60, 255))


def draw_herb_profile(draw,cx,base_y,height,scale):
    if scale<=0.01:return
    draw.line((cx,base_y,cx,base_y+15*scale),fill=(145,100,60,255),width=2)
    tip=base_y-height*scale
    draw.line((cx,base_y,cx,tip),fill=(62,125,48,255),width=3)
    for side,level in [(-1,.30),(1,.48),(-1,.65),(1,.82)]:
        y=base_y-height*scale*level
        draw.ellipse((cx+min(0,side*24*scale),y-10*scale,cx+max(0,side*24*scale),y+3*scale),fill=(94,156,60,255))


def scene_05(t):
    base = draw_base_frame(5)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ground_y = 430

    d.rectangle([(60, ground_y), (930, 498)], fill=(232, 222, 210, 255))
    d.line([(60, ground_y), (930, ground_y)], fill=(92, 68, 49, 255), width=3)
    d.line([(930, 150), (930, 498)], fill=(225, 218, 208, 255), width=1)

    t_norm = min(1.0, t / 0.85)
    p_can = min(1.0, max(0.0, (t_norm - 0.00) / 0.20))
    p_sub = min(1.0, max(0.0, (t_norm - 0.14) / 0.20))
    p_cli = min(1.0, max(0.0, (t_norm - 0.28) / 0.20))
    p_shrub = min(1.0, max(0.0, (t_norm - 0.42) / 0.20))
    p_herb = min(1.0, max(0.0, (t_norm - 0.54) / 0.18))
    p_gc = min(1.0, max(0.0, (t_norm - 0.66) / 0.16))
    p_root = min(1.0, max(0.0, (t_norm - 0.78) / 0.16))

    draw_tree_profile(d, 220, ground_y, 250, 92, 54, 16, (90, 64, 45, 255), (45, 90, 39, 255), p_can)
    draw_tree_profile(d, 400, ground_y, 185, 64, 40, 12, (90, 64, 45, 255), (61, 115, 46, 255), p_sub)
    draw_climber_profile(d, 520, ground_y, 210, p_cli)
    draw_tree_profile(d, 630, ground_y, 115, 46, 32, 8, (105, 75, 55, 255), (78, 135, 54, 255), p_shrub)
    draw_herb_profile(d, 725, ground_y, 65, p_herb)
    draw_ground_cover_profile(d, 770, 840, ground_y, p_gc)
    draw_root_crop_profile(d, 885, ground_y, p_root)

    font_label = load_font(28, bold=False)
    layer_defs = [
        ("Canopy", 168, p_can, (45, 90, 39, 255), (220+60*p_can, 430-245*p_can)),
        ("Sub-canopy", 212, p_sub, (61, 115, 46, 255), (400+40*p_sub, 430-185*p_sub)),
        ("Climbers", 256, p_cli, (45, 110, 38, 255), (520,430-170*p_cli)),
        ("Shrub", 300, p_shrub, (78, 135, 54, 255), (630+25*p_shrub,430-110*p_shrub)),
        ("Herbaceous", 344, p_herb, (94, 156, 60, 255), (725,430-60*p_herb)),
        ("Ground cover", 388, p_gc, (111, 168, 68, 255), (770+50*p_gc,420)),
        ("Root crops", 432, p_root, (154, 98, 51, 255), (885,430+25*p_root)),
    ]

    for name, ly, prog, col, target in layer_defs:
        if prog <= 0.05:
            continue
        tw, th, tx0, ty0 = get_text_size(font_label, name)
        box = [955, ly - 16, 955 + tw + 38, ly + 16]
        assert box[2]<=1220 and th<=32, f"Layer label outside key: {name}"
        draw_rounded_rect(d, box, radius=6, fill=(255, 255, 255, 245), outline=(205, 195, 185, 255), width=1)
        d.ellipse([965, ly - 5, 975, ly + 5], fill=col)
        d.text((985 - tx0, ly - th / 2.0 - ty0), name, font=font_label, fill=(35, 30, 25, 255))
        d.line([(955, ly), target], fill=(145, 135, 125, 220), width=2)
        d.ellipse([target[0] - 3, target[1] - 3, target[0] + 3, target[1] + 3], fill=col)

    base.alpha_composite(layer)
    return base


def scene_10(t):
    base = draw_base_frame(10)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    draw_rounded_rect(d, [70, 145, 615, 455], radius=12, fill=(242, 245, 248, 255), outline=(186, 200, 211, 255), width=2)
    draw_rounded_rect(d, [665, 145, 1210, 455], radius=12, fill=(251, 245, 236, 255), outline=(227, 207, 186, 255), width=2)

    cx1, cy1 = 105, 175
    for i in range(6):
        ang = i * math.pi / 3
        dx, dy = math.cos(ang) * 15, math.sin(ang) * 15
        d.line([(cx1, cy1), (cx1 + dx, cy1 + dy)], fill=(53, 98, 133, 255), width=2)
        d.line([(cx1 + dx * 0.6 - dy * 0.25, cy1 + dy * 0.6 + dx * 0.25), (cx1 + dx * 0.6, cy1 + dy * 0.6), (cx1 + dx * 0.6 + dy * 0.25, cy1 + dy * 0.6 - dx * 0.25)], fill=(53, 98, 133, 255), width=2)

    font_head = load_font(30, bold=True)
    d.text((135, 160), "Highveld", font=font_head, fill=(35, 56, 71, 255))

    cx2, cy2 = 700, 175
    d.ellipse([cx2 - 10, cy2 - 10, cx2 + 10, cy2 + 10], fill=(199, 121, 38, 255))
    for i in range(8):
        ang = i * math.pi / 4
        x_s, y_s = cx2 + math.cos(ang) * 13, cy2 + math.sin(ang) * 13
        x_e, y_e = cx2 + math.cos(ang) * 19, cy2 + math.sin(ang) * 19
        d.line([(x_s, y_s), (x_e, y_e)], fill=(199, 121, 38, 255), width=2)

    d.text((728, 160), "KZN coast / Lowveld", font=font_head, fill=(77, 49, 22, 255))

    font_card = load_font(28, bold=True)
    t_norm = min(1.0, t / 0.85)

    m1 = min(1.0, max(0.0, (t_norm - 0.08) / 0.22))
    ease1 = 1.0 - (1.0 - m1) ** 2
    y_c1 = 305 - ease1 * 97
    box_c1 = [100, y_c1, 585, y_c1 + 72]
    draw_rounded_rect(d, box_c1, radius=8, fill=(255, 255, 255, 250), outline=(176, 194, 206, 255), width=2)
    draw_centered_text(d, [100, y_c1, 585, y_c1 + 36], "Cold-tolerant trees", font_card, fill=(35, 56, 71, 255))
    draw_centered_text(d, [100, y_c1 + 36, 585, y_c1 + 72], "and shrubs", font_card, fill=(35, 56, 71, 255))

    p_p1 = min(1.0, max(0.0, (t_norm - 0.32) / 0.24))
    d.line([(95, 435), (590, 435)], fill=(160, 175, 185, 255), width=2)
    draw_tree_profile(d, 230, 435, 125, 46, 32, 10, (80, 60, 45, 255), (48, 88, 52, 255), p_p1)
    draw_tree_profile(d, 450, 435, 75, 34, 22, 6, (95, 70, 50, 255), (68, 110, 60, 255), p_p1)

    m2 = min(1.0, max(0.0, (t_norm - 0.30) / 0.22))
    ease2 = 1.0 - (1.0 - m2) ** 2
    y_c2 = 305 - ease2 * 97
    box_c2 = [695, y_c2, 1180, y_c2 + 72]
    draw_rounded_rect(d, box_c2, radius=8, fill=(255, 255, 255, 250), outline=(220, 198, 175, 255), width=2)
    draw_centered_text(d, box_c2, "Warm-climate species", font_card, fill=(77, 49, 22, 255))

    p_p2 = min(1.0, max(0.0, (t_norm - 0.54) / 0.24))
    d.line([(690, 435), (1185, 435)], fill=(205, 185, 165, 255), width=2)
    draw_tree_profile(d, 820, 435, 130, 56, 36, 12, (80, 60, 45, 255), (42, 105, 48, 255), p_p2)
    draw_tree_profile(d, 1050, 435, 80, 38, 24, 6, (95, 70, 50, 255), (70, 125, 55, 255), p_p2)

    font_site = load_font(28, bold=False)
    draw_rounded_rect(d, [70, 472, 1210, 504], radius=6, fill=(245, 241, 235, 255), outline=(215, 205, 195, 255), width=1)
    draw_centered_text(d, [70, 472, 1210, 504], "Site check factors: Frost  ·  Rainfall  ·  Humidity", font_site, fill=(80, 70, 60, 255))

    base.alpha_composite(layer)
    return base


def scene_15(t):
    base = draw_base_frame(15)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ground_y = 430

    d.rectangle([(80, ground_y), (1200, 498)], fill=(234, 224, 212, 255))
    d.line([(80, ground_y), (1200, ground_y)], fill=(90, 64, 45, 255), width=3)

    t_norm = min(1.0, t / 0.85)

    stages = [
        ("Sheet-mulch", 0.00, 0.22),
        ("Pioneers and fruit trees", 0.22, 0.50),
        ("Lower layers", 0.50, 0.72),
        ("Ground covers and climbers", 0.72, 1.00),
    ]
    cur_stage = stages[0][0]
    for s_name, s_start, s_end in stages:
        if t_norm >= s_start:
            cur_stage = s_name

    font_stage = load_font(28, bold=True)
    draw_rounded_rect(d, [250, 150, 1030, 194], radius=8, fill=(244, 239, 230, 255), outline=(210, 200, 188, 255), width=2)
    draw_centered_text(d, [250, 150, 1030, 194], f"Stage: {cur_stage}", font_stage, fill=(45, 38, 30, 255))

    p_mulch = min(1.0, max(0.0, (t_norm - 0.00) / 0.20))
    if p_mulch > 0.01:
        mx2 = 80 + (1200 - 80) * p_mulch
        d.line([(80, ground_y), (mx2, ground_y)], fill=(120, 95, 70, 255), width=3)
        d.rectangle([(80, ground_y - 8), (mx2, ground_y)], fill=(150, 115, 80, 255))
        st = 90
        while st < mx2 - 10:
            d.line([(st, ground_y - 6), (st + 8, ground_y - 3)], fill=(115, 85, 55, 255), width=2)
            st += 24

    p_pio = min(1.0, max(0.0, (t_norm - 0.20) / 0.18))
    draw_tree_profile(d, 280, ground_y, 195, 42, 60, 9, (95, 70, 50, 255), (75, 130, 55, 255), p_pio)
    draw_tree_profile(d, 680, ground_y, 205, 44, 62, 9, (95, 70, 50, 255), (75, 130, 55, 255), p_pio)
    draw_tree_profile(d, 1050, ground_y, 190, 40, 58, 9, (95, 70, 50, 255), (75, 130, 55, 255), p_pio)

    p_fruit = min(1.0, max(0.0, (t_norm - 0.28) / 0.20))
    draw_tree_profile(d, 470, ground_y, 185, 76, 48, 14, (85, 60, 40, 255), (45, 95, 40, 255), p_fruit)
    draw_tree_profile(d, 870, ground_y, 180, 74, 46, 14, (85, 60, 40, 255), (45, 95, 40, 255), p_fruit)

    p_lower = min(1.0, max(0.0, (t_norm - 0.50) / 0.20))
    draw_tree_profile(d, 375, ground_y, 110, 45, 30, 8, (100, 72, 50, 255), (65, 118, 48, 255), p_lower)
    draw_herb_profile(d, 580, ground_y, 65, p_lower)
    draw_tree_profile(d, 780, ground_y, 115, 46, 32, 8, (100, 72, 50, 255), (65, 118, 48, 255), p_lower)
    draw_herb_profile(d, 970, ground_y, 65, p_lower)

    p_gc_cli = min(1.0, max(0.0, (t_norm - 0.72) / 0.14))
    draw_ground_cover_profile(d, 150, 420, ground_y, p_gc_cli)
    draw_ground_cover_profile(d, 520, 820, ground_y, p_gc_cli)
    draw_ground_cover_profile(d, 920, 1150, ground_y, p_gc_cli)
    draw_climber_profile(d, 485, ground_y, 140, p_gc_cli)
    draw_climber_profile(d, 885, ground_y, 135, p_gc_cli)

    base.alpha_composite(layer)
    return base


SCENES = {5: scene_05, 10: scene_10, 15: scene_15}


def file_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def probe_file_duration(filepath):
    p = Path(filepath)
    if not p.is_file():
        raise FileNotFoundError(f"File not found: {p}")
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(p),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0 or not res.stdout.strip():
        raise RuntimeError(f"ffprobe failed for {p}: {res.stderr.strip()}")
    try:
        dur = float(res.stdout.strip())
        if not math.isfinite(dur) or dur <= 0:
            raise ValueError
        return dur
    except ValueError:
        raise RuntimeError(f"Invalid duration parsed from {p}")


def render_contacts_and_posters(slide_num, out_root):
    posters_dir = out_root / "posters"
    contacts_dir = out_root / "contacts"
    posters_dir.mkdir(parents=True, exist_ok=True)
    contacts_dir.mkdir(parents=True, exist_ok=True)

    slug = SLUGS[slide_num]
    scene_fn = SCENES[slide_num]

    poster_img = scene_fn(1.0).convert("RGB")
    poster_path = posters_dir / f"{slug}.png"
    poster_img.save(poster_path)

    contact_img=Image.new("RGB",(1320,1230),(245,242,236))
    dc=ImageDraw.Draw(contact_img)
    for idx,p in enumerate(PHASES):
        x=12+(idx%2)*652; y=42+(idx//2)*410
        tile=scene_fn(p).convert("RGB").resize((640,360),Image.Resampling.LANCZOS)
        contact_img.paste(tile,(x,y))
        dc.text((x,y-36),f"Phase {p:.2f}",font=load_font(28),fill=(50,45,40))

    contact_path = contacts_dir / f"{slug}.png"
    contact_img.convert("RGB").save(contact_path)
    return poster_path


def render_video_clip(slide_num, audio_path, out_root):
    clips_dir = out_root / "clips"
    clips_dir.mkdir(parents=True, exist_ok=True)
    slug = SLUGS[slide_num]
    clip_path = clips_dir / f"{slug}.mp4"

    audio_dur = probe_file_duration(audio_path)
    total_sec = max(14.0, audio_dur + 1.0)
    total_frames = math.ceil(total_sec * FPS)

    scene_fn = SCENES[slide_num]

    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-f", "rawvideo",
        "-pix_fmt", "rgb24",
        "-s", f"{W}x{H}",
        "-r", str(FPS),
        "-i", "-",
        "-an",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(clip_path),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f_idx in range(total_frames):
        t = f_idx / max(1, total_frames - 1)
        frame_img = scene_fn(t).convert("RGB")
        proc.stdin.write(frame_img.tobytes())
    proc.stdin.close()
    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError(f"FFmpeg failed while rendering {clip_path}")

    actual_sec = probe_file_duration(clip_path)
    clip_bytes = os.path.getsize(clip_path)
    clip_sha = file_sha256(clip_path)
    audio_sha = file_sha256(audio_path)

    return {
        "slide": slide_num,
        "path": f"clips/{slug}.mp4",
        "poster": f"posters/{slug}.png",
        "seconds": actual_sec,
        "bytes": clip_bytes,
        "sha256": clip_sha,
        "audio_path": str(audio_path),
        "audio_seconds": audio_dur,
        "audio_sha256": audio_sha,
        "caption": CAPTIONS[slide_num],
    }


def main():
    parser = argparse.ArgumentParser(description="Food Forest Watch animations renderer")
    parser.add_argument("--output", required=True, help="Root directory for outputs")
    parser.add_argument("--preview", action="store_true", help="Only render posters and contact sheets")
    parser.add_argument("--audio-dir", help="Directory containing slide-NN.mp3 files")
    args = parser.parse_args()

    out_root = Path(args.output)
    out_root.mkdir(parents=True, exist_ok=True)

    if args.audio_dir:
        audio_dir = Path(args.audio_dir)
        if not audio_dir.is_dir():
            raise FileNotFoundError(f"Audio directory not found: {audio_dir}")
    else:
        audio_dir = out_root / "inputs" / "english-audio"

    for s_num in (5, 10, 15):
        render_contacts_and_posters(s_num, out_root)

    if args.preview:
        print("Preview mode completed: posters and phase contacts rendered.")
        return

    manifest_records = []
    for s_num in (5, 10, 15):
        a_path = audio_dir / f"slide-{s_num:02d}.mp3"
        if not a_path.is_file():
            raise FileNotFoundError(f"Missing required audio file: {a_path}")
        rec = render_video_clip(s_num, a_path, out_root)
        manifest_records.append(rec)

    manifest_path = out_root / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_records, f, indent=2)

    print(f"Render completed. Manifest generated at {manifest_path}")


if __name__ == "__main__":
    main()
