// Local review capture: uncompressed PCM, with silent output to the speakers.
class PcmRecorder extends AudioWorkletProcessor {
  recording = true;
  constructor() {
    super();
    this.port.onmessage = event => {
      if (event.data === 'finish') { this.recording = false; this.port.postMessage({ done: true }); }
    };
  }
  process(inputs) {
    if (this.recording && inputs[0]?.length) {
      const channels = [inputs[0][0].slice(), (inputs[0][1] ?? inputs[0][0]).slice()];
      this.port.postMessage({ channels }, channels.map(channel => channel.buffer));
    }
    return true;
  }
}
registerProcessor('record-pcm', PcmRecorder);
