"""Pack the shipped tools into an editable library and render a contact sheet."""
import json
import math
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.view_settings.view_transform = 'AgX'
scene.render.resolution_x = 1500
scene.render.resolution_y = 1500
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Soft neutral studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.45, .49, .52, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .65
presentation = bpy.data.collections.new('00 — Toolkit presentation (linked meshes)')
scene.collection.children.link(presentation)
manifest = json.loads((ROOT / 'public/models/manifest.json').read_text())
names = ['Suede glove', 'Rubber mallet', 'Maple bat', 'Bowling ball', 'Pop blaster', 'Pop bomb', 'Rocket launcher', 'Bowling cannon', 'Pop vacuum']

def move_to(obj, collection):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)

def label(text, x, z, size=.087):
    bpy.ops.object.text_add(location=(x, -.52, z), rotation=(math.pi / 2, 0, 0))
    obj = bpy.context.object
    obj.data.body = text
    obj.data.align_x = 'CENTER'
    obj.data.size = size
    obj.data.extrude = 0
    obj.data.materials.append(ink)
    move_to(obj, presentation)

ink = bpy.data.materials.new('Studio typography')
ink.diffuse_color = (.025, .045, .048, 1)
ink.use_nodes = True
ink.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.025, .045, .048, 1)
ink.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1
for entry in manifest:
    index = entry['tool']
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/models' / entry['file']))
    imported = list(set(bpy.data.objects) - before)
    source = bpy.data.collections.new(f'{index + 1:02d} — {names[index]} (game origin)')
    scene.collection.children.link(source)
    for obj in imported:
        move_to(obj, source)
    meshes = [o for o in imported if o.type == 'MESH']
    angle = math.radians(135 if index == 4 or index >= 6 else 25 if index == 1 else -12)
    rotation = Euler((0, -.08 if index in (1, 2) else 0, angle), 'XYZ').to_matrix().to_4x4()
    points = [rotation @ o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector([min(p[i] for p in points) for i in range(3)])
    hi = Vector([max(p[i] for p in points) for i in range(3)])
    center = (lo + hi) / 2
    scale = .82 / max(hi - lo)
    x = (index % 3 - 1) * 1.45
    z = 2.85 - (index // 3) * 1.35
    matrix = Matrix.Translation(Vector((x, 0, z))) @ Matrix.Scale(scale, 4) @ Matrix.Translation(-center) @ rotation
    for obj in meshes:
        display = obj.copy()
        display.data = obj.data
        display.parent = None
        presentation.objects.link(display)
        display.matrix_world = matrix @ obj.matrix_world
        display.hide_set(False)
        display.name = f'Presentation — {names[index]}'
    source.hide_render = True
    source.hide_viewport = True
    label(names[index], x, z - .58)
    label('TRIPO + BLENDER' if 'generator' in entry else 'RETAINED PHYSICS PROP', x, z - .70, .044)

label('bubble wrap / model upgrade', 0, 3.83, .16)
label('Seven new textured tools, fitted for the existing game.', 0, 3.60, .066)
for loc, energy, size in [((-3, -4, 6), 750, 4), ((4, -2, 3), 420, 3), ((0, 2, 6), 550, 3)]:
    bpy.ops.object.light_add(type='AREA', location=loc)
    light = bpy.context.object
    light.data.energy = energy
    light.data.size = size
    light.rotation_euler = (Vector((0, 0, 1.6)) - light.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, .7, 0), rotation=(math.pi / 2, 0, 0))
backdrop = bpy.context.object
paper = bpy.data.materials.new('Warm gray backdrop')
paper.use_nodes = True
paper.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.66, .7, .7, 1)
paper.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .85
backdrop.data.materials.append(paper)
bpy.ops.object.camera_add(location=(0, -8, 1.65), rotation=(math.pi / 2, 0, 0))
camera = bpy.context.object
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 4.9
scene.camera = camera
scene.render.filepath = str(ROOT / 'docs/tripo-toolkit.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'art/tripo-tool-library.blend'), check_existing=False)
bpy.ops.render.render(write_still=True)
print('TRIPO_LIBRARY_READY', flush=True)
