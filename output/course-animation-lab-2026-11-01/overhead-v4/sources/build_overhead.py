"""Native Motion colour-zone reveal over a reference-matched fictional farm.

No measured geometry is inferred: this is a standalone editorial illustration.
The original Flow camera shot remains unmodified in the companion sequence.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import copy, json, subprocess, sys, xml.etree.ElementTree as E
import numpy as np

SRC = Path(__file__).resolve().parent
OUT = SRC.parent
LAB = OUT.parent
sys.path.insert(0, str(LAB / 'cinematic-v2/sources'))
from author_motion import param, animated

W, H, FPS, FRAMES = 1920, 1080, 24, 192
# Screen-space editorial outline around the door-side garden and its daily path.
# It is deliberately not a radius or a claim about the extent of a real property.
POLYGON = [(980,337),(1088,373),(1145,600),(1132,688),(1065,746),
           (818,750),(783,699),(785,515),(810,501),(810,432),
           (965,432),(965,347)]

def graphics():
    base = Image.open(SRC / 'same-property-overhead-clean.png')
    sx, sy = W/base.width, H/base.height
    points = [(round(x*sx), round(y*sy)) for x,y in POLYGON]
    # Author a transparent graphic asset, keeping the photographic plate intact.
    graphic = Image.new('RGBA', (W,H))
    d = ImageDraw.Draw(graphic)
    d.polygon(points, fill=(65,216,202,255))
    graphic.save(SRC / 'zone-1-transparent-overlay.png')
    border = Image.new('RGBA',(W,H)); bd=ImageDraw.Draw(border)
    bd.line(points + [points[0]],fill=(133,244,226,255),width=3,joint='curve')
    border.save(SRC / 'zone-1-border.png')
    label = Image.new('RGBA', (W,H)); d = ImageDraw.Draw(label)
    x,y = 1390,650
    d.rounded_rectangle((x,y,x+365,y+122), radius=12, fill=(12,34,30,225))
    d.line((x+22,y+27,x+22,y+95), fill=(133,244,226,255), width=4)
    font = '/System/Library/Fonts/Supplemental/Arial.ttf'
    d.text((x+43,y+17),'ZONE 1',font=ImageFont.truetype(font,24),fill='#a3f6e5')
    d.text((x+43,y+54),'Kitchen garden',font=ImageFont.truetype(font,34),fill='#ffffff')
    label.save(SRC / 'zone-1-label.png')

def project():
    tree = E.parse(LAB/'cinematic-v2/sources/Cinematic-Sectors-Apple-Motion.motn')
    root = tree.getroot(); scene = root.find('scene'); group = scene.find('layer')
    node_template = copy.deepcopy(group.find('scenenode'))
    foot_template = copy.deepcopy(scene.find('footage'))
    for node in list(group.findall('scenenode')): group.remove(node)
    for node in list(scene.findall('footage')): scene.remove(node)
    scene.find('sceneSettings/duration').text = str(FRAMES)
    scene.find('currentFrame').text = '5 1 1 0'
    for tag in ['timeRange','playRange']: scene.find(tag).set('duration','8 1 1 0')
    group.set('name','Same homestead — quiet overhead zone reveal')
    group.find('timing').set('out','191 24 1 0')
    specs = [('Overhead reconstruction','same-property-overhead-clean.png',0,1),
             ('Zone 1 translucent area','zone-1-transparent-overlay.png',2,.28),
             ('Zone 1 border','zone-1-border.png',2,.95),
             ('Zone 1 label','zone-1-label.png',2.6,1)]
    for i,(name,file,start,opacity) in enumerate(specs):
        size = Image.open(SRC/file).size
        node = copy.deepcopy(node_template); node.set('name',name);node.set('id',str(710100+i))
        group.insert(0,node)
        node.find('timing').attrib.update({'in':'0 1 1 0','out':'191 24 1 0','offset':'0 1 1 0'})
        props = node.find("parameter[@name='Properties']")
        media = props.find("parameter[@name='Media']/parameter[@id='300']")
        media.set('value',str(810100+i));media.set('default',str(810100+i))
        for p in list(props):
            if p.get('name') in ['Transform','Blending']:props.remove(p)
        tr = param(props,'Transform',100); sc = param(tr,'Scale',105)
        for axis,idx in [('X',1),('Y',2)]:
            param(sc,axis,idx,'8606711824',default=1,value=max(W/size[0],H/size[1]))
        if i:
            blend=param(props,'Blending',200)
            animated(blend,'Opacity',202,[(0,0),(start,0),(start+1,opacity),(8,opacity)],default=1)
        obj=node.find("parameter[@name='Object']")
        obj.find("parameter[@name='Width']").set('value',str(size[0]))
        obj.find("parameter[@name='Height']").set('value',str(size[1]))
        f=copy.deepcopy(foot_template);f.set('id',str(910100+i)); c=f.find('clip')
        c.set('id',str(810100+i));c.set('name',name);c.find('relativeURL').text=file
        c.find('missingWidth').text=str(size[0]);c.find('missingHeight').text=str(size[1])
        c.find('creationDuration').text='0'
        for p in c.findall('.//parameter'):
            if p.get('name')=='Fixed Width':p.set('value',str(size[0]))
            if p.get('name')=='Fixed Height':p.set('value',str(size[1]))
        scene.append(f)
    p=SRC/'Same-Property-Overhead-Zone-Apple-Motion.motn'
    E.indent(tree,space='\t')
    p.write_text('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE ozxmlscene>\n'+E.tostring(root,encoding='unicode'))
    return p

def submit(p):
    setting='/Applications/Compressor Creator Studio.app/Contents/PlugIns/Compressor/CompressorKit.bundle/Contents/Frameworks/Compressor.framework/Versions/A/Frameworks/CompressorKit.framework/Versions/A/Resources/Settings/EFBWebSharing.setting'
    r=subprocess.run(['/Applications/Compressor Creator Studio.app/Contents/MacOS/Compressor',
        '-batchname','Imbewu same-property overhead zone','-jobpath',str(p),'-settingpath',setting,
        '-locationpath',str(OUT/'native-overhead-master.mov'),'-outputformat','json'],capture_output=True,text=True,check=True)
    print(r.stdout[-2500:])

def finish():
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(OUT/'native-overhead-master.mov'),
        '-an','-c:v','libx264','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',
        str(OUT/'overhead-zone-reveal.mp4')],check=True)
    # A clear cut avoids pretending two generative viewpoints form a measured 3D move.
    subprocess.run(['ffmpeg','-v','error','-y',
        '-i',str(LAB/'professional-v3/sources/flow-documentary-original.mp4'),
        '-i',str(OUT/'overhead-zone-reveal.mp4'),'-filter_complex',
        '[0:v]scale=1920:1080,setsar=1,fps=24,setpts=PTS-STARTPTS[a];'
        '[1:v]setsar=1,fps=24,setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0[v]',
        '-map','[v]','-an','-c:v','libx264','-crf','19','-pix_fmt','yuv420p',
        '-movflags','+faststart',str(OUT/'flythrough-to-overhead-zone.mp4')],check=True)
    for sec,name in [(1,'overhead-clean.jpg'),(5,'overhead-zone-1.jpg')]:
        subprocess.run(['ffmpeg','-v','error','-y','-ss',str(sec),'-i',str(OUT/'overhead-zone-reveal.mp4'),
            '-frames:v','1','-q:v','2',str(OUT/name)],check=True)
    final=OUT/'flythrough-to-overhead-zone.mp4'
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(final)]))
    video=next(s for s in probe['streams'] if s['codec_type']=='video')
    assert video['width']==1920 and video['height']==1080
    assert int(video['nb_frames'])==382, video['nb_frames']
    subprocess.run(['ffmpeg','-v','error','-i',str(final),'-f','null','-'],check=True)
    clean=Image.open(OUT/'overhead-clean.jpg'); highlighted=Image.open(OUT/'overhead-zone-1.jpg')
    before=np.asarray(clean).astype(float); after=np.asarray(highlighted).astype(float)
    # Downsample the roof patch so lossy codec noise does not masquerade as motion.
    # A deliberately displaced patch must still fail the same registration limit.
    patch=lambda im,box:np.asarray(im.crop(box).resize((110,50))).astype(float)
    roof=patch(clean,(200,150,750,400))
    roof_difference=float(np.mean(np.abs(roof-patch(highlighted,(200,150,750,400)))))
    displaced_difference=float(np.mean(np.abs(roof-patch(highlighted,(205,150,755,400)))))
    zone_difference=float(np.mean(np.abs(before[600:800,1000:1200]-after[600:800,1000:1200])))
    assert roof_difference<2, roof_difference
    assert displaced_difference>2, displaced_difference
    assert zone_difference>10, zone_difference
    (OUT/'provenance.json').write_text(json.dumps({
        'source_video':'../professional-v3/sources/flow-documentary-original.mp4',
        'source_video_tool':'Google Flow / Veo 3.1 Fast, 720p, 190 frames at 24fps',
        'overhead_image':'Built-in imagegen, two extracted frames as references',
        'overhead_identity':'Reconstructed visual match; not an exact surveyed or 3D projection',
        'overlay':'Native Apple Motion opacity animation, Apple Compressor renderer',
        'zone':'Illustrative Zone 1 garden/door-side path footprint; not a measured boundary',
        'course_source':'lib/course-modules.ts intro-permaculture zones/sectors lesson (read only)',
        'sequence':'Original clean moving approach, cut to overhead, then one teal colour-zone fade',
        'audio':'Silent style review; no new audio',
        'checks':{'width':1920,'height':1080,'frames':382,'duration_seconds':382/24,'full_decode':'passed',
                  'roof_background_mean_pixel_difference':roof_difference,
                  'five_pixel_displacement_negative_control':displaced_difference,
                  'highlighted_garden_mean_pixel_difference':zone_difference},
        'production_app_changed':False},indent=2)+'\n')

if __name__=='__main__':
    if '--finish' in sys.argv:finish()
    else:graphics();submit(project())
