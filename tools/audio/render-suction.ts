import { synthesizeSuction, type SuctionSound } from '../../lib/game/suction-synthesis';
const kind = process.argv[2] as SuctionSound;
if (!['vacuum-start', 'vacuum'].includes(kind)) throw new Error('Unknown suction cue');
let seed = 68127;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const samples = synthesizeSuction(32000, kind, random);
const bytes = Buffer.alloc(samples.length * 4);
samples.forEach((sample, i) => bytes.writeFloatLE(sample, i * 4));
process.stdout.write(bytes);
