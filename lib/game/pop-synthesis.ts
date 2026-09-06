/** A soft pressure pop: rounded membrane transient, warm body, no scratch/crinkle tail. */
export function synthesizePop(sampleRate: number, variant: number, random = Math.random): Float32Array {
  const duration = .075;
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  const pitch = .88 + (variant % 16) / 16 * .26;
  // Two low-pass stages keep even the tiny air-release transient smooth.
  const airCoefficient = 1 - Math.exp(-2 * Math.PI * 1700 / sampleRate);
  let air1 = 0, air2 = 0, bodyPhase = 0, membranePhase = 0, peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    air1 += airCoefficient * (random() * 2 - 1 - air1);
    air2 += airCoefficient * (air1 - air2);
    const attack = 1 - Math.exp(-t / .00065);
    bodyPhase += 2 * Math.PI * pitch * (215 + 205 * Math.exp(-t / .0035)) / sampleRate;
    membranePhase += 2 * Math.PI * pitch * (610 + 430 * Math.exp(-t / .0018)) / sampleRate;
    const body = Math.sin(bodyPhase) * Math.exp(-t / .0065) * .88;
    const membrane = Math.sin(membranePhase) * Math.exp(-t / .0028) * .32;
    const air = air2 * Math.exp(-t / .0016) * .16;
    const fade = Math.min(1, (duration - t) / .008);
    // Linear mixing avoids the bright harmonics introduced by saturation.
    samples[i] = (body + membrane + air) * attack * fade;
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const gain = .72 / Math.max(peak, .001);
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return samples;
}

/** Resolve dense impacts into discrete pops, with a short, bounded audio queue. */
export class PopVoiceScheduler {
  private next = 0;
  private sequence = 0;
  reserve(now: number): number | null {
    const at = Math.max(now + .003, this.next);
    if (at > now + .105) return null;
    // The old 4.5 ms spacing smeared a group of pops into a buzzing scrape.
    // Slightly irregular 20–28 ms spacing preserves the individual attacks.
    const spacing = [.023, .028, .021, .026, .020][this.sequence++ % 5];
    this.next = at + spacing;
    return at;
  }
  reset() { this.next = 0; this.sequence = 0; }
}
