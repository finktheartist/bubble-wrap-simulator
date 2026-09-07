"""Inspect exported tools using the exact grip-pivot matrices sampled from the game."""
import bpy,math,json
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'outputs/toolkit'
bpy.ops.wm.read_factory_settings(use_empty=True)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True;s.view_settings.view_transform='AgX'
s.world=bpy.data.worlds.new('Arena neutral');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.5,.56,.57,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.8
bpy.ops.object.camera_add(location=(0,0,0));camera=bpy.context.object;camera.rotation_euler=(math.pi/2,0,0);camera.data.sensor_fit='VERTICAL';camera.data.sensor_height=36;camera.data.lens=36/(2*math.tan(math.radians(30)));camera.data.clip_start=.01;s.camera=camera
for loc,power in [((-2,-2,4),320),((2,-1,2),180)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=3;o.rotation_euler=(Vector((0,1,0))-o.location).to_track_quat('-Z','Y').to_euler()
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
for slug in ['mallet','bat']:
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models'/f'{slug}.glb'));objects=list(set(bpy.data.objects)-before)
 roots=[o for o in objects if o.parent not in objects];original={o:o.matrix_world.copy() for o in roots}
 for pose in json.loads((OUT/'swing-poses.json').read_text()):
  if pose['tool']!=slug:continue
  flat=pose['matrix'];M=Matrix([[flat[c*4+r] for c in range(4)] for r in range(4)]);M=C@M@C.inverted()
  for o in roots:o.matrix_world=M@original[o]
  s.render.resolution_x=pose['width'];s.render.resolution_y=pose['height'];s.render.resolution_percentage=100
  s.render.filepath=str(OUT/f"swing-{pose['layout']}-{slug}-{pose['stage']}.png");bpy.ops.render.render(write_still=True)
 for o in objects:bpy.data.objects.remove(o,do_unlink=True)
print('SWING_POSES_REVIEWED',flush=True)
