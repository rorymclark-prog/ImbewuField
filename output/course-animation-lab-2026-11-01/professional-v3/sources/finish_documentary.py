"""Documentary edit + restrained, registered native Apple Motion graphics."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import sys,subprocess,xml.etree.ElementTree as E,copy,shutil,json
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'sources';LAB=ROOT.parent;REPO=LAB.parents[1]
sys.path.insert(0,str(LAB/'cinematic-v2/sources'))
from author_motion import param,animated
W,H=1920,1080
FONT='/System/Library/Fonts/AvenirNext.ttc'
if not Path(FONT).exists():FONT='/System/Library/Fonts/Supplemental/Arial.ttf'
def text(d,xy,s,size=40,fill='white'):d.text(xy,s,font=ImageFont.truetype(FONT,size),fill=fill,stroke_width=1,stroke_fill=(0,0,0,70))
def layer(file,draw):
    im=Image.new('RGBA',(W,H));draw(ImageDraw.Draw(im));im.save(OUT/file)
def gradient(d,start=770):
    for y in range(start,H):d.line([(0,y),(W,y)],fill=(7,16,12,int(170*(y-start)/(H-start))))
def assets():
    def opener(d):
        gradient(d,730);d.line([(112,858),(166,858)],fill='#e1c28a',width=3)
        text(d,(112,887),'Zones plan your labour.',61)
        text(d,(114,978),'IMBEWUFIELD',21,'#e5d7bc')
    layer('opening.png',opener)
    def labels(d):
        # These are registered against source frame 96, held while the route is explained.
        d.ellipse([898,670,926,698],outline='#ecd9a9',width=3)
        d.line([(912,670),(845,612),(676,612)],fill='#fff1d7',width=2)
        text(d,(675,555),'Kitchen door',34)
        d.ellipse([1081,833,1109,861],outline='#ecd9a9',width=3)
        d.line([(1109,847),(1220,847),(1283,816)],fill='#fff1d7',width=2)
        text(d,(1293,774),'Daily garden',34)
    layer('registered-labels.png',labels)
    pts=[(912,699),(911,716),(920,739),(943,761),(971,784),(1005,805),(1042,824),(1080,841)]
    for i in range(len(pts)-1):
        layer(f'route-{i:02}.png',lambda d,i=i:d.line(pts[i:i+2],fill='#f3d69b',width=5))
    def near(d):
        gradient(d,850);text(d,(112,951),'Daily work. Close to the door.',48)
    layer('takeaway.png',near)
    def end(d):
        gradient(d,810);text(d,(112,912),'Stand at your kitchen door.',51)
        text(d,(114,1000),'What can you reach without thinking about it?',30,'#f0e5d1')
    layer('question.png',end)
    def disclosure(d):text(d,(1320,44),'AI-generated illustrative scene',21,'#f1e6d2')
    layer('disclosure.png',disclosure)
def edit_source():
    vf='[0:v]split=4[a0][b0][c0][d0];[a0]trim=end_frame=96,setpts=PTS-STARTPTS[a];[b0]trim=start_frame=96:end_frame=97,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=8,trim=end_frame=192[b];[c0]trim=start_frame=96,setpts=PTS-STARTPTS[c];[d0]trim=start_frame=189:end_frame=190,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=9,trim=end_frame=194[d];[a][b][c][d]concat=n=4:v=1:a=0,fps=24[v]'
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(OUT/'flow-documentary-original.mp4'),'-filter_complex',vf,'-map','[v]','-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'documentary-picture-edit.mp4')],check=True)
def native_project():
    tree=E.parse(LAB/'cinematic-v2/sources/Cinematic-Sectors-Apple-Motion.motn');root=tree.getroot();scene=root.find('scene');group=scene.find('layer');nodeTemplate=copy.deepcopy(group.find('scenenode'));footTemplate=copy.deepcopy(scene.find('footage'))
    for node in list(group.findall('scenenode')):group.remove(node)
    for f in list(scene.findall('footage')):scene.remove(f)
    scene.find('sceneSettings/duration').text='576';scene.find('currentFrame').text='8 1 1 0'
    for tag in ['timeRange','playRange']:scene.find(tag).set('duration','24 1 1 0')
    group.find('timing').set('out','575 24 1 0');group.set('name','Zones plan your labour — documentary pilot')
    specs=[('Documentary picture edit','documentary-picture-edit.mp4',0,24),('Opening','opening.png',.4,3.9),('Source disclosure','disclosure.png',.2,24),('Anchored labels','registered-labels.png',5,11.8)]
    specs += [(f'Walk segment {i+1}',f'route-{i:02}.png',6.2+i*.27,11.8) for i in range(7)]
    specs += [('Takeaway','takeaway.png',13,17.2),('Reflection','question.png',19.2,24)]
    for i,(name,file,start,end) in enumerate(specs):
        video=file.endswith('.mp4');size=(1280,720) if video else (W,H)
        node=copy.deepcopy(nodeTemplate);node.set('name',name);node.set('id',str(700100+i));group.insert(0,node)
        node.find('timing').attrib.update({'in':'0 1 1 0','out':'575 24 1 0','offset':'0 1 1 0'})
        props=node.find("parameter[@name='Properties']");media=props.find("parameter[@name='Media']/parameter[@id='300']");media.set('value',str(800100+i));media.set('default',str(800100+i))
        for p in list(props):
            if p.get('name') in ['Transform','Blending']:props.remove(p)
        if video:
            # Still-image nodes pin frame 1. A movie needs an explicit frame-time
            # curve; otherwise a green export silently turns the film into a photo.
            for tag,idx,flags in [('Retime Value',304,'8590066066'),('Retime Value Cache',319,'8590065810')]:
                old=props.find(f"parameter[@id='{idx}']")
                if old is not None:props.remove(old)
                p=param(props,tag,idx,flags)
                c0=E.SubElement(p,'curve',type='1',default='1',value='1',round='0',retimingExtrapolation='1')
                E.SubElement(c0,'numberOfKeypoints').text='2'
                E.SubElement(c0,'postExtrapolation').text='1'
                for t,v in [('0 24 1 0','1'),('575 24 1 0','576')]:
                    k=E.SubElement(c0,'keypoint',interpolation='1',flags='0');E.SubElement(k,'time').text=t;E.SubElement(k,'value').text=v
            param(props,'Duration Cache',320,'8589934610',default=0,value=576)
        tr=param(props,'Transform',100);sc=param(tr,'Scale',105)
        for axis,idx in [('X',1),('Y',2)]:param(sc,axis,idx,'8606711824',default=1,value=1.5 if video else 1)
        if not video:
            blending=param(props,'Blending',200)
            keys=[(0,0),(start,0),(start+.45,1)]
            if end<24:keys.extend([(end-.4,1),(end,0),(24,0)])
            else:keys.append((24,1))
            animated(blending,'Opacity',202,keys,default=1)
        obj=node.find("parameter[@name='Object']");obj.find("parameter[@name='Width']").set('value',str(size[0]));obj.find("parameter[@name='Height']").set('value',str(size[1]))
        f=copy.deepcopy(footTemplate);f.set('id',str(900100+i));c=f.find('clip');c.set('id',str(800100+i));c.set('name',name);c.find('relativeURL').text=file;c.find('missingWidth').text=str(size[0]);c.find('missingHeight').text=str(size[1]);c.find('missingDuration').text='24' if video else '0.0416666667';c.find('creationDuration').text='575' if video else '0'
        for p in c.findall('.//parameter'):
            if p.get('name')=='Fixed Width':p.set('value',str(size[0]))
            if p.get('name')=='Fixed Height':p.set('value',str(size[1]))
            if p.get('name')=='Frame Rate':p.set('value','24')
        if video:
            c.find('timing').set('out','575 24 1 0');f.find('timing').set('out','575 24 1 0');f.find('baseFlags').text='524368'
            param(c.find("parameter[@name='Object']"),'Missing Is Still',128,'8589934610',default=0,value=0)
        scene.append(f)
    p=OUT/'Professional-Study-Apple-Motion.motn';E.indent(tree,space='\t');p.write_text('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE ozxmlscene>\n'+E.tostring(root,encoding='unicode'))
    dst=Path('/Users/roryclark/Downloads/ImbewuProfessionalStudy');dst.mkdir(exist_ok=True)
    shutil.copy2(p,dst/p.name)
    for _,file,_,_ in specs:shutil.copy2(OUT/file,dst/file)
    return dst/p.name
def submit(p):
    setting='/Applications/Compressor Creator Studio.app/Contents/PlugIns/Compressor/CompressorKit.bundle/Contents/Frameworks/Compressor.framework/Versions/A/Frameworks/CompressorKit.framework/Versions/A/Resources/Settings/EFBWebSharing.setting'
    subprocess.run(['/Applications/Compressor Creator Studio.app/Contents/MacOS/Compressor','-batchname','Imbewu professional study pilot — moving picture','-jobpath',str(p),'-settingpath',setting,'-locationpath',str(ROOT/'apple-motion-native-master-r2.mov'),'-outputformat','json'],check=True)
def audio_finish():
    # Reuse the registered course recording without rewriting or regenerating it.
    audio=REPO/'public/course-audio/intro-permaculture/en/slide-17.mp3'
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(ROOT/'apple-motion-native-master-r2.mov'),'-i',str(audio),'-filter_complex','[1:a]adelay=800|800,apad[a]','-map','0:v:0','-map','[a]','-t','24','-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',str(ROOT/'professional-study-pilot.mp4')],check=True)
if __name__=='__main__':
    if '--audio-finish' in sys.argv:audio_finish()
    else:
        assets();edit_source();submit(native_project())
