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
- Realism comes from physical construction: a stitched suede glove, rubber-barrel mallet with a hardwood shaft, a continuous turned-wood bat with spiral grip tape, marbled resin bowling ball with three recessed finger wells, a molded pneumatic toy with inset vents and a hollow nozzle, and a painted bomb with gasket, threaded collar and braided fuse. Blender-authored meshes replace the original primitive assemblies. Grain and microtexture are baked into embedded color and normal atlases at 512–768px; material responses remain separate. Menu portraits use these exact models and matching neutral studio light.

Implementation references: [MDN pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events), [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action), [Three.js LatheGeometry](https://threejs.org/docs/pages/LatheGeometry.html). No asset downloads or generation services are used by the game.

## Blender tool rebuild — September 6, 2026

Judge the objects at silhouette scale first: a single connected glove, useful handle and barrel proportions, recessed holes and vents, and hardware attached to the body. Surface detail must follow the shape. Glove panels and stitches conform to the suede surface, and printed marks follow the ball and bomb curvature.

The source library preserves game-scale origins and has separate linked copies for its studio presentation. Exported GLBs are re-imported into a fresh Blender scene for visual review, so the review includes actual baked textures and export conversions. The runtime shares asset resources across tool changes and projectiles. Ball and bomb shell radii still match their existing physics colliders.


## Swing, target, and tool-dock pass — September 6, 2026

Keep the existing bright packing room, graphite typography, and acid-yellow action accent. The user's request to uncover the arena sets the layout direction. Refero's bundled motion and craft references supply the bounded interaction rules: deliberate press feedback, gesture ownership, visible keyboard focus, and a picker anchored to its trigger. No live Refero MCP is configured.

| Decision | Reference and role | Reason |
| --- | --- | --- |
| Equipped tool directly above the action button; full grid only while choosing | User's request for intuitive integration and less obstruction | Keep tool choice beside tool use, with the center and bottom middle clear. |
| Picker pauses play, closes on selection, and supports T / 1–6 | Existing accessible controls and Refero craft guidance | Choosing a tool should not also fire or move the player. |
| Arena tap uses a tool; a drag only aims | User's broken-tap report and gesture-ownership rules | The old touch overlay consumed arena taps without sending a tool action. |
| Grip-pivot hammer strike and lateral bat sweep | User's request for convincing swings | Show preparation, a timed contact, and follow-through instead of wobbling the whole object around its center. |
| Brief trails, air rings, film flecks and impact marker | User's VFX request and Refero feedback-purpose rule | Emphasize movement and confirmed hits while preserving the view. |
| Three drifting bubble targets that reinflate | User's moving-target request | Add repeatable play using the same visible wrap and collision system. |
| Slim machined upper, recessed crown, grip panels and slide serrations | User's more-realistic gun request | Replace the thick toy housing with recognizable material separation and proportions. |

The game pose function is also sampled into Blender review renders, including phone framing. The new blaster export is re-imported for material review. Browser playtesting remains a separate optional step until authorized.
