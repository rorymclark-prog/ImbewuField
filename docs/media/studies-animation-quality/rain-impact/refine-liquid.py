"""Review cached liquid with smooth normals and a surface-aligned image receiver."""
import bpy,sys
from pathlib import Path
from mathutils import Vector
out=Path(sys.argv[sys.argv.index('--')+1]);scene=bpy.context.scene
up=Vector((0,7,10)).normalized()
plate=bpy.data.objects['Stable background illustration'];plate.data.clear_geometry()
floor=bpy.data.objects['Collision surface'];surface_z=floor.location.z+floor.dimensions.z/2-.025
verts=[(x,y,surface_z) for x,y in [(-20,-20),(20,-20),(20,20),(-20,20)]]
plate.data.from_pydata(verts,[],[(0,1,2,3)]);plate.data.update()
uv=plate.data.uv_layers.new()
for i,co in enumerate(verts):uv.data[i].uv=((co[0]+8)/16,(Vector(co).dot(up)+4.5)/9)
domain=bpy.data.objects['Liquid domain'];domain.select_set(True);bpy.context.view_layer.objects.active=domain
for poly in domain.data.polygons:poly.use_smooth=True
ng=bpy.data.node_groups.new('Smooth fluid shading','GeometryNodeTree')
ng.interface.new_socket(name='Geometry',in_out='INPUT',socket_type='NodeSocketGeometry');ng.interface.new_socket(name='Geometry',in_out='OUTPUT',socket_type='NodeSocketGeometry')
nin=ng.nodes.new('NodeGroupInput');nout=ng.nodes.new('NodeGroupOutput');smooth=ng.nodes.new('GeometryNodeSetShadeSmooth');smooth.domain='FACE';smooth.inputs['Shade Smooth'].default_value=True
ng.links.new(nin.outputs['Geometry'],smooth.inputs['Geometry']);ng.links.new(smooth.outputs['Geometry'],nout.inputs['Geometry'])
mod=domain.modifiers.new('Smooth liquid surface normals','NODES');mod.node_group=ng
for frame in [38,44]:
    scene.frame_set(frame);scene.render.filepath=str(out/f'smooth-{frame:04}.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'liquid-smooth.blend'))
