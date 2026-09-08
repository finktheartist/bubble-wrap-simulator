"""Prepare the game's CC0 bubble-wrap atlas from five public Freesound previews.

Usage: python3 tools/audio/prepare-pops.py PATH_TO_DOWNLOADED_MP3S
Requires ffmpeg on PATH. Sources and licenses: public/audio/CREDITS.md.
No network calls. The YouTube reference is never used as source material.
"""
import array
import hashlib
import json
import math
import pathlib
import random
import subprocess
import sys
import wave

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = pathlib.Path(sys.argv[1])
RATE = 48000
SLOT = 2880  # 60 ms; 16 independently recorded transients in one small request.
# Source ID, dominant transient time, maximum tail before the next unrelated pop.
CUTS = [
    (399334, 0.00035, .030),
    (399330, .137, .030), (399330, .17448, .032), (399330, .213, .034),
    (399336, .057, .036), (399336, .123, .030), (399336, .16117, .040),
    (399341, .05706, .036), (399341, .102, .040),
    (399339, .116, .032), (399339, .156, .028), (399339, .192, .020),
    (399339, .244, .040), (399339, .296, .020), (399339, .3759, .034),
    (399339, .418, .040),
]
sources = {}
for sid, _, _ in CUTS:
    if sid not in sources:
        data = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(SOURCE / f'{sid}.mp3'),
                                       '-ac', '1', '-ar', str(RATE), '-f', 'f32le', 'pipe:1'])
        values = array.array('f', data)
        if sys.byteorder != 'little': values.byteswap()
        sources[sid] = values

atlas = array.array('h')
manifest = []
for index, (sid, peak_at, tail) in enumerate(CUTS):
    start = max(0, round((peak_at - .0015) * RATE))
    length = round(tail * RATE)
    raw = sources[sid][start:start + length]
    # Remove handling rumble without blunting the initial plastic snap.
    hp = math.exp(-2 * math.pi * 180 / RATE)
    last_x = last_y = 0
    result = []
    for i, x in enumerate(raw):
        y = hp * (last_y + x - last_x)
        last_x, last_y = x, y
        t = i / RATE
        envelope = min(1, t / .00012) * math.exp(-max(0, t - .0035) / (.013 + index % 4 * .002))
        envelope *= min(1, (len(raw) - 1 - i) / (RATE * .004))
        result.append(y * envelope)
    scale = .78 / max(abs(x) for x in result)
    # A quiet original pressure layer supplies the air volume missing from close
    # mic transient cuts, without turning the snap into a pitched cartoon plop.
    rng = random.Random(901 + index * 317)
    phase = low = 0
    for i in range(len(result)):
        t = i / RATE
        low += (1 - math.exp(-2 * math.pi * 700 / RATE)) * (rng.uniform(-1, 1) - low)
        phase += 2 * math.pi * (190 + index % 4 * 25 + 170 * math.exp(-t / .003)) / RATE
        body = (math.sin(phase) * .7 + low * 1.2) * (.22 + index % 5 * .035)
        body *= (1 - math.exp(-t / .0007)) * math.exp(-t / (.007 + index % 3 * .0015))
        body *= min(1, (len(result) - 1 - i) / (RATE * .004))
        result[i] = result[i] * scale + body
    scale = .78 / max(abs(x) for x in result)
    pcm = [round(x * scale * 32767) for x in result]
    atlas.extend(pcm + [0] * (SLOT - len(pcm)))
    manifest.append({'slot': index, 'sourceId': sid, 'sourceStartSeconds': start / RATE,
                     'durationSeconds': len(pcm) / RATE, 'peak': .78})
if sys.byteorder != 'little': atlas.byteswap()
target = ROOT / 'public/audio/bubble-pops.wav'
with wave.open(str(target), 'wb') as output:
    output.setnchannels(1); output.setsampwidth(2); output.setframerate(RATE)
    output.writeframes(atlas.tobytes())
meta = {'sampleRate': RATE, 'framesPerSlot': SLOT, 'slots': manifest,
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'sourceSha256': {str(s): hashlib.sha256((SOURCE / f'{s}.mp3').read_bytes()).hexdigest() for s in sources}}
(ROOT / 'tools/audio/pops-manifest.json').write_text(json.dumps(meta, indent=2) + '\n')
print(f'Prepared {len(CUTS)} recorded pops: {target.stat().st_size} bytes, {meta["sha256"]}')
