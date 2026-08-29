#!/usr/bin/env python3
"""Measure a plant-art PNG against the hard rules in PLANT-ART-BRIEF-CLIMATE-ZONES.md.
Usage: python3 check-plant-art.py <file.png> [--view topdown|front]
Exit 0 = PASS, 1 = FAIL. Prints one line per rule."""
import sys, os
from PIL import Image

def main():
    path = sys.argv[1]
    view = 'topdown'
    if '--view' in sys.argv:
        view = sys.argv[sys.argv.index('--view') + 1]
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    px = im.load()
    fails = []

    def rule(ok, name, detail):
        print(f"{'PASS' if ok else 'FAIL'}  {name}: {detail}")
        if not ok: fails.append(name)

    rule(w == h, 'square', f'{w}x{h}')

    corners = [px[0,0][3], px[w-1,0][3], px[0,h-1][3], px[w-1,h-1][3]]
    rule(max(corners) <= 2, 'corner-alpha-0', f'{corners}')

    step = max(1, w // 300)
    pts = [(x,y) for y in range(0,h,step) for x in range(0,w,step)]
    clear = sum(1 for x,y in pts if px[x,y][3] < 16)
    pct = 100.0*clear/len(pts)
    rule(pct > 5, 'genuine-alpha', f'{pct:.1f}% clear (checkerboard bake would be ~0%)')

    def inset(scan):
        for i,(x,y) in enumerate(scan):
            if px[x,y][3] > 32: return i
        return 10**6
    mh, mw = h//2, w//2
    ins = {
      'left':   inset([(x,mh) for x in range(w)]),
      'right':  inset([(w-1-x,mh) for x in range(w)]),
      'top':    inset([(mw,y) for y in range(h)]),
      'bottom': inset([(mw,h-1-y) for y in range(h)]),
    }
    if view == 'topdown':
        limit = max(2, int(w*0.03))
        rule(max(ins.values()) <= limit, 'foliage-reaches-frame',
             f'insets {ins} (limit {limit}px = 3% of {w})')
        cx, cy, R = w/2.0, h/2.0, w/2.0
        band = [(x,y) for x,y in pts if 0.8*R <= (((x-cx)**2+(y-cy)**2)**0.5) <= R and px[x,y][3] > 32]
        if band:
            brown = sum(1 for x,y in band
                        if px[x,y][0] > px[x,y][1] > px[x,y][2] and px[x,y][0]-px[x,y][2] > 25)
            bp = 100.0*brown/len(band)
            rule(bp < 45, 'outer-band-not-soil',
                 f'{bp:.1f}% brown in outer band (56-70% sank the first set; bark is OK, soil is not)')
    else:
        limit = max(2, int(w*0.03))
        rule(max(ins.values()) <= limit or min(ins.values()) <= limit,
             'subject-fills-frame', f'insets {ins} (limit {limit}px)')

    mb = os.path.getsize(path)/1048576.0
    cap = 0.25 if view == 'topdown' else 0.06
    rule(mb <= cap, 'file-size', f'{mb:.2f} MB (cap {cap} MB — downsize before delivery)')

    print('RESULT:', 'PASS' if not fails else 'FAIL (' + ', '.join(fails) + ')')
    sys.exit(0 if not fails else 1)

main()
