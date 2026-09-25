#!/usr/bin/env python3
"""Render the reviewed Food Forest L3 slide-16 layer-order composite to --output-dir only."""
from __future__ import annotations

import argparse
from pathlib import Path
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[3]
SOURCE_VIDEO = REPO / 'public/course-animations/food-forest/flow-sheet-mulching.mp4'
W, H, FPS = 1280, 720, 24


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = 'Verdana Bold.ttf' if bold else 'Verdana.ttf'
    return ImageFont.truetype(f'/System/Library/Fonts/Supplemental/{name}', size)


def run(args: list[str]) -> None:
    subprocess.run(args, check=True)


def label(draw: ImageDraw.ImageDraw, text: str, x: int, y: int, target_y: int, color: str) -> None:
    face = font(35, True)
    draw.text((x, y), text, font=face, fill=color)
    box = draw.textbbox((x, y), text, font=face)
    cx = (box[0] + box[2]) // 2
    draw.line((cx, y + 48, cx, target_y), fill=color, width=4)
    draw.ellipse((cx - 7, target_y - 7, cx + 7, target_y + 7), fill=color)


def render_frames(frames: Path) -> None:
    """Five seconds of loose chips settling over cardboard on soil."""
    for frame in range(5 * FPS):
        progress = min(1.0, frame / (3 * FPS))
        image = Image.new('RGB', (W, H), '#fbf3e6')
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle((36, 30, 1244, 690), radius=28, fill='#fffaf2', outline='#d8c8b3', width=3)
        draw.text((76, 68), 'Illustrated layer order', font=font(28, True), fill='#5c412d')
        left, right = 92, 1188
        soil_top, soil_bottom, card_top, card_bottom = 495, 642, 462, 496
        mulch_top = int(462 - 132 * progress)
        draw.rounded_rectangle((left, soil_top, right, soil_bottom), radius=18, fill='#70472f', outline='#4f3021', width=3)
        for x in range(left + 20, right - 15, 38):
            y = soil_top + 35 + ((x * 17) % 70)
            draw.ellipse((x, y, x + 9, y + 7), fill='#9b6a45')
        draw.rectangle((left, card_top, right, card_bottom), fill='#d8bd82', outline='#9f7b43', width=3)
        for x in range(left + 165, right, 205):
            draw.line((x, card_top + 2, x - 14, card_bottom - 2), fill='#ad8951', width=2)
        if progress:
            surface = [(x, mulch_top + 8 + ((x * 17) % 20)) for x in range(left, right + 1, 28)]
            draw.polygon([(left, card_top), *surface, (right, card_top)], fill='#9c693d', outline='#70462a')
            draw.line(surface, fill='#70462a', width=4)
            for n in range(62):
                x = left + 16 + ((n * 73) % (right - left - 42))
                available = max(18, card_top - mulch_top - 16)
                y = mulch_top + 15 + ((n * 29) % available)
                length = 19 + ((n * 11) % 14)
                color = '#e3bd73' if n % 3 else '#6c4429'
                draw.rounded_rectangle((x, y, x + length, y + 8), radius=3, fill=color, outline='#5a3925', width=1)
                if n % 2:
                    draw.line((x + 3, y + 2, x + length - 3, y + 6), fill='#f1d693', width=1)
        for n in range(25):
            x = left + 35 + ((n * 89) % (right - left - 70))
            start_y, end_y = 238 + ((n * 37) % 145), mulch_top + 18 + ((n * 19) % 45)
            y = int(start_y + (end_y - start_y) * progress)
            if progress < 0.88:
                draw.line((x, y, x + 20, y + 7), fill='#b37b45', width=5)
        label(draw, 'Mulch', 178, 154, max(315, mulch_top + 46), '#5b3a25')
        label(draw, 'Cardboard', 540, 278, card_top + 16, '#76551f')
        label(draw, 'Soil', 960, 278, soil_top + 62, '#5b3a25')
        image.save(frames / f'frame-{frame:03d}.png')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', required=True, type=Path)
    output_dir = parser.parse_args().output_dir.resolve()
    if not SOURCE_VIDEO.is_file():
        raise FileNotFoundError(SOURCE_VIDEO)
    output_dir.mkdir(parents=True, exist_ok=True)
    output, poster = output_dir / 'sheet-mulching-layer-order.mp4', output_dir / 'sheet-mulching-layer-order.jpg'
    with tempfile.TemporaryDirectory(prefix='imbewu-sheet-mulch-') as temp:
        temp_dir = Path(temp)
        frames = temp_dir / 'frames'
        frames.mkdir()
        scene = temp_dir / 'illustrated-layer-order-scene.mp4'
        render_frames(frames)
        run(['ffmpeg', '-y', '-v', 'error', '-framerate', str(FPS), '-i', str(frames / 'frame-%03d.png'), '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(scene)])
        run(['ffmpeg', '-y', '-v', 'error', '-i', str(SOURCE_VIDEO), '-i', str(scene), '-filter_complex', '[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[v0];[1:v]setsar=1[v1];[v0][v1]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-r', str(FPS), '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(output)])
        run(['ffmpeg', '-y', '-v', 'error', '-ss', '12', '-i', str(output), '-frames:v', '1', '-q:v', '2', str(poster)])


if __name__ == '__main__':
    main()
