export type SuctionSound = 'vacuum-start' | 'vacuum';

/** Soft air turbulence only: no oscillators, recorded motor, or pitch sweep. */
export function synthesizeSuction(sampleRate: number, kind: SuctionSound, random = Math.random): Float32Array {
  const duration = kind === 'vacuum' ? 1.35 : .32;
  const length = Math.round(duration * sampleRate), warmup = Math.round(.2 * sampleRate);
  const result = new Float32Array(length);
  const lowpass = 1 - Math.exp(-2 * Math.PI * 460 / sampleRate);
  const highpass = 1 - Math.exp(-2 * Math.PI * 75 / sampleRate);
  let a = 0, b = 0, c = 0, d = 0, rumble = 0;
  for (let i = -warmup; i < length; i++) {
    const noise = random() * 2 - 1;
    a += lowpass * (noise - a); b += lowpass * (a - b);
    c += lowpass * (b - c); d += lowpass * (c - d);
    rumble += highpass * (d - rumble);
    if (i >= 0) result[i] = d - rumble;
  }
  if (kind === 'vacuum') {
    // Fold the final 40 ms into the beginning, then continue from the same point.
    const overlap = Math.round(.04 * sampleRate), loop = new Float32Array(length - overlap);
    for (let i = 0; i < overlap; i++) {
      const u = i / (overlap - 1);
      result[length - overlap + i] = result[length - overlap + i] * (1 - u) + result[i] * u;
    }
    loop.set(result.subarray(overlap));
    return scale(loop);
  }
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const fade = Math.min(1, t / .11, (duration - t - 1 / sampleRate) / .075);
    result[i] *= Math.max(0, fade);
  }
  return scale(result);
}

function scale(samples: Float32Array) {
  let energy = 0, peak = 0;
  for (const value of samples) { energy += value * value; peak = Math.max(peak, Math.abs(value)); }
  const gain = Math.min(.55 / Math.max(peak, 1e-9), .12 / Math.max(Math.sqrt(energy / samples.length), 1e-9));
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return samples;
}
