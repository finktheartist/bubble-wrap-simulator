/** A pressure release: fast membrane snap, a short body, then irregular plastic micro-crinkles. */
export function synthesizePop(sampleRate: number, variant: number, random = Math.random): Float32Array {
  const duration = .12;
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  const pitch = .85 + (variant % 16) / 16 * .35;
  const grains = Array.from({ length: 5 }, (_, i) => ({
    at: .009 + i * .011 + random() * .007,
    duration: .001 + random() * .0018,
    amplitude: (.12 + random() * .13) * (1 - i * .13),
  }));
  let low = 0;
  let phase = 0;
  let membranePhase = 0;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const noise = random() * 2 - 1;
    low += .23 * (noise - low);
    const bright = noise - low;
    const attack = Math.min(1, t / .00018);
    const snap = bright * Math.exp(-t / .0016) * 1.15;
    // Integrate instantaneous frequency; a decaying phase would reverse and sound rubbery.
    phase += 2 * Math.PI * pitch * (235 + 450 * Math.exp(-t / .006)) / sampleRate;
    membranePhase += 2 * Math.PI * pitch * (1050 + 1250 * Math.exp(-t / .003)) / sampleRate;
    const body = Math.sin(phase) * Math.exp(-t / .013) * .66;
    const membrane = Math.sin(membranePhase) * Math.exp(-t / .0038) * .38;
    let crinkle = 0;
    for (const grain of grains) {
      const age = t - grain.at;
      if (age >= 0 && age < grain.duration * 5) {
        crinkle += bright * grain.amplitude * Math.exp(-age / grain.duration) * Math.min(1, age / .00012);
      }
    }
    const fade = Math.min(1, (duration - t) / .008);
    samples[i] = Math.tanh((snap + body + membrane) * attack + crinkle) * fade;
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const gain = .92 / Math.max(peak, .001);
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return samples;
}

/** Preserve several pops from one frame without allowing a blast to queue seconds of noise. */
export class PopVoiceScheduler {
  private next = 0;
  reserve(now: number): number | null {
    const at = Math.max(now + .003, this.next);
    if (at > now + .115) return null;
    this.next = at + .0045;
    return at;
  }
  reset() { this.next = 0; }
}
