import { PopVoiceScheduler, synthesizePop } from './pop-synthesis';
import { synthesizeTool, type ToolSound } from './tool-synthesis';

export const POP_ATLAS = { url: '/audio/bubble-pops.wav', count: 16, slotSeconds: .06 } as const;

export function splitPopAtlas(ctx: BaseAudioContext, atlas: AudioBuffer): AudioBuffer[] {
  if (atlas.numberOfChannels !== 1 || Math.abs(atlas.duration - POP_ATLAS.count * POP_ATLAS.slotSeconds) > .002) {
    throw new Error('Invalid bubble sound bank');
  }
  const source = atlas.getChannelData(0);
  return Array.from({ length: POP_ATLAS.count }, (_, i) => {
    const start = Math.round(i * POP_ATLAS.slotSeconds * atlas.sampleRate);
    const end = Math.round((i + 1) * POP_ATLAS.slotSeconds * atlas.sampleRate);
    const buffer = ctx.createBuffer(1, end - start, atlas.sampleRate);
    buffer.getChannelData(0).set(source.subarray(start, end));
    return buffer;
  });
}

type Voice = { source: AudioBufferSourceNode; gain: GainNode; stereo: StereoPannerNode; at: number };

export class PopAudio {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  private input: GainNode | null = null;
  private buffers: AudioBuffer[] = [];
  private tools = new Map<ToolSound, AudioBuffer>();
  private voices = new PopVoiceScheduler();
  private active = new Set<Voice>();
  private motor: Voice | null = null;
  private lastThump = -Infinity;
  private lastExplosion = -Infinity;
  private previousPop = -1;
  private loading: Promise<void> | null = null;
  private loaded = false;
  private retryAt = 0;
  private download: AbortController | null = null;
  volume = .65;
  muted = false;

  async start() {
    if (!this.context) {
      const ctx = this.context = new AudioContext({ latencyHint: 'interactive' });
      this.input = ctx.createGain();
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
      for (const kind of ['impact', 'explosion', 'pistol', 'launcher', 'cannon', 'swish', 'heavy-swish', 'vacuum'] as const) {
        this.tools.set(kind, this.buffer(synthesizeTool(ctx.sampleRate, kind)));
      }
    }
    const ctx = this.context;
    this.update();
    // Resume in the user gesture, before waiting for the small recorded sound bank.
    const resume = ctx.state !== 'running' ? ctx.resume() : Promise.resolve();
    if (!this.loaded && !this.loading && performance.now() >= this.retryAt) {
      this.download = new AbortController();
      this.loading = fetch(POP_ATLAS.url, { signal: this.download.signal, cache: 'no-cache' })
        .then(response => { if (!response.ok) throw new Error('Bubble sound download failed'); return response.arrayBuffer(); })
        .then(bytes => ctx.decodeAudioData(bytes))
        .then(atlas => {
          if (this.context !== ctx) return;
          this.buffers = splitPopAtlas(ctx, atlas); this.loaded = true; this.previousPop = -1;
        })
        .catch(() => { if (this.context === ctx) this.retryAt = performance.now() + 10000; })
        .finally(() => { if (this.context === ctx) { this.loading = null; this.download = null; } });
    }
    await Promise.all([resume, this.loading]);
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
  private play(buffer: AudioBuffer, at: number, level: number, pan = 0, rate = 1, loop = false): Voice | null {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.muted || this.active.size >= 24) return null;
    const source = ctx.createBufferSource(); source.buffer = buffer; source.playbackRate.value = rate; source.loop = loop;
    const gain = ctx.createGain(); gain.gain.value = loop ? 0 : level;
    if (loop) gain.gain.setTargetAtTime(level, at, .04);
    const stereo = ctx.createStereoPanner(); stereo.pan.value = Math.max(-.85, Math.min(.85, pan));
    source.connect(gain); gain.connect(stereo); stereo.connect(this.input!);
    const voice = { source, gain, stereo, at }; this.active.add(voice);
    source.onended = () => {
      source.disconnect(); gain.disconnect(); stereo.disconnect(); this.active.delete(voice);
      if (this.motor === voice) this.motor = null;
    };
    source.start(at); return voice;
  }
  pop(strength = 1, pan = 0, distance = 1) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.muted) return;
    const at = this.voices.reserve(ctx.currentTime); if (at === null) return;
    // Select without immediate repeats; preserve the recordings' different textures.
    let index = Math.floor(Math.random() * (this.buffers.length - 1));
    if (index >= this.previousPop) index++;
    index %= this.buffers.length; this.previousPop = index;
    const queued = at - ctx.currentTime > .02;
    const gain = (.74 + Math.min(2.7, Math.max(0, strength)) * .035) * (.82 + Math.random() * .3)
      * (queued ? .86 : 1) / (1 + Math.max(0, distance) * .04);
    this.play(this.buffers[index], at, gain, pan, .93 + Math.random() * .14);
  }
  thump(strength = 1, explosion = false) {
    const ctx = this.context; if (!ctx || ctx.state !== 'running' || this.muted) return;
    const t = ctx.currentTime;
    if (t - (explosion ? this.lastExplosion : this.lastThump) < (explosion ? .09 : .06)) return;
    if (explosion) this.lastExplosion = t; else this.lastThump = t;
    this.play(this.tools.get(explosion ? 'explosion' : 'impact')!, t,
      Math.min(explosion ? .6 : .35, strength * (explosion ? .22 : .2)), 0, .95 + Math.random() * .1);
  }
  fire(kind: 'pistol' | 'launcher' | 'cannon') {
    const ctx = this.context; if (!ctx) return;
    this.play(this.tools.get(kind)!, ctx.currentTime, kind === 'pistol' ? .38 : .5, .12, .97 + Math.random() * .06);
  }
  swish(heavy = false) {
    const ctx = this.context; if (!ctx) return;
    this.play(this.tools.get(heavy ? 'heavy-swish' : 'swish')!, ctx.currentTime, .22, .15);
  }
  vacuum(active: boolean) {
    const ctx = this.context;
    if (!active || this.muted) { if (this.motor) this.release(this.motor); this.motor = null; return; }
    if (ctx && !this.motor) this.motor = this.play(this.tools.get('vacuum')!, ctx.currentTime, .24, .1, 1, true);
  }
  private release(voice: Voice) {
    const t = this.context!.currentTime;
    voice.gain.gain.cancelScheduledValues(t);
    if (voice.at > t) { voice.gain.gain.setValueAtTime(0, t); voice.source.stop(t); return; }
    voice.gain.gain.setTargetAtTime(0, t, .008);
    voice.source.stop(t + .045);
  }
  /** Cancel queued pops and motor audio on pause/reset; no sounds leak into menus. */
  stop() {
    for (const voice of this.active) this.release(voice);
    this.motor = null; this.voices.reset(); this.lastThump = this.lastExplosion = -Infinity;
  }
  async preview() { await this.start(); this.pop(1.2, 0, .4); }
  dispose() {
    this.download?.abort(); this.stop(); void this.context?.close();
    this.context = null; this.master = null; this.input = null; this.buffers = []; this.tools.clear(); this.active.clear();
    this.loading = null; this.download = null; this.loaded = false; this.retryAt = 0; this.previousPop = -1;
  }
}
