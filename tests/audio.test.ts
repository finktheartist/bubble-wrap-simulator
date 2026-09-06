import test from 'node:test';
import assert from 'node:assert/strict';
import { PopVoiceScheduler,synthesizePop } from '../lib/game/pop-synthesis';
function random(seed=739){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
await test('pop has a strong bounded transient, distinct variants, and a quiet tail at both common sample rates',()=>{
  for(const rate of [44100,48000]){
    const pop=synthesizePop(rate,0,random());
    let peak=0;for(const sample of pop){assert.ok(Number.isFinite(sample));peak=Math.max(peak,Math.abs(sample));}
    assert.ok(peak>.85&&peak<.99,'headroom for the transient');
    const rms=(from:number,to:number)=>{const values=pop.slice(Math.floor(from*rate),Math.floor(to*rate));return Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length);};
    assert.ok(rms(0,.012)>rms(.09,.115)*15,'the pop has a defined attack instead of a long hiss');
    assert.ok(rms(.02,.06)>.003,'audible plastic micro-crinkles remain after the attack');
    assert.equal(pop[0],0,'no discontinuity before the attack');
    assert.ok(Math.abs(pop.at(-1)!)<.0001,'the buffer ends quietly');
    assert.notDeepEqual(pop,synthesizePop(rate,9,random(920)),'pops have different membrane pitches');
  }
});
await test('simultaneous pops become a bounded crackle instead of all but one being discarded',()=>{
  const scheduler=new PopVoiceScheduler();
  const starts:number[]=[];
  for(let i=0;i<250;i++){const at=scheduler.reserve(5);if(at!==null)starts.push(at);}
  assert.ok(starts.length>=20&&starts.length<=30);
  for(let i=1;i<starts.length;i++)assert.ok(starts[i]>starts[i-1]);
  assert.ok(starts.at(-1)!<=5.115,'a blast cannot create a multi-second audio backlog');
  assert.ok(scheduler.reserve(6)!>=6,'a later individual pop is not blocked');
});
