"""Coherent visible/collision soil for the magnified impact study.

Artist-authored aggregate shapes and shader scale, not a soil sample or a particle
size distribution. The same seed builds both surfaces before leaf cover is added.
"""
import bpy,math,random
from pathlib import Path
from mathutils import Vector
from mathutils.noise import noise_vector

def soil_material(name,light=1):
    m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;b=n.get('Principled BSDF');b.inputs['Roughness'].default_value=.92
    coords=n.new('ShaderNodeTexCoord');tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=35;tex.inputs['Detail'].default_value=5;tex.inputs['Roughness'].default_value=.78;l.new(coords.outputs['Object'],tex.inputs['Vector'])
    ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.18;ramp.color_ramp.elements[0].color=(.025*light,.011*light,.004*light,1);ramp.color_ramp.elements[1].position=.83;ramp.color_ramp.elements[1].color=(.24*light,.115*light,.045*light,1);l.new(tex.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs['Color'],b.inputs['Base Color'])
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.65;bump.inputs['Distance'].default_value=.028;l.new(tex.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],b.inputs['Normal'])
    image=n.new('ShaderNodeTexImage');image.image=bpy.data.images.load(str(Path(__file__).with_name('soil-albedo.png')),check_existing=True);image.image.pack();image.projection='BOX';image.projection_blend=.25
    mapping=n.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs['Scale'].default_value=.35;l.new(coords.outputs['Object'],mapping.inputs[0]);l.new(mapping.outputs['Vector'],image.inputs['Vector'])
    l.new(image.outputs['Color'],b.inputs['Base Color']);l.new(image.outputs['Color'],bump.inputs['Height']);bump.inputs['Distance'].default_value=.014
    return m

def leaf_material():
    m=bpy.data.materials.new('Dry papery leaf');m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;b=n.get('Principled BSDF');b.inputs['Roughness'].default_value=.82
    image=n.new('ShaderNodeTexImage');image.image=bpy.data.images.load(str(Path(__file__).with_name('leaf-albedo.png')),check_existing=True);image.image.pack();l.new(image.outputs['Color'],b.inputs['Base Color'])
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.4;bump.inputs['Distance'].default_value=.012;l.new(image.outputs['Color'],bump.inputs['Height']);l.new(bump.outputs['Normal'],b.inputs['Normal']);return m

def build(scene,covered=False):
    origin=Vector((0,0,0))
    if 'Stable background illustration' in bpy.data.objects:bpy.data.objects.remove(bpy.data.objects['Stable background illustration'],do_unlink=True)
    # A low undulating surface replaces the photograph; its actual mesh is baked.
    rng=random.Random(927);material=soil_material('Warm granular soil')
    def elevation(x,y):return .045*math.sin(2.7*x)*math.sin(2.1*y)+.022*math.sin(7*x+3*y)
    verts=[];faces=[];n=129;span=40
    for j in range(n):
        for i in range(n):
            x=-span/2+i*span/(n-1);y=-span/2+j*span/(n-1);verts.append((x,y,elevation(x,y)))
    for j in range(n-1):
        for i in range(n-1):
            k=j*n+i;faces.append((k,k+1,k+n+1,k+n))
    # Include the side walls so the visible top is a solid collision volume.
    border=[i for i in range(n)]+[j*n+n-1 for j in range(1,n)]+[(n-1)*n+i for i in range(n-2,-1,-1)]+[j*n for j in range(n-2,0,-1)]
    base=len(verts)
    verts.extend([(verts[i][0],verts[i][1],-.5) for i in border])
    for k,vi in enumerate(border):faces.append((vi,border[(k+1)%len(border)],base+(k+1)%len(border),base+k))
    faces.append(tuple(reversed(range(base,base+len(border)))))
    # Share one small irregular aggregate mesh; points are placed on the real surface.
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1);template=bpy.context.object
    points=[Vector(v.co) for v in template.data.vertices];polys=[tuple(p.vertices) for p in template.data.polygons];bpy.data.objects.remove(template,do_unlink=True)
    for k in range(16000):
        x=rng.uniform(-7,7);y=rng.uniform(-7,7);r=rng.uniform(.024,.14)**1.15
        if k%17==0:r*=1.8
        if x*x+y*y<.12:r*=.45
        z=elevation(x,y)+r*.35;scale=Vector((r*rng.uniform(.8,1.5),r*rng.uniform(.8,1.35),r*rng.uniform(.7,1.25)));start=len(verts)
        for v in points:
            q=Vector((v.x*scale.x,v.y*scale.y,v.z*scale.z));q*=1+.16*math.sin(v.x*9+k)*math.cos(v.z*7-k);verts.append(tuple(Vector((x,y,z))+q))
        faces.extend([tuple(start+i for i in poly) for poly in polys])
    mesh=bpy.data.meshes.new('Surface and aggregates');mesh.from_pydata(verts,[],faces);mesh.update();ground=bpy.data.objects.new('Visible soil collision',mesh);scene.collection.objects.link(ground);ground.data.materials.append(material)
    for poly in ground.data.polygons:poly.use_smooth=True
    colliders=[ground]
    if covered:
        leafmat=leaf_material()
        for i in range(14):
            length=1.5+rng.random()*1.6;width=length*rng.uniform(.28,.43)
            x,y=(0,0) if i==0 else (rng.uniform(-3.5,3.5),rng.uniform(-3,3))
            angle=.25 if i==0 else rng.uniform(-math.pi,math.pi);height=.15+i*.003
            vs=[];fs=[];nu,nv=19,41
            for j in range(nv):
                t=j/(nv-1);v=(t-.5)*length
                for k in range(nu):
                    u=k/(nu-1)*2-1;xx=u*width*math.sin(math.pi*t)**.75
                    zz=height+.12*u*u+.09*math.sin(t*2*math.pi)+.05*math.sin(t*9+u*4)*abs(u)**4
                    vs.append((x+xx*math.cos(angle)-v*math.sin(angle),y+xx*math.sin(angle)+v*math.cos(angle),zz))
            for j in range(nv-1):
                for k in range(nu-1):q=j*nu+k;fs.append((q,q+1,q+nu+1,q+nu))
            data=bpy.data.meshes.new(f'Curled leaf {i}');data.from_pydata(vs,[],fs);data.update();leaf=bpy.data.objects.new(f'Leaf cover {i}',data);scene.collection.objects.link(leaf);leaf.data.materials.append(leafmat)
            uv=data.uv_layers.new()
            for poly in data.polygons:
                poly.use_smooth=True
                for loop in poly.loop_indices:
                    vi=data.loops[loop].vertex_index;uv.data[loop].uv=((vi%nu)/(nu-1),(vi//nu)/(nv-1))
            sol=leaf.modifiers.new('Thin leaf surface','SOLIDIFY');sol.thickness=.014
            colliders.append(leaf)
    for ob in colliders:
        mod=ob.modifiers.new('Visible surface collision','FLUID');mod.fluid_type='EFFECTOR';mod.effector_settings.surface_distance=.001
        if ob.name.startswith('Leaf cover') and hasattr(mod.effector_settings,'use_plane_init'):mod.effector_settings.use_plane_init=True
    cam=scene.camera;cam.data.type='PERSP';cam.data.lens=75;cam.location=(4,-7,5.3);target=Vector((0,0,.5));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.empty_add(location=(0,0,.15));focus=bpy.context.object;focus.name='Impact focus';cam.data.dof.use_dof=True;cam.data.dof.focus_object=focus;cam.data.dof.aperture_fstop=2.8
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.38,.47,.27,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
    bpy.ops.object.light_add(type='SUN',location=(-5,-7,8));sun=bpy.context.object;sun.rotation_euler=(Vector((0,0,0))-sun.location).to_track_quat('-Z','Y').to_euler();sun.data.energy=2;sun.data.angle=.10
    for ob in scene.objects:
        if ob.type=='LIGHT':
            ob.data.color=(1,.88,.69)
            if ob.data.type=='AREA':ob.data.energy*=.35
    return origin,ground
