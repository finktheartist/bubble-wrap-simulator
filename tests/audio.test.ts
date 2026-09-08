import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PopVoiceScheduler, synthesizePop } from '../lib/game/pop-synthesis';
import { synthesizeTool } from '../lib/game/tool-synthesis';
import { PopAudio, splitPopAtlas, POP_ATLAS } from '../lib/game/audio';
import { AudioContextStub, BufferStub } from './helpers/audio-context';

function random(seed = 739) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function rms(samples: Float32Array, from = 0, to = samples.length) {
  let energy = 0;
  for (let i = from; i < to; i++) energy += samples[i] ** 2;
  return Math.sqrt(energy / (to - from));
}
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
  for (const rate of [44100, 48000]) for (const kind of ['impact', 'explosion', 'pistol', 'launcher', 'cannon', 'swish', 'heavy-swish', 'vacuum'] as const) {
    const sound = synthesizeTool(rate, kind, random());
    assert.ok(sound.every(Number.isFinite)); assert.ok(Math.max(...sound.map(Math.abs)) < 1);
    assert.ok(rms(sound) > .005); assert.ok(Math.abs(sound[0]) < .0001);
    assert.ok(Math.abs(sound.at(-1)!) < (kind === 'vacuum' ? .01 : .001));
  }
});

await test('audio resumes immediately, shares one recording download, and cancels motors and queued pops on mute/pause/dispose', async t => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { value: AudioContextStub, configurable: true });
  t.after(() => { if (prior) Object.defineProperty(globalThis, 'AudioContext', prior); else Reflect.deleteProperty(globalThis, 'AudioContext'); });
  let release!: (response: Response) => void, downloads = 0;
  t.mock.method(globalThis, 'fetch', () => { downloads++; return new Promise<Response>(resolve => { release = resolve; }); });
  const audio = new PopAudio(), first = audio.start(), second = audio.start();
  const ctx = audio.context as unknown as AudioContextStub;
  assert.equal(ctx.state, 'running', 'resume happens inside the gesture before awaiting download');
  assert.equal(downloads, 1);
  audio.pop(); assert.equal(ctx.sources.length, 1, 'first actions retain an offline fallback');
  release(new Response(bytes)); await Promise.all([first, second]); assert.equal(ctx.decodeCalls, 1);
  ctx.currentTime = 1;
  for (let i = 0; i < 6; i++) { audio.pop(); ctx.currentTime += .2; }
  for (let i = 2; i < 7; i++) assert.notEqual(ctx.sources[i].buffer, ctx.sources[i - 1].buffer, 'no consecutive sample repeats');
  const before = ctx.sources.length;
  for (let i = 0; i < 60; i++) audio.vacuum(true);
  assert.equal(ctx.sources.length, before + 1, 'holding creates only one loop');
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
  assert.equal(downloads, 1); assert.equal(ctx.sources.length, 1);
  assert.ok(ctx.sources[0].buffer!.data.some(sample => sample !== 0));
  audio.dispose();
});
