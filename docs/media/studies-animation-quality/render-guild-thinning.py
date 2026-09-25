from pathlib import Path
import math
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont


OUT = Path(__file__).resolve().parents[3] / 'public/course-animations/plant-guilds'
POSTERS = OUT / 'posters'
W, H = 1280, 720
FPS = 24
FRAMES = 192  # 8 seconds; final state holds for the last 2 seconds.


def font(size, bold=False):
    name = '/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf'
    if not Path(name).exists():
        name = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    return ImageFont.truetype(name, size)


F_TITLE = font(42, True)


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def tree(draw, cx, base_y, scale=1.0, crown=(61, 126, 65), trunk=(91, 62, 39)):
    # Generic fruit tree silhouette; no species claim.
    tw = int(34 * scale)
    draw.polygon([(cx - tw, base_y), (cx + tw, base_y), (cx + 16 * scale, base_y - 150 * scale), (cx - 12 * scale, base_y - 150 * scale)], fill=trunk)
    for dx, dy, r in [(-72, -170, 74), (0, -220, 94), (76, -165, 72), (-5, -125, 80)]:
        x, y, rr = cx + int(dx * scale), base_y + int(dy * scale), int(r * scale)
        draw.ellipse((x - rr, y - rr, x + rr, y + rr), fill=crown)
    for dx, dy in [(-55, -205), (-10, -260), (53, -188), (16, -151)]:
        x, y = cx + int(dx * scale), base_y + int(dy * scale)
        draw.ellipse((x - 12, y - 9, x + 12, y + 9), fill=(220, 177, 75))


def support(draw, cx, base_y, scale=1.0, color=(116, 146, 54)):
    # Generic support shrub with a clear single stem and three limbs.
    tw = max(5, int(10 * scale))
    draw.line((cx, base_y, cx, base_y - int(180 * scale)), fill=(85, 67, 38), width=tw)
    for dx, dy in [(-45, -150), (44, -145), (-20, -210), (32, -225)]:
        draw.line((cx, base_y - int(52 * scale), cx + int(dx * scale), base_y + int(dy * scale)), fill=(85, 67, 38), width=max(3, int(6 * scale)))
    for dx, dy, r in [(-62, -160, 33), (-20, -223, 38), (43, -157, 35), (37, -230, 34), (-5, -115, 30)]:
        x, y, rr = cx + int(dx * scale), base_y + int(dy * scale), int(r * scale)
        draw.ellipse((x - rr, y - rr, x + rr, y + rr), fill=color)


def scissors(draw, x, y, scale=1.0, color=(224, 93, 49)):
    r = int(13 * scale)
    draw.ellipse((x - r - 30, y - r, x + r - 30, y + r), outline=color, width=max(3, int(4 * scale)))
    draw.ellipse((x - r + 12, y - r, x + r + 12, y + r), outline=color, width=max(3, int(4 * scale)))
    draw.line((x - 18, y - 1, x + 48, y - 42), fill=color, width=max(4, int(6 * scale)))
    draw.line((x - 18, y + 1, x + 48, y + 42), fill=color, width=max(4, int(6 * scale)))


def target(draw, x, y, scale=1.0, color=(224, 93, 49)):
    r = int(26 * scale)
    draw.ellipse((x - r, y - r, x + r, y + r), outline=color, width=max(3, int(5 * scale)))
    draw.ellipse((x - r // 2, y - r // 2, x + r // 2, y + r // 2), outline=color, width=max(3, int(5 * scale)))
    draw.ellipse((x - 5 * scale, y - 5 * scale, x + 5 * scale, y + 5 * scale), fill=color)


def eye(draw, x, y, scale=1.0, color=(224, 93, 49)):
    w, h = int(50 * scale), int(28 * scale)
    draw.ellipse((x - w, y - h, x + w, y + h), outline=color, width=max(3, int(5 * scale)))
    r = int(10 * scale)
    draw.ellipse((x - r, y - r, x + r, y + r), fill=color)


def stump(draw, cx, base_y, scale=1.0):
    # Small remaining base after the whole above-ground support is removed.
    h, w = int(36 * scale), int(18 * scale)
    draw.polygon([(cx - w, base_y), (cx + w, base_y), (cx + w // 2, base_y - h), (cx - w // 2, base_y - h)], fill=(85, 67, 38))
    draw.ellipse((cx - w, base_y - h - 5, cx + w, base_y - h + 5), fill=(134, 92, 51), outline=(72, 51, 34), width=2)


def scene(frame):
    im = Image.new('RGB', (W, H), (242, 234, 210))
    d = ImageDraw.Draw(im)
    # Header and teaching panel stay visible throughout.
    d.rectangle((0, 0, W, 128), fill=(28, 66, 52))
    d.text((48, 25), '43', font=F_TITLE, fill=(255, 249, 226))
    scissors(d, 155, 57, 0.65, (226, 238, 206))
    d.line((210, 57, 255, 57), fill=(226, 238, 206), width=5)
    d.polygon([(255, 57), (242, 48), (242, 66)], fill=(226, 238, 206))
    eye(d, 305, 57, 0.42, (226, 238, 206))
    d.rectangle((0, 128, W, 720), fill=(204, 170, 117))
    # Farmland bands and an access path.
    d.polygon([(0, 485), (W, 405), (W, H), (0, H)], fill=(161, 123, 78))
    d.polygon([(550, 720), (705, 720), (785, 400), (650, 400)], fill=(213, 188, 140))
    d.line((0, 530, W, 447), fill=(184, 143, 90), width=8)
    # Central fruit tree and a competing support plant.
    tree(d, 445, 575, 1.05)
    if frame < 34:
        support(d, 865, 565, 1.05)
    # Small generic companion plants, kept away from the trunk and path.
    for x in (210, 1080):
        d.ellipse((x - 50, 500, x + 50, 575), fill=(78, 125, 66))
    # Mulch around the fruit tree, with a clearly bare trunk collar.
    d.ellipse((280, 538, 610, 615), fill=(135, 92, 49), outline=(99, 66, 37), width=3)
    d.ellipse((395, 540, 495, 590), fill=(161, 123, 78))
    # Plant-specific staged action.
    if frame < 34:
        rounded(d, (746, 180, 1197, 256), 16, (255, 247, 218), outline=(127, 76, 35), width=4)
        d.text((782, 191), '1', font=font(50, True), fill=(98, 55, 30))
        target(d, 890, 218, 0.7)
        d.ellipse((730, 302, 1000, 575), outline=(224, 93, 49), width=8)
    elif frame < 116:
        rounded(d, (654, 180, 1197, 256), 16, (255, 247, 218), outline=(127, 76, 35), width=4)
        d.text((690, 191), '2', font=font(50, True), fill=(98, 55, 30))
        scissors(d, 820, 218, 0.7)
        # Remove the entire selected crown; cut biomass lands separately from the stump.
        d.line((810, 350, 925, 310), fill=(224, 93, 49), width=8)
        stump(d, 865, 565, 1.0)
        biomass_x = 920
        for i in range(7):
            x = biomass_x + (i % 4) * 22
            y = 550 + ((i * 19) % 34)
            d.line((x, y, x + 34, y - 18), fill=(78, 104, 42), width=7)
    else:
        rounded(d, (810, 180, 1197, 256), 16, (255, 247, 218), outline=(127, 76, 35), width=4)
        d.text((850, 191), '3', font=font(50, True), fill=(98, 55, 30))
        eye(d, 982, 218, 0.55)
        stump(d, 865, 565, 1.0)
        for i in range(7):
            x = 930 + (i % 4) * 22
            y = 550 + ((i * 19) % 34)
            d.line((x, y, x + 34, y - 18), fill=(78, 104, 42), width=7)
        # Delayed check cue; no immediate leafy regrowth is shown.
        d.ellipse((810, 320, 875, 385), outline=(132, 89, 48), width=5)
        d.line((843, 353, 843, 334), fill=(132, 89, 48), width=5)
        d.line((843, 353, 859, 363), fill=(132, 89, 48), width=5)
        d.text((885, 327), '?', font=font(48, True), fill=(132, 89, 48))
        d.ellipse((1040, 300, 1100, 360), outline=(239, 192, 76), width=6)
        for ang in range(0, 360, 45):
            x1 = 1070 + int(45 * math.cos(math.radians(ang)))
            y1 = 330 + int(45 * math.sin(math.radians(ang)))
            x2 = 1070 + int(65 * math.cos(math.radians(ang)))
            y2 = 330 + int(65 * math.sin(math.radians(ang)))
            d.line((x1, y1, x2, y2), fill=(239, 192, 76), width=4)
        d.ellipse((1110, 395, 1140, 440), fill=(91, 157, 214))
        d.polygon([(1125, 382), (1108, 410), (1142, 410)], fill=(91, 157, 214))
    # Persistent access path and below-soil roots keep the caution visible without words.
    d.line((550, 700, 705, 700), fill=(74, 104, 57), width=10)
    d.line((440, 590, 350, 650), fill=(93, 67, 45), width=4)
    d.line((440, 590, 525, 660), fill=(93, 67, 45), width=4)
    if frame >= 116:
        d.line((865, 565, 800, 650), fill=(93, 67, 45), width=3)
        d.line((865, 565, 930, 650), fill=(93, 67, 45), width=3)
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    POSTERS.mkdir(parents=True, exist_ok=True)
    scene(FRAMES - 1).save(POSTERS / 'thin-selected-support.jpg', quality=94, subsampling=0)
    with tempfile.TemporaryDirectory(prefix='imbewu-guilds-43-') as temp_dir:
        frames = Path(temp_dir)
        for i in range(FRAMES):
            scene(i).save(frames / f'frame-{i:04d}.png')
        subprocess.run([
            'ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS),
            '-i', str(frames / 'frame-%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart', '-an', str(OUT / 'thin-selected-support.mp4')
        ], check=True)


if __name__ == '__main__':
    main()
