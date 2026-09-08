# Meshy item upgrade

All nine tools use Meshy PBR materials. Seven models were generated with Meshy 7 Ultra: the pointing glove, mallet, bat, pistol, rocket launcher, bowling cannon, and vacuum. The bowling ball and bomb were retextured from the original Blender props. The [contact sheet](../docs/meshy-toolkit.png) shows the current set; `meshy-tool-library.blend` contains editable game-origin meshes and a linked product studio.

## Generate locally

Requires Node 22.13+, Blender, an existing Meshy API account with credits, and an authorized Studio job. Set `MESHY_API_KEY` in the process environment or in a local environment file outside the repository. The CLI can also read an existing Meshy MCP connection using `--mcp-config /absolute/path/to/config.json`. Credentials are read privately and sent only to the Meshy API; they are never included in the game, asset downloads, receipts, or prompts.

`tools/meshy/assets.json` records geometry prompts, material prompts, face budgets, and API options. Generate a geometry preview, inspect it, then refine only an accepted shape:

```sh
node tools/meshy/generate.mjs --asset pop-blaster --dry-run
node tools/meshy/generate.mjs --balance --job JOB_ID --env-file /absolute/path/to/meshy.env
node tools/meshy/generate.mjs --asset pop-blaster --stage preview --job JOB_ID --env-file /absolute/path/to/meshy.env
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python tools/blender/review_model.py -- --source outputs/meshy/first-pass/pop-blaster/preview.glb --out outputs/meshy/first-pass/pop-blaster/preview-review
node tools/meshy/generate.mjs --asset pop-blaster --stage refine --job JOB_ID --env-file /absolute/path/to/meshy.env
```

Downloads and receipts live in ignored `outputs/meshy/RUN/ASSET/` directories. Repeating a command resumes its existing task or verifies the completed download hash. The CLI checks Studio network and spend capabilities, verifies available credits, and never buys credits. A failed or uncertain POST requires manual review before a replacement task; automatic retries cannot create another paid generation. Use a new `--run` for an intentional new candidate. `--preview-run` can reuse an already reviewed mesh for a separate material candidate.

The final mallet and cannon use `--run revised`. Their first geometry previews were rejected: the mallet had an extra handle, and the cannon's front was blocked. Corrected geometry was reviewed before paying for textures. The accepted pass used nine geometry previews at 25 credits each, seven refinements at 10 credits each, and two retextures at 10 credits each: **315 credits total**. Prices are observations from this pass; verify current pricing before another generation.

## Retexture precise props

Export the original bowling ball and bomb from `bubble-wrap-tools.blend` into ignored `outputs/meshy/input/`. The authoring run used the original public GLBs from commit `94370d0`. Retexture each source with original UVs and PBR enabled:

```sh
node tools/meshy/generate.mjs --asset bowling-ball --stage retexture --source outputs/meshy/input/bowling-ball.glb --job JOB_ID --env-file /absolute/path/to/meshy.env
node tools/meshy/generate.mjs --asset pop-bomb --stage retexture --source outputs/meshy/input/pop-bomb.glb --job JOB_ID --env-file /absolute/path/to/meshy.env
```

Meshy's retexture output normalized model size and simplified some geometry despite original UVs being enabled. The fitting script restores the established dimensions. For the ball it reapplies the Meshy material to the exact original drilled mesh, then bakes clean circular dark finger inserts into the color map. This removes square artifacts around the wells while keeping the 0.28 m collision sphere and three real cavities. The bomb keeps its source silhouette with the retexture output's simplified mesh, restored to the original dimensions.

## Finish and fit in Blender

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python tools/meshy/prepare_model.py -- --asset pop-blaster
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python tools/meshy/prepare_model.py -- --asset mallet --run revised
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python tools/blender/review_model.py -- --source outputs/meshy/prepared/pop-blaster.glb --out outputs/meshy/prepared/pop-blaster-review
```

`fit.json` records reviewed calibrations in Blender coordinates: X right, Y forward, Z up. It aligns actual barrel openings with the game's muzzle anchors, preserves melee lengths and grip pivots, straightens the generated bat's long axis, and trims the glove's unwanted forearm. The pistol receives a charcoal polymer grip material. Metallic response, roughness, and normal-map strength are adjusted per tool.

The script identifies textures by their material connections, reduces color maps to 1024 px JPEGs and normal/packed material maps to 512 px PNGs, then replaces the original packed image bytes before export. Four-direction renders inspect the actual exported GLBs. Each model stays below 45,000 triangles without a runtime mesh decoder. The nine GLBs total **13,992,408 bytes**; `public/models/manifest.json` records individual budgets and sources.

Prepared candidates stay in ignored `outputs/meshy/prepared/` until reviewed. Copy accepted GLBs into `public/models/`, update the manifest from the exported geometry, and rebuild the editable library:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python tools/blender/build_library.py -- --edition meshy
npm test
npm run typecheck
npm run lint
npm run build:vercel
```

All 35 existing tests, typecheck, lint, and the standalone production build passed. Asset tests parse the shipped GLBs, raycast the real bowling-ball wells, and project the new tool vertices at rest and during recoil into phone, tablet, square, and desktop views. Browser review covers the picker portraits, tool activation, and portrait/landscape framing; sampled game-pose renders cover melee contact and recovery. Touch behavior has automated coverage; viewport emulation is not a physical-phone performance test.

Raw API downloads and private receipts stay local. The repository contains finished assets, the editable library, prompts, and scripts. Generated shapes are not deterministic, so another generation needs fresh review and calibration.

Official API references checked September 7, 2026: [text-to-3D](https://docs.meshy.ai/en/api/text-to-3d), [retexture](https://docs.meshy.ai/en/api/retexture), [pricing](https://docs.meshy.ai/en/api/pricing), [balance](https://docs.meshy.ai/en/api/balance).
