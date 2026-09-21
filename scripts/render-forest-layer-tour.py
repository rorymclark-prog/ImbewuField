#!/usr/bin/env python3
"""Render a narrated, guided tour of reviewed teaching artwork.

The earlier clip reduced plants to green ellipses. Keep the detailed artwork intact;
camera movement and a restrained focus light direct attention without inventing growth.
Word-boundary timings keep each label beside the feature the learner is hearing about.
The default remains the forest tour; --art-dir selects another authored storyboard.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'docs/media/studies-animation-quality/forest-layers'


def ease(value):
    value = max(0, min(1, value))
    return value * value * (3 - 2 * value)


def render(output, asset_dir=ART):
    cfg = json.loads((asset_dir / 'storyboard.json').read_text())
    timing = json.loads((asset_dir / 'timing.json').read_text())
    spoken = '\n\n'.join(s['narration'] for s in cfg['scenes'])
    assert hashlib.sha256(spoken.encode()).hexdigest() == timing['source_sha256']
    assert hashlib.sha256((asset_dir / 'narration.mp3').read_bytes()).hexdigest() == timing['audio_sha256']
    assert timing['text_match'] and timing['full_decode'] == 'pass'
    assert len(timing['starts']) == len(cfg['scenes']) >= 3
    steps = len(cfg['scenes']) - 2
    w, ah, fh, fps = cfg['width'], cfg['artHeight'], cfg['footerHeight'], cfg['fps']
    height = ah + fh
    source = Image.open(asset_dir / cfg['source']).convert('RGB').resize((w, ah), Image.Resampling.LANCZOS)
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 76)
    small = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 31)
    count_font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 45)
    starts = [0] + timing['starts'][1:]
    seconds = math.ceil((timing['seconds'] + 1.25) * fps) / fps
    frames = round(seconds * fps)
    masks = []
    for scene in cfg['scenes']:
        mask = Image.new('L', (w, ah), 0)
        if scene['focus']:
            x, y, rx, ry = scene['focus']
            ImageDraw.Draw(mask).ellipse(((x-rx)*w, (y-ry)*ah, (x+rx)*w, (y+ry)*ah), fill=255)
            mask = mask.filter(ImageFilter.GaussianBlur(45))
        masks.append(mask)

    def camera(scene):
        if not scene['focus']:
            return (w/2, ah/2, 1)
        x, y, rx, ry = scene['focus']
        zoom = scene.get('zoom', 1.30 if scene['id'] == 'canopy' else 1.65)
        return (x*w, y*ah, zoom)

    def frame_at(t):
        idx = max(i for i, start in enumerate(starts) if start <= t)
        scene = cfg['scenes'][idx]
        local = t - starts[idx]
        transition = ease(local / cfg.get('transitionSeconds', .8))
        previous = max(0, idx-1)
        c0, c1 = camera(cfg['scenes'][previous]), camera(scene)
        cx, cy, zoom = [a+(b-a)*transition for a, b in zip(c0, c1)]
        vw, vh = w / zoom, ah / zoom
        left = max(0, min(w-vw, cx-vw/2))
        top = max(0, min(ah-vh, cy-vh/2))
        transform = (1/zoom, 0, left, 0, 1/zoom, top)
        art = source.transform((w, ah), Image.Transform.AFFINE, transform, Image.Resampling.BICUBIC)
        focus = Image.blend(masks[previous], masks[idx], transition)
        focus = focus.transform((w, ah), Image.Transform.AFFINE, transform, Image.Resampling.BICUBIC)
        active0 = 0 if not cfg['scenes'][previous]['focus'] else 1
        active1 = 0 if not scene['focus'] else 1
        active = active0+(active1-active0)*transition
        # The background remains recognisable, preserving context around the close-up.
        shade = focus.point(lambda p: round((1-p/255)*76*active))
        art = Image.composite(Image.new('RGB', (w, ah), '#102d21'), art, shade)
        # A restrained teaching outline makes the named feature unambiguous on a phone.
        if scene['focus'] and transition > .5:
            x, y, rx, ry = scene['focus']
            ring = Image.new('RGBA', (w, ah))
            ImageDraw.Draw(ring).ellipse(
                (((x-rx)*w-left)*zoom, ((y-ry)*ah-top)*zoom,
                 ((x+rx)*w-left)*zoom, ((y+ry)*ah-top)*zoom),
                outline=(244, 218, 142, round(210*ease((transition-.5)*2))), width=4,
            )
            art = Image.alpha_composite(art.convert('RGBA'), ring).convert('RGB')
        out = Image.new('RGB', (w, height), '#143a2b')
        out.paste(art, (0, 0))
        draw = ImageDraw.Draw(out)
        draw.line((0, ah, w, ah), fill='#b9b677', width=3)
        draw.text((42, ah+19), cfg.get('eyebrow', 'READ THE FOOD FOREST'), font=small, fill='#cbd6b4')
        draw.text((40, ah+60), scene['label'], font=font, fill='#fffdf5')
        if 0 < idx <= steps:
            draw.text((w-164, ah+78), f'{idx} / {steps}', font=count_font, fill='#e5d4a0')
        else:
            tag = cfg.get('overviewTag', 'CONCEPT CUTAWAY')
            draw.text((w-42-draw.textlength(tag, font=small), ah+88), tag, font=small, fill='#cbd6b4')
        for n in range(steps):
            x = 43+n*((w-86)/steps)
            end = x+(w-114)/steps
            fill = '#dcca8c' if idx == steps+1 or n+1 <= idx else '#476354'
            draw.rounded_rectangle((x, height-27, end, height-18), radius=4, fill=fill)
        return out

    output.parent.mkdir(parents=True, exist_ok=True)
    command = ['ffmpeg','-y','-v','error','-f','rawvideo','-pixel_format','rgb24',
               '-video_size',f'{w}x{height}','-framerate',str(fps),'-i','-',
               '-an','-c:v','libx264','-preset','medium','-crf','23','-pix_fmt','yuv420p',
               '-movflags','+faststart',str(output)]
    encoder = subprocess.Popen(command, stdin=subprocess.PIPE)
    for n in range(frames):
        encoder.stdin.write(frame_at(n/fps).tobytes())
    encoder.stdin.close()
    if encoder.wait() != 0:
        raise RuntimeError('Animation encode failed')
    poster = output.parent / 'posters' / output.with_suffix('.jpg').name
    poster.parent.mkdir(parents=True, exist_ok=True)
    frame_at(0).save(poster, quality=93)
    contact = Image.new('RGB', (1200, math.ceil(len(starts)/3)*275), '#143a2b')
    for i, start in enumerate(starts):
        sample = min(seconds-1/fps, start+1.3)
        frame_at(sample).resize((400,275), Image.Resampling.LANCZOS).save(asset_dir / f'review-{i:02}.jpg', quality=92)
        contact.paste(Image.open(asset_dir / f'review-{i:02}.jpg'), ((i%3)*400,(i//3)*275))
    contact.save(asset_dir / 'review-contact.jpg', quality=93)
    meta = {'file':str(output.relative_to(ROOT)), 'bytes':output.stat().st_size,
            'sha256':hashlib.sha256(output.read_bytes()).hexdigest(), 'seconds':seconds,
            'width':w, 'height':height, 'fps':fps, 'frames':frames,
            'source_sha256':hashlib.sha256((asset_dir/cfg['source']).read_bytes()).hexdigest(),
            'narration_seconds':timing['seconds'], 'phase_starts':starts,
            'scope':cfg.get('scope', 'Guided illustrated cutaway. No simulated plant growth or measured planting dimensions.')}
    (asset_dir / 'render.json').write_text(json.dumps(meta, indent=2)+'\n')
    print(json.dumps(meta, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, default=ROOT/'public/course-animations/food-forest/tour-seven-layers.mp4')
    parser.add_argument('--art-dir', type=Path, default=ART)
    args = parser.parse_args()
    render(args.out, args.art_dir)
