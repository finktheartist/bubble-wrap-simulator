# Blender tool library

`bubble-wrap-tools.blend` contains all six game tools, packed color and normal maps, and a neutral product studio. The `00 — Toolkit presentation (linked copies)` collection is arranged for review. The six hidden source collections retain unit scale and the game origin; show one source collection and hide the presentation to edit or export it. The presentation copies share their mesh and materials with the sources.

The authoring script rebuilds the generated library, exports the six GLBs to `public/models/`, and renders previews to `outputs/toolkit/`. It runs in a separate background Blender process and does not affect an already open scene. Rebuilding overwrites this generated master and its exports, so save manual revisions separately first.

From the project root, using Blender 5.1.2:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/blender/build_toolkit.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/blender/review_exports.py
```

The second command imports the actual exported GLBs into a fresh studio to inspect their finishes, including an oblique view of the bowling-ball wells. `toolkit-overview.png` is the reviewed source-library overview.

| Asset | Triangles | Color / normal atlas |
| --- | ---: | ---: |
| Suede glove | 30,342 | 768 px |
| Rubber mallet | 9,776 | 512 px |
| Maple bat | 8,588 | 512 px |
| Bowling ball | 16,170 | 768 px |
| Pop blaster | 14,794 | 512 px |
| Pop bomb | 20,040 | 512 px |

All textures are embedded; the full set totals about 5.7 MB. `public/models/manifest.json` records exact export sizes. The game loads one library and shares geometry and textures across held tools, menu portraits, and projectiles. Procedural shading is baked locally; play requires no asset service.

To review actual game swing poses (without changing the open Blender scene):

```sh
node_modules/.bin/tsx tools/blender/swing_poses.ts
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/blender/review_swings.py
```

The sampler reads the same grip-pivot pose function used by the renderer. Review outputs include rest, wind-up, contact, and follow-through for the hammer and bat in desktop and portrait framing.
