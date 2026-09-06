import { PopVoiceScheduler, synthesizePop } from './pop-synthesis';

export class PopAudio {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  private input: GainNode | null = null;
  private buffers: AudioBuffer[] = [];
  private voices = new PopVoiceScheduler();
  volume = .65;
  muted = false;

  async start() {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      const ctx = this.context;
      this.input = ctx.createGain();
      this.master = ctx.createGain();
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass'; highpass.frequency.value = 75;
      const body = ctx.createBiquadFilter();
      body.type = 'lowshelf'; body.frequency.value = 260; body.gain.value = 2;
      const presence = ctx.createBiquadFilter();
      presence.type = 'peaking'; presence.frequency.value = 1800; presence.Q.value = .7; presence.gain.value = 2.2;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -9; limiter.knee.value = 5; limiter.ratio.value = 7;
      limiter.attack.value = .002; limiter.release.value = .07;
      this.input.connect(highpass); highpass.connect(body); body.connect(presence);
      presence.connect(limiter); limiter.connect(this.master); this.master.connect(ctx.destination);
      // A very quiet single reflection provides room scale without smearing the dry snap.
      const delay = ctx.createDelay(.1); delay.delayTime.value = .037;
      const reflection = ctx.createGain(); reflection.gain.value = .045;
      const soft = ctx.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 4500;
      this.input.connect(delay); delay.connect(soft); soft.connect(reflection); reflection.connect(limiter);
      for (let v = 0; v < 24; v++) {
        const samples = synthesizePop(ctx.sampleRate, v);
        const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
        buffer.getChannelData(0).set(samples);
        this.buffers.push(buffer);
      }
    }
    this.update();
    if (this.context.state !== 'running') await this.context.resume();
  }
  update() {
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, .015);
  }
  pop(strength = 1, pan = 0, distance = 1) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.muted) return;
    const at = this.voices.reserve(ctx.currentTime);
    if (at === null) return;
    const src = ctx.createBufferSource();
    src.buffer = this.buffers[Math.floor(Math.random() * this.buffers.length)];
    src.playbackRate.value = .96 + Math.random() * .09;
    const gain = ctx.createGain();
    gain.gain.value = Math.min(.88, .55 + strength * .14) / (1 + distance * .042);
    const stereo = ctx.createStereoPanner(); stereo.pan.value = Math.max(-.9, Math.min(.9, pan));
    src.connect(gain); gain.connect(stereo); stereo.connect(this.input!);
    src.onended = () => { src.disconnect(); gain.disconnect(); stereo.disconnect(); };
    src.start(at);
  }
  thump(strength = 1, explosion = false) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(explosion ? 100 : 130, t);
    osc.frequency.exponentialRampToValueAtTime(explosion ? 35 : 65, t + .09);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(Math.min(.42, strength * (explosion ? .17 : .08)), t + .001);
    gain.gain.exponentialRampToValueAtTime(.001, t + (explosion ? .3 : .08));
    osc.connect(gain); gain.connect(this.input!); osc.start(t); osc.stop(t + .35);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    if (explosion) for (let i = 0; i < 10; i++) this.pop(1.5, (Math.random() - .5) * 1.5, 2);
  }
  async preview() { await this.start(); this.pop(1.2, 0, .4); }
  dispose() { void this.context?.close(); this.context = null; this.buffers = []; this.voices.reset(); }
}
