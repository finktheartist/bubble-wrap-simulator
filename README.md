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

Touch devices receive a movement stick, a drag-to-look region, and jump, grab, and action buttons. Settings include volume, sensitivity, camera shake, footstep popping, and rendering quality. Only preferences persist in local storage.

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

- Three.js renders instanced hemispheres with a sealed rim, clearcoat, subtle iridescence, environment reflections, and short collapse animations. Popped cells stay flat until reset.
- Rapier provides a fixed 60 Hz rigid-body simulation, a capsule character controller, gravity, contact events, object mass, friction, restitution, continuous collision detection, and collision-preserving object grabbing.
- Bowling balls, parcels, pellets, and bombs are dynamic bodies. Contact position and impact speed determine pop radius. Explosions apply distance-based impulses and schedule outward-moving crackles.
- Web Audio synthesizes each pop from a sharp membrane snap, a brief pressure body, and five irregular plastic micro-crinkles. Twenty-four variants, stereo placement, a quiet room reflection, and bounded 4.5 ms voice scheduling preserve the crackle of simultaneous pops. A compressor controls peaks. No audio assets or external services are needed during play.
- GPU instancing, bounded projectiles, bounded particles, and a balanced render setting keep the room practical for a browser.

The wrap itself uses a hybrid approximation: rigid backing plus individually animated cells. It does not simulate tearing sheets, cloth, or air pressure. The six tools are stylized sandbox objects rather than engineering-accurate weapon simulations.

## Validation

Eleven automated tests exercise tool-button availability, mouse and keyboard use without capture, quick-tap activation of all six tools, bounded audio transients and multi-pop scheduling, one-time popping and reinflation, walking/wall collision/jumping/landing, high-speed contact detection, collision-preserving grabbing, and blast falloff/reset. TypeScript checks the full project. Lint checks application, game, and test sources; the untouched generated component catalog has pre-existing lint failures and is outside that command.

Browser playtesting is a separate optional step, pending the user's choice in the build conversation. Touch controls are implemented but are not yet verified on a physical device.

## Architecture

- `app/page.tsx`: game HUD, tool belt, pause and settings UI, touch input.
- `lib/game/game.ts`: game loop, input, targeting, impacts, pop waves, and effects.
- `lib/game/arena.ts`: room geometry and bubble instance state.
- `lib/game/physics.ts`: Rapier bodies, character movement, grabbing, and impulses.
- `lib/game/tools.ts`: physical tool models.
- `lib/game/audio.ts`: procedural sound routing.
- `lib/game/pop-synthesis.ts`: pressure-release synthesis and voice scheduling.
- `lib/game/input.ts`: tool input with or without mouse capture.
- `components/game/use-tool-button.tsx`: pointer and keyboard action button.

API references: [Three.js](https://threejs.org/docs/), [Rapier](https://rapier.rs/docs/user_guides/javascript/getting_started_js/).
