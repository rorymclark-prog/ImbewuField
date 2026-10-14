#!/usr/bin/env python3
"""Slowed, magnified drop impacts. Teaching marks, not calibrated soil physics.

The matched clean plate remains stable: the film must not simulate a soil-health
change, an infiltration test or a measured runoff ratio. View every candidate.
"""
from pathlib import Path
import argparse, math, random, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent
p=argparse.ArgumentParser(); p.add_argument('--out',type=Path,required=True); p.add_argument('--seconds',type=float,default=14)
a=p.parse_args(); a.out.parent.mkdir(parents=True,exist_ok=True)
W,H,FPS=1600,1100,24
art=Image.open(ROOT/'source.png').convert('RGB').resize((1600,900),Image.Resampling.LANCZOS)
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',54)
small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',32)
label=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf',54)
rng=random.Random(927)
# Deliberately paired initial drop and splash timings; no empirical ratio implied.
spray=[(2*math.pi*k/11, rng.uniform(.75,1.1),rng.uniform(.75,1.05)) for k in range(11)]
soil=[(rng.uniform(-1,1),rng.uniform(.45,1),rng.uniform(4,8)) for _ in range(12)]

def sphere(im,x,y,r,alpha=1,stretch=1):
    """Render a clear water bead with refraction, edge shading and reflected sky."""
    if r<1 or alpha<=0:return
    rw=max(2,int(r));rh=max(2,int(r*stretch));x=int(x);y=int(y)
    box=(x-rw-2,y-rh-2,x+rw+3,y+rh+3)
    if box[0]<0 or box[1]<0 or box[2]>im.width or box[3]>im.height:return
    base=np.array(im.crop(box).convert('RGB')).astype(float)
    yy,xx=np.mgrid[-rh-2:rh+3,-rw-2:rw+3]; nx=xx/rw;ny=yy/rh;rr=nx*nx+ny*ny
    mask=np.clip((1-rr)*rw,0,1)*alpha
    # Refraction samples only the current rendered ground behind this moving drop.
    fx=np.clip(np.rint(xx*.7+rw+2).astype(int),0,base.shape[1]-1)
    fy=np.clip(np.rint(yy*.7+rh+2).astype(int),0,base.shape[0]-1)
    refr=base[fy,fx]*.72+np.array([91,137,143])*.28
    edge=np.clip((rr-.60)/.4,0,1)[...,None]
    refr=refr*(1-.32*edge)
    sky=np.exp(-((nx+.28)**2/.12+(ny+.45)**2/.035))[...,None]
    rim=np.exp(-((nx-.20)**2/.36+(ny-.69)**2/.014))[...,None]
    refr=refr*(1-.75*sky)+np.array([255,255,244])*.75*sky+np.array([60,75,70])*rim
    rgb=np.clip(base*(1-mask[...,None])+refr*mask[...,None],0,255).astype('uint8')
    im.paste(Image.fromarray(rgb),box[:2])

def impact(im,t,x,y,bare):
    # A slow replay is clearly labelled; these seconds are film timing only.
    cycle=(t-1.4)%4.5
    if t<1.4:return
    if cycle<1.45:
        u=cycle/1.45
        dropy=y-380+380*u*u
        sphere(im,x,dropy,24,stretch=.93+.10*u)
        return
    u=cycle-1.45
    if u>2.5:return
    layer=Image.new('RGBA',im.size);d=ImageDraw.Draw(layer)
    alpha=max(0,1-u/2.1)
    # A crown spreads in the surface plane; clear liquid is separate from brown grains.
    if u<.78:
        q=u/.78; rx=8+82*q; ry=rx*.27;rise=48*math.sin(math.pi*q)
        top=[];bottom=[]
        for k in range(97):
            theta=k/96*2*math.pi
            spike=(.35+.65*max(0,math.sin(theta*9+.4)))*rise
            top.append((x+rx*math.cos(theta),y+ry*math.sin(theta)-spike))
            bottom.append((x+rx*.62*math.cos(theta),y+ry*.62*math.sin(theta)))
        d.polygon(top+list(reversed(bottom)),fill=(147,184,174,int(88*alpha)))
        d.line(top,fill=(244,250,236,int(205*alpha)),width=2)
        d.arc((x-rx,y-ry,x+rx,y+ry),0,180,fill=(90,122,113,int(145*alpha)),width=3)
    # A few scattered liquid beads follow visible parabolic paths back to the surface.
    for theta,speed,weight in spray:
        age=u-.13
        if age<0:continue
        vx=math.cos(theta)*94*speed
        depth=math.sin(theta)*20
        py=y-105*weight*age+73*age*age+depth*age
        ground=y+depth*age
        if py>ground:continue
        sphere(im,x+vx*age,py,4.5*(1-.2*age),alpha=min(1,alpha+.15))
    if bare:
        for k,(direction,speed,r) in enumerate(soil):
            age=u-.19
            if age<0:continue
            xx=x+direction*130*age
            yy=y-130*speed*age+98*age*age
            if yy>y+10:continue
            tone=(99+6*(k%3),61+4*(k%3),29+3*(k%3),int(255*min(1,alpha+.35)))
            d.polygon([(xx-r,yy-r*.6),(xx+r*.4,yy-r),(xx+r,yy+r*.4),(xx-r*.5,yy+r*.7)],fill=tone)
            d.line((xx-r*.6,yy-r*.5,xx+r*.3,yy-r*.8),fill=(194,146,89,int(220*alpha)),width=2)
    im.alpha_composite(layer)

def frame(t):
    im=art.copy().convert('RGBA')
    # Impact centres sit on visible ground/leaf, not the bokeh or a cutaway face.
    impact(im,t,428,482,True)
    impact(im,t,1155,350,False)
    d=ImageDraw.Draw(im)
    d.line((800,0,800,900),fill='#ece4cc',width=3)
    out=Image.new('RGBA',(W,H),'#173b2a');out.alpha_composite(im)
    d=ImageDraw.Draw(out)
    d.text((32,919),'Bare soil',font=label,fill='#fffaf0')
    d.text((830,919),'Loose mulch',font=label,fill='#fffaf0')
    d.text((32,990),'Impact can move soil grains.',font=small,fill='#e8edda')
    d.text((830,990),'Cover receives the impact.',font=small,fill='#e8edda')
    d.text((32,1050),'MAGNIFIED · SLOWED TEACHING ILLUSTRATION',font=small,fill='#d4d9bb')
    return out.convert('RGB')

enc=subprocess.Popen(['ffmpeg','-y','-v','error','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{W}x{H}','-framerate',str(FPS),'-i','-','-an','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(a.out)],stdin=subprocess.PIPE)
for i in range(round(FPS*a.seconds)):
    im=frame(i/FPS);enc.stdin.write(im.tobytes())
    if i in (60,76,84,95):im.save(a.out.parent/f'frame-{i}.jpg',quality=95)
enc.stdin.close();assert enc.wait()==0
print(a.out,a.out.stat().st_size)
