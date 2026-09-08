import { PopVoiceScheduler, synthesizePop } from './pop-synthesis';
import { synthesizeTool, TOOL_SOUNDS, type ToolSound } from './tool-synthesis';
import { TOOL_ATLAS } from './tool-bank';
import { MELEE } from './melee';

export const POP_ATLAS = { url: '/audio/bubble-pops.wav', count: 16, slotSeconds: .06 } as const;

export function splitPopAtlas(ctx: BaseAudioContext, atlas: AudioBuffer): AudioBuffer[] {
  if (atlas.numberOfChannels !== 1 || Math.abs(atlas.duration - POP_ATLAS.count * POP_ATLAS.slotSeconds) > .002) {
    throw new Error('Invalid bubble sound bank');
  }
  return Array.from({ length: POP_ATLAS.count }, (_, i) => slice(ctx, atlas, i * POP_ATLAS.slotSeconds, (i + 1) * POP_ATLAS.slotSeconds));
}
function slice(ctx: BaseAudioContext, atlas: AudioBuffer, from: number, to: number) {
  const start = Math.round(from * atlas.sampleRate), end = Math.round(to * atlas.sampleRate);
  const buffer = ctx.createBuffer(1, end - start, atlas.sampleRate);
  buffer.getChannelData(0).set(atlas.getChannelData(0).subarray(start, end));
  return buffer;
}
type ToolClip = { buffer: AudioBuffer; peakSeconds: number };
export function splitToolAtlas(ctx: BaseAudioContext, atlas: AudioBuffer): Map<ToolSound, ToolClip[]> {
  if (atlas.numberOfChannels !== 1 || Math.abs(atlas.duration - TOOL_ATLAS.frames / TOOL_ATLAS.sampleRate) > .002) {
    throw new Error('Invalid item sound bank');
  }
  const bank = new Map<ToolSound, ToolClip[]>();
  for (const clip of TOOL_ATLAS.clips) {
    const clips = bank.get(clip.kind) ?? [];
    clips.push({ buffer: slice(ctx, atlas, clip.offsetFrames / TOOL_ATLAS.sampleRate, (clip.offsetFrames + clip.lengthFrames) / TOOL_ATLAS.sampleRate), peakSeconds: clip.peakSeconds });
    bank.set(clip.kind, clips);
  }
  return bank;
}

type Voice = { source: AudioBufferSourceNode; gain: GainNode; stereo: StereoPannerNode; at: number; bus: 'pop' | 'tool'; released: boolean };
type BankLoad = { loaded: boolean; pending: Promise<void> | null; retryAt: number; abort: AbortController | null };
const newLoad = (): BankLoad => ({ loaded: false, pending: null, retryAt: 0, abort: null });
export type ItemImpact = 'mallet' | 'bat' | 'ball' | 'parcel' | 'pellet';

export class PopAudio {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  private input: GainNode | null = null;
  private toolBus: GainNode | null = null;
  private buffers: AudioBuffer[] = [];
  private tools = new Map<ToolSound, ToolClip[]>();
  private voices = new PopVoiceScheduler();
  private active = new Set<Voice>();
  private motorVoices: Voice[] = [];
  private motorRunning = false;
  private motorStartedAt = 0;
  private lastCue = new Map<ToolSound, number>();
  private previousTool = new Map<ToolSound, number>();
  private previousPop = -1;
  private pistolVoice: Voice | null = null;
  private loads = { pops: newLoad(), tools: newLoad() };
  volume = .65;
  muted = false;

  async start() {
    if (!this.context) {
      const ctx = this.context = new AudioContext({ latencyHint: 'interactive' });
      this.input = ctx.createGain();
      this.toolBus = ctx.createGain(); this.toolBus.connect(this.input);
      this.master = ctx.createGain();
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass'; highpass.frequency.value = 65;
      const presence = ctx.createBiquadFilter();
      presence.type = 'peaking'; presence.frequency.value = 4200; presence.Q.value = .65; presence.gain.value = -2;
      const top = ctx.createBiquadFilter();
      top.type = 'lowpass'; top.frequency.value = 9200; top.Q.value = .6;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -8; limiter.knee.value = 6; limiter.ratio.value = 6;
      limiter.attack.value = .002; limiter.release.value = .065;
      this.input.connect(highpass); highpass.connect(presence); presence.connect(top);
      top.connect(limiter); limiter.connect(this.master); this.master.connect(ctx.destination);
      for (let v = 0; v < POP_ATLAS.count; v++) this.buffers.push(this.buffer(synthesizePop(ctx.sampleRate, v)));
      for (const kind of TOOL_SOUNDS) {
        const buffer = this.buffer(synthesizeTool(ctx.sampleRate, kind));
        this.tools.set(kind, [{ buffer, peakSeconds: buffer.duration * .5 }]);
      }
    }
    const ctx = this.context;
    this.update();
    // Resume in the gesture. Each bank loads independently; a failed bank keeps its fallback.
    const resume = ctx.state !== 'running' ? ctx.resume() : Promise.resolve();
    await Promise.all([resume, this.load(ctx, 'pops'), this.load(ctx, 'tools')]);
  }
  private load(ctx: AudioContext, kind: keyof PopAudio['loads']) {
    const state = this.loads[kind];
    if (!state.loaded && !state.pending && performance.now() >= state.retryAt) {
      state.abort = new AbortController();
      state.pending = fetch(kind === 'pops' ? POP_ATLAS.url : TOOL_ATLAS.url, { signal: state.abort.signal, cache: 'no-cache' })
        .then(response => { if (!response.ok) throw new Error('Sound download failed'); return response.arrayBuffer(); })
        .then(bytes => ctx.decodeAudioData(bytes))
        .then(atlas => {
          if (this.context !== ctx) return;
          if (kind === 'pops') { this.buffers = splitPopAtlas(ctx, atlas); this.previousPop = -1; }
          else { this.tools = splitToolAtlas(ctx, atlas); this.previousTool.clear(); }
          state.loaded = true;
        })
        .catch(() => { state.retryAt = performance.now() + 10000; })
        .finally(() => { state.pending = null; state.abort = null; });
    }
    return state.pending;
  }
  private buffer(samples: Float32Array) {
    const ctx = this.context!, buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.getChannelData(0).set(samples);
    return buffer;
  }
  update() {
    if (this.muted) this.stop();
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : Math.max(0, Math.min(1, this.volume)), this.context.currentTime, .012);
  }
  private play(buffer: AudioBuffer, at: number, level: number, pan = 0, rate = 1, loop = false, bus: Voice['bus'] = 'tool'): Voice | null {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.muted || this.active.size >= 24) return null;
    // Tools cannot consume the eight voices reserved for plastic snaps.
    if (bus === 'tool' && [...this.active].filter(voice => voice.bus === 'tool').length >= 16) return null;
    const source = ctx.createBufferSource(); source.buffer = buffer; source.playbackRate.value = rate; source.loop = loop;
    const gain = ctx.createGain(); gain.gain.value = loop ? 0 : level;
    if (loop) gain.gain.setTargetAtTime(level, at, .04);
    const stereo = ctx.createStereoPanner(); stereo.pan.value = Math.max(-.85, Math.min(.85, pan));
    source.connect(gain); gain.connect(stereo); stereo.connect(bus === 'tool' ? this.toolBus! : this.input!);
    const voice: Voice = { source, gain, stereo, at, bus, released: false }; this.active.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); stereo.disconnect(); this.active.delete(voice); };
    source.start(at); return voice;
  }
  private index(count: number, previous = -1) {
    if (count < 2) return 0;
    let index = Math.floor(Math.random() * (previous < 0 ? count : count - 1));
    if (previous >= 0 && index >= previous) index++;
    return index;
  }
  private pick(kind: ToolSound) {
    const clips = this.tools.get(kind)!;
    const index = this.index(clips.length, this.previousTool.get(kind));
    this.previousTool.set(kind, index); return clips[index];
  }
  pop(strength = 1, pan = 0, distance = 1) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.muted) return;
    const at = this.voices.reserve(ctx.currentTime); if (at === null) return;
    const large = strength >= 1.6;
    const index = this.index(this.buffers.length, this.previousPop);
    if (!large) this.previousPop = index;
    const buffer = large ? this.pick('big-pop').buffer : this.buffers[index];
    const queued = at - ctx.currentTime > .02;
    const gain = ((large ? .92 : .74) + Math.min(2.7, Math.max(0, strength)) * .035) * (.82 + Math.random() * .3)
      * (queued ? .86 : 1) / (1 + Math.max(0, distance) * .04);
    if (this.play(buffer, at, gain, pan, large ? .97 + Math.random() * .07 : .93 + Math.random() * .14, false, 'pop')) {
      const duck = this.toolBus!.gain;
      duck.cancelScheduledValues(ctx.currentTime);
      duck.setTargetAtTime(.86, ctx.currentTime, .008);
      duck.setTargetAtTime(1, at + .065, .07);
    }
  }
  private cue(kind: ToolSound, level: number, pan = 0, distance = 0, cooldown = .04) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.muted || ctx.currentTime - (this.lastCue.get(kind) ?? -Infinity) < cooldown) return;
    const clip = this.pick(kind);
    const voice = this.play(clip.buffer, ctx.currentTime, level * (.9 + Math.random() * .2) / (1 + Math.max(0, distance) * .055), pan, .975 + Math.random() * .05);
    if (voice) this.lastCue.set(kind, ctx.currentTime);
    return voice;
  }
  impact(kind: ItemImpact, strength = 1, pan = 0, distance = 1) {
    const level = Math.min(1.3, Math.max(0, strength)) * (kind === 'pellet' ? .22 : kind === 'ball' ? .94 : .87);
    this.cue(`${kind}-hit`, level, pan, distance, kind === 'ball' ? .085 : .055);
  }
  blast(rocket = false, pan = 0, distance = 1) {
    this.cue(rocket ? 'rocket-blast' : 'bomb-blast', .6, pan, distance, .09);
  }
  /** Kept for the existing bubble-pop comparison tool. Gameplay uses item-specific impacts. */
  thump(strength = 1, explosion = false) { if (explosion) this.blast(); else this.impact('parcel', strength); }
  fire(kind: 'pistol' | 'launcher' | 'cannon') {
    const voice = this.cue(kind, kind === 'pistol' ? .77 : kind === 'cannon' ? .56 : .58, .12, 0, .075);
    if (kind === 'pistol' && voice) {
      // Keep the newest report clear when rapid shots overlap their acoustic tails.
      if (this.pistolVoice) this.release(this.pistolVoice, .03);
      this.pistolVoice = voice;
    }
  }
  toss(bomb = false) { this.cue(bomb ? 'bomb-arm' : 'throw', .42, .15); }
  swish(heavy = false) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.muted) return;
    const clip = this.pick(heavy ? 'heavy-swish' : 'swish'), rate = .98 + Math.random() * .04;
    const at = ctx.currentTime + Math.max(0, MELEE[heavy ? 1 : 2].contact - clip.peakSeconds / rate - .025);
    const voice = this.play(clip.buffer, at, heavy ? .6 : .56, .35, rate);
    voice?.stereo.pan.setValueAtTime(.35, at);
    voice?.stereo.pan.linearRampToValueAtTime(-.3, at + clip.buffer.duration / rate);
  }
  vacuum(active: boolean) {
    const ctx = this.context;
    if (!active || this.muted) {
      const running = this.motorRunning;
      for (const voice of this.motorVoices) this.release(voice, .12);
      this.motorVoices = []; this.motorRunning = false;
      const held = ctx ? ctx.currentTime - this.motorStartedAt : 0;
      if (running && !this.muted && held >= .14) this.cue('vacuum-stop', .16 * Math.min(1, held / .36), .1);
      return;
    }
    if (!ctx || ctx.state !== 'running' || this.motorRunning) return;
    const start = this.pick('vacuum-start'), loop = this.pick('vacuum');
    const a = this.play(start.buffer, ctx.currentTime, .23, .1);
    const b = this.play(loop.buffer, ctx.currentTime + Math.max(0, start.buffer.duration - .075), .18, .1, 1, true);
    if (!b) { if (a) this.release(a); return; }
    this.motorVoices = a ? [a, b] : [b]; this.motorRunning = true; this.motorStartedAt = ctx.currentTime;
  }
  private release(voice: Voice, fade = .045) {
    const ctx = this.context;
    if (!ctx || voice.released) return;
    voice.released = true;
    const t = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(t);
    if (voice.at > t) { voice.gain.gain.setValueAtTime(0, t); voice.source.stop(t); return; }
    voice.gain.gain.setTargetAtTime(0, t, fade / 6);
    voice.source.stop(t + fade);
  }
  /** Cancel queued pops, swings and motor transitions on pause/reset. */
  stop() {
    for (const voice of this.active) this.release(voice);
    this.pistolVoice = null;
    this.motorVoices = []; this.motorRunning = false; this.voices.reset(); this.lastCue.clear();
    if (this.context && this.toolBus) {
      this.toolBus.gain.cancelScheduledValues(this.context.currentTime);
      this.toolBus.gain.setTargetAtTime(1, this.context.currentTime, .02);
    }
  }
  async preview() { await this.start(); this.pop(1.2, 0, .4); }
  dispose() {
    Object.values(this.loads).forEach(load => load.abort?.abort());
    this.stop(); void this.context?.close();
    this.context = null; this.master = null; this.input = null; this.toolBus = null;
    this.buffers = []; this.tools.clear(); this.active.clear(); this.previousTool.clear();
    this.loads = { pops: newLoad(), tools: newLoad() }; this.previousPop = -1;
  }
}
