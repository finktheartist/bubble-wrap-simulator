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
