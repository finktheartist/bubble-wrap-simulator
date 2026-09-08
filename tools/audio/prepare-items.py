#!/usr/bin/env python3
"""Build the small, deterministic item Foley atlas. Requires Python 3 + FFmpeg."""
from pathlib import Path
import array, hashlib, json, math, subprocess, sys, wave
ROOT = Path(__file__).resolve().parents[2]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'outputs/item-audio/sources'
RATE = 32000
IMPACT = 'kenney-impact/Audio/'
SWISH = 'swishes/swishes/'
GUN = 'firearms/Prepared SFX Library/1911/A_42P.wav'
source_hashes = {}
recipes = []
clips = []
atlas = array.array('h')

def layer(path, duration, start=0, pitch=1, lowpass=10000, highpass=70, level=1, tempo=1, ramp=None, eq=(), compression=False):
    file = ROOT / path[2:] if path.startswith('@/') else SRC / path
    source_hashes[path] = hashlib.sha256(file.read_bytes()).hexdigest()
    filters = [f'atrim=start={start}:duration={duration}', 'asetpts=PTS-STARTPTS', f'asetrate=32000*{pitch}', 'aresample=32000', f'highpass=f={highpass}', f'lowpass=f={lowpass}']
    filters.extend(eq)
    if compression: filters.append('acompressor=threshold=0.09:ratio=3:attack=0.05:release=45:knee=2:detection=peak')
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
    recipe = dict(source=path,start=start,duration=duration,pitch=pitch,lowpass=lowpass,highpass=highpass,level=level,tempo=tempo,ramp=ramp,eq=list(eq),compression=compression)
    return samples, recipe

def add(kind, duration, layers, fade_in=.001, fade_out=.04, decay_from=None, loop=False, rms_ceiling=None):
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
    if rms_ceiling:
        rms=math.sqrt(sum(v*v for v in out)/len(out))
        if rms>rms_ceiling: out=[v*rms_ceiling/rms for v in out]
    # Ten-millisecond RMS peak aligns an air pass with the visual strike.
    windows=[sum(v*v for v in out[i:i+320]) for i in range(0,n,160)]
    peak_seconds=(max(range(len(windows)),key=windows.__getitem__)*160+160)/RATE
    clips.append(dict(kind=kind,offsetFrames=len(atlas),lengthFrames=n,peakSeconds=round(peak_seconds,5)))
    recipes.append(dict(kind=kind,duration=duration,fadeIn=fade_in,fadeOut=fade_out,decayFrom=decay_from,loop=loop,rmsCeiling=rms_ceiling,layers=[dict(**recipe,offset=offset) for (_,recipe),offset in layers]))
    atlas.extend(round(max(-1,min(1,v))*32767) for v in out)

def l(path,duration,**kwargs): return layer(path,duration,**kwargs),0

for i in range(3):
    add('mallet-hit',.25,[l(IMPACT+f'impactSoft_heavy_00{i}.ogg',.25,lowpass=4200),l(IMPACT+f'impactPunch_heavy_00{i}.ogg',.075,pitch=.84,level=.28,lowpass=5000)],decay_from=.12)
    add('bat-hit',.24,[l(IMPACT+f'impactWood_heavy_00{i}.ogg',.25,pitch=.98,lowpass=7600)],fade_out=.055)
    add('ball-hit',.34,[l(IMPACT+f'impactSoft_heavy_00{i}.ogg',.3,pitch=.79,lowpass=1800),l(IMPACT+f'impactWood_heavy_00{i}.ogg',.05,pitch=.8,lowpass=2200,level=.28)],decay_from=.15)
    add('pellet-hit',.085,[l(IMPACT+f'impactGeneric_light_00{i}.ogg',.075,pitch=1.1,highpass=800)],fade_out=.04)
for i in range(2):
    add('parcel-hit',.24,[l(IMPACT+f'impactSoft_medium_00{i}.ogg',.24,lowpass=4800)],decay_from=.1)
# Close/mid .45 reports retain their pressure body and early acoustic reflections.
# Fast peak compression controls the microphone spike instead of trimming away the body.
for i,(file,start) in enumerate([(GUN,.936),(GUN,4.994),(GUN.replace('A_42P','A_34P'),1.535),(GUN.replace('A_42P','A_34P'),6.65)]):
    body_file=GUN.replace('A_42P','A_34P')
    body_start=6.65 if i%2==0 else 1.535
    add('pistol',.46,[l(file,.46,start=start,highpass=65,lowpass=9000,compression=True,eq=('equalizer=f=240:t=q:w=.8:g=3',)),
        (layer(body_file,.25,start=body_start,highpass=70,lowpass=1300,level=.6,compression=True),.003)],fade_in=.0002,fade_out=.12,decay_from=.14,rms_ceiling=.105)
for pitch in [1,.96]:
    add('launcher',.78,[l('fireworks/fw_04.ogg',.125,start=.014,pitch=pitch,lowpass=7200,compression=True),
        (layer('fireworks/fw_04.ogg',.75,start=.42,pitch=pitch,lowpass=4400,highpass=220,level=.48),.025),
        l('cannon-fire.ogg',.1,pitch=1.18*pitch,lowpass=1300,level=.3)],fade_in=.0005,fade_out=.18,decay_from=.38)
    add('cannon',.8,[l('cannon-fire.ogg',.82,pitch=pitch,lowpass=6700,highpass=45,compression=True),
        l(IMPACT+'impactMetal_light_000.ogg',.055,level=.12)],fade_in=.0004,fade_out=.15,decay_from=.15)
for i in [7,8,9]:
    add('swish',.19,[l(SWISH+f'swish-{i}.wav',.18,start=.008,pitch=1.05)],fade_in=.008,fade_out=.024)
    add('heavy-swish',.25,[l(SWISH+f'swish-{i}.wav',.195,pitch=.79,lowpass=5600)],fade_in=.014,fade_out=.045)
for i in [5,6]:
    add('throw',.17,[l(SWISH+f'swish-{i}.wav',.14,pitch=.9,lowpass=4500)],fade_in=.01,fade_out=.03)
for i in range(2):
    add('bomb-arm',.48,[l(IMPACT+f'impactMetal_light_00{i}.ogg',.055,highpass=750,level=.8),
        (layer('fireworks/fw_04.ogg',.4,start=1.35,highpass=600,lowpass=4500,level=.3),.06),
        (layer(IMPACT+f'impactGeneric_light_00{i}.ogg',.06,pitch=.9,level=.45),.09)],fade_out=.12)
for pitch in [.91,.96]:
    add('bomb-blast',1.05,[l('fireworks/cannon_02.ogg',1,pitch=pitch,lowpass=6300,highpass=45,compression=True),
        l('cannon-fire.ogg',.35,pitch=.82,lowpass=550,highpass=40,level=.22)],fade_in=.0004,fade_out=.2,decay_from=.53)
for pitch in [1.03,.98]:
    add('rocket-blast',.82,[l('fireworks/cannon_01.ogg',.82,start=.077,pitch=pitch,lowpass=7500,highpass=55,compression=True)],fade_in=.0004,fade_out=.16,decay_from=.4)
# Remove narrow motor harmonics before the startup/stop pitch ramps. Keep warm airflow.
vacuum_eq=tuple(f'equalizer=f={f}:t=q:w={q}:g={g}' for f,q,g in [(1082,12,-12),(2164,10,-12),(3246,7,-24),(6492,6,-24)])+('lowpass=f=2100:p=2',)
add('vacuum-start',.44,[l('vacuumcleaner01.wav',.44,start=34,lowpass=2100,highpass=75,eq=vacuum_eq,ramp=(.65,1))],fade_in=.12,fade_out=.075)
add('vacuum',1.4,[l('vacuumcleaner01.wav',1.4,start=35,lowpass=2100,highpass=75,eq=vacuum_eq)],loop=True)
add('vacuum-stop',.5,[l('vacuumcleaner01.wav',.5,start=37,lowpass=2100,highpass=75,eq=vacuum_eq,ramp=(1,.5))],fade_in=.025,fade_out=.28)
# Strong contacts use a larger plastic snap with a separate low pressure layer.
# Finger taps and suction continue to use the original, unchanged small-pop bank.
for slot in [0,3,7,9,12,15]:
    add('big-pop',.1,[l('@/public/audio/bubble-pops.wav',.06,start=slot*.06,pitch=.78,lowpass=8500,highpass=55),
        (layer('@/public/audio/bubble-pops.wav',.06,start=slot*.06,pitch=.5,lowpass=1100,highpass=40,level=.48),.002)],fade_in=.00015,fade_out=.018)

output=ROOT/'public/audio/item-sounds.wav'
with wave.open(str(output),'wb') as f:
    f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(atlas.tobytes())
metadata=dict(url='/audio/item-sounds.wav',sampleRate=RATE,frames=len(atlas),clips=clips)
(ROOT/'lib/game/tool-bank.ts').write_text('// Generated by tools/audio/prepare-items.py. Frame offsets use the source rate.\nexport const TOOL_ATLAS = '+json.dumps(metadata,indent=2)+' as const;\n')
manifest=dict(sha256=hashlib.sha256(output.read_bytes()).hexdigest(),bytes=output.stat().st_size,sourceSha256=source_hashes,recipes=recipes,**metadata)
(ROOT/'tools/audio/items-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'{len(clips)} clips, {len(atlas)/RATE:.3f} seconds, {output.stat().st_size:,} bytes, sha256 {manifest["sha256"]}')
