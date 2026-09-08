/** Offline fallback: a dry plastic snap, with a small pressure body and short folds. */
export function synthesizePop(sampleRate: number, variant: number, random = Math.random): Float32Array {
  const duration = .06, samples = new Float32Array(Math.ceil(sampleRate * duration));
  const pitch = .91 + (variant % 16) / 15 * .2;
  const coefficient = 1 - Math.exp(-2 * Math.PI * (5200 + variant % 5 * 280) / sampleRate);
  let air = 0, phase = 0, peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    air += coefficient * (random() * 2 - 1 - air);
    phase += 2 * Math.PI * pitch * (260 + 350 * Math.exp(-t / .0018)) / sampleRate;
    const snap = air * Math.exp(-t / (.0015 + variant % 4 * .00025));
    const body = Math.sin(phase) * Math.exp(-t / .0032) * .12;
    const fold = air * .06 * Math.exp(-(((t - .006 - variant % 3 * .002) / .0012) ** 2));
    samples[i] = (snap + body + fold) * (1 - Math.exp(-t / .00012)) * Math.min(1, (duration - t) / .006);
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  for (let i = 0; i < samples.length; i++) samples[i] *= .78 / Math.max(peak, .001);
  return samples;
}

/** Thin dense contacts into an irregular crackle, never a long delayed backlog. */
export class PopVoiceScheduler {
  private next = 0;
  constructor(private random = Math.random) {}
  reserve(now: number): number | null {
    const at = Math.max(now + .003, this.next);
    if (at > now + .085) return null;
    this.next = at + .024 + this.random() * .018;
    return at;
  }
  reset() { this.next = 0; }
}
