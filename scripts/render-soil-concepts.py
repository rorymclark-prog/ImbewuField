#!/usr/bin/env python3
"""ImbewuField Soil Health & Composting authored Watch animation generator.

Deterministic Pillow & FFmpeg video pipeline rendering 1280x720 24fps H264 clips,
posters, contact sheets, and manifest metadata for slides 5, 10, and 14.
"""

import argparse
import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT, FPS = 1280, 720, 24
PHASES = [0.10, 0.35, 0.60, 0.85, 0.98]
POSTER_PHASE = 0.85

BG_COLOR = (246, 245, 242)
PANEL_BG = (255, 255, 255)
PANEL_BORDER = (216, 212, 204)
TEXT_DARK = (30, 37, 34)
TEXT_MUTED = (92, 98, 94)
ACCENT_GREEN = (45, 106, 79)
DARK_SOIL = (52, 38, 28)
DARK_SOIL_LIGHT = (88, 68, 52)
PALE_SOIL = (196, 185, 165)
PALE_SOIL_LINE = (168, 156, 136)
WORM_COLOR = (208, 124, 108)
BROWN_LAYER = (138, 92, 54)
GREEN_LAYER = (58, 118, 66)
MOIST_BLUE = (80, 150, 195)
MULCH_COLOR = (185, 150, 88)

CAPTION_05 = (
    "Look at colour, structure and channels in these two soil examples.\n"
    "Use several clues together; one picture cannot diagnose soil health."
)
CAPTION_10 = (
    "Build the heap with dry browns and fresh greens.\n"
    "Keep the layers moist, not wet, so air and decomposers can work."
)
CAPTION_14 = (
    "Compare bare soil with mulched soil.\n"
    "Watch how the mulch protects topsoil when a South African summer storm brings intense rain."
)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = []
    if bold:
        candidates += [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/Library/Fonts/Arial Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "Arial Bold.ttf",
            "DejaVuSans-Bold.ttf",
        ]
    candidates += [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "Arial.ttf",
        "DejaVuSans.ttf",
    ]
    for p in candidates:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    raise RuntimeError("Missing required font: Arial or DejaVu font family not found.")


def init_fonts() -> dict:
    return {
        "title": load_font(32, bold=True),
        "subtitle": load_font(28, bold=False),
        "label_bold": load_font(28, bold=True),
        "label": load_font(28, bold=False),
        "body": load_font(28, bold=False),
        "footer": load_font(28, bold=False),
    }


def draw_text_corrected(draw: ImageDraw.ImageDraw, xy: tuple, text: str, font: ImageFont.FreeTypeFont, fill: tuple, align: str = "left"):
    bbox = font.getbbox(text)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x, y = xy
    if align == "center":
        draw_x = x - (w / 2.0) - bbox[0]
    elif align == "right":
        draw_x = x - w - bbox[0]
    else:
        draw_x = x - bbox[0]
    assert draw_x+bbox[0]>=0 and draw_x+bbox[2]<=WIDTH, f"Text outside frame: {text}"
    draw_y = y - bbox[1]
    draw.text((draw_x, draw_y), text, font=font, fill=fill)
    return w, h


def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    lines = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            continue
        cur = []
        for word in words:
            test = " ".join(cur + [word])
            bbox = font.getbbox(test)
            if (bbox[2] - bbox[0]) <= max_w:
                cur.append(word)
            else:
                if cur:
                    lines.append(" ".join(cur))
                    cur = [word]
                else:
                    lines.append(word)
                    cur = []
        if cur:
            lines.append(" ".join(cur))
    return lines


def draw_caption(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, box: tuple = (60, 532, 1220, 672)):
    x1, y1, x2, y2 = box
    max_w = x2 - x1
    lines = wrap_text(text, font, max_w)
    line_h = 34
    total_h = len(lines) * line_h
    y_start = y1 + (y2 - y1 - total_h) / 2
    assert y_start >= 530, f"Caption starts before 530: {y_start}"
    y = y_start
    for line in lines:
        w, h = draw_text_corrected(draw, (640, y), line, font, TEXT_DARK, align="center")
        assert (640 - w / 2) >= x1 and (640 + w / 2) <= x2, f"Line exceeds horizontal bounds: {line}"
        y += line_h
    assert y - (line_h - 28) <= 675, f"Caption exceeds vertical bound 675: {y}"


def draw_chrome(draw: ImageDraw.ImageDraw, title: str, subtitle: str, caption: str, fonts: dict):
    # Header zone: strictly 20..105
    assert 20 <= 26 and (68 + 28) <= 105
    draw_text_corrected(draw, (640, 26), title, fonts["title"], ACCENT_GREEN, align="center")
    draw_text_corrected(draw, (640, 68), subtitle, fonts["subtitle"], TEXT_MUTED, align="center")
    draw.line([(60, 114), (1220, 114)], fill=PANEL_BORDER, width=2)

    # Caption container zone: strictly 530..675
    draw.rectangle([(50, 526), (1230, 674)], fill=PANEL_BG, outline=PANEL_BORDER, width=1)
    draw_caption(draw, caption, fonts["body"], box=(65, 532, 1215, 670))

    # Footer note below captions
    draw_text_corrected(draw, (640, 688), "Concept diagram — not to scale", fonts["footer"], TEXT_MUTED, align="center")


def render_scene_05(t: float, fonts: dict) -> Image.Image:
    im = Image.new("RGBA", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(im)
    draw_chrome(draw, "LOOK AT THE SOIL", "Worm channels and smell", CAPTION_05, fonts)

    # Diagram zone: strictly 150..505
    # Side by side cards: Left [70, 150, 610, 505], Right [670, 150, 1210, 505]
    for x1, x2 in [(70, 610), (670, 1210)]:
        draw.rectangle([(x1, 150), (x2, 505)], fill=PANEL_BG, outline=PANEL_BORDER, width=2)

    # Left: Dark, living topsoil
    draw_text_corrected(draw, (340, 160), "Dark, living topsoil", fonts["label_bold"], TEXT_DARK, align="center")
    draw_text_corrected(draw, (340, 196), "Smell: Rain or mushrooms", fonts["label"], TEXT_MUTED, align="center")
    draw.rectangle([(90, 238), (590, 492)], fill=DARK_SOIL, outline=PANEL_BORDER, width=1)

    # Crumbly soil texture aggregates
    for ox, oy in [(140, 280), (280, 260), (450, 290), (170, 420), (320, 460), (490, 420), (240, 360), (390, 380)]:
        draw.ellipse([(ox, oy), (ox + 16, oy + 12)], fill=(40, 28, 20))
        draw.ellipse([(ox + 30, oy + 8), (ox + 42, oy + 18)], fill=(66, 50, 38))

    # Existing visible worm channels
    channels = [
        [(110, 280), (160, 315), (230, 295), (310, 340), (390, 320), (470, 360), (550, 335)],
        [(130, 440), (200, 415), (280, 455), (360, 425), (440, 460), (530, 435)],
        [(190, 255), (260, 270), (340, 255), (420, 275), (510, 260)],
    ]
    for ch in channels:
        draw.line(ch, fill=DARK_SOIL_LIGHT, width=10)
        for pt in ch:
            draw.ellipse([(pt[0] - 5, pt[1] - 5), (pt[0] + 5, pt[1] + 5)], fill=DARK_SOIL_LIGHT)

    # Moving worm creating new channel across t
    worm_head_x = 110 + 440 * t
    worm_head_y = 360 + 32 * math.sin(t * 3 * math.pi)

    # Carved trail behind active worm
    trail_pts = []
    for step in range(int(max(1, t * 60))):
        st = step / 60.0
        trail_pts.append((110 + 440 * st, 360 + 32 * math.sin(st * 3 * math.pi)))
    trail_pts.append((worm_head_x, worm_head_y))
    if len(trail_pts) > 1:
        draw.line(trail_pts, fill=DARK_SOIL_LIGHT, width=10)

    # Worm body segments
    worm_len = 54
    for seg in range(11):
        back_t = max(0.0, t - (seg / 10.0) * (worm_len / 440.0))
        bx = 110 + 440 * back_t
        by = 360 + 32 * math.sin(back_t * 3 * math.pi)
        r = 6 if seg not in (3, 4) else 7  # Clitellum slightly thicker
        col = (222, 138, 120) if seg in (3, 4) else WORM_COLOR
        draw.ellipse([(bx - r, by - r), (bx + r, by + r)], fill=col)

    # Right: Pale, compacted soil
    draw_text_corrected(draw, (940, 160), "Pale, compacted soil", fonts["label_bold"], TEXT_DARK, align="center")
    draw_text_corrected(draw, (940, 196), "Smell: Sour or nothing", fonts["label"], TEXT_MUTED, align="center")
    draw.rectangle([(690, 238), (1190, 492)], fill=PALE_SOIL, outline=PANEL_BORDER, width=1)

    # Dense horizontal compaction strata lines
    for ly in range(254, 488, 16):
        draw.line([(705, ly), (1175, ly)], fill=PALE_SOIL_LINE, width=3)
        draw.line([(715, ly + 6), (1165, ly + 6)], fill=(182, 170, 150), width=1)

    return im


def render_scene_10(t: float, fonts: dict) -> Image.Image:
    im = Image.new("RGBA", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(im)
    draw_chrome(draw, "BUILD THE COMPOST HEAP", "Dry browns and fresh greens", CAPTION_10, fonts)

    # Center card in diagram zone 150..505
    draw.rectangle([(70, 150), (1210, 505)], fill=PANEL_BG, outline=PANEL_BORDER, width=2)
    draw_text_corrected(draw, (180, 240), "Dry browns", fonts["label_bold"], BROWN_LAYER, align="center")
    draw_text_corrected(draw, (180, 360), "Fresh greens", fonts["label_bold"], GREEN_LAYER, align="center")
    draw_text_corrected(draw, (1090, 240), "Air spaces", fonts["label_bold"], TEXT_DARK, align="center")
    draw_text_corrected(draw, (1090, 360), "Moist, not wet", fonts["label_bold"], MOIST_BLUE, align="center")

    # Base ground line
    draw.line([(320, 485), (960, 485)], fill=PANEL_BORDER, width=3)

    # 5 alternating layers landing sequentially between t=0.04 and t=0.78
    layers = [
        (0, "brown", 0.04, 0.18, 435, 485, 360, 920, 380, 900),
        (1, "green", 0.19, 0.33, 385, 435, 380, 900, 410, 870),
        (2, "brown", 0.34, 0.48, 335, 385, 410, 870, 440, 840),
        (3, "green", 0.49, 0.63, 285, 335, 440, 840, 470, 810),
        (4, "brown", 0.64, 0.78, 235, 285, 470, 810, 500, 780),
    ]

    for idx, ltype, t0, t1, y_top, y_bot, x_b1, x_b2, x_t1, x_t2 in layers:
        if t < t0:
            continue
        p = min(1.0, (t - t0) / (t1 - t0))
        y_off = -(1.0 - p) * 26.0  # Physically landing onto heap
        cur_top = y_top + y_off
        cur_bot = y_bot + y_off
        col = BROWN_LAYER if ltype == "brown" else GREEN_LAYER
        poly = [(x_t1, cur_top), (x_t2, cur_top), (x_b2, cur_bot), (x_b1, cur_bot)]
        draw.polygon(poly, fill=col, outline=(50, 40, 30))

        # Texture & details
        if ltype == "brown":
            # Coarse air spaces and straw flecks
            for fx in range(int(x_t1) + 20, int(x_t2) - 20, 36):
                fy = cur_top + 16
                draw.line([(fx, fy), (fx + 18, fy + 8)], fill=(175, 128, 80), width=2)
                draw.ellipse([(fx + 8, fy + 14), (fx + 16, fy + 22)], fill=(96, 62, 34))  # air pocket
        else:
            # Leaf flecks and modest moisture dots (never a pool)
            for fx in range(int(x_t1) + 22, int(x_t2) - 22, 38):
                fy = cur_top + 15
                draw.line([(fx, fy), (fx + 14, fy - 5)], fill=(85, 150, 95), width=2)
                draw.ellipse([(fx + 6, fy + 16), (fx + 10, fy + 20)], fill=MOIST_BLUE)  # modest droplet

    # Hold concept completed heap for t >= 0.78 (at least 1.0 full second)
    # Subtle rising airflow and abstract decomposer specks after building
    if t > 0.78:
        decomp_phase = (t - 0.78) / 0.22
        # Rising warm air streams
        for sx in [540, 640, 740]:
            ay = 230 - 30 * math.sin(decomp_phase * 2 * math.pi + sx)
            draw.arc([(sx - 12, ay - 24), (sx + 12, ay + 6)], start=180, end=360, fill=(150, 165, 155), width=2)
        # Abstract decomposer activity specks inside core
        for dx, dy in [(580, 360), (640, 340), (700, 365), (610, 410), (670, 405)]:
            pulse = 2 + int(math.sin(decomp_phase * 6 * math.pi + dx) > 0)
            draw.ellipse([(dx - pulse, dy - pulse), (dx + pulse, dy + pulse)], fill=(225, 195, 95))

    return im


def render_scene_14(t: float, fonts: dict) -> Image.Image:
    im = Image.new("RGBA", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(im)
    draw_chrome(draw, "BARE SOIL AND MULCH", "Protecting topsoil in a summer storm", CAPTION_14, fonts)

    # Side by side cards in diagram zone 150..505
    for x1, x2 in [(70, 610), (670, 1210)]:
        draw.rectangle([(x1, 150), (x2, 505)], fill=PANEL_BG, outline=PANEL_BORDER, width=2)

    # Titles & labels
    draw_text_corrected(draw, (340, 160), "Bare soil", fonts["label_bold"], TEXT_DARK, align="center")
    draw_text_corrected(draw, (340, 196), "Rain on bare soil", fonts["label"], TEXT_MUTED, align="center")
    draw_text_corrected(draw, (940, 160), "Mulched soil", fonts["label_bold"], TEXT_DARK, align="center")
    draw_text_corrected(draw, (940, 196), "Rain on mulch", fonts["label"], ACCENT_GREEN, align="center")

    # Identical shallow downward slope for both sides: left y=340 to right y=398 (slope ~6.5 deg)
    # Left side bare soil
    poly_bare = [(90, 340), (590, 398), (590, 492), (90, 492)]
    draw.polygon(poly_bare, fill=DARK_SOIL, outline=PANEL_BORDER)

    # Right side soil + mulch sitting on actual soil surface
    poly_mulch_soil = [(690, 340), (1190, 398), (1190, 492), (690, 492)]
    draw.polygon(poly_mulch_soil, fill=DARK_SOIL, outline=PANEL_BORDER)

    poly_mulch_layer = [(690, 318), (1190, 376), (1190, 398), (690, 340)]
    draw.polygon(poly_mulch_layer, fill=MULCH_COLOR, outline=(140, 110, 60))

    # Textured mulch strands
    for mx in range(700, 1180, 24):
        my = 318 + ((mx - 690) * 58) // 500 + 4
        draw.line([(mx, my), (mx + 16, my + 8)], fill=(215, 185, 120), width=2)
        draw.line([(mx + 8, my + 2), (mx + 22, my - 4)], fill=(150, 120, 65), width=2)

    # Equal heavy storm rain falling at 15 degrees angle on both sides
    rain_drops = 22
    for i in range(rain_drops):
        # Progressively moving rain based on t
        cycle_t = (t * 7.3 + i * 0.61803398875) % 1.0
        rx_offset = i * 22
        rx_bare = 100 + rx_offset
        rx_mulch = 700 + rx_offset

        # Surface hit points on slopes
        hit_y_bare = 340 + ((rx_bare - 90) * 58) / 500.0
        hit_y_mulch = 318 + ((rx_mulch - 690) * 58) / 500.0

        ry_bare = 245 + cycle_t * (hit_y_bare - 245)
        ry_mulch = 245 + cycle_t * (hit_y_mulch - 245)

        # Draw falling raindrops
        draw.line([(rx_bare, ry_bare), (rx_bare + 3, min(hit_y_bare, ry_bare + 12))], fill=MOIST_BLUE, width=2)
        draw.line([(rx_mulch, ry_mulch), (rx_mulch + 3, min(hit_y_mulch, ry_mulch + 12))], fill=MOIST_BLUE, width=2)

        # Impacts and movement:
        if cycle_t > 0.88:
            # Bare side: drops strike bare soil, kick up droplets and topsoil particles downslope
            draw.arc([(rx_bare - 6, hit_y_bare - 6), (rx_bare + 6, hit_y_bare + 4)], 180, 360, fill=MOIST_BLUE, width=2)
            # Lifted particles follow a short downslope arc above the soil surface.
            impact_phase=(cycle_t-0.88)/0.12
            erosion_x=rx_bare+impact_phase*24
            erosion_surface=340+(erosion_x-90)*58/500
            erosion_y=erosion_surface-4-14*math.sin(impact_phase*math.pi)
            if erosion_x<585:
                draw.ellipse((erosion_x-3,erosion_y-3,erosion_x+3,erosion_y+3),fill=(128,87,52))

            # Mulched side: mulch cushions and intercepts rain impact
            draw.arc([(rx_mulch - 5, hit_y_mulch - 4), (rx_mulch + 5, hit_y_mulch + 4)], 180, 360, fill=(215, 230, 240), width=1)
            # Gentle water infiltration through mulch into soil (some water moves in both)
            infil_y = hit_y_mulch + 28
            draw.line([(rx_mulch, infil_y), (rx_mulch + 2, infil_y + 8)], fill=MOIST_BLUE, width=1)

    # Surface water continues downhill on both sides, without a numerical loss claim.
    for offset,level in [(0,340),(600,318)]:
        for j in range(5):
            x=95+((t*420+j*91)%475)
            y=level+(x-90)*58/500-2
            draw.line((x+offset,y,x+offset+13,y+1.5),fill=MOIST_BLUE,width=2)

    return im


def render_contacts(render_fn, fonts: dict, out_path: Path):
    cw, ch = 640, 360
    margin_x, margin_y = 16, 42
    gap = 12
    sheet = Image.new("RGBA", (1320, 1260), (255, 255, 255))
    sdraw = ImageDraw.Draw(sheet)

    for i, phase in enumerate(PHASES):
        frame = render_fn(phase, fonts)
        thumb = frame.resize((cw, ch), Image.Resampling.LANCZOS)
        x = margin_x + (i % 2) * (cw + gap)
        y = margin_y + (i // 2) * 410
        sheet.paste(thumb, (x, y))
        draw_text_corrected(sdraw, (x + cw / 2, y-32), f"t = {phase:.2f}", fonts["body"], TEXT_DARK, align="center")

    sheet.convert("RGB").save(out_path)


def probe_audio_seconds(audio_path: Path) -> float:
    if not audio_path.is_file():
        raise FileNotFoundError(audio_path)
    duration=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",str(audio_path)]))
    if not math.isfinite(duration) or duration<=0:
        raise ValueError(f"Invalid media duration: {audio_path}")
    return duration


def encode_clip(render_fn, fonts: dict, total_frames: int, mp4_path: Path):
    cmd = [
        "ffmpeg",
        "-v",
        "error",
        "-y",
        "-f",
        "rawvideo",
        "-vcodec",
        "rawvideo",
        "-s",
        f"{WIDTH}x{HEIGHT}",
        "-pix_fmt",
        "rgb24",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(mp4_path),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for frame_idx in range(total_frames):
        t = frame_idx / max(1, total_frames - 1)
        img = render_fn(t, fonts).convert("RGB")
        proc.stdin.write(img.tobytes())
    proc.stdin.close()
    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError(f"FFmpeg failed with return code {proc.returncode}")


def main():
    parser = argparse.ArgumentParser(description="Generate ImbewuField Soil Health Watch animations.")
    parser.add_argument("--output", default=".", help="Root output directory.")
    parser.add_argument("--preview", action="store_true", help="Only render posters and contact sheets.")
    parser.add_argument("--audio-dir", help="Directory holding current slide-NN.mp3 narration")
    args = parser.parse_args()

    root = Path(args.output).resolve()
    clips_dir = root / "clips"
    posters_dir = root / "posters"
    contacts_dir = root / "contacts"
    audio_dir = Path(args.audio_dir).resolve() if args.audio_dir else root / "inputs" / "english-audio"

    for d in [clips_dir, posters_dir, contacts_dir]:
        d.mkdir(parents=True, exist_ok=True)

    fonts = init_fonts()

    scenes = [
        (5, "watch-05-living-soil", render_scene_05),
        (10, "watch-10-compost-heap", render_scene_10),
        (14, "watch-14-mulch-protection", render_scene_14),
    ]

    manifest = []

    for slide, name, render_fn in scenes:
        audio_file = audio_dir / f"slide-{slide:02d}.mp3"
        audio_dur = probe_audio_seconds(audio_file)
        target_seconds = max(14.0, audio_dur + 1.0)
        total_frames = math.ceil(target_seconds * FPS)
        actual_seconds = total_frames / float(FPS)

        # Posters and contacts
        poster_file = posters_dir / f"{name}.png"
        contact_file = contacts_dir / f"{name}-contact.png"

        poster_img = render_fn(POSTER_PHASE, fonts).convert("RGB")
        poster_img.save(poster_file)
        render_contacts(render_fn, fonts, contact_file)

        mp4_file = clips_dir / f"{name}.mp4"
        file_bytes = 0
        file_sha256 = ""

        if not args.preview:
            encode_clip(render_fn, fonts, total_frames, mp4_file)
            data = mp4_file.read_bytes()
            file_bytes = len(data)
            file_sha256 = hashlib.sha256(data).hexdigest()
            actual_seconds = probe_audio_seconds(mp4_file)

        manifest.append(
            {
                "slide": slide,
                "path": f"clips/{name}.mp4",
                "poster": f"posters/{name}.png",
                "seconds": actual_seconds,
                "bytes": file_bytes,
                "sha256": file_sha256,
                "audio_path": f"inputs/english-audio/slide-{slide:02d}.mp3",
                "audio_seconds": audio_dur,
                "audio_sha256": hashlib.sha256(audio_file.read_bytes()).hexdigest(),
                "caption": {5: CAPTION_05,10:CAPTION_10,14:CAPTION_14}[slide],
            }
        )

    manifest_path = root / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
