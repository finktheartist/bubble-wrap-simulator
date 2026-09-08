import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PopVoiceScheduler, synthesizePop } from '../lib/game/pop-synthesis';
import { synthesizeTool, TOOL_SOUNDS } from '../lib/game/tool-synthesis';
import { PopAudio, splitPopAtlas, splitToolAtlas, POP_ATLAS } from '../lib/game/audio';
import { TOOL_ATLAS } from '../lib/game/tool-bank';
import { AudioContextStub, BufferStub } from './helpers/audio-context';

function random(seed = 739) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function rms(samples: Float32Array, from = 0, to = samples.length) {
  let energy = 0;
  for (let i = from; i < to; i++) energy += samples[i] ** 2;
  return Math.sqrt(energy / (to - from));
}
const itemBytes = readFileSync(new URL('../public/audio/item-sounds.wav', import.meta.url));
const itemManifest = JSON.parse(readFileSync(new URL('../tools/audio/items-manifest.json', import.meta.url), 'utf8'));
const bytes = readFileSync(new URL('../public/audio/bubble-pops.wav', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../tools/audio/pops-manifest.json', import.meta.url), 'utf8'));
function recorded() {
  const samples = new Float32Array((bytes.length - 44) / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = bytes.readInt16LE(44 + i * 2) / 32768;
  return samples;
}

await test('recorded pop bank has sixteen distinct, dry transients with clean boundaries and source provenance', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256);
  assert.equal(bytes.readUInt32LE(24), 48000);
  assert.equal(bytes.readUInt16LE(22), 1);
  assert.ok(bytes.length < 100000, 'the complete bank remains small enough for mobile');
  const data = recorded(), fingerprints = new Set<string>();
  assert.equal(data.length, POP_ATLAS.count * 2880);
  for (let i = 0; i < POP_ATLAS.count; i++) {
    const pop = data.subarray(i * 2880, (i + 1) * 2880);
    assert.equal(pop[0], 0);
    assert.equal(pop.at(-1), 0);
    const peak = Math.max(...pop.map(Math.abs));
    assert.ok(peak > .77 && peak < .79, 'each trimmed recording leaves headroom');
    assert.ok(rms(pop, 0, 576) > .05, 'a clear transient remains');
    assert.ok(rms(pop, 1680, 2880) < .003, 'handling noise does not trail into the next pop');
    fingerprints.add(createHash('sha256').update(new Uint8Array(pop.buffer, pop.byteOffset, pop.byteLength)).digest('hex'));
    assert.ok(manifest.sourceSha256[manifest.slots[i].sourceId], 'every cut has a source hash');
  }
  assert.equal(fingerprints.size, 16, 'variation comes from distinct recorded transients');
});

await test('fallback pops remain finite, brief, varied and quiet at both phone sample rates', () => {
  for (const rate of [44100, 48000]) for (const variant of [0, 9, 15]) {
    const pop = synthesizePop(rate, variant, random());
    assert.ok(pop.every(Number.isFinite));
    assert.ok(Math.max(...pop.map(Math.abs)) < .8);
    assert.ok(rms(pop, 0, Math.floor(.012 * rate)) > .06);
    assert.ok(rms(pop, Math.floor(.035 * rate)) < .001);
    assert.equal(pop[0], 0); assert.ok(Math.abs(pop.at(-1)!) < .0001);
    assert.notDeepEqual(pop, synthesizePop(rate, (variant + 7) % 16, random(920)));
  }
});

await test('atlas splitting respects decoded sample rate and rejects malformed banks', () => {
  for (const rate of [44100, 48000]) {
    const ctx = new AudioContextStub(), atlas = new BufferStub(1, Math.round(.96 * rate), rate);
    for (let i = 0; i < 16; i++) atlas.data[Math.round(i * .06 * rate)] = (i + 1) / 16;
    const bank = splitPopAtlas(ctx as unknown as BaseAudioContext, atlas as unknown as AudioBuffer);
    assert.equal(bank.length, 16);
    for (let i = 0; i < 16; i++) {
      assert.equal(bank[i].sampleRate, rate); assert.equal(bank[i].getChannelData(0)[0], (i + 1) / 16);
      assert.ok(Math.abs(bank[i].duration - .06) < 1 / rate);
    }
    assert.throws(() => splitPopAtlas(ctx as unknown as BaseAudioContext, new BufferStub(2, 100, rate) as unknown as AudioBuffer));
  }
});

await test('large impacts keep irregular distinct attacks inside an 85 ms queue', () => {
  const scheduler = new PopVoiceScheduler(random()), starts: number[] = [];
  for (let i = 0; i < 250; i++) { const at = scheduler.reserve(5); if (at !== null) starts.push(at); }
  assert.ok(starts.length >= 3 && starts.length <= 4);
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= .0239);
  assert.ok(starts.at(-1)! <= 5.085);
  assert.ok(scheduler.reserve(6)! >= 6);
  scheduler.reset(); assert.ok(scheduler.reserve(0)! < .01);
});

await test('a sustained recorded crackle has headroom and stops without a long sound backlog', () => {
  const rate = 48000, scheduler = new PopVoiceScheduler(random()), data = recorded(), mixed = new Float32Array(rate * 2);
  let count = 0;
  for (let frame = 0; frame < 45; frame++) for (let bubble = 0; bubble < 80; bubble++) {
    const at = scheduler.reserve(frame / 60); if (at === null) continue;
    const pop = data.subarray(count++ % 16 * 2880, ((count - 1) % 16 + 1) * 2880);
    const start = Math.round(at * rate);
    for (let i = 0; i < pop.length; i++) mixed[start + i] += pop[i] * .94;
  }
  assert.ok(count > 20);
  assert.ok(Math.max(...mixed.map(Math.abs)) < .8);
  assert.ok(rms(mixed, rate) < .0001);
});

await test('tool cues have finite samples, bounded peaks and a seamless motor loop', () => {
  for (const rate of [44100, 48000]) for (const kind of TOOL_SOUNDS) {
    const sound = synthesizeTool(rate, kind, random());
    assert.ok(sound.every(Number.isFinite)); assert.ok(Math.max(...sound.map(Math.abs)) < 1);
    assert.ok(rms(sound) > .005); assert.ok(Math.abs(sound[0]) < .0001);
    assert.ok(Math.abs(sound.at(-1)!) < (kind === 'vacuum' ? .01 : .001));
  }
});

await test('audio resumes immediately, shares one download per bank, and cancels motors and queued pops on mute/pause/dispose', async t => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { value: AudioContextStub, configurable: true });
  t.after(() => { if (prior) Object.defineProperty(globalThis, 'AudioContext', prior); else Reflect.deleteProperty(globalThis, 'AudioContext'); });
  const releases = new Map<string, (response: Response) => void>(); let downloads = 0;
  t.mock.method(globalThis, 'fetch', (url: string) => { downloads++; return new Promise<Response>(resolve => { releases.set(url, resolve); }); });
  const audio = new PopAudio(), first = audio.start(), second = audio.start();
  const ctx = audio.context as unknown as AudioContextStub;
  assert.equal(ctx.state, 'running', 'resume happens inside the gesture before awaiting download');
  assert.equal(downloads, 2);
  audio.pop(); assert.equal(ctx.sources.length, 1, 'first actions retain an offline fallback');
  releases.get(POP_ATLAS.url)!(new Response(bytes)); releases.get(TOOL_ATLAS.url)!(new Response(itemBytes));
  await Promise.all([first, second]); assert.equal(ctx.decodeCalls, 2);
  ctx.currentTime = 1;
  for (let i = 0; i < 6; i++) { audio.pop(); ctx.currentTime += .2; }
  for (let i = 2; i < 7; i++) assert.notEqual(ctx.sources[i].buffer, ctx.sources[i - 1].buffer, 'no consecutive sample repeats');
  const before = ctx.sources.length;
  for (let i = 0; i < 60; i++) audio.vacuum(true);
  assert.equal(ctx.sources.length, before + 2, 'holding creates one start and one loop');
  assert.equal(ctx.sources.slice(before).filter(source => source.loop).length, 1);
  const motor = ctx.sources.at(-1)!; audio.vacuum(false); assert.ok(motor.stops.length > 0);
  motor.finish();
  audio.vacuum(true); audio.pop(); audio.pop();
  audio.muted = true; audio.update();
  assert.ok(ctx.sources.every(source => source.stops.length > 0), 'mute cancels every pending source');
  const mutedCount = ctx.sources.length; audio.vacuum(true); audio.pop(); audio.fire('pistol');
  assert.equal(ctx.sources.length, mutedCount);
  ctx.sources.forEach(source => source.finish());
  audio.muted = false; audio.update(); audio.pop();
  const last = ctx.sources.at(-1)!; assert.ok(last.starts[0] - ctx.currentTime < .01, 'pause/mute reset the queue');
  audio.stop(); assert.ok(last.stops.length > 0);
  audio.dispose(); assert.equal(ctx.state, 'closed'); assert.equal(audio.context, null);
});

await test('a failed sample download preserves usable fallback sounds and does not retry on every tap', async t => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { value: AudioContextStub, configurable: true });
  t.after(() => { if (prior) Object.defineProperty(globalThis, 'AudioContext', prior); else Reflect.deleteProperty(globalThis, 'AudioContext'); });
  let downloads = 0;
  t.mock.method(globalThis, 'fetch', async () => { downloads++; throw new Error('Offline'); });
  const audio = new PopAudio(); await audio.start(); await audio.start(); audio.pop();
  const ctx = audio.context as unknown as AudioContextStub;
  assert.equal(downloads, 2); assert.equal(ctx.sources.length, 1);
  assert.ok(ctx.sources[0].buffer!.data.some(sample => sample !== 0));
  audio.dispose();
});

await test('the item bank covers every action with sourced, bounded samples and a continuous motor seam', () => {
  assert.equal(createHash('sha256').update(itemBytes).digest('hex'), itemManifest.sha256);
  assert.ok(itemBytes.length < 1200000, 'all item Foley stays below 1.2 MB on mobile');
  assert.deepEqual(new Set(TOOL_ATLAS.clips.map(c => c.kind)), new Set(TOOL_SOUNDS));
  assert.equal(itemBytes.readUInt32LE(24), TOOL_ATLAS.sampleRate);
  const hashes = new Set<string>(); let end = 0;
  for (const clip of TOOL_ATLAS.clips) {
    assert.equal(clip.offsetFrames, end); end += clip.lengthFrames;
    const samples = Float32Array.from({length:clip.lengthFrames}, (_, i) => itemBytes.readInt16LE(44 + (clip.offsetFrames + i)*2)/32768);
    assert.ok(samples.every(Number.isFinite));
    assert.ok(Math.max(...samples.map(Math.abs)) < .721);
    assert.ok(rms(samples) > .01, clip.kind + ' is audible');
    if (clip.kind !== 'vacuum') { assert.equal(samples[0], 0); assert.equal(samples.at(-1), 0); }
    else {
      // Airflow has larger adjacent samples than a tonal motor. Compare the seam
      // with its own waveform, rather than a fixed threshold for quiet sine waves.
      let largestStep = 0;
      for (let i=1;i<samples.length;i++) largestStep=Math.max(largestStep,Math.abs(samples[i]-samples[i-1]));
      assert.ok(Math.abs(samples[0]-samples.at(-1)!) <= largestStep, 'seam is within the natural airflow slope');
      const ratio=rms(samples,0,320)/rms(samples,samples.length-320);
      assert.ok(ratio>.5 && ratio<2, 'loop boundary does not pump or go silent');
    }
    hashes.add(createHash('sha256').update(new Uint8Array(samples.buffer)).digest('hex'));
  }
  assert.equal(hashes.size, TOOL_ATLAS.clips.length);
  assert.equal(end, TOOL_ATLAS.frames);
  for (const recipe of itemManifest.recipes) for (const layer of recipe.layers) assert.match(itemManifest.sourceSha256[layer.source], /^[a-f\d]{64}$/);
});

await test('the recorded vacuum does not concentrate energy in its piercing motor harmonics', () => {
  const clip = TOOL_ATLAS.clips.find(c => c.kind === 'vacuum')!;
  const length = 8192, rate = TOOL_ATLAS.sampleRate;
  const samples = Float64Array.from({length}, (_, i) =>
    itemBytes.readInt16LE(44 + (clip.offsetFrames + i) * 2) / 32768 * (.5 - .5 * Math.cos(2 * Math.PI * i / (length - 1))));
  const total = samples.reduce((sum, value) => sum + value * value, 0) * length / 2;
  function bandFraction(from: number, to: number) {
    let power = 0;
    for (let bin = Math.ceil(from * length / rate); bin <= Math.floor(to * length / rate); bin++) {
      const coefficient = 2 * Math.cos(2 * Math.PI * bin / length);
      let a = 0, b = 0;
      for (const sample of samples) { const next = sample + coefficient * a - b; b = a; a = next; }
      power += a * a + b * b - coefficient * a * b;
    }
    return power / total;
  }
  assert.ok(bandFraction(3100, 3400) < .01, '3.25 kHz whine remains below 1% of energy');
  assert.ok(bandFraction(6200, 6800) < .002, '6.5 kHz harmonic remains below 0.2% of energy');
});

await test('heavy hits use fuller pops while finger and vacuum hits retain the small recorded snaps', async t => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { value: AudioContextStub, configurable: true });
  t.after(() => { if (prior) Object.defineProperty(globalThis, 'AudioContext', prior); else Reflect.deleteProperty(globalThis, 'AudioContext'); });
  t.mock.method(globalThis, 'fetch', async (url: string) => new Response(url === POP_ATLAS.url ? bytes : itemBytes));
  const audio = new PopAudio(); await audio.start();
  const ctx = audio.context as unknown as AudioContextStub;
  for (const strength of [1, 1.05, 2, 2.7]) { audio.pop(strength); ctx.currentTime += .2; }
  assert.deepEqual(ctx.sources.map(source => source.buffer!.duration), [.06, .06, .1, .1]);
  assert.notEqual(ctx.sources[2].buffer, ctx.sources[3].buffer, 'large snaps also avoid consecutive repeats');
  audio.stop(); assert.ok(ctx.sources.every(source => source.stops.length > 0));
  audio.dispose();
});

await test('rapid pistol shots fade the preceding tail without cancelling their fresh report', async t => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { value: AudioContextStub, configurable: true });
  t.after(() => { if (prior) Object.defineProperty(globalThis, 'AudioContext', prior); else Reflect.deleteProperty(globalThis, 'AudioContext'); });
  t.mock.method(globalThis, 'fetch', async (url: string) => new Response(url === POP_ATLAS.url ? bytes : itemBytes));
  const audio = new PopAudio(); await audio.start(); const ctx = audio.context as unknown as AudioContextStub;
  audio.fire('pistol'); const first = ctx.sources.at(-1)!;
  ctx.currentTime = .03; audio.fire('pistol');
  assert.equal(ctx.sources.length, 1); assert.equal(first.stops.length, 0, 'a cooldown-rejected tap leaves the current sound intact');
  ctx.currentTime = .11; audio.fire('pistol'); const second = ctx.sources.at(-1)!;
  assert.equal(ctx.sources.length, 2);
  assert.ok(first.stops[0] > .11 && first.stops[0] <= .18, 'the old tail fades after the new report begins');
  assert.equal(second.stops.length, 0); assert.equal(second.starts[0], .11);
  ctx.currentTime = .3; audio.fire('cannon');
  assert.equal(second.stops.length, 0, 'other weapons do not choke the pistol');
  audio.dispose();
});

await test('item cuts retain their durations after 44.1/48 kHz browser resampling', () => {
  for (const rate of [44100,48000]) {
    const ctx = new AudioContextStub(), atlas = new BufferStub(1, Math.round(TOOL_ATLAS.frames/32000*rate), rate);
    const bank = splitToolAtlas(ctx as unknown as BaseAudioContext, atlas as unknown as AudioBuffer);
    for (const kind of TOOL_SOUNDS) {
      const cuts = TOOL_ATLAS.clips.filter(c => c.kind === kind), sounds = bank.get(kind)!;
      assert.equal(cuts.length, sounds.length);
      sounds.forEach((sound,i) => assert.ok(Math.abs(sound.buffer.duration-cuts[i].lengthFrames/32000) <= 1/rate + 1e-9));
    }
    assert.throws(() => splitToolAtlas(ctx as unknown as BaseAudioContext,new BufferStub(1,100,rate) as unknown as AudioBuffer));
  }
});

await test('a failed pop download does not block recorded tools; cancelled cold-start motors do not restart on load', async t => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { value: AudioContextStub, configurable: true });
  t.after(() => { if (prior) Object.defineProperty(globalThis, 'AudioContext', prior); else Reflect.deleteProperty(globalThis, 'AudioContext'); });
  let release!: (response: Response) => void;
  t.mock.method(globalThis, 'fetch', (url: string) => url === POP_ATLAS.url ? Promise.reject(new Error('offline')) : new Promise<Response>(resolve => { release = resolve; }));
  const audio = new PopAudio(), pending = audio.start(), ctx = audio.context as unknown as AudioContextStub;
  audio.vacuum(true); const count = ctx.sources.length;
  audio.vacuum(false); const released = ctx.sources.length;
  assert.equal(count,2); assert.equal(released,2, 'very short taps fade their start instead of jumping to a full-speed wind-down');
  assert.ok(ctx.sources[1].loop && ctx.sources[1].stops[0] <= ctx.sources[1].starts[0], 'queued loop is cancelled before its start');
  release(new Response(itemBytes)); await pending;
  assert.equal(ctx.sources.length,released,'loading only replaces buffers, never restarts released actions');
  audio.fire('pistol'); assert.ok(ctx.sources.at(-1)!.buffer!.duration > .24,'the independent tool bank loaded');
  audio.pop(); assert.ok(ctx.sources.at(-1)!.buffer!.data.some(v=>v!==0),'pop fallback still works');
  audio.dispose();
});

await test('swing timing follows visual contact, tool storms reserve pop voices, and pause cancels every queued cue', async t => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { value: AudioContextStub, configurable: true });
  t.after(() => { if (prior) Object.defineProperty(globalThis, 'AudioContext', prior); else Reflect.deleteProperty(globalThis, 'AudioContext'); });
  t.mock.method(globalThis, 'fetch', async (url: string) => new Response(url === POP_ATLAS.url ? bytes : itemBytes));
  const audio = new PopAudio(); await audio.start(); const ctx=audio.context as unknown as AudioContextStub;
  audio.swish(true); const swing=ctx.sources.at(-1)!;
  assert.ok(swing.starts[0]>.04 && swing.starts[0]<.2,'sound waits until the mallet leaves its wind-up');
  audio.stop(); assert.ok(swing.stops[0] <= swing.starts[0]); swing.finish();
  for(let i=0;i<40;i++){audio.fire('pistol');ctx.currentTime+=.11;}
  assert.equal(ctx.sources.length,17,'tool voices are capped even when ended callbacks are delayed');
  const toolBuffers=ctx.sources.slice(1).map(s=>s.buffer);
  toolBuffers.slice(1).forEach((b,i)=>assert.notEqual(b,toolBuffers[i],'recorded pistol alternates between real takes'));
  audio.pop(); assert.equal(ctx.sources.length,18,'a busy tool bus cannot starve the bubble snaps');
  audio.stop(); assert.ok(ctx.sources.every(s=>s.stops.length>0)); audio.dispose();
});
