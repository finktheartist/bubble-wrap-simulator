export class AudioParamStub {
  value = 0;
  targets: number[] = [];
  setTargetAtTime(value: number) { this.value = value; this.targets.push(value); }
  setValueAtTime(value: number) { this.value = value; }
  linearRampToValueAtTime(value: number) { this.value = value; }
  cancelScheduledValues() {}
}
class NodeStub {
  gain = new AudioParamStub(); frequency = new AudioParamStub(); Q = new AudioParamStub();
  threshold = new AudioParamStub(); knee = new AudioParamStub(); ratio = new AudioParamStub();
  attack = new AudioParamStub(); release = new AudioParamStub(); pan = new AudioParamStub();
  playbackRate = new AudioParamStub(); type = ''; disconnected = false;
  connect() {} disconnect() { this.disconnected = true; }
}
export class BufferStub {
  readonly duration: number;
  data: Float32Array;
  constructor(public numberOfChannels: number, public length: number, public sampleRate: number) {
    this.duration = length / sampleRate; this.data = new Float32Array(length);
  }
  getChannelData() { return this.data; }
}
class SourceStub extends NodeStub {
  buffer: BufferStub | null = null; loop = false; starts: number[] = []; stops: number[] = [];
  onended: (() => void) | null = null;
  start(at = 0) { this.starts.push(at); }
  stop(at = 0) { this.stops.push(at); }
  finish() { this.onended?.(); }
}
export class AudioContextStub {
  static instances: AudioContextStub[] = [];
  currentTime = 0; sampleRate = 48000; state = 'suspended'; destination = new NodeStub();
  sources: SourceStub[] = []; resumeCalls = 0; decodeCalls = 0;
  constructor() { AudioContextStub.instances.push(this); }
  async resume() { this.resumeCalls++; this.state = 'running'; }
  async close() { this.state = 'closed'; }
  createGain() { return new NodeStub(); }
  createBiquadFilter() { return new NodeStub(); }
  createDynamicsCompressor() { return new NodeStub(); }
  createStereoPanner() { return new NodeStub(); }
  createBufferSource() { const source = new SourceStub(); this.sources.push(source); return source; }
  createBuffer(channels: number, length: number, rate: number) { return new BufferStub(channels, length, rate); }
  async decodeAudioData(bytes: ArrayBuffer) {
    this.decodeCalls++;
    const view = new DataView(bytes), data = new BufferStub(1, view.getUint32(40, true) / 2, view.getUint32(24, true));
    for (let i = 0; i < data.length; i++) data.data[i] = view.getInt16(44 + i * 2, true) / 32768;
    return data;
  }
}
