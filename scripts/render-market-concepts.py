#!/usr/bin/env python3
"""
ImbewuField Watch Animations — Market Gardening & Community
Generates three 1280x720 24fps silent H264 animations with deterministic Pillow/FFmpeg:
  - Slide 04: watch-04-farm-record
  - Slide 09: watch-09-surplus-routes
  - Slide 14: watch-14-community-network
"""

import argparse
import hashlib
import json
import math
import os
import subprocess
import sys
from typing import Dict, List, Optional, Tuple
from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT, FPS = 1280, 720, 24

PALETTE = {
    "bg": (245, 241, 232),          # Warm cream
    "card_bg": (253, 251, 247),     # Soft card cream
    "card_border": (217, 208, 193), # Subtle warm outline
    "text_main": (44, 38, 32),       # Dark soil charcoal
    "text_muted": (92, 82, 72),      # Muted soil
    "forest": (45, 90, 39),          # BewuField deep leaf green
    "forest_light": (232, 240, 229), # Soft green tint
    "soil": (92, 64, 51),            # Earth soil brown
    "gold": (198, 125, 10),          # Harvest gold
    "rust": (166, 75, 42),           # Warm terracotta
    "white": (255, 255, 255),
}

# -----------------------------------------------------------------------------
# Font Management & Strict Measurement
# -----------------------------------------------------------------------------
class FontManager:
    def __init__(self):
        self._cache: Dict[int, ImageFont.FreeTypeFont] = {}
        self.font_path = self._discover_font()
        if not self.font_path:
            raise RuntimeError("Required Arial or DejaVu TrueType font not found.")

    def _discover_font(self) -> Optional[str]:
        candidates = [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/Library/Fonts/Arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/TTF/DejaVuSans.ttf",
        ]
        for path in candidates:
            if os.path.exists(path):
                return path
        return None

    def get(self, size: int) -> ImageFont.FreeTypeFont:
        if size < 28:
            raise ValueError(f"Font size {size} violates minimum required >= 28px.")
        if size not in self._cache:
            try:
                self._cache[size] = ImageFont.truetype(self.font_path, size)
            except Exception as e:
                raise RuntimeError(f"Failed to load font '{self.font_path}': {e}")
        return self._cache[size]

def measure_text(text: str, font: ImageFont.FreeTypeFont) -> Tuple[int, int, int, int]:
    bbox = font.getbbox(text)
    return bbox[2] - bbox[0], bbox[3] - bbox[1], bbox[0], bbox[1]

def draw_text_box(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont,
                  box_x: int, box_y: int, max_w: int, max_h: int,
                  fill: Tuple[int, int, int], align: str = "center") -> Tuple[int, int]:
    w, h, off_x, off_y = measure_text(text, font)
    if w > max_w or h > max_h:
        raise ValueError(f"Text '{text}' ({w}x{h}) overflows allocated box ({max_w}x{max_h})")
    x = box_x + (max_w - w) // 2 - off_x if align == "center" else (box_x - off_x if align == "left" else box_x + max_w - w - off_x)
    y = box_y + (max_h - h) // 2 - off_y
    draw.text((x, y), text, font=font, fill=fill)
    return w, h

def draw_multiline_box(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont,
                       box_x: int, box_y: int, max_w: int, max_h: int,
                       fill: Tuple[int, int, int], line_spacing: int = 6, align: str = "center"):
    words = text.split()
    lines: List[str] = []
    curr: List[str] = []
    for w in words:
        test = " ".join(curr + [w])
        width, _, _, _ = measure_text(test, font)
        if width <= max_w:
            curr.append(w)
        else:
            if curr:
                lines.append(" ".join(curr))
                curr = [w]
            else:
                raise ValueError(f"Word '{w}' overflows width {max_w}")
    if curr:
        lines.append(" ".join(curr))
    metrics = [measure_text(l, font) for l in lines]
    total_h = sum(m[1] for m in metrics) + line_spacing * (len(lines) - 1)
    if total_h > max_h:
        raise ValueError(f"Multiline text overflows allocated height {max_h}: {text}")
    curr_y = box_y + (max_h - total_h) // 2
    for l, (w, h, off_x, off_y) in zip(lines, metrics):
        x = box_x + (max_w - w) // 2 - off_x if align == "center" else (box_x - off_x if align == "left" else box_x + max_w - w - off_x)
        draw.text((x, curr_y - off_y), l, font=font, fill=fill)
        curr_y += h + line_spacing

# -----------------------------------------------------------------------------
# Drawing Helpers & Recognizable Icons
# -----------------------------------------------------------------------------
def draw_arrow(draw: ImageDraw.ImageDraw, start: Tuple[float, float], end: Tuple[float, float],
               color: Tuple[int, int, int], width: int = 4, arrow_len: float = 14.0):
    dx, dy = end[0] - start[0], end[1] - start[1]
    dist = math.hypot(dx, dy)
    if dist < 1e-3:
        return
    ux, uy = dx / dist, dy / dist
    draw.line([start, end], fill=color, width=width)
    angle = math.atan2(dy, dx)
    p_tip = end
    p_left = (end[0] + arrow_len * math.cos(angle + math.pi - 0.45), end[1] + arrow_len * math.sin(angle + math.pi - 0.45))
    p_right = (end[0] + arrow_len * math.cos(angle + math.pi + 0.45), end[1] + arrow_len * math.sin(angle + math.pi + 0.45))
    draw.polygon([p_tip, p_left, p_right], fill=color)

def draw_basket(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int = 20):
    draw.polygon([(cx - s, cy - s//3), (cx + s, cy - s//3), (cx + s*3//4, cy + s), (cx - s*3//4, cy + s)], fill=PALETTE["gold"])
    draw.line([(cx - s, cy - s//3), (cx + s, cy - s//3)], fill=PALETTE["soil"], width=2)
    draw.ellipse((cx - s*4//5, cy - s*4//5, cx - s//5, cy - s//5), fill=PALETTE["rust"])
    draw.ellipse((cx - s//4, cy - s, cx + s//3, cy - s*2//5), fill=PALETTE["forest"])
    draw.ellipse((cx + s//5, cy - s*4//5, cx + s*4//5, cy - s//5), fill=PALETTE["gold"])

def draw_farm(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int = 26):
    draw.rectangle([cx - s, cy - s//4, cx + s*2//5, cy + s], fill=PALETTE["rust"])
    draw.polygon([(cx - s*6//5, cy - s//4), (cx - s*3//10, cy - s), (cx + s*3//5, cy - s//4)], fill=PALETTE["soil"])
    draw.rectangle([cx - s*3//5, cy + s//4, cx - s//10, cy + s], fill=PALETTE["card_bg"])
    draw.rectangle([cx + s//2, cy - s*3//5, cx + s*9//10, cy + s], fill=PALETTE["card_border"])
    draw.chord([cx + s//2, cy - s, cx + s*9//10, cy - s//3], 180, 360, fill=PALETTE["text_muted"])

def draw_stall(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int = 24):
    draw.rectangle([cx - s, cy + s//5, cx + s, cy + s], fill=PALETTE["soil"])
    draw.polygon([(cx - s*11//10, cy - s*4//5), (cx + s*11//10, cy - s*4//5), (cx + s, cy + s//5), (cx - s, cy + s//5)], fill=PALETTE["forest"])
    for i in range(-2, 3, 2):
        draw.line([(cx + i*s//3, cy - s*4//5), (cx + i*s//3, cy + s//5)], fill=PALETTE["card_bg"], width=3)
    draw.rectangle([cx - s*3//5, cy + s*2//5, cx + s*3//5, cy + s*4//5], fill=PALETTE["gold"])

def draw_shop(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int = 24):
    draw.rectangle([cx - s, cy - s//3, cx + s, cy + s], fill=PALETTE["card_bg"], outline=PALETTE["card_border"], width=2)
    draw.polygon([(cx - s*11//10, cy - s//3), (cx, cy - s), (cx + s*11//10, cy - s//3)], fill=PALETTE["forest"])
    draw.rectangle([cx - s*4//5, cy, cx - s//5, cy + s*3//5], fill=PALETTE["forest_light"], outline=PALETTE["soil"], width=1)
    draw.rectangle([cx + s//6, cy, cx + s*4//5, cy + s], fill=PALETTE["soil"])

def draw_house(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int = 24):
    draw.rectangle([cx - s*4//5, cy - s//5, cx + s*4//5, cy + s], fill=PALETTE["card_bg"], outline=PALETTE["card_border"], width=2)
    draw.polygon([(cx - s, cy - s//5), (cx, cy - s), (cx + s, cy - s//5)], fill=PALETTE["rust"])
    draw.rectangle([cx - s//4, cy + s*2//5, cx + s//4, cy + s], fill=PALETTE["soil"])
    draw.rectangle([cx + s*2//5, cy - s*4//5, cx + s*3//5, cy - s*2//5], fill=PALETTE["soil"])

def draw_produce_box(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int = 16):
    draw.rectangle([cx - s, cy - s//3, cx + s, cy + s], fill=PALETTE["soil"])
    draw.line([(cx - s, cy + s//3), (cx + s, cy + s//3)], fill=PALETTE["card_bg"], width=2)
    draw.ellipse((cx - s*3//4, cy - s*4//5, cx - s//6, cy), fill=PALETTE["forest"])
    draw.ellipse((cx, cy - s*4//5, cx + s*3//4, cy), fill=PALETTE["forest"])

def draw_seed_packet(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int = 18):
    draw.rectangle([cx - s*3//4, cy - s, cx + s*3//4, cy + s], fill=PALETTE["card_bg"], outline=PALETTE["forest"], width=2)
    draw.ellipse((cx - s//3, cy - s//4, cx + s//3, cy + s//2), fill=PALETTE["gold"])
    draw.line([(cx, cy - s//2), (cx, cy - s*4//5)], fill=PALETTE["forest"], width=2)

def draw_tool(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int = 18):
    draw.line([(cx - s, cy + s), (cx + s, cy - s)], fill=PALETTE["soil"], width=4)
    draw.polygon([(cx + s - 6, cy - s), (cx + s + 4, cy - s + 4), (cx + s, cy - s + 10)], fill=PALETTE["card_border"])
    draw.line([(cx + s, cy + s), (cx - s, cy - s)], fill=PALETTE["soil"], width=4)
    draw.polygon([(cx - s - 4, cy - s + 4), (cx - s + 6, cy - s - 6), (cx - s + 10, cy - s)], fill=PALETTE["card_border"])

def draw_skills(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int = 18):
    draw.polygon([(cx, cy - s//3), (cx - s, cy - s*2//3), (cx - s, cy + s*2//3), (cx, cy + s)], fill=PALETTE["card_bg"], outline=PALETTE["soil"])
    draw.polygon([(cx, cy - s//3), (cx + s, cy - s*2//3), (cx + s, cy + s*2//3), (cx, cy + s)], fill=PALETTE["card_bg"], outline=PALETTE["soil"])
    draw.line([(cx, cy - s//3), (cx, cy + s)], fill=PALETTE["soil"], width=2)
    draw.ellipse((cx - 4, cy - s - 2, cx + 4, cy - s + 6), fill=PALETTE["gold"])

def draw_transport(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int = 18):
    draw.ellipse((cx - s//2, cy + s//2, cx - s//2 + 12, cy + s//2 + 12), fill=PALETTE["soil"])
    draw.polygon([(cx - s*4//5, cy - s//3), (cx + s*3//4, cy - s//3), (cx + s//3, cy + s//2), (cx - s//2, cy + s//2)], fill=PALETTE["forest"])
    draw.line([(cx + s*3//4, cy - s//3), (cx + s, cy - s*2//3)], fill=PALETTE["soil"], width=3)

def draw_checkmark(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int = 14):
    draw.line([(cx - s*3//5, cy), (cx - s//10, cy + s*3//5), (cx + s*4//5, cy - s*3//5)], fill=PALETTE["forest"], width=4)

# -----------------------------------------------------------------------------
# Base Layout Template
# -----------------------------------------------------------------------------
def create_base_frame(title: str, caption: str, font_mgr: FontManager) -> Image.Image:
    im = Image.new("RGBA", (WIDTH, HEIGHT), PALETTE["bg"])
    draw = ImageDraw.Draw(im)
    draw.rectangle([60, 20, 1220, 105], fill=PALETTE["card_bg"], outline=PALETTE["card_border"], width=1)
    draw_text_box(draw, title, font_mgr.get(32), 80, 25, 1120, 75, PALETTE["text_main"])
    draw.rectangle([60, 150, 1220, 505], fill=PALETTE["card_bg"], outline=PALETTE["card_border"], width=1)
    draw.rectangle([60, 530, 1220, 675], fill=PALETTE["card_bg"], outline=PALETTE["card_border"], width=1)
    draw_multiline_box(draw, caption, font_mgr.get(28), 80, 535, 1120, 135, PALETTE["text_main"], line_spacing=6)
    draw_text_box(draw, "Concept diagram — not to scale", font_mgr.get(28), 80, 680, 1120, 35, PALETTE["text_muted"])
    return im

# -----------------------------------------------------------------------------
# Scene 04: Farm Record (watch-04-farm-record)
# -----------------------------------------------------------------------------
def render_scene_04(t: float, font_mgr: FontManager) -> Image.Image:
    title = "Watch: What the Farm Record Shows"
    caption = "The record follows each harvest to family food, sales, gifts, or compost. Read across the season to see the farm as an economy before making a business decision."
    im = create_base_frame(title, caption, font_mgr)
    draw = ImageDraw.Draw(im)

    cols = ["Harvest", "Family food", "Sales", "Gifts", "Compost"]
    col_w = [180, 220, 210, 210, 210]
    table_x, table_y = 125, 170
    hdr_h, row_h = 45, 55

    cur_x = table_x
    for i, (col, w) in enumerate(zip(cols, col_w)):
        draw.rectangle([cur_x, table_y, cur_x + w, table_y + hdr_h], fill=PALETTE["forest_light"], outline=PALETTE["card_border"], width=1)
        draw_text_box(draw, col, font_mgr.get(28), cur_x + 5, table_y + 4, w - 10, hdr_h - 8, PALETTE["text_main"])
        cur_x += w

    outcomes = [1, 2, 3, 4]  # col index per row
    t_start_rows, t_end_rows = 0.15, 0.75

    for r_idx in range(4):
        ry = table_y + hdr_h + r_idx * row_h
        r_start = t_start_rows + r_idx * ((t_end_rows - t_start_rows) / 4)
        r_end = r_start + ((t_end_rows - t_start_rows) / 4)

        if t >= r_start:
            fill_bg = PALETTE["forest_light"] if t < r_end else PALETTE["card_bg"]
            draw.rectangle([table_x, ry, table_x + sum(col_w), ry + row_h], fill=fill_bg, outline=PALETTE["card_border"], width=1)

            target_col = outcomes[r_idx]
            dest_cx = table_x + sum(col_w[:target_col]) + col_w[target_col] // 2
            start_cx = table_x + col_w[0] // 2
            mid_y = ry + row_h // 2

            if t < r_end:
                prog = min(1.0, (t - r_start) / (r_end - r_start) / 0.82)
                curr_bx = int(start_cx + (dest_cx - start_cx) * prog)
                if curr_bx-start_cx>60:
                    draw_arrow(draw, (start_cx + 26, mid_y), (curr_bx - 26, mid_y), PALETTE["soil"], width=3)
                draw_basket(draw, curr_bx, mid_y, s=18)
            else:
                draw_checkmark(draw, dest_cx, mid_y, s=14)
                draw_basket(draw, start_cx, mid_y, s=16)
        else:
            draw.rectangle([table_x, ry, table_x + sum(col_w), ry + row_h], fill=PALETTE["card_bg"], outline=PALETTE["card_border"], width=1)

    grid_x=table_x
    for width in col_w[:-1]:
        grid_x+=width
        draw.line((grid_x,table_y+hdr_h,grid_x,table_y+hdr_h+4*row_h),fill=PALETTE["card_border"],width=1)

    if t >= 0.75:
        draw.rectangle([table_x - 3, table_y - 3, table_x + sum(col_w) + 3, table_y + hdr_h + 4 * row_h + 3], outline=PALETTE["gold"], width=4)
        draw.rectangle([450, 445, 830, 492], fill=PALETTE["forest_light"], outline=PALETTE["forest"], width=2)
        draw_text_box(draw, "Season Overview", font_mgr.get(28), 455, 448, 370, 40, PALETTE["forest"])

    return im

# -----------------------------------------------------------------------------
# Scene 09: Surplus Routes (watch-09-surplus-routes)
# -----------------------------------------------------------------------------
def render_scene_09(t: float, font_mgr: FontManager) -> Image.Image:
    title = "Watch: Where Surplus Can Go"
    caption = "Surplus can leave the farm through a roadside stall, a group delivery to a shop, or a box delivered to a household. The arrows show each route."
    im = create_base_frame(title, caption, font_mgr)
    draw = ImageDraw.Draw(im)

    farm_x, farm_y, farm_w, farm_h = 90, 275, 150, 105
    draw.rectangle([farm_x, farm_y, farm_x + farm_w, farm_y + farm_h], fill=PALETTE["forest_light"], outline=PALETTE["card_border"], width=2)
    draw_farm(draw, farm_x + farm_w // 2, farm_y + 40, s=24)
    draw_text_box(draw, "Farm", font_mgr.get(28), farm_x + 5, farm_y + 70, farm_w - 10, 32, PALETTE["text_main"])

    routes = [
        {"name": "Roadside stall", "multiline": False, "y": 205, "fn": draw_stall},
        {"name": "Group delivery\nto a shop", "multiline": True, "y": 328, "fn": draw_shop},
        {"name": "Box to a\nhousehold", "multiline": True, "y": 450, "fn": draw_house},
    ]

    dest_x = 880
    for r in routes:
        ry = r["y"]
        card_box = [dest_x, ry - 42, dest_x + 310, ry + 42]
        draw.rectangle(card_box, fill=PALETTE["card_bg"], outline=PALETTE["card_border"], width=2)
        r["fn"](draw, dest_x + 45, ry, s=24)
        if r["multiline"]:
            draw_multiline_box(draw, r["name"], font_mgr.get(28), dest_x + 95, ry - 38, 205, 76, PALETTE["text_main"], line_spacing=4)
        else:
            draw_text_box(draw, r["name"], font_mgr.get(28), dest_x + 95, ry - 35, 205, 70, PALETTE["text_main"])

    # Branch paths from farm (no crossings)
    draw_arrow(draw, (farm_x + farm_w, 300), (360, 205), PALETTE["soil"], width=3)
    draw_arrow(draw, (360, 205), (dest_x - 12, 205), PALETTE["soil"], width=3)

    draw_arrow(draw, (farm_x + farm_w, 328), (dest_x - 12, 328), PALETTE["soil"], width=4)
    draw_arrow(draw, (440, 270), (525, 328), PALETTE["forest"], width=3)
    draw_arrow(draw, (440, 385), (490, 328), PALETTE["forest"], width=3)

    draw_arrow(draw, (farm_x + farm_w, 355), (360, 450), PALETTE["soil"], width=3)
    draw_arrow(draw, (360, 450), (dest_x - 12, 450), PALETTE["soil"], width=3)

    # Moving produce boxes
    t_start, t_end = 0.10, 0.85
    p = max(0.0, min(1.0, (t - t_start) / (t_end - t_start))) if t >= t_start else 0.0

    # Route 1 box
    bx1 = 240 + p * (dest_x - 240)
    by1 = 300 + (205 - 300) * (min(1.0, (bx1 - 240) / 120)) if bx1 < 360 else 205
    draw_produce_box(draw, int(bx1), int(by1), s=15)

    # Route 2 group boxes converging
    bx2 = 240 + p * (dest_x - 240)
    draw_produce_box(draw, int(bx2), 328, s=15)
    if p>=.5:
        draw_produce_box(draw,int(bx2-35),328,s=14)
        draw_produce_box(draw,int(bx2-70),328,s=14)
    else:
        draw_produce_box(draw,int(440+170*p),int(270+116*p),s=13)
        draw_produce_box(draw,int(440+100*p),int(385-114*p),s=13)

    # Route 3 box
    bx3 = 240 + p * (dest_x - 240)
    by3 = 355 + (450 - 355) * (min(1.0, (bx3 - 240) / 120)) if bx3 < 360 else 450
    draw_produce_box(draw, int(bx3), int(by3), s=15)

    return im

# -----------------------------------------------------------------------------
# Scene 14: Community Network (watch-14-community-network)
# -----------------------------------------------------------------------------
def render_scene_14(t: float, font_mgr: FontManager) -> Image.Image:
    title = "Watch: How Neighbours Strengthen a Harvest"
    caption = "One farm can produce food. A group can share seed, tools, skills, and transport. Separate growers become a stronger local food network, with each household contributing what it can."
    im = create_base_frame(title, caption, font_mgr)
    draw = ImageDraw.Draw(im)

    cx, cy = 640, 325
    rx, ry = 340, 125
    angles = [-math.pi/2, -0.15*math.pi, 0.28*math.pi, 0.72*math.pi, 1.15*math.pi]
    nodes = [(int(cx + rx * math.cos(a)), int(cy + ry * math.sin(a))) for a in angles]

    edges = [
        (4, 0, "Seed", draw_seed_packet, (-40, -32)),
        (0, 1, "Tools", draw_tool, (40, -32)),
        (1, 2, "Skills", draw_skills, (50, 10)),
        (3, 4, "Transport", draw_transport, (-70, 10)),
        (2, 3, "", draw_basket, (0, 30)),  # Mutual solidarity link
    ]

    t_start, t_end = 0.15, 0.85
    p = max(0.0, min(1.0, (t - t_start) / (t_end - t_start))) if t >= t_start else 0.0

    # Draw edges & arrows (arrowhead outside nodes)
    for edge_index,(u, v, label, _, l_off) in enumerate(edges):
        edge_progress=min(1,max(0,(t-(.04+.06*edge_index))/.18))
        if edge_progress<=0:continue
        p1, p2 = nodes[u], nodes[v]
        dx, dy = p2[0] - p1[0], p2[1] - p1[1]
        dist = math.hypot(dx, dy)
        ux, uy = dx / dist, dy / dist
        start = (p1[0] + ux * 42, p1[1] + uy * 42)
        end = (p2[0] - ux * 42, p2[1] - uy * 42)
        revealed=(start[0]+(end[0]-start[0])*edge_progress,start[1]+(end[1]-start[1])*edge_progress)
        draw_arrow(draw, start, revealed, PALETTE["forest"], width=3)
        if label:
            mx, my = (start[0] + end[0]) // 2 + l_off[0], (start[1] + end[1]) // 2 + l_off[1]
            draw_text_box(draw, label, font_mgr.get(28), mx - 60, my - 16, 120, 32, PALETTE["forest"])

    # Draw moving resource tokens along distinct edges
    for edge_index,(u, v, _, draw_fn, _) in enumerate(edges):
        begins=.24+.07*edge_index
        if t<begins:continue
        p=min(1,(t-begins)/(.85-begins))
        p1, p2 = nodes[u], nodes[v]
        dx, dy = p2[0] - p1[0], p2[1] - p1[1]
        dist = math.hypot(dx, dy)
        ux, uy = dx / dist, dy / dist
        start = (p1[0] + ux * 42, p1[1] + uy * 42)
        end = (p2[0] - ux * 42, p2[1] - uy * 42)
        tx = int(start[0] + (end[0] - start[0]) * p)
        ty = int(start[1] + (end[1] - start[1]) * p)
        draw_fn(draw, tx, ty, s=18)

    # Draw 5 distinct grower nodes
    for idx, (nx, ny) in enumerate(nodes):
        draw.ellipse((nx - 36, ny - 36, nx + 36, ny + 36), fill=PALETTE["card_bg"], outline=PALETTE["forest"], width=3)
        draw_house(draw, nx, ny - 2, s=18)
        label_x,label_y=nx-50,ny+38
        if idx==1:label_x,label_y=nx+48,ny-16
        if idx==4:label_x,label_y=nx-148,ny-16
        draw_text_box(draw, "Grower", font_mgr.get(28), label_x,label_y,100,32,PALETTE["text_main"])

    if t >= 0.80:
        draw.rectangle([480, 305, 800, 348], fill=PALETTE["forest_light"], outline=PALETTE["gold"], width=2)
        draw_text_box(draw, "Local Food Network", font_mgr.get(28), 485, 308, 310, 38, PALETTE["forest"])

    return im

# -----------------------------------------------------------------------------
# Contact Sheets, Video Pipeline & Execution
# -----------------------------------------------------------------------------
SCENES = [
    {"slide": 4, "slug": "watch-04-farm-record", "func": render_scene_04, "caption": "The record follows each harvest to family food, sales, gifts, or compost. Read across the season to see the farm as an economy before making a business decision."},
    {"slide": 9, "slug": "watch-09-surplus-routes", "func": render_scene_09, "caption": "Surplus can leave the farm through a roadside stall, a group delivery to a shop, or a box delivered to a household. The arrows show each route."},
    {"slide": 14, "slug": "watch-14-community-network", "func": render_scene_14, "caption": "One farm can produce food. A group can share seed, tools, skills, and transport. Separate growers become a stronger local food network, with each household contributing what it can."},
]

def render_contact_sheet(scene_info: dict, out_path: str, font_mgr: FontManager):
    phases = [0.10, 0.35, 0.60, 0.85, 0.98]
    tw, th = 640, 360
    hdr_h = 42
    pad = 20
    cell_w, cell_h = tw, th + hdr_h
    im_sheet = Image.new("RGBA", (pad * 3 + cell_w * 2, pad * 4 + cell_h * 3), PALETTE["bg"])
    draw = ImageDraw.Draw(im_sheet)

    for i, phase in enumerate(phases):
        col, row = i % 2, i // 2
        x = pad + col * (cell_w + pad)
        y = pad + row * (cell_h + pad)
        draw.rectangle([x, y, x + cell_w, y + hdr_h], fill=PALETTE["forest_light"], outline=PALETTE["card_border"], width=1)
        draw_text_box(draw, f"Phase: {int(phase*100)}% (t={phase:.2f})", font_mgr.get(28), x + 5, y + 5, cell_w - 10, hdr_h - 10, PALETTE["text_main"])
        frame = scene_info["func"](phase, font_mgr)
        frame_thumb = frame.resize((tw, th), Image.Resampling.LANCZOS)
        im_sheet.paste(frame_thumb, (x, y + hdr_h))

    im_sheet.save(out_path)

def probe_audio_file(audio_path: str) -> Tuple[float, str]:
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file does not exist: {audio_path}")
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", audio_path]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"ffprobe failed for {audio_path}: {res.stderr}")
    try:
        dur = float(json.loads(res.stdout)["format"]["duration"])
    except Exception as e:
        raise ValueError(f"Invalid duration parsed from {audio_path}: {e}")
    if not math.isfinite(dur) or dur<=0:raise ValueError("Invalid source duration")
    with open(audio_path, "rb") as f:
        audio_sha = hashlib.sha256(f.read()).hexdigest()
    return dur, audio_sha

def render_video_clip(scene_info: dict, out_clip: str, total_frames: int, font_mgr: FontManager):
    cmd = [
        "ffmpeg", "-v", "error", "-y",
        "-f", "rawvideo", "-vcodec", "rawvideo", "-s", "1280x720",
        "-pix_fmt", "rgba", "-r", "24", "-i", "-",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        out_clip
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(total_frames):
        t = f / max(1, total_frames - 1)
        img = scene_info["func"](t, font_mgr)
        proc.stdin.write(img.tobytes())
    proc.stdin.close()
    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed with exit code {proc.returncode}")

def get_file_stats(file_path: str) -> Tuple[int, str]:
    size = os.path.getsize(file_path)
    with open(file_path, "rb") as f:
        sha = hashlib.sha256(f.read()).hexdigest()
    return size, sha

def main():
    parser = argparse.ArgumentParser(description="Deterministic ImbewuField Watch Animations Generator")
    parser.add_argument("--output", required=True, help="Output root directory")
    parser.add_argument("--preview", action="store_true", help="Generate only posters and contact sheets")
    parser.add_argument("--audio-dir", default=None, help="Optional directory with slide-NN.mp3 files")
    args = parser.parse_args()

    root = os.path.abspath(args.output)
    clips_dir = os.path.join(root, "clips")
    posters_dir = os.path.join(root, "posters")
    contacts_dir = os.path.join(root, "contacts")
    for d in [clips_dir, posters_dir, contacts_dir]:
        os.makedirs(d, exist_ok=True)

    font_mgr = FontManager()
    manifest_rows = []

    for sc in SCENES:
        slug = sc["slug"]
        slide_num = sc["slide"]
        poster_rel = f"posters/{slug}.png"
        poster_abs = os.path.join(root, poster_rel)
        contact_abs = os.path.join(contacts_dir, f"{slug}-contact.png")
        clip_rel = f"clips/{slug}.mp4"
        clip_abs = os.path.join(root, clip_rel)

        # 1. Poster & Contact sheet
        poster_img = sc["func"](0.98, font_mgr)
        poster_img.save(poster_abs)
        render_contact_sheet(sc, contact_abs, font_mgr)

        # 2. Audio duration handling
        audio_dir=args.audio_dir or os.path.join(root,"inputs","english-audio")
        audio_path=os.path.join(audio_dir,f"slide-{slide_num:02d}.mp3")
        audio_dur,audio_sha=probe_audio_file(audio_path)
        clip_seconds=max(14.0,audio_dur+1.0)
        total_frames=math.ceil(clip_seconds*FPS)
        clip_seconds=total_frames/FPS

        # 3. Video rendering (unless --preview)
        bytes_val, sha_val = None, None
        if not args.preview:
            render_video_clip(sc, clip_abs, total_frames, font_mgr)
            bytes_val, sha_val = get_file_stats(clip_abs)
            clip_seconds,_=probe_audio_file(clip_abs)

        manifest_rows.append({
            "slide": slide_num,
            "path": clip_rel,
            "poster": poster_rel,
            "seconds": clip_seconds,
            "bytes": bytes_val,
            "sha256": sha_val,
            "audio_path": audio_path,
            "audio_seconds": audio_dur,
            "audio_sha256": audio_sha,
            "caption": sc["caption"],
        })

    manifest_path = os.path.join(root, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_rows, f, indent=2)

    print(f"Generated {len(SCENES)} animations. Manifest: {manifest_path}")

if __name__ == "__main__":
    main()
