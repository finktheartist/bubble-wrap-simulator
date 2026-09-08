"""Fit reviewed Meshy models to the game and embed compact, role-aware PBR textures.

Coordinates are Blender X right, Y forward, Z up. An isolated background process
leaves an already open Blender scene alone. Outputs require review before shipping.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
import numpy as np
from mathutils import Euler, Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--asset', required=True)
parser.add_argument('--run', default='first-pass')
parser.add_argument('--texture-size', type=int, default=1024)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
fit = json.loads((ROOT / 'tools/meshy/fit.json').read_text())[args.asset]
source = ROOT / 'outputs/meshy' / args.run / args.asset / (fit['stage'] + '.glb')
out = ROOT / 'outputs/meshy/prepared'
texture_out = out / 'textures'
texture_out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes:
    raise RuntimeError('No mesh was imported')
if 'geometry_source' in fit:
    # Retexturing can simplify the supplied mesh even with original UVs enabled.
    # Reuse its material on the exact source mesh when gameplay needs those wells.
    generated_material = meshes[0].data.materials[0]
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / fit['geometry_source']))
    originals = [o for o in bpy.context.scene.objects if o not in before and o.type == 'MESH']
    if not originals:
        raise RuntimeError('Original geometry was not imported')
    for obj in originals:
        obj.data.materials.clear()
        obj.data.materials.append(generated_material)
        for face in obj.data.polygons:
            face.material_index = 0
    for obj in meshes:
        bpy.data.objects.remove(obj, do_unlink=True)
    meshes = originals
    for material in list(bpy.data.materials):
        if not material.users:
            bpy.data.materials.remove(material)
if 'trim_min_z' in fit:
    cuff = bpy.data.materials.new('Dark leather cuff edge')
    cuff.use_nodes = True
    cuff.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.018, .012, .008, 1)
    cuff.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .8
    for obj in meshes:
        matrix = obj.matrix_world.copy()
        obj.parent = None
        obj.data = obj.data.copy()
        obj.data.transform(matrix)
        obj.matrix_world = Matrix.Identity(4)
        cap_material = len(obj.data.materials)
        obj.data.materials.append(cuff)
        mesh = bmesh.new()
        mesh.from_mesh(obj.data)
        cut = bmesh.ops.bisect_plane(mesh, geom=list(mesh.verts) + list(mesh.edges) + list(mesh.faces),
            plane_co=(0, 0, fit['trim_min_z']), plane_no=(0, 0, 1), clear_inner=True, clear_outer=False,
            dist=.00001)
        boundary = [edge for edge in cut['geom_cut'] if isinstance(edge, bmesh.types.BMEdge) and edge.is_boundary]
        if boundary:
            cap_faces = bmesh.ops.holes_fill(mesh, edges=boundary, sides=0)['faces']
            for face in cap_faces:
                face.material_index = cap_material
        mesh.normal_update()
        mesh.to_mesh(obj.data)
        mesh.free()
raw_points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
raw_lo = Vector([min(p[i] for p in raw_points) for i in range(3)])
raw_hi = Vector([max(p[i] for p in raw_points) for i in range(3)])
transform = Matrix.Identity(4)
source_anchor = None
if not fit.get('preserve_geometry'):
    rotation = Euler([math.radians(v) for v in fit['rotation_degrees']], 'XYZ').to_matrix().to_4x4()
    if fit.get('align_long_axis'):
        array = np.array([list(p) for p in raw_points])
        values, vectors = np.linalg.eigh(np.cov(array.T))
        direction = Vector(vectors[:, int(np.argmax(values))])
        if direction.z < 0:
            direction.negate()
        rotation = rotation @ direction.rotation_difference(Vector((0, 0, 1))).to_matrix().to_4x4()
    rotated = [rotation @ p for p in raw_points]
    axis = fit['length_axis']
    scale = fit['length'] / (max(p[axis] for p in rotated) - min(p[axis] for p in rotated))
    transform = Matrix.Scale(scale, 4) @ rotation
    if 'muzzle_axis' in fit:
        axis = fit['muzzle_axis']
        end = raw_lo[axis] if fit['muzzle_end'] == 'min' else raw_hi[axis]
        band = (raw_hi[axis] - raw_lo[axis]) * fit.get('muzzle_band', .008)
        rim = [p for p in raw_points if abs(p[axis] - end) <= band]
        source_anchor = Vector([(min(p[i] for p in rim) + max(p[i] for p in rim)) / 2 for i in range(3)])
        source_anchor[axis] = end
    else:
        center = Vector([(min(p[i] for p in rotated) + max(p[i] for p in rotated)) / 2 for i in range(3)])
        source_anchor = Vector(fit['source_anchor']) if 'source_anchor' in fit else rotation.inverted() @ center
    transform = Matrix.Translation(Vector(fit['target_anchor']) - transform @ source_anchor) @ transform

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

if fit.get('hole_inserts'):
    directions = [Vector((x, -z, y)).normalized() for x, y, z in [(-.19, .32, .93), (.19, .32, .93), (0, -.115, .994)]]
    threshold = math.cos(math.asin(fit.get('insert_radius', .049) / .28))
    baked = bpy.data.images.new('Clean circular finger-insert color', width=2048, height=2048)
    restores = []
    # Bake a smooth per-pixel mask; assigning whole triangles creates jagged rims.
    for material in {mat for obj in meshes for mat in obj.data.materials if mat}:
        nodes, links = material.node_tree.nodes, material.node_tree.links
        bsdf = next(node for node in nodes if node.type == 'BSDF_PRINCIPLED')
        output = next(node for node in nodes if node.type == 'OUTPUT_MATERIAL' and node.is_active_output)
        previous_surface = output.inputs['Surface'].links[0].from_socket
        geometry = nodes.new('ShaderNodeNewGeometry')
        normal = nodes.new('ShaderNodeVectorMath')
        normal.operation = 'NORMALIZE'
        links.new(geometry.outputs['Position'], normal.inputs[0])
        maximum = None
        for direction in directions:
            dot = nodes.new('ShaderNodeVectorMath')
            dot.operation = 'DOT_PRODUCT'
            dot.inputs[1].default_value = direction
            links.new(normal.outputs['Vector'], dot.inputs[0])
            if maximum is None:
                maximum = dot.outputs['Value']
            else:
                combine = nodes.new('ShaderNodeMath')
                combine.operation = 'MAXIMUM'
                links.new(maximum, combine.inputs[0])
                links.new(dot.outputs['Value'], combine.inputs[1])
                maximum = combine.outputs[0]
        cutoff = nodes.new('ShaderNodeMath')
        cutoff.operation = 'SUBTRACT'
        cutoff.inputs[1].default_value = threshold - .0005
        links.new(maximum, cutoff.inputs[0])
        mask = nodes.new('ShaderNodeMath')
        mask.operation = 'MULTIPLY'
        mask.inputs[1].default_value = 1000
        mask.use_clamp = True
        links.new(cutoff.outputs[0], mask.inputs[0])
        mix = nodes.new('ShaderNodeMixRGB')
        mix.inputs[2].default_value = (.008, .014, .02, 1)
        links.new(mask.outputs[0], mix.inputs[0])
        if bsdf.inputs['Base Color'].links:
            links.new(bsdf.inputs['Base Color'].links[0].from_socket, mix.inputs[1])
        else:
            mix.inputs[1].default_value = bsdf.inputs['Base Color'].default_value
        emission = nodes.new('ShaderNodeEmission')
        links.new(mix.outputs[0], emission.inputs['Color'])
        links.new(emission.outputs[0], output.inputs['Surface'])
        target = nodes.new('ShaderNodeTexImage')
        target.image = baked
        nodes.active = target
        target.select = True
        restores.append((links, bsdf, output, previous_surface, target))
    bpy.context.scene.render.engine = 'CYCLES'
    bpy.context.scene.cycles.samples = 1
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.bake(type='EMIT', margin=6, use_clear=True)
    for links, bsdf, output, surface, target in restores:
        links.new(surface, output.inputs['Surface'])
        links.new(target.outputs['Color'], bsdf.inputs['Base Color'])

if 'rubber_grip' in fit:
    region = fit['rubber_grip']
    for obj in meshes:
        rubber = obj.data.materials[0].copy()
        rubber.name = 'Charcoal stippled polymer grip'
        bsdf = next(node for node in rubber.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
        for name, value in [('Base Color', (.012, .014, .018, 1)), ('Metallic', 0.0), ('Roughness', .72)]:
            socket = bsdf.inputs[name]
            for link in list(socket.links):
                rubber.node_tree.links.remove(link)
            socket.default_value = value
        slot = len(obj.data.materials)
        obj.data.materials.append(rubber)
        for face in obj.data.polygons:
            if face.center.y < region['max_forward'] and face.center.z < region['max_height']:
                face.material_index = slot

def images_upstream(socket, visited=None):
    visited = set() if visited is None else visited
    images = set()
    for link in socket.links:
        node = link.from_node
        if node in visited:
            continue
        visited.add(node)
        if node.type == 'TEX_IMAGE' and node.image:
            images.add(node.image)
        else:
            for input_socket in node.inputs:
                images.update(images_upstream(input_socket, visited))
    return images

roles = {}
for material in {mat for obj in meshes for mat in obj.data.materials if mat}:
    if not material.use_nodes:
        continue
    for node in material.node_tree.nodes:
        if node.type == 'BSDF_PRINCIPLED':
            for socket_name, role in [('Base Color', 'color'), ('Roughness', 'roughness'), ('Metallic', 'metallic'), ('Normal', 'normal')]:
                for image in images_upstream(node.inputs[socket_name]):
                    roles.setdefault(image, set()).add(role)
        elif node.type == 'NORMAL_MAP':
            node.inputs['Strength'].default_value = fit.get('normal_strength', .65)
    material.name = f'{args.asset} — {material.name}'
if not any('color' in image_roles for image_roles in roles.values()):
    raise RuntimeError('A finished Meshy model must have a base-color texture')
textures = []
for index, (image, image_roles) in enumerate(roles.items()):
    width, height = image.size
    size = args.texture_size if 'color' in image_roles else min(args.texture_size, 512)
    if max(width, height) > size:
        ratio = size / max(width, height)
        image.scale(max(1, round(width * ratio)), max(1, round(height * ratio)))
    if image_roles & {'roughness', 'metallic'} and 'color' not in image_roles:
        pixels = np.empty(len(image.pixels), dtype=np.float32)
        image.pixels.foreach_get(pixels)
        channels = pixels.reshape((-1, 4))
        # glTF packs roughness in G and metallic in B; the importer retains this map.
        if 'roughness' in image_roles:
            floor = fit.get('roughness_floor', .15)
            channels[:, 1] = floor + (1 - floor) * channels[:, 1]
        if 'metallic' in image_roles:
            channels[:, 2] *= fit.get('metallic_scale', 1)
        image.pixels.foreach_set(pixels)
        image.update()
    color = 'color' in image_roles
    image.file_format = 'JPEG' if color else 'PNG'
    image.filepath_raw = str(texture_out / f'{args.asset}-{index}.{"jpg" if color else "png"}')
    bpy.context.scene.render.image_settings.quality = 90
    image.save()
    # Imported GLBs retain original packed bytes until explicitly replaced.
    if image.packed_file:
        image.unpack(method='REMOVE')
    image.pack()
    textures.append({'roles': sorted(image_roles), 'size': list(image.size)})

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
bpy.ops.wm.save_as_mainfile(filepath=str(out / f'{args.asset}.blend'), check_existing=False)
points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
report = {'asset': args.asset, 'source': str(source.relative_to(ROOT)), 'triangles': triangles,
    'vertices': sum(len(o.data.vertices) for o in meshes), 'materials': len({mat for obj in meshes for mat in obj.data.materials if mat}),
    'bytes': glb.stat().st_size, 'textures': textures, 'fit': fit,
    'sourceAnchor': list(source_anchor) if source_anchor is not None else None,
    'blenderBounds': {'min': [min(p[i] for p in points) for i in range(3)],
                      'max': [max(p[i] for p in points) for i in range(3)]}}
(out / f'{args.asset}.json').write_text(json.dumps(report, indent=2) + '\n')
print('PREPARED_MESHY_MODEL', json.dumps(report), flush=True)
