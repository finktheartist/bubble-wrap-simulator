"""Render an untouched Tripo candidate in a neutral four-view Blender studio."""
import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--out', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
source = Path(args.source).resolve()
out = Path(args.out).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not objects:
    raise RuntimeError('The candidate has no mesh objects')
points = [o.matrix_world @ Vector(corner) for o in objects for corner in o.bound_box]
lo = Vector([min(p[i] for p in points) for i in range(3)])
hi = Vector([max(p[i] for p in points) for i in range(3)])
center = (lo + hi) / 2
extent = max(hi - lo)
if extent <= 0:
    raise RuntimeError('The candidate has empty bounds')
triangles = 0
for obj in objects:
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
report = {
    'source': str(source), 'triangles': triangles,
    'blenderBounds': {'min': list(lo), 'max': list(hi)},
    'meshes': len(objects),
    'materials': [m.name for m in bpy.data.materials],
    'images': [{'name': i.name, 'size': list(i.size)} for i in bpy.data.images],
}
(out / 'inspection.json').write_text(json.dumps(report, indent=2) + '\n')
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.view_settings.view_transform = 'AgX'
scene.render.resolution_x = 768
scene.render.resolution_y = 768
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Neutral studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.34, .38, .42, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .65

def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

for offset, energy, size in [((-2, -3, 4), 440, 3), ((3, 2, 2), 600, 2), ((0, -3, 0), 90, 2)]:
    bpy.ops.object.light_add(type='AREA', location=center + Vector(offset) * extent)
    light = bpy.context.object
    light.data.energy = energy * extent ** 2
    light.data.shape = 'DISK'
    light.data.size = size * extent
    aim(light, center)
bpy.ops.mesh.primitive_plane_add(size=200 * extent, location=(center.x, center.y, lo.z - .015 * extent))
floor = bpy.context.object
material = bpy.data.materials.new('Neutral matte floor')
material.use_nodes = True
material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.27, .31, .34, 1)
material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .8
floor.data.materials.append(material)
bpy.ops.object.camera_add()
camera = bpy.context.object
camera.data.type = 'ORTHO'
camera.data.ortho_scale = extent * 1.4
scene.camera = camera
for label, offset in [('front', (2.6, -3.5, 1.7)), ('back', (-2.6, 3.5, 1.7)), ('side', (4, 0, 1)), ('top', (0, -.1, 4))]:
    camera.location = center + Vector(offset) * extent
    aim(camera, center)
    scene.render.filepath = str(out / f'{label}.png')
    bpy.ops.render.render(write_still=True)
print('CANDIDATE_REVIEW', json.dumps(report), flush=True)
