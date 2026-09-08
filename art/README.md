# Blender tool library

`tripo-tool-library.blend` contains the current nine game tools with packed textures and a neutral product studio. Seven tools use Tripo-generated geometry, fitted and finished in Blender. The bowling ball and bomb retain their original Blender geometry. See the [current contact sheet](../docs/tripo-toolkit.png) and [Tripo authoring workflow](TRIPO.md).

The `00 — Toolkit presentation (linked meshes)` collection is arranged for review. The nine hidden source collections retain unit scale and the game origin. Show a source collection and hide the presentation to edit or export it. Presentation copies share meshes and materials with their sources.

| Asset | Triangles | GLB bytes | Color / material maps |
| --- | ---: | ---: | --- |
| Suede glove | 21,154 | 1,180,676 | 1024 / 512 px |
| Rubber mallet | 13,576 | 1,156,600 | 1024 / 512 px |
| Maple bat | 11,284 | 805,384 | 1024 / 512 px |
| Bowling ball (retained) | 16,170 | 830,344 | 768 px atlases |
| Pop blaster | 18,981 | 1,242,308 | 1024 / 512 px |
| Pop bomb (retained) | 20,040 | 930,716 | 512 px atlases |
| Rocket launcher | 22,376 | 1,270,824 | 1024 / 512 px |
| Bowling cannon | 21,543 | 1,107,840 | 1024 / 512 px |
| Pop vacuum | 19,599 | 1,202,928 | 1024 / 512 px |

All textures are embedded. The complete set totals **9,727,620 bytes**, recorded in `public/models/manifest.json`. The game shares geometry and textures across held tools, menu portraits, and projectiles. It requires no asset service during play.

## Rebuild the current review library

From the project root, using Blender 5.1.2:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/tripo/build_library.py
```

This imports the current `public/models/*.glb` files and regenerates `art/tripo-tool-library.blend` and `docs/tripo-toolkit.png`. It does not change the GLBs or an already open Blender scene. Save manual changes separately before regenerating the library.

## Review game poses

```sh
node_modules/.bin/tsx tools/blender/swing_poses.ts
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/blender/review_swings.py
node_modules/.bin/tsx tools/blender/toybox_poses.ts
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/blender/review_toybox.py
```

These samplers read the actual game pose functions. Outputs cover mallet and bat rest, wind-up, contact, and follow-through, plus launcher, cannon, and vacuum recoil in desktop and phone framing.

## Original procedural library

`bubble-wrap-tools.blend` and `toolkit-overview.png` preserve the previous tool set. The original `tools/blender/build_toolkit.py` rebuilds that library **and replaces all nine public GLBs with the previous procedural versions**. Use a separate checkout when exploring that workflow. The current Tripo replacements are prepared through `tools/tripo/` instead.
