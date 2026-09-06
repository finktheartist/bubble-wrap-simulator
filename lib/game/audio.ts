// Every pop is synthesized locally. No downloads or microphone permission.
export class PopAudio {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  buffers: AudioBuffer[] = [];
  volume = .65;
  muted = false;
  private lastVoice = 0;
  async start() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -14; limiter.knee.value = 9; limiter.ratio.value = 8; limiter.attack.value = .002; limiter.release.value = .12;
      this.master.connect(limiter); limiter.connect(this.context.destination);
      for (let v = 0; v < 18; v++) {
        const length = .07 + v * .002;
        const b = this.context.createBuffer(1,Math.floor(this.context.sampleRate*length),this.context.sampleRate);
        const data = b.getChannelData(0);
        const freq = 160 + v*21;
        let last=0;
        for (let i=0;i<data.length;i++) {
          const t=i/this.context.sampleRate;
          const noise=Math.random()*2-1;
          const snap=(noise-last*.65)*Math.exp(-t*130);
          const body=Math.sin(2*Math.PI*freq*t*Math.exp(-t*22))*Math.exp(-t*73);
          const crinkle=noise*Math.exp(-t*50)*(.12+.1*Math.sin(t*700));
          data[i]=Math.tanh(snap*.75+body*.65+crinkle)*.74;
          last=noise;
        }
        this.buffers.push(b);
      }
    }
    this.update();
    await this.context.resume();
  }
  update() { if(this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume,this.context.currentTime,.025); }
  pop(strength=1,pan=0,distance=1) {
    const ctx=this.context;
    if(!ctx || ctx.state!=='running' || this.muted) return;
    // Cap polyphony during a blast while preserving its traveling crackle.
    if(ctx.currentTime-this.lastVoice<.009) return;
    this.lastVoice=ctx.currentTime;
    const src=ctx.createBufferSource(); src.buffer=this.buffers[Math.floor(Math.random()*this.buffers.length)];
    src.playbackRate.value=.88+Math.random()*.28;
    const gain=ctx.createGain(); gain.gain.value=Math.min(1.1,.44+strength*.2)/(1+distance*.065);
    const stereo=ctx.createStereoPanner(); stereo.pan.value=Math.max(-1,Math.min(1,pan));
    src.connect(gain); gain.connect(stereo); stereo.connect(this.master!);
    src.onended=()=>{src.disconnect();gain.disconnect();stereo.disconnect();};
    src.start();
  }
  thump(strength=1,explosion=false) {
    const ctx=this.context; if(!ctx || ctx.state!=='running') return;
    const t=ctx.currentTime;
    const osc=ctx.createOscillator(); osc.type='sine';
    osc.frequency.setValueAtTime(explosion?95:160,t); osc.frequency.exponentialRampToValueAtTime(35,t+.17);
    const gain=ctx.createGain(); gain.gain.setValueAtTime(Math.min(.7,strength*.2),t); gain.gain.exponentialRampToValueAtTime(.001,t+(explosion?.55:.16));
    osc.connect(gain);gain.connect(this.master!);osc.start(t);osc.stop(t+.6);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
    if(explosion) for(let i=0;i<7;i++) this.pop(2,(Math.random()-.5)*1.5,2);
  }
  dispose(){ void this.context?.close(); this.context=null; this.buffers=[]; }
}
