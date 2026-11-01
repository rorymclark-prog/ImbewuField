"""Author editable Motion image layers and native transform/opacity keyframes."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import xml.etree.ElementTree as E,copy,math,shutil
OUT=Path(__file__).resolve().parent
W,H=1920,1080
def text(d,xy,s,size=36,fill='white'):
    d.text(xy,s,font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',size),fill=fill)
def arrow(d,points,color,width=5):
    d.line(points,fill=color,width=width,joint='curve');a,b=points[-2:];ang=math.atan2(b[1]-a[1],b[0]-a[0]);r=23
    d.polygon([b,(b[0]-r*math.cos(ang-.4),b[1]-r*math.sin(ang-.4)),(b[0]-r*math.cos(ang+.4),b[1]-r*math.sin(ang+.4))],fill=color)
def assets():
    im=Image.new('RGBA',(W,H));p=im.load()
    for x in range(W):
        for y in range(300):p[x,y]=(7,19,16,int(166*(1-y/300)))
    d=ImageDraw.Draw(im);text(d,(92,62),'IMBEWUFIELD  /  SECTORS',24,'#e6d5ae');text(d,(88,105),'Read what arrives on your land.',58)
    text(d,(92,1010),'APPLE MOTION  ·  CINEMATIC STYLE TRIAL',23,'#f5ead5')
    text(d,(1190,1010),'Imaginary plot · concept directions only',21,'#f5ead5')
    im.save(OUT/'title-overlay.png')
    for name,c in [('wind','#e2e8dd'),('rain','#83bfd0'),('sun','#edc56e')]:
        im=Image.new('RGBA',(W,H));d=ImageDraw.Draw(im)
        if name=='wind':
            for k in range(3):
                pts=[(x,500+k*35+40*math.sin(x/260)) for x in range(60,785,10)]
                arrow(d,pts,c,4)
            text(d,(110,395),'WIND',30,c)
        elif name=='rain':
            for k in range(4):arrow(d,[(1770+k*15,410+k*27),(1570+k*15,515+k*27),(1330+k*15,590+k*27)],c,4)
            text(d,(1650,335),'RAIN',30,c)
        else:
            for k in range(3):arrow(d,[(1700+k*40,170),(1580+k*40,265),(1490+k*40,350)],c,4)
            text(d,(1610,110),'SUN',30,c)
        im.save(OUT/f'{name}-overlay.png')
def param(parent,name,id,flags='8589938704',**attrs):return E.SubElement(parent,'parameter',name=name,id=str(id),flags=flags,**{k:str(v) for k,v in attrs.items()})
def animated(parent,name,id,keys,default=0):
    p=param(parent,name,id,'8589936640')
    c=E.SubElement(p,'curve',type='1',default=str(default),value=str(keys[0][1]));E.SubElement(c,'numberOfKeypoints').text=str(len(keys))
    for sec,val in keys:
        k=E.SubElement(c,'keypoint',interpolation='1',flags='0');E.SubElement(k,'time').text=f'{round(sec*24)} 24 1 0';E.SubElement(k,'value').text=str(val)
        for n,v in [('inputTangentTime',0),('inputTangentValue',0),('outputTangentTime',0),('outputTangentValue',0)]:E.SubElement(k,n).text=str(v)
    return p
def author():
    assets()
    template=Path('/Applications/Motion Creator Studio.app/Contents/Resources/Templates.localized/Compositions.localized/Stickers.localized/Heart - Large.localized/Heart - Large.motn')
    tree=E.parse(template);root=tree.getroot();root.set('version','5.15');root.find('displayversion').text='6.3'
    scene=root.find('scene');settings=scene.find('sceneSettings')
    for k,v in {'width':1920,'height':1080,'duration':360,'frameRate':24,'NTSC':0}.items():settings.find(k).text=str(v)
    settings.find('backgroundColor').attrib.update(red='0',green='0',blue='0',alpha='1')
    for tag in ['timeRange','playRange']:scene.find(tag).set('duration','15 1 1 0')
    scene.find('currentFrame').text='8 1 1 0'
    oldgroup=scene.find('layer');imageTemplate=copy.deepcopy(oldgroup.find('scenenode'));footTemplate=copy.deepcopy(scene.find('footage'))
    scene.remove(oldgroup)
    for el in list(scene.findall('footage')):scene.remove(el)
    group=E.SubElement(scene,'layer',name='Cinematic sector composition',id='1999778368')
    E.SubElement(group,'aspectRatio').text='1';E.SubElement(group,'flags').text='0';E.SubElement(group,'timing',attrib={'in':'0 1 1 0','out':'359 24 1 0','offset':'0 1 1 0'});E.SubElement(group,'foldFlags').text='0';E.SubElement(group,'baseFlags').text='524304'
    param(group,'Properties',1);param(group,'Object',2)
    specs=[('Cinematic farm plate','cinematic-farm.png',0),('Editorial title','title-overlay.png',.3),('Wind arriving','wind-overlay.png',2),('Rain arriving','rain-overlay.png',6),('Sun arriving','sun-overlay.png',10)]
    for i,(name,file,start) in enumerate(specs):
        node=copy.deepcopy(imageTemplate);node.set('name',name);node.set('id',str(100100+i));group.insert(0,node)
        node.find('timing').attrib.update({'in':'0 1 1 0','out':'359 24 1 0','offset':'0 1 1 0'})
        props=node.find("parameter[@name='Properties']")
        props.find("parameter[@name='Media']/parameter[@id='300']").set('value',str(200100+i))
        props.find("parameter[@name='Media']/parameter[@id='300']").set('default',str(200100+i))
        trans=param(props,'Transform',100)
        scale=param(trans,'Scale',105)
        size=Image.open(OUT/file).size
        base=max(W/size[0],H/size[1])
        for axis,idx in [('X',1),('Y',2)]:
            if i==0:animated(scale,axis,idx,[(0,base),(15,base*1.035)],default=1)
            else:param(scale,axis,idx,'8606711824',default=1,value=1)
        if i>=2:
            position=param(trans,'Position',101)
            animated(position,'X',1,[(0,-70 if i==2 else 70),(start,-70 if i==2 else 70),(start+1.8,0)],default=0)
        blend=param(props,'Blending',200)
        if i:animated(blend,'Opacity',202,[(0,0),(max(0,start),0),(start+1.2,1),(15,1)],default=1)
        obj=node.find("parameter[@name='Object']")
        obj.find("parameter[@name='Width']").set('value',str(size[0]));obj.find("parameter[@name='Height']").set('value',str(size[1]))
        footage=copy.deepcopy(footTemplate);footage.set('id',str(300100+i));clip=footage.find('clip');clip.set('id',str(200100+i));clip.set('name',name)
        clip.find('relativeURL').text=file
        clip.find('missingWidth').text=str(size[0]);clip.find('missingHeight').text=str(size[1]);clip.find('creationDuration').text='0'
        for p in clip.findall('.//parameter'):
            if p.get('name') in ['Fixed Width']:p.set('value',str(size[0]))
            if p.get('name') in ['Fixed Height']:p.set('value',str(size[1]))
        scene.append(footage)
    for timing in scene.findall('.//timing'):
        if timing.get('out','').startswith('-'):timing.set('out','-1 24 1 0')
    p=OUT/'Cinematic-Sectors-Apple-Motion.motn'
    E.indent(tree,space='\t');raw=E.tostring(root,encoding='unicode')
    p.write_text('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE ozxmlscene>\n'+raw)
    target=Path('/Users/roryclark/Downloads/ImbewuMotionCinematic');target.mkdir(exist_ok=True)
    for f in [p,OUT/'cinematic-farm.png',OUT/'title-overlay.png',OUT/'wind-overlay.png',OUT/'rain-overlay.png',OUT/'sun-overlay.png']:shutil.copy2(f,target/f.name)
    print(p)
if __name__=='__main__':author()
