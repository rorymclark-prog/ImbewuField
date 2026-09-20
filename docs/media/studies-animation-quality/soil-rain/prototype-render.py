from pathlib import Path
import math,random,subprocess
from PIL import Image,ImageDraw,ImageFont,ImageFilter
root=Path(__file__).resolve().parents[4]
w,h,footer,fps=1600,900,160,24
src=Image.open(root/'docs/media/studies-animation-quality/soil-rain/source.png').convert('RGB').resize((w,h),Image.Resampling.LANCZOS)
rng=random.Random(927)
# The same particles hit matching horizontal positions in both panels. These are
# qualitative teaching marks, not a rainfall measurement or runoff simulation.
particles=[(rng.uniform(15,785),rng.uniform(0,1),rng.uniform(.75,1.3),rng.uniform(17,28)) for _ in range(75)]
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',64)
small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',31)
output=Path('/Users/roryclark/Downloads/ImbewuField-Animation-Quality-2026-09-20/soil-rain-prototype.mp4')
def surface(x,covered):
 return (285 if covered else 302)+.226*x

def frame(t):
 out=Image.new('RGB',(w,h+footer),'#143a2b');art=src.copy()
 overlay=Image.new('RGBA',(w,h));d=ImageDraw.Draw(overlay)
 strength=min(1,max(0,(t-1)/1.5))
 for panel in range(2):
  offset=panel*800
  for n,(x,phase,speed,length) in enumerate(particles):
   floor=surface(x,panel==1)
   cyc=(t*speed+phase)%1.65
   fall=.95; impact=cyc-fall
   if cyc<fall:
    u=cyc/fall;y=-40+(floor+40)*u
    # Thin translucent streaks keep the material in view, with a bright leading drop.
    alpha=round((80+60*(n%3)/2)*strength)
    d.line((offset+x-2,y-length,offset+x,y),fill=(202,223,229,alpha),width=2)
    d.ellipse((offset+x-1,y-2,offset+x+1,y+1),fill=(231,243,246,alpha))
   elif impact<.32:
    for k in range(4):
     direction=(-1 if k%2 else 1);v=25+11*k
     dx=direction*v*impact;dy=-70*impact+220*impact*impact
     a=round(170*(1-impact/.32)*strength)
     d.ellipse((offset+x+dx-1,floor+dy-1,offset+x+dx+1,floor+dy+1),fill=(214,228,233,a))
    if panel==0:
     for k in range(3):
      dx=(k-1)*(45+8*(n%3))*impact;dy=-52*impact+205*impact*impact
      a=round(245*(1-impact/.32)*strength)
      d.ellipse((offset+x+dx-2,floor+dy-2,offset+x+dx+2,floor+dy+2),fill=(113,72,38,a))
 art=Image.alpha_composite(art.convert('RGBA'),overlay).convert('RGB')
 out.paste(art,(0,0));d=ImageDraw.Draw(out)
 d.line((800,0,800,h),fill='#f1e6c4',width=2)
 d.text((32,h+26),'Bare soil',font=font,fill='#fffdf5');d.text((830,h+26),'Mulched soil',font=font,fill='#fffdf5')
 d.text((32,h+111),'SAME RAIN · CONCEPT ILLUSTRATION',font=small,fill='#d8dbbe')
 return out
enc=subprocess.Popen(['ffmpeg','-y','-v','error','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{w}x{h+footer}','-framerate',str(fps),'-i','-','-an','-c:v','libx264','-preset','medium','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(output)],stdin=subprocess.PIPE)
for i in range(fps*9):enc.stdin.write(frame(i/fps).tobytes())
enc.stdin.close();assert enc.wait()==0
frame(4.25).save(output.with_suffix('.jpg'),quality=94)
print(output,output.stat().st_size)
