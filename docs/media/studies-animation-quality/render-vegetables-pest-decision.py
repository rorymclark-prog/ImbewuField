"""Render the lesson-4 pest decision sequence without a paid video service."""

import argparse
from pathlib import Path
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

W,H,FPS,SECONDS=1280,720,24,10
FONT='/System/Library/Fonts/Supplemental/Arial.ttf'; BOLD='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
try: ImageFont.truetype(FONT,20)
except OSError: FONT=BOLD='/System/Library/Fonts/Helvetica.ttc'
def f(n,b=False): return ImageFont.truetype(BOLD if b else FONT,n)
def tx(d,p,s,n=30,c='#173d36',b=False,a=None): d.text(p,s,font=f(n,b),fill=c,anchor=a)
def ease(x): x=max(0,min(1,x));return x*x*(3-2*x)
def card(d,box): d.rounded_rectangle(box,28,fill='#f7f1e4',outline='#d9cbb8',width=4)
def leaf(d,x,y):
    d.line((x,y+135,x,y+24),fill='#387a42',width=12)
    d.ellipse((x-68,y+5,x-5,y+48),fill='#5f9b50');d.ellipse((x+5,y-15,x+80,y+32),fill='#4e8b47')
    d.ellipse((x-58,y+53,x-4,y+91),fill='#6ba656');d.ellipse((x+5,y+43,x+67,y+82),fill='#5b9449')
    d.arc((x-50,y+20,x+1,y+62),195,350,fill='#d1b25d',width=8)
    d.ellipse((x+20,y+51,x+42,y+70),fill='#6d3a27')
def footer(d,s):
    d.rounded_rectangle((278,612,1002,672),30,fill='#173d36')
    tx(d,(640,642),s,30,'#ffffff',True,'mm')
def base(d,step,title,subtitle,phase):
    d.rectangle((0,0,W,126),fill='#173d36');tx(d,(54,39),'OBSERVE • CHECK • PROTECT • ACT • MONITOR',27,'#ffffff',True)
    tx(d,(54,87),'Authored diagram — not a diagnosis or product recommendation',22,'#dcebe5')
    for i in range(5):
        col='#d9cbb8' if i!=step else '#e0a341'
        pulse=3*max(0,1-abs(((phase % .8)/.8)*2-1)) if i==step else 0
        cx=919+i*52;cy=59;r=19+pulse
        d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=col)
    tx(d,(640,174),title,44,'#173d36',True,'mm');tx(d,(640,218),subtitle,28,'#5c574e',False,'mm')
def draw(step,phase=0):
    im=Image.new('RGB',(W,H),'#efe5d3');d=ImageDraw.Draw(im)
    if step==0:
        base(d,0,'1. OBSERVE','Look at the pattern, leaf underside, stem and nearby plants',phase)
        card(d,(195,270,1085,572)); leaf(d,468,325)
        tx(d,(720,360),'Damage is a clue.',36,'#173d36',True);tx(d,(720,416),'Do not assume the cause yet.',31,'#5c574e')
        footer(d,'Observe before deciding.')
    elif step==1:
        base(d,1,'2. CHECK FOR STRESS','Check before assuming a pest cause',phase)
        labels=['SOIL\nMOISTURE','ROOTS','SPACING','NUTRITION','DRAINAGE']
        for i,l in enumerate(labels):
            x=104+i*216;card(d,(x,302,x+176,508));
            d.ellipse((x+57,340,x+119,402),fill=['#5d91b1','#a36a3c','#d9cbb8','#8eaa55','#5d91b1'][i])
            tx(d,(x+88,450),l,22,'#173d36',True,'mm')
        footer(d,'Check the whole growing situation.')
    elif step==2:
        base(d,2,'3. PROTECT WHAT HELPS','Beneficial insects may already be working',phase)
        card(d,(250,282,1030,552));leaf(d,460,350)
        d.ellipse((780,373,837,428),fill='#d8a43b',outline='#173d36',width=4)
        d.ellipse((744,342,803,391),fill='#e7d49f',outline='#173d36',width=3);d.ellipse((815,342,874,391),fill='#e7d49f',outline='#173d36',width=3)
        d.line((791,376,772,352),fill='#173d36',width=4);d.line((826,376,846,352),fill='#173d36',width=4)
        d.ellipse((767,347,774,354),fill='#173d36');d.ellipse((844,347,851,354),fill='#173d36')
        for dx in (792,808,824):
            d.line((dx,420,dx-12,440),fill='#173d36',width=3);d.line((dx,420,dx+12,440),fill='#173d36',width=3)
        tx(d,(820,471),'Protect helpful insects.',31,'#173d36',True,'mm');footer(d,'Keep help in the system.')
    elif step==3:
        base(d,3,'4. ACT, THEN MONITOR','Use the least-harmful appropriate action',phase)
        for i,(label,shape) in enumerate([('REMOVE','hand'),('BARRIER','shield'),('CROP CARE','leaf')]):
            x=205+i*300;card(d,(x,300,x+250,526));
            if shape=='hand': d.ellipse((x+92,351,x+158,431),fill='#a66f4b');d.rectangle((x+111,411,x+140,462),fill='#a66f4b')
            elif shape=='shield': d.polygon([(x+125,345),(x+185,372),(x+170,447),(x+125,476),(x+80,447),(x+65,372)],fill='#6c9a9e')
            else: leaf(d,x+125,348)
            tx(d,(x+125,487),label,23,'#173d36',True,'mm')
        footer(d,'Check whether the action suits the problem.')
    else:
        base(d,4,'IF A TREATMENT IS NEEDED','',phase)
        # Phone video controls cover the lower half of a held frame. All three
        # safety instructions must stay above that overlay, even when paused.
        d.rounded_rectangle((270,218,1010,382),24,fill='#f7f1e4',outline='#d9cbb8',width=4)
        d.rounded_rectangle((460,230,820,294),16,fill='#ffffff',outline='#173d36',width=5)
        tx(d,(640,250),'REGISTERED FOR',24,'#173d36',True,'mm')
        tx(d,(640,278),'CROP + PEST',31,'#173d36',True,'mm')
        tx(d,(640,322),'Follow label: protection + harvest wait.',28,'#173d36',True,'mm')
        tx(d,(640,355),'No improvised mixtures or stronger doses.',27,'#173d36',True,'mm')
        footer(d,'Check the label before any treatment.')
    return im
def frame(n):
    t=n/FPS;step=min(4,int(t//2));within=t-step*2
    image=draw(step,within)
    if step<4 and within>=1.7:
        image=Image.blend(image,draw(step+1,within-1.7),ease((within-1.7)/.3))
    return image

def main():
    parser=argparse.ArgumentParser()
    root=Path(__file__).resolve().parents[3]
    parser.add_argument('--output-dir',type=Path,
                        default=root/'public/course-animations/vegetables-staples')
    args=parser.parse_args()
    movie=args.output_dir/'pest-decision-path.mp4'
    poster=args.output_dir/'posters/pest-decision-path.jpg'
    poster.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pest-decision-path-') as tmp:
        frames=Path(tmp)
        for n in range(FPS*SECONDS):
            frame(n).save(frames/f'frame-{n:04d}.png')
        subprocess.run([
            'ffmpeg','-y','-loglevel','error','-framerate',str(FPS),
            '-i',str(frames/'frame-%04d.png'),'-c:v','libx264',
            '-pix_fmt','yuv420p','-crf','20','-movflags','+faststart',
            str(movie),
        ],check=True)
    frame(FPS*SECONDS-1).save(poster,quality=78,subsampling=2)
    print(f'{movie}\n{poster}')

if __name__=='__main__':
    main()
