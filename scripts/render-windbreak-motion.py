#!/usr/bin/env python3
"""Show wind passing through shelter without inventing a measured protection zone.

The old wind diagram used tiny arrows and disconnected circles as trees. Detailed
artwork supplies the landscape; authored arrows retain the teachable direction.
Their speed is a qualitative illustration, never a calibrated airflow model.
"""
import bisect
import hashlib
import json
import math
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'docs/media/studies-animation-quality/windbreak'
OUT = ROOT / 'public/course-animations/intro-permaculture/motion-windbreak.mp4'
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
# These are pixel coordinates in the reviewed artwork, not farm measurements.
CROSSINGS = [(540, 660), (780, 420), (1000, 200)]


def ease(t):
    t = max(0, min(1, t))
    return t*t*(3-2*t)


def flow_table():
    positions, times = [], []
    elapsed = 0
    for u in range(-400, 361):
        positions.append(u)
        times.append(elapsed)
        # Never stop at the trees: through-flow slows continuously across the belt.
        elapsed += 1 / (106 - 59*ease((u+50)/140))
    return positions, times


def render():
    cfg = json.loads((ART/'storyboard.json').read_text())
    timing = json.loads((ART/'timing.json').read_text())
    text = '\n\n'.join(s['narration'] for s in cfg['scenes'])
    assert hashlib.sha256(text.encode()).hexdigest() == timing['source_sha256']
    assert hashlib.sha256((ART/'narration.mp3').read_bytes()).hexdigest() == timing['audio_sha256']
    assert timing['text_match'] and timing['full_decode'] == 'pass'
    w, ah, fh, fps = [cfg[k] for k in ['width', 'artHeight', 'footerHeight', 'fps']]
    assert (w, ah) == (1600, 900), 'Arrow coordinates must be re-reviewed after changing art dimensions'
    h = ah+fh
    source = Image.open(ART/cfg['source']).convert('RGB').resize((w, ah), Image.Resampling.LANCZOS)
    starts = [0]+timing['starts'][1:]
    assert len(starts) == len(cfg['scenes'])
    seconds = math.ceil((timing['seconds']+1.25)*fps)/fps
    frames = round(seconds*fps)
    positions, times = flow_table()
    cycle = times[-1]
    font = ImageFont.truetype(FONT, 76)
    small = ImageFont.truetype(FONT, 31)
    count_font = ImageFont.truetype(FONT, 43)

    def arrow_position(t, lane, n):
        phase = (t + lane*.8 + n*cycle/4) % cycle
        i = min(len(times)-2, bisect.bisect_right(times, phase)-1)
        u = positions[i]+(phase-times[i])/(times[i+1]-times[i])
        x, y = CROSSINGS[lane]
        return u, x+u, y+u

    def frame_at(t):
        idx = max(i for i, start in enumerate(starts) if start <= t)
        scene = cfg['scenes'][idx]
        overlay = Image.new('RGBA', (w, ah))
        pen = ImageDraw.Draw(overlay)
        for lane in range(len(CROSSINGS)):
            for n in range(4):
                u, x, y = arrow_position(t, lane, n)
                filtered = ease((u+50)/140)
                alpha = ease((u+400)/55)*ease((360-u)/55)
                if idx == 0 and u > 60:
                    alpha *= .45
                elif idx == 3 and u < -50:
                    alpha *= .50
                color = tuple(round(a+(b-a)*filtered) for a,b in zip((255,215,121),(210,247,244)))
                length = 65-24*filtered
                # A dark under-stroke keeps moving arrows legible over light soil and foliage.
                points = [(x-length, y-length), (x, y)]
                head = [(x-26,y-3),(x,y),(x-3,y-26)]
                for path in [points, head]:
                    pen.line(path, fill=(17,46,35,round(155*alpha)), width=11, joint='curve')
                    pen.line(path, fill=(*color,round(248*alpha)), width=5, joint='curve')
        # Stable direction context prevents a pretty diagonal from teaching the wrong sector.
        pen.rounded_rectangle((32,28,526,94), radius=20, fill=(20,58,43,225))
        pen.text((53,43), 'ILLUSTRATED WIND FLOW', font=small, fill='#fff8df')
        pen.rounded_rectangle((1460,26,1568,188), radius=25, fill=(20,58,43,230))
        pen.text((1498,35), 'N', font=count_font, fill='#fff8df')
        pen.line((1514,159,1514,97), fill='#fff8df', width=5)
        pen.polygon([(1514,86),(1501,111),(1527,111)], fill='#fff8df')
        image = Image.new('RGB',(w,h),'#143a2b')
        image.paste(Image.alpha_composite(source.convert('RGBA'),overlay).convert('RGB'),(0,0))
        draw = ImageDraw.Draw(image)
        draw.line((0,ah,w,ah),fill='#b9b677',width=3)
        draw.text((42,ah+18),'READ WIND AND SHELTER',font=small,fill='#cbd6b4')
        assert draw.textlength(scene['label'],font=font)<w-225, scene['label']
        draw.text((40,ah+59),scene['label'],font=font,fill='#fffdf5')
        draw.text((w-160,ah+79),f'{idx+1} / {len(starts)}',font=count_font,fill='#e5d4a0')
        for n in range(len(starts)):
            x=43+n*(w-86)/len(starts)
            end=x+(w-114)/len(starts)
            draw.rounded_rectangle((x,h-27,end,h-18),radius=4,fill='#dcca8c' if n<=idx else '#476354')
        return image

    OUT.parent.mkdir(parents=True,exist_ok=True)
    encoder=subprocess.Popen(['ffmpeg','-y','-v','error','-f','rawvideo','-pixel_format','rgb24',
        '-video_size',f'{w}x{h}','-framerate',str(fps),'-i','-','-an','-c:v','libx264',
        '-preset','medium','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT)],stdin=subprocess.PIPE)
    for n in range(frames):
        encoder.stdin.write(frame_at(n/fps).tobytes())
    encoder.stdin.close()
    assert encoder.wait()==0, 'Encode failed'
    subprocess.run(['ffmpeg','-v','error','-i',str(OUT),'-f','null','-'],check=True)
    poster=OUT.parent/'posters'/OUT.with_suffix('.jpg').name
    frame_at(0).save(poster,quality=93)
    contact=Image.new('RGB',(1200,550),'#143a2b')
    for i,start in enumerate(starts):
        still=frame_at(start+1.25)
        still.save(ART/f'review-{i:02}.jpg',quality=92)
        contact.paste(still.resize((400,275),Image.Resampling.LANCZOS),((i%3)*400,(i//3)*275))
    contact.save(ART/'review-contact.jpg',quality=92)
    meta={'file':str(OUT.relative_to(ROOT)),'bytes':OUT.stat().st_size,
        'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'seconds':seconds,'frames':frames,
        'width':w,'height':h,'fps':fps,'source_sha256':hashlib.sha256((ART/cfg['source']).read_bytes()).hexdigest(),
        'narration_seconds':timing['seconds'],'phase_starts':starts,'full_decode':'pass','scope':cfg['scope']}
    (ART/'render.json').write_text(json.dumps(meta,indent=2)+'\n')
    print(json.dumps(meta,indent=2))


if __name__=='__main__':
    render()
