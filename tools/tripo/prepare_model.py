"""Fit a reviewed candidate to the game and export embedded, mobile-sized PBR maps.

Calibration coordinates are Blender coordinates: X right, Y forward, Z up.
Run in a separate background Blender process; never modifies an open user scene.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--asset', required=True)
parser.add_argument('--run', default='first-pass')
parser.add_argument('--texture-size', type=int, default=1024)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
fit = json.loads((ROOT / 'tools/tripo/fit.json').read_text())[args.asset]
source = ROOT / 'outputs/tripo' / args.run / args.asset / 'source.glb'
out = ROOT / 'outputs/tripo/prepared'
out.mkdir(parents=True, exist_ok=True)
texture_out = out / 'textures'
texture_out.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
rotation = Euler([math.radians(v) for v in fit['rotation_degrees']], 'XYZ').to_matrix().to_4x4()
points = [rotation @ o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
axis = fit['length_axis']
scale = fit['length'] / (max(p[axis] for p in points) - min(p[axis] for p in points))
transform = Matrix.Scale(scale, 4) @ rotation
source_anchor = transform @ Vector(fit.get('source_anchor', [0, 0, 0]))
transform = Matrix.Translation(Vector(fit['target_anchor']) - source_anchor) @ transform
# Bake the transformed world vertices, leaving a single identity origin for the game's rig.
world_matrices = {o: o.matrix_world.copy() for o in meshes}
for obj in meshes:
    obj.parent = None
    obj.data = obj.data.copy()
    obj.data.transform(transform @ world_matrices[obj])
    obj.matrix_world = Matrix.Identity(4)
    obj.data.update()
    obj.name = args.asset
for obj in list(bpy.context.scene.objects):
    if obj not in meshes:
        bpy.data.objects.remove(obj, do_unlink=True)

for image in bpy.data.images:
    width, height = image.size
    size = args.texture_size if image.name.startswith('Color_') else min(args.texture_size, 512)
    if max(width, height) > size:
        ratio = size / max(width, height)
        image.scale(max(1, round(width * ratio)), max(1, round(height * ratio)))
    if image.name.startswith('ORM_'):
        pixels = np.empty(len(image.pixels), dtype=np.float32)
        image.pixels.foreach_get(pixels)
        channels = pixels.reshape((-1, 4))
        floor = fit.get('roughness_floor', 0.3)
        channels[:, 1] = floor + (1 - floor) * channels[:, 1]
        channels[:, 2] *= fit.get('metallic_scale', 1)
        image.pixels.foreach_set(pixels)
        image.update()
    if image.name.startswith('Color_'):
        # Keep scalar/normal maps lossless; photographic base color compresses well as JPEG.
        image.filepath_raw = str(texture_out / f'{args.asset}-color.jpg')
        image.file_format = 'JPEG'
        bpy.context.scene.render.image_settings.quality = 90
        image.save()
        # The GLB import still carries its original packed 4K JPEG after save().
        # Remove that stale packed copy before packing the resized file.
        if image.packed_file:
            image.unpack(method='REMOVE')
    image.pack()
for material in bpy.data.materials:
    material.name = f'{args.asset} PBR'
    if material.use_nodes:
        for node in material.node_tree.nodes:
            if node.type == 'NORMAL_MAP':
                node.inputs['Strength'].default_value = fit.get('normal_strength', 0.65)

if 'rubber_grip' in fit:
    region = fit['rubber_grip']
    for obj in meshes:
        rubber = obj.data.materials[0].copy()
        rubber.name = f'{args.asset} charcoal polymer grip'
        bsdf = next(n for n in rubber.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        for input_name, value in [('Base Color', (.018, .023, .025, 1)), ('Metallic', 0.0), ('Roughness', .75)]:
            socket = bsdf.inputs[input_name]
            for link in list(socket.links):
                rubber.node_tree.links.remove(link)
            socket.default_value = value
        index = len(obj.data.materials)
        obj.data.materials.append(rubber)
        for face in obj.data.polygons:
            if face.center.y < region['max_forward'] and face.center.z < region['max_height']:
                face.material_index = index

bpy.ops.object.select_all(action='DESELECT')
triangles = 0
for obj in meshes:
    obj.select_set(True)
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
if not 1000 < triangles < 45000:
    raise RuntimeError(f'Triangle budget exceeded: {triangles}')
bpy.context.view_layer.objects.active = meshes[0]
glb = out / f'{args.asset}.glb'
bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_selection=True,
    export_apply=True, export_yup=True, export_animations=False, export_image_format='AUTO',
    export_materials='EXPORT', export_cameras=False, export_lights=False,
    export_jpeg_quality=88, export_image_quality=88)
blend = out / f'{args.asset}.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend), check_existing=False)
report = {'asset': args.asset, 'source': str(source.relative_to(ROOT)), 'triangles': triangles,
    'vertices': sum(len(o.data.vertices) for o in meshes), 'materials': len(bpy.data.materials),
    'bytes': glb.stat().st_size, 'textureSize': args.texture_size, 'fit': fit}
(out / f'{args.asset}.json').write_text(json.dumps(report, indent=2) + '\n')
print('PREPARED_MODEL', json.dumps(report), flush=True)
