"""Bounded Mantaflow liquid proof: replace procedural crown with solved motion.

One drop, one non-absorbing impact surface. Inspect the early impact only; this
cannot substantiate infiltration/runoff rates or behaviour through an entire storm.
"""
import sys,runpy
from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
sys.argv.append('--setup-only')
ns=runpy.run_path(str(ROOT/'render-3d.py'))
a=ns['a'];scene=bpy.context.scene;origin=ns['origins'][0 if a.focus!='mulch' else 1]
bpy.app.handlers.frame_change_pre.clear()
for group in ns['objects']:
    drop,crown,spray,grains,puddle=group
    for ob in [drop,crown,*spray,*grains,puddle]:bpy.data.objects.remove(ob,do_unlink=True)

if a.terrain:
    terrain=runpy.run_path(str(ROOT/'terrain-scene.py'));origin,visible_ground=terrain['build'](scene,a.focus=='mulch')

bpy.ops.mesh.primitive_cube_add(size=1,location=origin+Vector((0,0,1.6)))
domain=bpy.context.object;domain.name='Liquid domain';domain.dimensions=(4,4,4.2)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
mod=domain.modifiers.new('Liquid domain','FLUID');mod.fluid_type='DOMAIN';ds=mod.domain_settings;ds.domain_type='LIQUID';ds.resolution_max=72;ds.cache_type='ALL';ds.cache_frame_start=1;ds.cache_frame_end=64;ds.cache_directory=str(a.out/'liquid-cache');ds.use_mesh=True;ds.mesh_scale=2;ds.timesteps_max=6;ds.time_scale=.5
for name in ['use_collision_border_front','use_collision_border_back','use_collision_border_left','use_collision_border_right','use_collision_border_top']:
    if hasattr(ds,name):setattr(ds,name,False)
domain.data.materials.append(ns['water'])
for poly in domain.data.polygons:poly.use_smooth=True

if not a.terrain:
    bpy.ops.mesh.primitive_cube_add(size=1,location=origin+Vector((0,0,-.25)))
    ground=bpy.context.object;ground.name='Collision surface';ground.dimensions=(8,8,.5)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=ground.modifiers.new('Impact collision','FLUID');mod.fluid_type='EFFECTOR';ground.hide_render=True
# The floor is a non-absorbing simulation boundary, not a model of this soil's pores.
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=24,radius=.28,location=origin+Vector((0,0,2.8)))
flow=bpy.context.object;flow.name='Initial liquid drop';mod=flow.modifiers.new('Initial liquid','FLUID');mod.fluid_type='FLOW';fs=mod.flow_settings;fs.flow_type='LIQUID';fs.flow_behavior='GEOMETRY';flow.hide_render=True
scene.frame_start=1;scene.frame_end=64;scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');domain.select_set(True);bpy.context.view_layer.objects.active=domain
bpy.ops.wm.save_as_mainfile(filepath=str(a.out/'liquid-proof.blend'))
print('BAKE_START',a.out,flush=True);bpy.ops.fluid.bake_all();print('BAKE_FINISHED',flush=True)
for frame in [32,38,44,50]:
    scene.frame_set(frame);scene.render.filepath=str(a.out/f'liquid-{frame:04}.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(a.out/'liquid-proof.blend'))
print('PROOF_FINISHED',flush=True)
