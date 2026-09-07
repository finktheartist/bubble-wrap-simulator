# Bubble Wrap Simulator

A first person Three.js playground built around the extremely reasonable desire to pop an entire room of bubble wrap.

## Play

Enter the arena, look at the wrapped block directly ahead, and click the large **POP** button or press **F** for your first pop. Explore the wrapped room, stairs, arch, platforms, and loose parcels. All six tools are available immediately.

| Control | Action |
| --- | --- |
| WASD | Move |
| Right-drag / arrow keys | Look while keeping your cursor available |
| L | Toggle optional captured mouse look |
| Space | Jump |
| Shift | Run |
| On-screen action button / F / left mouse | Use the selected tool |
| Hold, then release left mouse | Charge and throw a bowling ball or held object |
| Grab button / E | Pick up or drop a nearby loose object |
| Q | Drop a held object |
| 1–6 / mouse wheel | Change tools |
| R | Reinflate the room and restore objects |
| Sound button | Mute / unmute |
| Esc | Pause and release the mouse |

Phones and tablets have safe-area-aware portrait and landscape layouts, a movement stick with a center dead zone, drag-to-look across the arena, and large jump, grab, and action buttons. Drag on the action button to aim while firing. Independent fingers can move, aim, and fire together; cancelled gestures stop cleanly without launching a charged throw. Rotating the device pauses the game. Settings include volume, sensitivity, camera shake, footstep popping, and rendering quality. Only preferences persist in local storage.

## Run locally

Requires Node 22.13 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by the server. Audio begins with the Enter button; optional mouse capture requires a browser user gesture, but tool use never requires capture. The app needs WebGL2 and WebAssembly.

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

## Implementation

Bubble spacing is 0.26 world units throughout the room and 0.22 on loose parcels, down from 0.62 and 0.4. Smaller per-cell geometry and deduplicated pop waves keep the denser wrap bounded.

- Three.js renders clear, nonmetallic packing film over the colored backing. Instanced molded pockets taper into broad heat-welded lips; physical transmission, fine film normals, restrained clearcoat, and panel reflections make the air pockets readable. Continuous backing sheets carry grain and contact shading. Popping blends each pocket into a folded empty shape with matching normals, while reinflation restores it. Neutral studio lighting, overhead area lights, and soft shadow filtering ground the room. Balanced quality reduces the transmission-buffer resolution; high quality restores full resolution.
- Rapier provides a fixed 60 Hz rigid-body simulation, a capsule character controller, gravity, contact events, object mass, friction, restitution, continuous collision detection, and collision-preserving object grabbing.
- Bowling balls, parcels, pellets, and bombs are dynamic bodies. Contact position and impact speed determine pop radius. Explosions apply distance-based impulses and schedule outward-moving crackles.
- Web Audio synthesizes rounded pressure pops with a short, warm membrane body and a softly filtered air transient. There are no crinkle tails, distortion, or added room echoes. Twenty-four variants and stereo placement provide variation; dense impacts resolve into distinct pops spaced 20–28 ms apart. Conservative voice gain, a short queue, filtered treble, and a gentle limiter prevent harsh stacking. Impact thumps are quieter and rate-limited. No audio assets or external services are needed during play.
- Six Blender-authored GLBs replace the procedural tool assemblies: a connected suede glove with fitted stitching, a rubber-barrel mallet, a turned maple bat, a resin bowling ball with drilled finger wells, a vented pneumatic toy, and an enamel bomb with threaded hardware and a braided fuse. Each asset embeds baked color and normal maps while retaining distinct PBR material responses. The complete set is about 5.5 MB; meshes and textures are shared by held tools, portraits, and thrown instances.
- Mobile rendering uses 10-segment bubble pockets without changing cell counts, 1× balanced pixel density, a 45% transmission buffer, and at most 24 projectiles. Paused scenes redraw at 10 Hz; hidden tabs skip rendering.
- Menu icons are transparent portraits rendered once from the same Three.js models and materials used by the held tools. Shapes, colors, grips, and bowling-ball finger holes match the items in the arena.
- GPU instancing, bounded projectiles, bounded particles, and a balanced render setting keep the room practical for a browser.

The wrap itself uses a hybrid approximation: rigid backing plus individually animated cells. It does not simulate tearing sheets, cloth, or air pressure. The six tools are stylized sandbox objects rather than engineering-accurate weapon simulations.

## Validation

Twenty-one automated tests exercise tool-button availability, mouse and keyboard use without capture, quick-tap activation of all six tools, rounded audio transients, separated multi-pop scheduling, sustained-burst mixing headroom, one-time popping and reinflation, walking/wall collision/jumping/landing, high-speed contact detection, collision-preserving grabbing, blast falloff/reset, simultaneous touch ownership, drift-free analog movement, viewport-scaled aiming, cancelled charged throws, and mobile bubble geometry/state parity. Asset tests parse the shipped GLBs to check finite geometry, UVs, triangle budgets, real bowling-ball wells, embedded textures, and safe shared-resource disposal. The six GLBs have also been re-imported and rendered in Blender to inspect exported materials and silhouettes. TypeScript checks the full project. Lint checks application, game, and test sources; the untouched generated component catalog has pre-existing lint failures and is outside that command.

Browser playtesting is a separate optional step, pending the user's choice in the build conversation. Touch controls are implemented but are not yet verified on a physical device.

## Architecture

- `app/page.tsx`: game HUD, tool belt, pause and settings UI, touch input.
- `lib/game/game.ts`: game loop, input, targeting, impacts, pop waves, and effects.
- `lib/game/arena.ts`: room geometry, lighting, continuous backing sheets, and bubble instance state.
- `lib/game/plastic.ts`: molded and folded pocket geometry, procedural film maps, physical plastic shader, and reflection environment.
- `lib/game/physics.ts`: Rapier bodies, character movement, grabbing, and impulses.
- `lib/game/tools.ts`: GLB loading, tool instances, and ownership of shared GPU resources.
- `public/models/`: six self-contained GLBs and their asset budget manifest.
- `art/bubble-wrap-tools.blend`: editable model library and product studio; see [asset workflow](art/README.md).
- `tools/blender/`: repeatable modeling, baking, export, and exported-asset review scripts.
- `lib/game/touch.ts`: pointer ownership, stick dead zone and touch look scaling.
- `components/game/touch-controls.tsx`: independent look and movement controls.
- `lib/game/audio.ts`: procedural sound routing.
- `lib/game/tool-icons.ts`: menu portraits rendered from the live tool models.
- `lib/game/pop-synthesis.ts`: pressure-release synthesis and voice scheduling.
- `lib/game/input.ts`: tool input with or without mouse capture.
- `components/game/use-tool-button.tsx`: pointer and keyboard action button.

API references: [Three.js](https://threejs.org/docs/), [Rapier](https://rapier.rs/docs/user_guides/javascript/getting_started_js/).
