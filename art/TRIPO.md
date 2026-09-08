# Archived Tripo item upgrade

This experiment was superseded by the [Meshy model pass](MESHY.md) before publication. Its source library and contact sheet are retained for comparison. The notes below describe the earlier pass, not the models currently loaded by the game. To reproduce that pass, use commit `ec34847` in a separate checkout; rebuilding a library from the current public assets produces the Meshy set.

Seven Tripo v3.1 models are integrated into the game: the suede glove, rubber mallet, maple bat, pop blaster, rocket launcher, bowling cannon, and pop vacuum. All were inspected from four directions, fitted to the existing game rig, and exported with mobile-sized PBR textures. The [contact sheet](../docs/tripo-toolkit.png) shows the final set; `tripo-tool-library.blend` contains editable copies of all nine playable tools.

The bowling ball and bomb keep their original Blender models. The generated ball had additional hole-like marks and an uneven shell; its replacement must match the 0.28 m physics sphere and retain three real finger wells. The generated bomb had an irregular shape and a raised seam. Neither candidate improved on the current physics props.

## Generate locally

Requires Node 22.13+, Blender, a Tripo API account with credits, and an authorized Studio job. Store `TRIPO_API_KEY` in a local environment file outside the repository or in the process environment. The browser never contacts Tripo.

`tools/tripo/assets.json` contains the nine prompts and request settings: model `v3.1-20260211`, detailed PBR textures, and face limits of 12,000–24,000. The first pass used nine generations at 30 credits each. Actual prices may change; check the API account before generating.

```sh
node tools/tripo/generate.mjs --asset pop-blaster --dry-run
node tools/tripo/generate.mjs --balance --job JOB_ID --env-file /absolute/path/to/tripo.env
node tools/tripo/generate.mjs --asset pop-blaster --job JOB_ID --env-file /absolute/path/to/tripo.env
```

Downloads and receipts go to ignored `outputs/tripo/first-pass/ASSET/`. Running the same command resumes an existing task or verifies its downloaded hash. It does not automatically buy another generation after a timeout or failure. Use a new `--run` slug only for an intentional new candidate; a POST with a lost reply stays marked uncertain to prevent a duplicate charge. The CLI checks Studio network and spend capabilities before the corresponding actions.

Raw generations are kept locally. Cloning the repository provides the finished models and editable library, not the original API downloads. A fresh generation may differ and needs its own calibration.

## Review and fit

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/blender/review_model.py -- --source outputs/tripo/first-pass/pop-blaster/source.glb --out outputs/tripo/first-pass/pop-blaster/review
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/tripo/prepare_model.py -- --asset pop-blaster
```

The review script imports the actual GLB into a neutral four-view studio. Check the grip, silhouette, openings, underside, and surface finish before fitting. `fit.json` records the seven accepted calibrations in Blender coordinates (X right, Y forward, Z up). The fitting script writes a GLB, editable Blender file, and geometry report to ignored `outputs/tripo/prepared/` for review before copying the approved GLB into `public/models/`.

The fitted exports preserve melee lengths and grip placement. Barrel openings align with `TOOL_MUZZLES` so projectiles and flashes originate at the visible muzzle. The cannon's generated barrel tilt is corrected. The gun receives a separate charcoal polymer grip material, and overly glossy metal and strong normal maps are softened across the set.

Color maps use 1024 px JPEGs; normal and packed occlusion/roughness/metallic maps use 512 px lossless PNGs. All exports stay below 45,000 triangles and embed their textures without requiring a mesh decoder. The nine playable GLBs total 9.73 MB. `public/models/manifest.json` records individual budgets and sources.

After replacing an export, update its manifest entry and rebuild the current library:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/blender/build_library.py -- --edition tripo
npm test
npm run typecheck
npm run lint
npm run build:vercel
```

All 35 existing tests, typecheck, lint, and the standalone production build passed with these seven replacements. Tests include finite geometry, UVs, embedded textures, triangle budgets, real bowling-ball wells, timed melee contact, projectile behavior, and projected phone/desktop tool bounds. The browser review covers the picker portraits, tool activation, and portrait/landscape framing. A physical phone was not used for this pass.

API references checked September 7, 2026: [generation](https://developers.tripo3d.ai/en/docs/generation-text-to-model/standard), [task query](https://developers.tripo3d.ai/en/docs/task-query), [balance](https://developers.tripo3d.ai/en/docs/account), [pricing](https://developers.tripo3d.ai/en/pricing).
