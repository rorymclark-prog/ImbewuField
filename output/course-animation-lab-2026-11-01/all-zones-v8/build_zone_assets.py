"""Export editable teaching annotations without modifying the photographic plate.

These screen-space areas describe a fictional example, never saved farm geometry.
The diagram fragment owns the outlines; export reads those same polygons.
"""
from pathlib import Path
from PIL import Image, ImageDraw
from io import BytesIO
from xml.sax.saxutils import escape
import base64, json, re, subprocess, sys

OUT=Path(__file__).resolve().parent
FRAGMENT=OUT/'courtyard-zones.html'
W,H=1672,941
NAMES=['House','Picking garden','Main garden + chicken run','Main field','Semi-wild','Wild']
DETAILS=['Zone 0 is the house.',
         'In this example, Zone 1 is near the house and holds what you pick often — herbs, salad greens.',
         'Zone 2 is the main garden and chicken run, visited once or twice a day.',
         'Zone 3 is the main field, visited weekly.',
         'Zone 4 is semi-wild — fruit trees and fodder needing occasional attention.',
         'Zone 5 is left wild.']
COLOURS=['#e68d82','#48c6b0','#91c264','#efba63','#ba9ade','#7abedf']
MARKERS=[(1204,555),(1104,772),(401,640),(385,188),(1003,282),(1471,132)]

def build():
    source=FRAGMENT.read_text()
    entries=re.findall(r'<polygon data-area="(\d)" points="([^"]+)"',source)
    assert [int(i) for i,_ in entries]==list(range(6))
    body=(OUT.parents[2]/'lib/course-modules.ts').read_text()
    for sentence in DETAILS: assert sentence in body, sentence
    photo=Image.open(OUT/'holding-clean.png');assert photo.size==(W,H)
    buf=BytesIO();photo.save(buf,'JPEG',quality=90,optimize=True)
    uri='data:image/jpeg;base64,'+base64.b64encode(buf.getvalue()).decode()
    zones=[]
    for idx,points in entries:
        i=int(idx);xy=[tuple(map(int,p.split(','))) for p in points.split()]
        assert all(0<=x<=W and 0<=y<=H for x,y in xy)
        zones.append({'zone':i,'name':NAMES[i],'course_sentence':DETAILS[i],
                      'colour':COLOURS[i],'polygon':xy,'marker':MARKERS[i]})
        layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer)
        c=tuple(bytes.fromhex(COLOURS[i][1:]))
        d.polygon(xy,fill=c+(55,));d.line(xy+[xy[0]],fill=c+(245,),width=3,joint='curve')
        layer.save(OUT/f'zone-{i}-overlay.png')
        # Editor-friendly vector overlay has no photographic pixels in it.
        (OUT/f'zone-{i}-overlay.svg').write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
            f'<polygon points="{points}" fill="{COLOURS[i]}" fill-opacity=".22" stroke="{COLOURS[i]}" stroke-width="3"/></svg>')
    for selected in ['all']+list(range(6)):
        parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="1125" viewBox="0 0 {W} 1125">',
               '<rect width="1672" height="1125" fill="#fbf7ef"/>',
               f'<image width="{W}" height="{H}" href="{uri}"/>']
        for z in zones:
            i=z['zone'];points=' '.join(f'{x},{y}' for x,y in z['polygon'])
            if selected=='all' or selected==i:
                parts.append(f'<polygon points="{points}" fill="{z["colour"]}" fill-opacity=".16" stroke="{z["colour"]}" stroke-width="3"/>')
                x,y=z['marker']
                parts.append(f'<circle cx="{x}" cy="{y}" r="24" fill="#fbf7ef"/><text x="{x}" y="{y+9}" text-anchor="middle" font-family="Arial" font-size="27" fill="#142b22">{i}</text>')
        for i,z in enumerate(zones):
            x=35+(i%3)*550;y=977+(i//3)*49
            parts.append(f'<circle cx="{x+15}" cy="{y-8}" r="14" fill="{z["colour"]}"/><text x="{x+15}" y="{y-2}" text-anchor="middle" font-family="Arial" font-size="17" fill="#142b22">{i}</text>')
            parts.append(f'<text x="{x+44}" y="{y}" font-family="Arial" font-size="26" fill="#142b22">{escape(z["name"])}</text>')
        parts.append('<text x="35" y="1100" font-family="Arial" font-size="23" fill="#40564b">Zones follow how often you visit · Fictional teaching layout · No survey scale</text></svg>')
        name='all-zones-map.svg' if selected=='all' else f'zone-{selected}-study.svg'
        (OUT/name).write_text(''.join(parts))
    (OUT/'zones.json').write_text(json.dumps({'image_size':[W,H],'source':'lib/course-modules.ts: zones/sectors lesson',
        'meaning':'Illustrative areas based on use/visit frequency, not mandatory rings or measured boundaries.',
        'zones':zones},indent=2)+'\n')
    print('Created overview, six study views, six transparent PNG/SVG pairs and shared geometry.')

def raster_exports():
    # Quick Look crops non-square SVG previews. Render a square artboard, then
    # trim only its empty export margin so all six zones and legend entries survive.
    for name in ['all-zones-map']+[f'zone-{i}-study' for i in range(6)]:
        source=(OUT/(name+'.svg')).read_text()
        render=OUT/(name+'-render.svg')
        render.write_text(source.replace('height="1125" viewBox="0 0 1672 1125"',
                                         'height="1672" viewBox="0 0 1672 1672"',1))
        subprocess.run(['qlmanage','-t','-s','1672','-o',str(OUT),str(render)],
                       stdout=subprocess.DEVNULL,check=True)
        thumb=OUT/(render.name+'.png');im=Image.open(thumb)
        assert im.size==(1672,1672),im.size
        im.crop((0,0,1672,1125)).save(OUT/(name+'.png'))
        thumb.unlink();render.unlink()

if __name__=='__main__':
    build()
    if '--raster' in sys.argv:raster_exports()
