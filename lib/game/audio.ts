import { PopVoiceScheduler, synthesizePop } from './pop-synthesis';

export class PopAudio {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  private input: GainNode | null = null;
  private buffers: AudioBuffer[] = [];
  private voices = new PopVoiceScheduler();
  private lastThump = -Infinity;
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
      body.type = 'lowshelf'; body.frequency.value = 320; body.gain.value = 1;
      const presence = ctx.createBiquadFilter();
      presence.type = 'lowpass'; presence.frequency.value = 3200; presence.Q.value = .5;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 4;
      limiter.attack.value = .004; limiter.release.value = .08;
      this.input.connect(highpass); highpass.connect(body); body.connect(presence);
      presence.connect(limiter); limiter.connect(this.master); this.master.connect(ctx.destination);
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
    gain.gain.value = Math.min(.72, .48 + strength * .08) / (1 + distance * .045);
    const stereo = ctx.createStereoPanner(); stereo.pan.value = Math.max(-.9, Math.min(.9, pan));
    src.connect(gain); gain.connect(stereo); stereo.connect(this.input!);
    src.onended = () => { src.disconnect(); gain.disconnect(); stereo.disconnect(); };
    src.start(at);
  }
  thump(strength = 1, explosion = false) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.muted) return;
    const t = ctx.currentTime;
    if (!explosion && t - this.lastThump < .06) return;
    this.lastThump = t;
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(explosion ? 100 : 130, t);
    osc.frequency.exponentialRampToValueAtTime(explosion ? 35 : 65, t + .09);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(Math.min(.24, strength * (explosion ? .085 : .045)), t + .003);
    gain.gain.exponentialRampToValueAtTime(.001, t + (explosion ? .22 : .065));
    osc.connect(gain); gain.connect(this.input!); osc.start(t); osc.stop(t + .35);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  async preview() { await this.start(); this.pop(1.2, 0, .4); }
  swish(heavy=false) {
    const ctx=this.context;if(!ctx||ctx.state!=='running'||this.muted)return;
    const duration=heavy?.18:.14,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++){const t=i/data.length;data[i]=(Math.random()*2-1)*Math.sin(Math.PI*t)**2;}
    const source=ctx.createBufferSource();source.buffer=buffer;
    const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.Q.value=.6;filter.frequency.setValueAtTime(heavy?450:720,ctx.currentTime);filter.frequency.exponentialRampToValueAtTime(180,ctx.currentTime+duration);
    const gain=ctx.createGain();gain.gain.value=.065;
    source.connect(filter);filter.connect(gain);gain.connect(this.input!);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};source.start();
  }
  dispose() { void this.context?.close(); this.context = null; this.buffers = []; this.voices.reset(); this.lastThump = -Infinity; }
}
