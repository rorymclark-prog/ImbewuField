"""Native Blender clay diorama: zones concern frequency, not measured distance."""
import bpy, math, random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
random.seed(17)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
sc=bpy.context.scene
sc.render.engine='BLENDER_EEVEE'
sc.render.resolution_x=1280;sc.render.resolution_y=720;sc.render.resolution_percentage=75
sc.render.fps=12;sc.frame_start=1;sc.frame_end=144
sc.render.image_settings.file_format='PNG';sc.render.film_transparent=False
sc.world.color=(.65,.65,.65)
sc.render.image_settings.color_mode='RGB'
sc.view_settings.view_transform='Standard'
def mat(name,c):
    m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.85
    return m
paper=mat('Warm paper',(.88,.84,.73));soil=mat('Terracotta',(.49,.28,.14));wall=mat('Ochre walls',(.88,.66,.31));roof=mat('Roof',(.58,.20,.12));ink=mat('Door',(.10,.21,.15));leaf=mat('Generic canopy',(.17,.35,.19));stem=mat('Trunk',(.33,.21,.12))
colors=[(.83,.86,.69),(.68,.77,.50),(.52,.68,.36),(.35,.56,.29),(.22,.42,.24)]
greens=[mat('Zone '+str(5-i),c) for i,c in enumerate(colors)]
def cube(name,loc,scale,m,bevel=.08):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
    if bevel:mod=o.modifiers.new('Soft clay edges','BEVEL');mod.width=bevel;mod.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o
cube('Paper ground',(0,0,-.55),(200,200,.2),paper)
cube('Plot plinth',(0,0,-.28),(12,10,.55),soil,.22)
for i,r in enumerate([5.2,4.35,3.5,2.65,1.8]):
    bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=r,depth=.09,location=(0,0,.04+i*.09));o=bpy.context.object;o.name='Zone '+str(5-i);o.scale.y=.77;o.data.materials.append(greens[i])
    z=o.location.z
    o.location.z=z-.65;o.keyframe_insert(data_path='location',frame=1+i*10)
    o.location.z=z;o.keyframe_insert(data_path='location',frame=20+i*10)
cube('House walls',(-.2,0,.82),(1.4,1.25,.9),wall)
verts=[(-1.0,-.75,1.23),(.6,-.75,1.23),(-.2,-.75,1.95),(-1,.75,1.23),(.6,.75,1.23),(-.2,.75,1.95)]
mesh=bpy.data.meshes.new('Roof mesh');mesh.from_pydata(verts,[],[(0,1,2),(3,5,4),(0,3,4,1),(0,2,5,3),(1,4,5,2)]);mesh.update();o=bpy.data.objects.new('Pitched roof',mesh);sc.collection.objects.link(o);o.data.materials.append(roof)
cube('Door',(-.2,-.636,.69),(.32,.035,.64),ink,.02)
for x,y in [(1,-.7),(1.5,-.7),(2.0,-.7),(1,-1.2),(1.5,-1.2),(2.,-1.2)]:
    cube('Garden bed',(x,y,.56),(.38,.33,.14),soil,.04)
    for dx in [-.09,.09]:cube('Generic garden foliage',(x+dx,y,.68),(.10,.24,.15),leaf,.045)
for x,y in [(-3,1),(-4,1.5),(3,2),(3.8,-1),(-2.9,-2.1),(.7,3.2)]:
    cube('Generic tree trunk',(x,y,.80),(.14,.14,.85),stem,.03)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=.52,location=(x,y,1.43));o=bpy.context.object;o.name='Generic canopy';o.scale=(1,.9,1.05);o.data.materials.append(leaf)
def label(s,loc,size=.23):
    bpy.ops.object.text_add(location=loc);o=bpy.context.object;o.name=s;o.data.body=s;o.data.size=size;o.data.align_x='CENTER';o.data.extrude=.002;o.data.materials.append(ink)
label('ZONE 1',(0,-1.04,.51),.22);label('ZONE 2',(0,-1.70,.40),.22);label('ZONE 3',(0,-2.28,.31),.22);label('ZONE 4',(0,-2.95,.22),.22);label('ZONE 5',(0,-3.60,.13),.22)
bpy.ops.object.light_add(type='AREA',location=(-3,-4,10));o=bpy.context.object;o.data.energy=1700;o.data.shape='DISK';o.data.size=9
bpy.ops.object.light_add(type='AREA',location=(5,4,8));o=bpy.context.object;o.data.energy=900;o.data.size=8
bpy.ops.object.camera_add(location=(10,-14,14));cam=bpy.context.object;sc.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=17
def aim():cam.rotation_euler=(Vector((0,0,.15))-cam.location).to_track_quat('-Z','Y').to_euler()
aim();cam.keyframe_insert(data_path='location',frame=1);cam.keyframe_insert(data_path='rotation_euler',frame=1)
cam.location=(8,-15,15);aim();cam.keyframe_insert(data_path='location',frame=144);cam.keyframe_insert(data_path='rotation_euler',frame=144)
sc.render.filepath=str(ROOT/'sources/blender-frames/frame-')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'sources/03-zones-clay.blend'))
sc.frame_set(100);sc.render.filepath=str(ROOT/'previews/blender-check.png');bpy.ops.render.render(write_still=True)
sc.render.filepath=str(ROOT/'sources/blender-frames/frame-');bpy.ops.render.render(animation=True)
