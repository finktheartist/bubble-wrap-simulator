#!/usr/bin/env python3
"""Build the small, deterministic item Foley atlas. Requires Python 3 + FFmpeg."""
from pathlib import Path
import array, hashlib, json, math, subprocess, sys, wave
ROOT = Path(__file__).resolve().parents[2]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'outputs/item-audio/sources'
RATE = 32000
IMPACT = 'kenney-impact/Audio/'
SCIFI = 'kenney-scifi/Audio/'
SWISH = 'swishes/swishes/'
GUN = 'firearms/Prepared SFX Library/Walther PPQ/X_31P.wav'
source_hashes = {}
recipes = []
clips = []
atlas = array.array('h')

def layer(path, duration, start=0, pitch=1, lowpass=10000, highpass=70, level=1, tempo=1, ramp=None):
    file = SRC / path
    source_hashes[path] = hashlib.sha256(file.read_bytes()).hexdigest()
    filters = [f'atrim=start={start}:duration={duration}', 'asetpts=PTS-STARTPTS', f'asetrate=32000*{pitch}', 'aresample=32000', f'highpass=f={highpass}', f'lowpass=f={lowpass}']
    if tempo != 1: filters.append(f'atempo={tempo}')
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(file),'-ac','1','-ar',str(RATE),'-af',','.join(['aresample=32000',*filters]),'-f','f32le','pipe:1'])
    samples = array.array('f',raw)
    peak = max(map(abs,samples),default=1) or 1
    samples = array.array('f',(v/peak*level for v in samples))
    if ramp:
        original=samples; samples=array.array('f'); pos=0.0
        for i in range(len(original)):
            u=i/max(1,len(original)-1); index=int(pos); fraction=pos-index
            samples.append(original[min(index,len(original)-1)]*(1-fraction)+original[min(index+1,len(original)-1)]*fraction)
            pos+=ramp[0]+(ramp[1]-ramp[0])*(u*u*(3-2*u))
    recipe = dict(source=path,start=start,duration=duration,pitch=pitch,lowpass=lowpass,highpass=highpass,level=level,tempo=tempo,ramp=ramp)
    return samples, recipe

def add(kind, duration, layers, fade_in=.001, fade_out=.04, decay_from=None, loop=False):
    n = round(duration*RATE); out = [0.0]*n
    for (samples,_), offset in layers:
        offset = round(offset*RATE)
        for i,v in enumerate(samples[:n-offset]): out[i+offset] += v
    if loop:
        # Crossfade the end into the first 50 ms; the next cycle continues at that point.
        cross = round(.05*RATE)
        for i in range(cross):
            u=i/(cross-1)
            out[n-cross+i]=out[n-cross+i]*math.cos(u*math.pi/2)+out[i]*math.sin(u*math.pi/2)
        out=out[cross:]; n=len(out)
    else:
        for i in range(n):
            t=i/RATE
            envelope=min(1,i/max(1,fade_in*RATE),(n-1-i)/max(1,fade_out*RATE))
            if decay_from is not None and t>decay_from:
                envelope*=math.exp(-3.5*(t-decay_from)/(duration-decay_from))
            out[i]*=envelope
    peak=max(map(abs,out)) or 1
    out=[v/peak*.72 for v in out]
    # Ten-millisecond RMS peak aligns an air pass with the visual strike.
    windows=[sum(v*v for v in out[i:i+320]) for i in range(0,n,160)]
    peak_seconds=(max(range(len(windows)),key=windows.__getitem__)*160+160)/RATE
    clips.append(dict(kind=kind,offsetFrames=len(atlas),lengthFrames=n,peakSeconds=round(peak_seconds,5)))
    recipes.append(dict(kind=kind,duration=duration,fadeIn=fade_in,fadeOut=fade_out,decayFrom=decay_from,loop=loop,layers=[dict(**recipe,offset=offset) for (_,recipe),offset in layers]))
    atlas.extend(round(max(-1,min(1,v))*32767) for v in out)

def l(path,duration,**kwargs): return layer(path,duration,**kwargs),0

for i in range(3):
    add('mallet-hit',.25,[l(IMPACT+f'impactSoft_heavy_00{i}.ogg',.25,lowpass=4200),l(IMPACT+f'impactPunch_heavy_00{i}.ogg',.075,pitch=.84,level=.28,lowpass=5000)],decay_from=.12)
    add('bat-hit',.24,[l(IMPACT+f'impactWood_heavy_00{i}.ogg',.25,pitch=.98,lowpass=7600)],fade_out=.055)
    add('ball-hit',.34,[l(IMPACT+f'impactSoft_heavy_00{i}.ogg',.3,pitch=.79,lowpass=1800),l(IMPACT+f'impactWood_heavy_00{i}.ogg',.05,pitch=.8,lowpass=2200,level=.28)],decay_from=.15)
    add('pellet-hit',.085,[l(IMPACT+f'impactGeneric_light_00{i}.ogg',.075,pitch=1.1,highpass=800)],fade_out=.04)
for i in range(2):
    add('parcel-hit',.24,[l(IMPACT+f'impactSoft_medium_00{i}.ogg',.24,lowpass=4800)],decay_from=.1)
# Four different recorded shots; trims exclude all speech and long outdoor tails.
for file,start in [(GUN,1.078),(GUN,5.238),(GUN.replace('X_31P','X_39P'),1.394),(GUN.replace('X_31P','X_39P'),6.433)]:
    add('pistol',.28,[l(file,.28,start=start,highpass=85,lowpass=8800)],fade_in=.0004,fade_out=.06,decay_from=.14)
for i in range(2):
    add('launcher',.58,[l(SCIFI+f'thrusterFire_00{i}.ogg',.57,start=1.08,lowpass=7500),l(IMPACT+f'impactMetal_light_00{i}.ogg',.045,level=.18)],fade_in=.003,fade_out=.15,decay_from=.3)
    add('cannon',.35,[l(SCIFI+'lowFrequency_explosion_001.ogg',.28,start=.02,pitch=1.22,lowpass=1500,level=.85),l(SCIFI+f'thrusterFire_00{i}.ogg',.23,start=1.08,highpass=650,level=.32),l(IMPACT+f'impactMetal_light_00{i}.ogg',.04,level=.13)],fade_out=.09,decay_from=.12)
for i in [7,8,9]:
    add('swish',.19,[l(SWISH+f'swish-{i}.wav',.18,start=.008,pitch=1.05)],fade_in=.008,fade_out=.024)
    add('heavy-swish',.25,[l(SWISH+f'swish-{i}.wav',.195,pitch=.79,lowpass=5600)],fade_in=.014,fade_out=.045)
for i in [5,6]:
    add('throw',.17,[l(SWISH+f'swish-{i}.wav',.14,pitch=.9,lowpass=4500)],fade_in=.01,fade_out=.03)
for i in range(2):
    add('bomb-arm',.18,[l(IMPACT+f'impactMetal_light_00{i}.ogg',.055,highpass=750,level=.7),(layer(IMPACT+f'impactGeneric_light_00{i}.ogg',.06,pitch=.9,level=.45),.09)],fade_out=.024)
for pitch in [1, .96]:
    add('bomb-blast',.76,[l('explosion3.ogg',.74,pitch=pitch,lowpass=6400)],fade_out=.15,decay_from=.30)
for pitch in [1.17,1.12]:
    add('rocket-blast',.5,[l('explosion3.ogg',.57,pitch=pitch,lowpass=7500),l(SCIFI+'thrusterFire_000.ogg',.2,start=1.1,level=.18)],fade_out=.1,decay_from=.18)
add('vacuum-start',.44,[l('vacuumcleaner01.wav',.44,start=34,lowpass=5800,highpass=85,ramp=(.65,1))],fade_in=.12,fade_out=.075)
add('vacuum',1.4,[l('vacuumcleaner01.wav',1.4,start=35,lowpass=5800,highpass=85)],loop=True)
add('vacuum-stop',.5,[l('vacuumcleaner01.wav',.5,start=37,lowpass=5800,highpass=85,ramp=(1,.5))],fade_in=.025,fade_out=.28)

output=ROOT/'public/audio/item-sounds.wav'
with wave.open(str(output),'wb') as f:
    f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(atlas.tobytes())
metadata=dict(url='/audio/item-sounds.wav',sampleRate=RATE,frames=len(atlas),clips=clips)
(ROOT/'lib/game/tool-bank.ts').write_text('// Generated by tools/audio/prepare-items.py. Frame offsets use the source rate.\nexport const TOOL_ATLAS = '+json.dumps(metadata,indent=2)+' as const;\n')
manifest=dict(sha256=hashlib.sha256(output.read_bytes()).hexdigest(),bytes=output.stat().st_size,sourceSha256=source_hashes,recipes=recipes,**metadata)
(ROOT/'tools/audio/items-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'{len(clips)} clips, {len(atlas)/RATE:.3f} seconds, {output.stat().st_size:,} bytes, sha256 {manifest["sha256"]}')
