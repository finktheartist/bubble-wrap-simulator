export type ToolSound = 'impact' | 'explosion' | 'pistol' | 'launcher' | 'cannon' | 'swish' | 'heavy-swish' | 'vacuum';

/** Short, dry tool cues leave the recorded plastic transients in the foreground. */
export function synthesizeTool(sampleRate: number, kind: ToolSound, random = Math.random): Float32Array {
  const duration = kind === 'vacuum' ? 1 : kind === 'explosion' ? .42 : kind === 'launcher' ? .3 : kind === 'cannon' ? .2 : kind === 'impact' ? .085 : kind === 'pistol' ? .11 : kind === 'heavy-swish' ? .18 : .14;
  const result = new Float32Array(Math.ceil(sampleRate * duration));
  let low = 0, mid = 0, phase = 0;
  for (let i = 0; i < result.length; i++) {
    const t = i / sampleRate, u = t / duration, noise = random() * 2 - 1;
    low += (1 - Math.exp(-2 * Math.PI * 380 / sampleRate)) * (noise - low);
    mid += (1 - Math.exp(-2 * Math.PI * 2900 / sampleRate)) * (noise - mid);
    let value: number;
    if (kind === 'vacuum') {
      // Whole-number cycles make a seamless, restrained electric motor bed.
      value = (Math.sin(2 * Math.PI * 112 * t) * .15 + Math.sin(2 * Math.PI * 224 * t) * .07
        + Math.sin(2 * Math.PI * 448 * t) * .025) * (1 + .05 * Math.sin(2 * Math.PI * 7 * t));
      value += (mid - low) * .12 * Math.sin(Math.PI * u) ** 2;
    } else if (kind === 'swish' || kind === 'heavy-swish') {
      value = (mid - low * .85) * Math.sin(Math.PI * u) ** 2 * .45;
    } else {
      const big = kind === 'explosion' || kind === 'cannon', launch = kind === 'launcher';
      const frequency = big ? 48 + 85 * Math.exp(-t / .012) : launch ? 80 : kind === 'impact' ? 155 : 235;
      phase += 2 * Math.PI * frequency / sampleRate;
      const body = Math.sin(phase) * Math.exp(-t / (big ? .055 : .012)) * (big ? .5 : .12);
      const crack = (mid - low * .6) * Math.exp(-t / (big ? .024 : .006)) * (kind === 'pistol' ? .95 : .6);
      const air = launch ? (mid - low) * Math.sin(Math.PI * u) ** 2 * .3 : low * Math.exp(-t / (big ? .075 : .015)) * .2;
      const mechanism = kind === 'pistol' ? (mid - low) * .11 * Math.exp(-(((t - .04) / .003) ** 2)) : 0;
      value = (body + crack + air + mechanism) * (1 - Math.exp(-t / .0003));
      value *= Math.min(1, (duration - t) / .012);
    }
    result[i] = value;
  }
  return result;
}
