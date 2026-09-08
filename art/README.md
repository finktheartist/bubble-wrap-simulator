# Blender tool library

`meshy-tool-library.blend` contains the current nine game tools with packed textures and a neutral product studio. Seven tools use Meshy 7 Ultra geometry and PBR materials, fitted and finished in Blender. The ball and bomb use Meshy retextures of the original Blender props; the ball retains its exact drilled source mesh. See the [current contact sheet](../docs/meshy-toolkit.png) and [Meshy authoring workflow](MESHY.md).

The `00 — Toolkit presentation (linked meshes)` collection is arranged for review. The nine hidden source collections retain unit scale and the game origin. Show a source collection and hide the presentation to edit or export it. Presentation copies share meshes and materials with their sources.

| Asset | Triangles | GLB bytes | Color / material maps |
| --- | ---: | ---: | --- |
| Suede glove | 24,356 | 1,518,260 | 1024 / 512 px |
| Replaceable-face mallet | 18,519 | 1,610,116 | 1024 / 512 px |
| Maple bat | 15,005 | 1,365,352 | 1024 / 512 px |
| Bowling ball | 16,170 | 905,468 | 1024 / 512 px |
| Pop blaster | 24,483 | 1,980,288 | 1024 / 512 px |
| Pop bomb | 19,379 | 1,064,088 | 1024 / 512 px |
| Rocket launcher | 26,074 | 1,793,644 | 1024 / 512 px |
| Bowling cannon | 26,855 | 1,743,884 | 1024 / 512 px |
| Pop vacuum | 23,718 | 2,011,308 | 1024 / 512 px |

All textures are embedded. The complete set totals **13,992,408 bytes** and **194,559 triangles**, recorded in `public/models/manifest.json`. The game shares geometry and textures across held tools, menu portraits, and projectiles. It requires no asset service during play. The manifest counts vertices in the exported GLBs, including splits at UV seams.

## Rebuild the current review library

From the project root, using Blender 5.1.2:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python tools/blender/build_library.py -- --edition meshy
```

This imports the current `public/models/*.glb` files and regenerates `art/meshy-tool-library.blend` and `docs/meshy-toolkit.png`. It does not change the GLBs or an already open Blender scene. Save manual changes separately before regenerating the library.

## Review game poses

```sh
node_modules/.bin/tsx tools/blender/swing_poses.ts
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python tools/blender/review_swings.py
node_modules/.bin/tsx tools/blender/toybox_poses.ts
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python tools/blender/review_toybox.py
```

These samplers read the actual game pose functions. Outputs cover mallet and bat rest, wind-up, contact, and follow-through, plus launcher, cannon, and vacuum recoil in desktop and phone framing.

## Earlier libraries

`tripo-tool-library.blend` and `../docs/tripo-toolkit.png` preserve the superseded Tripo experiment. Its [workflow notes](TRIPO.md) are historical.

`bubble-wrap-tools.blend` and `toolkit-overview.png` preserve the original procedural set. The original `tools/blender/build_toolkit.py` rebuilds that library **and replaces all nine public GLBs with the original procedural versions**. Use a separate checkout when exploring that workflow. The current Meshy replacements are prepared through `tools/meshy/` instead.
