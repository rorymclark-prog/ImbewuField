"""Blender water-material study over the reviewed photographic illustration.

Procedural magnified impact geometry, not a fluid/erosion measurement. Start with
still frames before committing to the animation. Run via blender -b -P ... -- ...
"""
import bpy, math, random, sys, argparse
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--frame',type=int,default=76);p.add_argument('--samples',type=int,default=64);p.add_argument('--animation',action='store_true');p.add_argument('--gpu',action='store_true');p.add_argument('--width',type=int,default=1600);p.add_argument('--terrain',action='store_true');p.add_argument('--setup-only',action='store_true');p.add_argument('--focus',choices=['both','bare','mulch'],default='both')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);a.out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True
try:
    if not a.gpu: raise RuntimeError('CPU requested; Metal shader compilation crashed on this host')
    pref=bpy.context.preferences.addons['cycles'].preferences;pref.compute_device_type='METAL';pref.get_devices()
    for device in pref.devices:device.use=device.type=='METAL'
    if any(d.type=='METAL' for d in pref.devices):scene.cycles.device='GPU'
except Exception as e:print('CPU render:',e)
scene.render.resolution_x=a.width;scene.render.resolution_y=round(a.width*900/1600);scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.fps=24;scene.frame_start=1;scene.frame_end=336
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.64,.72,.77,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
camdir=Vector((0,-10,7)).normalized();up=Vector((0,camdir.z,-camdir.y));right=Vector((1,0,0))
bpy.ops.object.camera_add(location=camdir*18);cam=bpy.context.object;cam.rotation_euler=(-camdir).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=16;scene.camera=cam

def mesh(name,verts,faces,material):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob)
    ob.data.materials.append(material)
    for poly in data.polygons:poly.use_smooth=True
    return ob

photo=bpy.data.materials.new('Reference clean plate');photo.use_nodes=True;n=photo.node_tree.nodes;n.clear();img=n.new('ShaderNodeTexImage');img.image=bpy.data.images.load(str(ROOT/'source.png'));img.image.pack();em=n.new('ShaderNodeEmission');photo.node_tree.links.new(img.outputs['Color'],em.inputs['Color']);out=n.new('ShaderNodeOutputMaterial');photo.node_tree.links.new(em.outputs[0],out.inputs['Surface'])
back=-camdir*5;verts=[tuple(back+right*x+up*y) for x,y in [(-8,-4.5),(8,-4.5),(8,4.5),(-8,4.5)]]
plate=mesh('Stable background illustration',verts,[(0,1,2,3)],photo);uv=plate.data.uv_layers.new()
for i,co in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[i].uv=co
water=bpy.data.materials.new('Water — clear, refractive');water.use_nodes=True;bs=water.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.93,.985,1,1);bs.inputs['Roughness'].default_value=.045;bs.inputs['IOR'].default_value=1.333;bs.inputs['Transmission Weight'].default_value=1
soilmat=bpy.data.materials.new('Detached soil grains');soilmat.use_nodes=True;sn=soilmat.node_tree.nodes;sb=sn.get('Principled BSDF');sb.inputs['Base Color'].default_value=(.10,.040,.012,1);sb.inputs['Roughness'].default_value=.91
noise=sn.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=17;noise.inputs['Detail'].default_value=4;bump=sn.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.65;bump.inputs['Distance'].default_value=.03;soilmat.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);soilmat.node_tree.links.new(bump.outputs['Normal'],sb.inputs['Normal'])
for pos,power,size in [((-5,-6,7),800,5),((5,1,6),650,4),((0,3,4),300,3)]:
    bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()

origins=[right*((428-800)/100)+up*((450-482)/100),right*((1155-800)/100)+up*((450-350)/100)]
if a.focus!='both':
    target=origins[0 if a.focus=='bare' else 1]+up*.75
    cam.location=camdir*18+target;cam.data.ortho_scale=7.8

def ball(name,mat,r=1,ico=False):
    if ico:bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=r)
    else:bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,radius=r)
    ob=bpy.context.object;ob.name=name;ob.data.materials.append(mat)
    for face in ob.data.polygons:face.use_smooth=True
    return ob

rng=random.Random(927)
sprayparams=[(2*math.pi*k/13,rng.uniform(.8,1.15),rng.uniform(.75,1.1),rng.uniform(.035,.065)) for k in range(13)]
grainparams=[(rng.uniform(0,2*math.pi),rng.uniform(.6,1.2),rng.uniform(.035,.075)) for _ in range(12)]
objects=[]
for side,origin in enumerate(origins):
    drop=ball(f'Drop {side}',water,.24)
    count=160
    # Closed thin annular liquid sheet, four rings from outer base to inner base.
    crown=mesh(f'Water crown {side}',[(0,0,0)]*(count*16),[(ring*count+k,ring*count+(k+1)%count,((ring+1)%16)*count+(k+1)%count,((ring+1)%16)*count+k) for ring in range(16) for k in range(count)],water)
    crown.location=origin
    spray=[ball(f'Water bead {side}-{k}',water,r) for k,(_,_,_,r) in enumerate(sprayparams)]
    grains=[ball(f'Soil grain {k}',soilmat,r,True) for k,(_,_,r) in enumerate(grainparams)] if side==0 else []
    puddle=ball(f'Surface liquid {side}',water,1)
    puddle.location=origin+Vector((0,0,.008))
    objects.append((drop,crown,spray,grains,puddle))

def show(ob,visible):ob.hide_render=not visible

def update(scene):
    t=scene.frame_current/24;cycle=(t-1.4)%4.5;u=cycle-1.45
    for side,(drop,crown,spray,grains,puddle) in enumerate(objects):
        origin=origins[side];fall=t>=1.4 and cycle<1.45
        show(drop,fall)
        if fall:
            f=cycle/1.45;drop.location=origin+Vector((0,0,.24+4.5*(1-f*f)));drop.scale=(1.04,1.04,.94)
        active=t>=1.4 and 0<=u<.88;show(crown,active)
        if active:
            q=u/.88;radius=.10+1.10*q;height=.29*math.sin(math.pi*q);thickness=.009*(1-.6*q)
            for k in range(160):
                theta=k/160*2*math.pi
                wave=.30+.70*max(0,math.sin(theta*7+.4)+.30*math.sin(theta*11+.7))**2/1.69
                rad=radius*(1+.06*math.sin(theta*5+.9));top=height*wave+.025
                for ring in range(16):
                    v=ring/7 if ring<8 else (15-ring)/7
                    r=rad*(.56+.52*v*v)-(thickness if ring>=8 else 0)
                    z=.01+top*v
                    crown.data.vertices[ring*160+k].co=(r*math.cos(theta),r*math.sin(theta),z)
            crown.data.update()
        visible=t>=1.4 and 0<=u<2.2
        show(puddle,visible)
        if visible:
            r=.07+.78*min(1,u/.65);puddle.scale=(r,r,.014*max(.05,1-u/2.2))
        for ob,(theta,speed,vert,r) in zip(spray,sprayparams):
            age=u-.12;z=.06+1.4*vert*age-1.1*age*age;visible=t>=1.4 and 0<age<1.8 and z>0
            show(ob,visible)
            if visible:ob.location=origin+Vector((math.cos(theta)*speed*age,math.sin(theta)*speed*age,z));ob.scale=(1,1,1.25)
        for ob,(theta,speed,r) in zip(grains,grainparams):
            age=u-.20;z=.05+1.4*speed*age-1.45*age*age;visible=t>=1.4 and 0<age<1.5 and z>0
            show(ob,visible)
            if visible:ob.location=origin+Vector((math.cos(theta)*speed*age,math.sin(theta)*speed*age,z));ob.rotation_euler=(age*2,age*3,theta);ob.scale=(1.2,.8,1)

bpy.app.handlers.frame_change_pre.clear();bpy.app.handlers.frame_change_pre.append(update)
scene.frame_set(a.frame);update(scene)
bpy.ops.wm.save_as_mainfile(filepath=str(a.out/'rain-impact.blend'))
if a.setup_only:
    pass
elif a.animation:
    scene.render.filepath=str(a.out/'frame-');bpy.ops.render.render(animation=True)
else:
    scene.render.filepath=str(a.out/f'frame-{a.frame:04}.png');bpy.ops.render.render(write_still=True)
print('Finished',scene.render.filepath)
