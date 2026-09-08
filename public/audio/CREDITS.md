# Bubble wrap recordings

The game's `bubble-pops.wav` contains 16 edited transients from recordings by
**Anthousai**, released under **CC0 1.0 Universal** on Freesound:

- [Single pop](https://freesound.org/people/Anthousai/sounds/399334/)
- [Multiple pops 01](https://freesound.org/people/Anthousai/sounds/399330/)
- [Multiple pops 04](https://freesound.org/people/Anthousai/sounds/399336/)
- [Multiple pops 07](https://freesound.org/people/Anthousai/sounds/399341/)
- [Multiple pops 09](https://freesound.org/people/Anthousai/sounds/399339/)

License: https://creativecommons.org/publicdomain/zero/1.0/

The public high-quality MP3 previews were retrieved September 8, 2026. Each sound's
CC0 license was verified on its original Freesound page. Edits: mono conversion,
48 kHz resampling, individual transient cuts, removal of low handling rumble,
shortened tails, a quiet original synthesized pressure layer, peak normalization,
and packing into a WAV atlas. The preparation
script and exact source hashes are in `tools/audio/` in the repository.

## Item sound effects

`item-sounds.wav` contains 39 edited and layered clips from these **CC0 1.0**
libraries, retrieved September 8, 2026:

- [Impact Sounds](https://kenney.nl/assets/impact-sounds) by **Kenney**: wood,
  soft, punch, generic, and metal Foley for mallet, bat, ball, parcel, pellet,
  cannon mechanism, and bomb arming sounds.
- [Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds) by **Kenney**: thruster
  and low-frequency pressure layers for the rocket and bowling cannon.
- [Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack) by
  **artisticdude**: air movement for swinging and throwing.
- [The Free Firearm Sound Library](https://opengameart.org/node/21826) by
  **Ben Jaszczak, Brian Nelson, Kevin Heras, and Matthew Nanney**: four Walther
  PPQ transients from `X_31P.wav` and `X_39P.wav`, trimmed to remove long range ambience.
- [Explosions](https://opengameart.org/content/explosions-4) by **EZduzziteh**:
  `explosion3.ogg`, shortened and pitched for bomb and rocket impacts.
- [General Household Sound Effects](https://opengameart.org/content/general-household-sound-effects)
  by **bretbernhoft**: `vacuumcleaner01.wav`, edited into a vacuum loop with
  original pitch ramps for startup and wind-down.

Edits include mono conversion, 32 kHz resampling, pitch and speed changes,
filtering, layering, envelopes, loop crossfading, and peak normalization. Exact
source hashes and edit recipes are in `tools/audio/items-manifest.json`.
The game synthesizes small fallback sounds if an audio bank cannot load.
No audio from the YouTube style reference is included in this game.
