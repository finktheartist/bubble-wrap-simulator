"""Round-trip the shipped GLBs into Blender for material and orientation inspection."""
import bpy,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'outputs/toolkit'
bpy.ops.wm.read_factory_settings(use_empty=True)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True;s.view_settings.view_transform='AgX'
s.world=bpy.data.worlds.new('Neutral studio');s.world.use_nodes=True
s.world.node_tree.nodes['Background'].inputs[0].default_value=(.42,.46,.5,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.65
bpy.ops.object.camera_add(location=(1,-3,1));cam=bpy.context.object;s.camera=cam;cam.data.type='ORTHO'
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
for loc,energy,size in [((-2,-3,4),360,3),((2,1,2.4),450,2),((0,-3,.1),55,2)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=energy;o.data.size=size;aim(o,(0,0,0))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-1));floor=bpy.context.object
mat=bpy.data.materials.new('Floor');mat.diffuse_color=(.45,.49,.5,1);mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.45,.49,.5,1);mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.77;floor.data.materials.append(mat)
s.render.resolution_x=720;s.render.resolution_y=720;s.render.resolution_percentage=100
for slug in ['fingertip','mallet','bat','bowling-ball','pop-blaster','pop-bomb']:
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models'/f'{slug}.glb'));objects=list(set(bpy.data.objects)-before)
 bounds=[o.matrix_world@Vector(p) for o in objects if o.type=='MESH' for p in o.bound_box];center=sum(bounds,Vector())/len(bounds)
 extent=max(max(p[i] for p in bounds)-min(p[i] for p in bounds) for i in range(3));floor.location.z=min(p.z for p in bounds)-.008
 cam.data.ortho_scale=extent*1.48;cam.location=center+Vector((extent*(1.7 if slug=='pop-blaster' else .85),-extent*3.5,extent*.9));aim(cam,center)
 s.render.filepath=str(OUT/f'export-{slug}.png');bpy.ops.render.render(write_still=True)
 if slug=='bowling-ball':
  cam.location=center+Vector((extent*2.7,-extent*3,extent*.7));aim(cam,center);s.render.filepath=str(OUT/'export-ball-wells.png');bpy.ops.render.render(write_still=True)
 for o in objects:bpy.data.objects.remove(o,do_unlink=True)
print('EXPORTED_ASSETS_REVIEWED',flush=True)
