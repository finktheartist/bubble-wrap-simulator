import test from 'node:test';
import assert from 'node:assert/strict';
import { PopVoiceScheduler, synthesizePop } from '../lib/game/pop-synthesis';
function random(seed=739){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function rms(samples: Float32Array, from = 0, to = samples.length) {
  let energy = 0;
  for (let i = from; i < to; i++) energy += samples[i] ** 2;
  return Math.sqrt(energy / (to - from));
}
await test('pops have a rounded attack, headroom, and no scratchy tail at common sample rates',()=>{
  for(const rate of [44100,48000]) for(const variant of [0,9,15]) {
    const pop=synthesizePop(rate,variant,random());
    let peak=0;for(const sample of pop){assert.ok(Number.isFinite(sample));peak=Math.max(peak,Math.abs(sample));}
    assert.ok(peak>.65&&peak<.8,'a single pop leaves ample mixing headroom');
    assert.ok(rms(pop,0,Math.floor(.012*rate))>.15,'the pressure release is audible');
    assert.ok(rms(pop,Math.floor(.035*rate),Math.floor(.065*rate))<.004,'no noisy crinkle tail after the pop');
    // Large adjacent-sample jumps are a useful regression signal for harsh broadband noise.
    const differences=new Float32Array(pop.length-1);
    for(let i=0;i<differences.length;i++)differences[i]=pop[i+1]-pop[i];
    assert.ok(rms(differences)/rms(pop)<.15,'the waveform is smooth rather than scratchy');
    assert.equal(pop[0],0,'no discontinuity before the attack');
    assert.ok(Math.abs(pop.at(-1)!)<.0001,'the buffer ends quietly');
    assert.notDeepEqual(pop,synthesizePop(rate,(variant+7)%16,random(920)),'pops retain natural pitch variation');
  }
});
await test('large impacts retain separate pops instead of a dense buzzing stack',()=>{
  const scheduler=new PopVoiceScheduler();
  const starts:number[]=[];
  for(let i=0;i<250;i++){const at=scheduler.reserve(5);if(at!==null)starts.push(at);}
  assert.ok(starts.length>=4&&starts.length<=6,'select a handful of distinct audible pops from a dense impact');
  for(let i=1;i<starts.length;i++)assert.ok(starts[i]-starts[i-1]>=.0199,'leave space between attacks');
  assert.ok(starts.at(-1)!<=5.105,'a blast cannot create a long audio backlog');
  assert.ok(scheduler.reserve(6)!>=6,'a later individual pop is not blocked');
  scheduler.reset();
  assert.ok(scheduler.reserve(0)!<.01,'reset discards pending timing');
});
await test('a sustained explosion-density burst has mixing headroom before the limiter',()=>{
  const rate=48000,scheduler=new PopVoiceScheduler(),mixed=new Float32Array(rate*2);
  let count=0;
  for(let frame=0;frame<45;frame++) for(let bubble=0;bubble<80;bubble++) {
    const at=scheduler.reserve(frame/60);if(at===null)continue;
    const pop=synthesizePop(rate,count++,random(count+91));
    const start=Math.round(at*rate);
    for(let i=0;i<pop.length&&start+i<mixed.length;i++)mixed[start+i]+=pop[i]*.72;
  }
  let peak=0;for(const sample of mixed)peak=Math.max(peak,Math.abs(sample));
  assert.ok(count>25,'a blast remains audibly plentiful');
  assert.ok(peak<.8,`no clipping from overlapping pops: ${peak}`);
  assert.ok(rms(mixed,rate,mixed.length)<.0001,'no lingering noise after the burst');
});
