"""Render the generic seed-or-seedling choice without a paid video service."""

import argparse
from pathlib import Path
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

W, H, FPS, SECONDS = 1280, 720, 24, 7
try:
    FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
    BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
    ImageFont.truetype(FONT, 20)
except OSError:
    FONT = BOLD = '/System/Library/Fonts/Helvetica.ttc'

def font(size, bold=False): return ImageFont.truetype(BOLD if bold else FONT, size)
def text(d, xy, value, size, fill, bold=False, anchor=None):
    d.text(xy, value, font=font(size, bold), fill=fill, anchor=anchor)
def ease(v):
    v=max(0,min(1,v)); return v*v*(3-2*v)

def soil(d, x0, x1):
    d.rectangle((x0, 375, x1, 650), fill='#714427')
    d.rectangle((x0, 375, x1, 387), fill='#a36a3c')
    for i in range(40):
        x=x0+18+(i*67)%(x1-x0-36); y=407+(i*47)%222
        d.ellipse((x-2,y-2,x+2,y+2), fill='#5d351e')

def draw_seedling(d, t):
    down=ease((t-.35)/1.8)
    cy=385+67*down
    top,bottom=cy-78,cy+78
    # Hole is an explanatory cutaway, with no depth value claimed.
    d.rounded_rectangle((878,375,1042,548), radius=16, fill='#3f2519')
    # Start with the plant intact and already partly in the schematic hole. Its
    # leaves never pop into being during the move or cover the route heading.
    d.line((960, top+8, 960, top-42), fill='#356e37', width=12)
    d.ellipse((912,top-72,957,top-43),fill='#528b45')
    d.ellipse((965,top-86,1018,top-48),fill='#609b50')
    d.ellipse((913,top-36,958,top-7),fill='#477d3e')
    d.ellipse((962,top-31,1014,top+1),fill='#5b9449')
    d.rounded_rectangle((893,top,1027,bottom),radius=18,fill='#503223',outline='#2f1a11',width=5)
    for i in range(10):
        x=910+(i*27)%98;y=top+22+(i*43)%108
        d.arc((x-10,y-2,x+18,y+31),95,255,fill='#d7c69e',width=3)
    return ease((t-3.0)/1.7)

def draw_seed(d, t):
    fall=ease((t-.35)/1.6)
    y=278+126*fall
    d.ellipse((301,y-11,323,y+11), fill='#d7c69e', outline='#705638', width=3)
    # The cross-section closes over the seed so the held frame does not imply
    # that leaving it exposed is a finished sowing action. No depth is marked.
    cover=ease((t-2.35)/1.5)
    if cover:
        d.rectangle((271,375,353,375+int(51*cover)),fill='#714427')
        d.rectangle((271,375,353,387),fill='#a36a3c')

def frame(n):
    t=n/FPS
    im=Image.new('RGB',(W,H),'#f7f1e4');d=ImageDraw.Draw(im)
    d.rectangle((0,0,W,132),fill='#173d36')
    text(d,(64,40),'AUTHORED DIAGRAM',46,'#ffffff',True)
    text(d,(64,89),'Choose for the crop and local conditions',40,'#dcebe5')
    d.line((640,154,640,640),fill='#d8cbb8',width=4)
    text(d,(320,175),'DIRECT SOW',53,'#173d36',True,'mm')
    text(d,(960,175),'NURSERY START',53,'#173d36',True,'mm')
    soil(d,42,598);soil(d,682,1238)
    # A simple small furrow remains visible until the seed reaches it.
    d.rounded_rectangle((271,375,353,426),radius=15,fill='#3f2519')
    draw_seed(d,t)
    return_soil=draw_seedling(d,t)
    if return_soil:
        w=int(82*return_soil)
        d.polygon([(858,375),(858+w,375),(893,510),(858,548)],fill='#714427')
        d.polygon([(1062,375),(1062-w,375),(1027,510),(1062,548)],fill='#714427')
        d.rectangle((858,375,1062,387),fill='#a36a3c')
    if t>=4.9:
        alpha=ease((t-4.9)/.45)
        overlay=Image.new('RGBA',(W,H),(0,0,0,0));od=ImageDraw.Draw(overlay)
        od.rounded_rectangle((245,571,1035,644),radius=30,fill=(23,61,54,int(232*alpha)))
        text(od,(640,608),'No depth or spacing rule shown.',41,(255,255,255,int(255*alpha)),True,'mm')
        im=Image.alpha_composite(im.convert('RGBA'),overlay).convert('RGB')
    return im

def main():
    parser = argparse.ArgumentParser()
    root = Path(__file__).resolve().parents[3]
    parser.add_argument('--output-dir', type=Path,
                        default=root / 'public/course-animations/vegetables-staples')
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    movie = args.output_dir / 'seed-or-seedling-choice.mp4'
    poster = args.output_dir / 'posters/seed-or-seedling-choice.jpg'
    poster.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='seed-or-seedling-choice-') as tmp:
        frames = Path(tmp)
        for n in range(FPS * SECONDS):
            frame(n).save(frames / f'frame-{n:04d}.png')
        subprocess.run([
            'ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS),
            '-i', str(frames / 'frame-%04d.png'), '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart',
            str(movie),
        ], check=True)
    frame(FPS * SECONDS - 1).save(poster, quality=78, subsampling=2)
    print(f'{movie}\n{poster}')


if __name__ == '__main__':
    main()
