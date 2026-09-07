# Bubble Wrap Simulator — reference lock

The user's bubble-wrap sandbox owns the direction: an oversized, tactile packing-material playground, immediately visible in a full-screen game. All imagery is real-time Three.js geometry serving gameplay. No bitmap artwork is required.

Refero MCP is unavailable. Bundled Refero color, motion, and craft references supply the bounded UI guidance: neutral canvas with one action accent, immediate feedback, visible keyboard focus, and purpose-driven motion.

| Decision | Source | Role and reason |
| --- | --- | --- |
| Pearly white plastic room, cyan and pink wrapped obstacles | User's bubble-wrap arena | Material differentiation makes poppable shapes legible. |
| Full viewport live world, compact game start, six-slot tool belt | User's first-person sandbox | Play takes priority over content chrome. |
| Graphite text, mist neutral surfaces, acid yellow active controls | Refero color reference | One accent for selected tools and primary actions; object colors remain inside the world. |
| Punchy counters, pressure compression, quick recoil, short crackle tails | User's satisfaction goal and Refero motion reference | Every motion communicates contact, force, or a successful pop. |
| Focus-visible, semantic buttons, reduced shake option | Refero craft reference | Make control states accessible without interrupting play. |

Preserve the bright room, large individually collapsing cells, restrained HUD, and physical tools. Reject a marketing layout, dark cyberpunk chrome, or decoration that obscures the scene.

The tool belt uses small renders of the actual tool models, per the user's request for icons that match the objects. The existing palette, button layout, and text labels remain the reference. Audio direction is a rounded, distinct pop with no scratchy noise tails; large hits spread into brief, separate pops.


## Realism pass — September 6, 2026

The requested direction is real packing film in the existing playful room. Preserve the arena, compact HUD, small bubble spacing, tool models, and rounded pop audio. The reference is the construction of bubble wrap: clear thermoformed pockets, a broad heat-welded lip, continuous backing film, and wrinkled empty pockets after release.

- Separate neutral clear film from its colored backing. Use nonmetallic physical transmission with a small optical thickness, white dielectric reflections, restrained roughness, and no rainbow tint. The colored forms stay legible through the film.
- Replace the hemisphere-plus-torus silhouette with a shallow molded dome tapering into a flat weld. Small deterministic changes in height and rotation break the identical-stud look.
- Keep the perimeter intact when popping. Blend pocket vertices and normals toward a folded shape, strengthen fine wrinkle normals, and reset both geometry state and gameplay state on reinflation.
- Use continuous backing sheets with subtle grain and dark contact rings at the pocket welds. Mipmapped material maps avoid noisy texture shimmer at distance.
- Ground the room with a neutral, lower-saturation material palette, soft shadow filtering, lower ambient wash, and overhead area lights. Reflection panels match the overhead strips and establish long white highlights on the plastic.
- Keep GPU instancing. Balanced quality uses a smaller transmission buffer; high quality increases its resolution. No image downloads or external services are required during play.

Material implementation follows [Three.js physical transmission](https://threejs.org/docs/pages/MeshPhysicalMaterial.html) and [rectangular area lights](https://threejs.org/docs/pages/RectAreaLight.html). This remains a real-time approximation of packing film; it does not simulate cloth or air pressure.

## Mobile and tool realism — September 6, 2026

Build target: the existing bright packing room and compact acid-yellow HUD. The bundled Refero craft reference supplies bounded touch guidance (gesture ownership, deliberate tap feedback, accessible buttons, scroll-contained dialogs). Preserve the arena, all six tools, small clear bubbles, and pop audio.

- Phone controls use a left movement well and right action dock, with all six tools in a strip above them. Landscape moves the strip between the thumbs. Respect all four safe-area insets and the dynamic viewport; keep pause and settings reachable. Touch targets are at least 44px at the supported 320px portrait and 568px landscape minimums. Compact tool labels remain secondary to rendered portraits and the selected tool name.
- Each movement, look, and action gesture owns a pointer ID. A second finger cannot steal a drag, and cancelled/captured-lost actions cannot launch a charged object. The action button also supports drag-to-aim. A center dead zone suppresses stick drift. Orientation changes pause the game.
- Phone rendering caps balanced resolution at 1×, uses a 45% transmission buffer and 10-segment pockets (the same cells and gameplay as desktop), and bounds projectiles to 24. Hidden tabs skip rendering; paused scenes redraw at 10 Hz. Tool framing adapts to portrait screens.
- Realism comes from physical construction: a stitched suede glove, rubber-barrel mallet with a hardwood shaft, a continuous turned-wood bat with spiral grip tape, marbled resin bowling ball with three recessed finger wells, a molded pneumatic toy with inset vents and a hollow nozzle, and a painted bomb with gasket, threaded collar and braided fuse. Locally generated grain and microtexture maps stay small and shared. Menu portraits use these exact models and matching neutral studio light.

Implementation references: [MDN pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events), [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action), [Three.js LatheGeometry](https://threejs.org/docs/pages/LatheGeometry.html). No asset downloads or generation services are used by the game.
