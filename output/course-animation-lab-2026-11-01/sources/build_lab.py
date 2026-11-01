"""Standalone teaching experiments. Existing lessons and app assets are untouched."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math, subprocess, json, shutil

ROOT = Path(__file__).resolve().parents[1]
W,H,FPS = 1280,720,24
PAPER='#f7f0df'; INK='#23392e'; GREEN='#2f684c'; GOLD='#d5a74a'; BLUE='#5596ad'
FONT='/System/Library/Fonts/Supplemental/Arial.ttf'
SERIF='/System/Library/Fonts/Supplemental/Georgia.ttf'
def font(size, serif=False): return ImageFont.truetype(SERIF if serif else FONT,size)
def ease(x):
    x=max(0,min(1,x)); return x*x*(3-2*x)
def text(d,xy,s,size=24,fill=INK,anchor=None,serif=False):
    d.text(xy,s,font=font(size,serif),fill=fill,anchor=anchor)
def arrow(d,a,b,color,width=7):
    d.line([a,b],fill=color,width=width)
    ang=math.atan2(b[1]-a[1],b[0]-a[0]); l=19
    d.polygon([b,(b[0]-l*math.cos(ang-.5),b[1]-l*math.sin(ang-.5)),(b[0]-l*math.cos(ang+.5),b[1]-l*math.sin(ang+.5))],fill=color)
def chrome(d,title,sub,tag,dark=False):
    c='#f7f0df' if dark else INK
    text(d,(64,40),'IMBEWUFIELD  /  ANIMATION LAB',16,fill=GOLD)
    text(d,(64,74),title,44,fill=c,serif=True)
    text(d,(66,132),sub,22,fill='#bdc8bb' if dark else '#647768')
    d.line([(64,654),(1216,654)],fill='#466252' if dark else '#d6d8c4',width=1)
    text(d,(64,678),tag,16,fill='#a7b5a7' if dark else '#657565')
    text(d,(1216,678),'Illustrative plot · not to scale',16,fill='#a7b5a7' if dark else '#657565',anchor='ra')
def house(d,x,y,scale=1):
    d.rounded_rectangle([x-30*scale,y-16*scale,x+30*scale,y+27*scale],radius=3,fill='#f1d49e',outline=INK,width=2)
    d.polygon([(x-38*scale,y-13*scale),(x,y-42*scale),(x+38*scale,y-13*scale)],fill='#b96343')
    d.rectangle([x-6*scale,y+5*scale,x+6*scale,y+27*scale],fill=INK)
def ringpoints(cx,cy,r,n=180):
    return [(cx+r*math.cos(a)*(1+.065*math.sin(3*a)),cy+r*.68*math.sin(a)*(1+.06*math.cos(4*a))) for a in [i*2*math.pi/n for i in range(n+1)]]

def zones(t):
    im=Image.new('RGB',(W,H),PAPER);d=ImageDraw.Draw(im)
    chrome(d,'Zones follow your feet','The more often something needs you, the closer it lives.','01  /  Paper diagram  /  scripted 2D')
    cx,cy=390,409; cols=['#dce5cf','#c6d8af','#a9c18c','#81a76c','#4e835a']
    labels=[('0','House'),('1','Pick daily'),('2','Main garden / chicken run'),('3','Main field / weekly'),('4','Occasional attention'),('5','Left wild')]
    for j,r in enumerate([286,238,188,138,90]):
        d.polygon(ringpoints(cx,cy,r),fill=cols[j])
    for k in range(5):
        r=[90,138,188,238,286][k];p=ease((t-.4-k*.48)/1.2)
        pts=ringpoints(cx,cy,r); count=max(2,int(len(pts)*p))
        if p: d.line(pts[:count],fill=PAPER,width=3)
        if t>2+k*.5:
            x,y=ringpoints(cx,cy,r)[152];d.ellipse((x-14,y-14,x+14,y+14),fill=PAPER)
            text(d,(x,y),str(k+1),17,anchor='mm')
    house(d,cx,cy,1.25)
    for i,(num,label) in enumerate(labels):
        y=213+i*60
        if t>.3+i*.65:
            d.rounded_rectangle([789,y-2,825,y+34],radius=12,fill=INK if i==0 else cols[max(0,5-i)])
            text(d,(807,y+16),num,20,fill=PAPER if i==0 else INK,anchor='mm')
            text(d,(844,y+15),label,24,anchor='lm')
    # Feet travel on a short route; it is a visual metaphor, never a distance claim.
    if t>4:
        p=(t*.31)%1; x=cx+64*math.sin(p*math.pi);y=cy+51*math.sin(p*math.pi)
        d.ellipse([x-7,y-7,x+7,y+7],fill=GOLD,outline=INK,width=2)
    if t>9: text(d,(805,601),'Zones organise effort.',25,serif=True)
    return im

def sectors(t):
    im=Image.new('RGB',(W,H),'#173a32');d=ImageDraw.Draw(im)
    chrome(d,'Sectors cross your boundary','Sun, wind, rain, flood and fire arrive from outside.','02  /  Chalkboard diagram  /  scripted 2D',True)
    cx,cy=650,400
    # Arrows do not imply bearings: this is explicitly a concept diagram.
    d.rounded_rectangle([473,249,847,565],radius=26,outline='#8da88c',width=3)
    for k in range(5):
        x=535+k*44; d.line([(x,480),(x+20,425)],fill='#4f7859',width=10)
    house(d,cx,cy,1.1)
    specs=[('WIND',(203,310),(490,354),'#b9d1ba'),('RAIN',(1061,240),(824,325),BLUE),('SUN',(650,195),(650,283),GOLD),('FLOOD',(1095,548),(838,491),'#73b2c5'),('FIRE',(202,549),(479,488),'#df906b')]
    for i,(label,a,b,c) in enumerate(specs):
        p=ease((t-i*1.8)/1.5)
        if p<=0:continue
        e=(a[0]+(b[0]-a[0])*p,a[1]+(b[1]-a[1])*p)
        arrow(d,a,e,c)
        for q in range(3):
            u=((t*.4+q/3)%1)*p
            x=a[0]+(b[0]-a[0])*u;y=a[1]+(b[1]-a[1])*u
            d.ellipse([x-4,y-4,x+4,y+4],fill=c)
        text(d,(a[0],a[1]-34),label,24,fill=c,anchor='mm')
    text(d,(650,597),'Which direction does damaging weather come from?',25,fill=PAPER,anchor='mm',serif=True)
    text(d,(1120,620),'Concept arrows only',15,fill='#a7b5a7',anchor='ra')
    return im

def painted(t):
    im=Image.open(ROOT/'sources/painted-homestead.png').convert('RGB').resize((W,H),Image.Resampling.LANCZOS)
    layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer)
    d.rectangle([0,0,W,143],fill=(247,240,223,230))
    text(d,(54,26),'From your door to your daily work',38,serif=True)
    text(d,(56,85),'Zones organise labour by how often you need to visit.',24)
    # Leaders point to visible regions in the illustration, not invented measurements.
    cards=[(0,'ZONE 0','House',(300,358),(100,192)),(3.5,'ZONE 1','Daily picking',(433,458),(691,196)),(7,'ZONE 2','Main garden',(723,531),(952,406)),(10.5,'ZONE 3','Main field',(858,329),(1002,211))]
    for start,title,detail,point,box in cards:
        if t<start:continue
        p=ease((t-start)/1.1);x,y=box
        d.rounded_rectangle([x,y,x+223,y+78],radius=12,fill=(247,240,223,242),outline=INK,width=2)
        text(d,(x+14,y+10),title,17,fill=GREEN)
        text(d,(x+14,y+37),detail,24)
        a=(x+111,y+78);b=(a[0]+(point[0]-a[0])*p,a[1]+(point[1]-a[1])*p)
        arrow(d,a,b,INK,4)
        if p>.9:d.ellipse([point[0]-8,point[1]-8,point[0]+8,point[1]+8],fill=GOLD,outline=INK,width=2)
    d.rectangle([0,666,W,H],fill=(247,240,223,240))
    text(d,(44,684),'05  /  Painted illustration + animated teaching layer',17)
    text(d,(1235,684),'Imaginary plot · not to scale',16,anchor='ra')
    return Image.alpha_composite(im.convert('RGBA'),layer).convert('RGB')

def render(name, fn, seconds):
    out=ROOT/(name+'.mp4')
    cmd=['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-crf','20','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(out)]
    p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    for f in range(int(seconds*FPS)):
        image=fn(f/FPS)
        if f in [int(seconds*FPS*.12),int(seconds*FPS*.5),int(seconds*FPS*.85)]:image.save(ROOT/'previews'/f'{Path(name).name}-{f:04}.jpg',quality=90)
        p.stdin.write(image.tobytes())
    p.stdin.close()
    if p.wait(): raise RuntimeError(name)
    print(out,flush=True)

def motion_svg():
    svg='''<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
    <rect width="1920" height="1080" fill="#f7f0df"/>
    <text x="100" y="100" font-family="Georgia" font-size="58" fill="#23392e">Sectors arrive from outside</text>
    <text x="100" y="155" font-family="Arial" font-size="30" fill="#647768">Sun, wind, rain, flood and fire cross your boundary.</text>
    <rect x="620" y="320" width="680" height="520" rx="38" fill="#dbe6ce" stroke="#2f684c" stroke-width="5"/>
    <path d="M840 520 L960 430 L1080 520 Z" fill="#b96343"/>
    <rect x="860" y="520" width="200" height="155" fill="#ecd4a0" stroke="#23392e" stroke-width="5"/>
    <rect x="945" y="590" width="40" height="85" fill="#23392e"/>
    <path d="M1130 690 L1210 690 M1130 720 L1210 720 M1130 750 L1210 750" stroke="#4e835a" stroke-width="17"/>
    <text x="100" y="1000" font-family="Arial" font-size="25" fill="#647768">IMBEWUFIELD  /  04  /  APPLE MOTION EXPERIMENT</text>
    <text x="1360" y="1000" font-family="Arial" font-size="25" fill="#647768">Concept diagram · not to scale</text>
    </svg>'''
    (ROOT/'sources/motion-base.svg').write_text(svg)
    arrows=[('wind','#6e8e76','M230 450 L650 510','620,486 650,510 613,524',230,400,'WIND'),('rain','#5596ad','M1640 350 L1280 470','1307,440 1280,470 1321,475',1550,300,'RAIN'),('sun','#d5a74a','M960 220 L960 375','940,344 960,375 980,344',930,206,'SUN'),('flood','#5596ad','M1660 750 L1290 700','1325,683 1290,700 1320,722',1520,810,'FLOOD'),('fire','#b96343','M230 790 L640 730','609,715 640,730 615,752',230,850,'FIRE')]
    for name,c,path,head,x,y,label in arrows:
        s=f'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><path d="{path}" fill="none" stroke="{c}" stroke-width="14"/><polygon points="{head}" fill="{c}"/><text x="{x}" y="{y}" font-family="Arial" font-size="42" fill="{c}">{label}</text></svg>'
        (ROOT/f'sources/motion-{name}.svg').write_text(s)

if __name__=='__main__':
    import sys
    motion_svg()
    if '--svg-only' not in sys.argv:
        render('01-zones-paper',zones,20)
        render('02-sectors-chalkboard',sectors,18)
        render('05-zones-painted',painted,18)
