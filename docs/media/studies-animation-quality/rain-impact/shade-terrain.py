"""Apply the inspected soil texture to cached coherent terrain before review."""
import bpy,sys,runpy
from pathlib import Path
out=Path(sys.argv[sys.argv.index('--')+1]);root=Path(__file__).resolve().parent
terrain=runpy.run_path(str(root/'terrain-scene.py'))
ground=bpy.data.objects['Visible soil collision'];ground.data.materials[0]=terrain['soil_material']('Photographic granular soil')
domain=bpy.data.objects['Liquid domain']
ng=bpy.data.node_groups.new('Fluid smooth normals','GeometryNodeTree');ng.interface.new_socket(name='Geometry',in_out='INPUT',socket_type='NodeSocketGeometry');ng.interface.new_socket(name='Geometry',in_out='OUTPUT',socket_type='NodeSocketGeometry')
i=ng.nodes.new('NodeGroupInput');o=ng.nodes.new('NodeGroupOutput');smooth=ng.nodes.new('GeometryNodeSetShadeSmooth');smooth.domain='FACE';smooth.inputs['Shade Smooth'].default_value=True;ng.links.new(i.outputs['Geometry'],smooth.inputs['Geometry']);ng.links.new(smooth.outputs['Geometry'],o.inputs['Geometry']);mod=domain.modifiers.new('Fluid smooth normals','NODES');mod.node_group=ng
scene=bpy.context.scene;scene.camera.data.dof.aperture_fstop=.4;scene.view_settings.exposure=.65;scene.cycles.samples=64
for frame in [32,38,44,50]:
    scene.frame_set(frame);scene.render.filepath=str(out/f'textured-{frame:04}.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'terrain-textured.blend'))
