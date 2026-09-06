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
