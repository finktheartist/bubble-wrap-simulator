# Audio authoring

`public/audio/CREDITS.md` identifies the five CC0 recordings used by the pop bank.
The shipped WAV contains sixteen distinct transients. No API or third-party audio
request is made during play; all assets are served with the game.

To reproduce the bank, place the five original public high-quality MP3 previews
in a local directory, named by their Freesound IDs, then run:

```sh
python3 tools/audio/prepare-pops.py /path/to/sources
```

The script requires FFmpeg. It trims around the selected attacks, removes handling
rumble, keeps brief plastic tails, adds a small original pressure layer, and packs
sixteen 60 ms slots into a mono 48 kHz WAV. `pops-manifest.json` records exact cut
locations and source/output hashes. The game decodes the atlas at the browser's
sample rate; synthesized snaps provide an immediate fallback while it loads.

For a local listening comparison with the last pre-recording release:

```sh
node tools/audio/serve.mjs
```

Open `http://127.0.0.1:4180/review.html`, select **Record comparison**, then use the
player. Recording is silent and saves a local WebM in `outputs/audio-review/`.
It uses both actual game audio engines with the same event pattern. It does not
normalize loudness or include the YouTube reference. The previous engine is read
from commit `abf35be49df524d8d35bc797dcbd34211a5a6362`; a full Git checkout is needed.
The review page and server are tooling only and are not in the Vercel payload.

The sound bank, voice queue, mixing headroom, loading/fallback behavior, and
mute/cancellation cleanup are covered by `tests/audio.test.ts`. Those tests check
correctness; listening remains the quality check for sound direction.

## Item Foley

The item bank contains 39 clips for 17 actions. Download these public CC0 sources
into a local source directory (the large originals are not deployed):

| Local path | Download |
| --- | --- |
| `kenney-impact/Audio/*` | Extract [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) into `kenney-impact/` |
| `kenney-scifi/Audio/*` | Extract [Kenney Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds) into `kenney-scifi/` |
| `swishes/swishes/*` | Extract [Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack) into `swishes/` |
| `firearms/Prepared SFX Library/Walther PPQ/X_31P.wav`, `X_39P.wav` | Extract these two files from [The Free Firearm Sound Library](https://opengameart.org/node/21826) into `firearms/` |
| `explosion3.ogg` | Download the third file from [Explosions](https://opengameart.org/content/explosions-4) |
| `vacuumcleaner01.wav` | Download this file from [General Household Sound Effects](https://opengameart.org/content/general-household-sound-effects) |

```sh
python3 tools/audio/prepare-items.py /path/to/sources
```

This produces `public/audio/item-sounds.wav`, the matching frame index in
`lib/game/tool-bank.ts`, and `tools/audio/items-manifest.json` with every layer,
source hash, cut, filter, pitch, envelope, and loop edit. All sound banks are local
assets; the game needs no generation API, external media host, or credentials.

The pop and item banks load independently and have immediate synthesized
fallbacks. Contact sounds depend on the material and impact speed. Swing peaks
follow the visual contact time. Tool voices are capped separately so they cannot
starve the bubble pops. The vacuum starts once while held and cancels its queued
loop on release; short taps fade the startup instead of jumping to a full-speed
shutdown. Pause, mute, reset, and disposal cancel pending audio.

With the local review server running, open `http://127.0.0.1:4180/items.html`.
**Record fresh demo silently** captures the actual game mixer and all tool actions
in about 31 seconds. Individual buttons audition each item. The saved WebM lands
in `outputs/item-audio/`; export a portable MP3 with:

```sh
ffmpeg -i outputs/item-audio/item-sounds-demo.webm -c:a libmp3lame -b:a 192k outputs/item-audio/item-sounds-demo.mp3
```

The review page is authoring tooling and is excluded from the published game.
