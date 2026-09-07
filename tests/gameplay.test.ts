import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeleeSwing, MELEE, meleePose } from '../lib/game/melee';
import { MovingTargets, targetPosition } from '../lib/game/targets';
import { ArenaPhysics, initPhysics } from '../lib/game/physics';
import { WorldEffects } from '../lib/game/effects';
import type { WrappedObject, WrapSurface } from '../lib/game/arena';

await test('a committed melee swing lands once at its contact time and finishes a distinct follow-through',()=>{
  for(const tool of [1,2] as const){
    const swing=new MeleeSwing();swing.trigger(tool,1);
    assert.equal(swing.advance(1.05),null);assert.equal(swing.advance(1+MELEE[tool].contact),tool);
    assert.equal(swing.advance(1+MELEE[tool].contact+.02),null,'frames cannot apply a second hit');
    assert.ok(swing.attack,'contact does not truncate the follow-through');swing.advance(1+MELEE[tool].duration+.01);assert.equal(swing.attack,null);
    assert.deepEqual(meleePose(tool,MELEE[tool].duration),{position:[0,0,0],rotation:[0,0,0]});
  }
  const hammer=meleePose(1,.23),bat=meleePose(2,.19);
  assert.ok(hammer.rotation[0]<-.5,'hammer drives down and forward');assert.ok(bat.rotation[2]>.5,'bat sweeps across the body');
});
await test('rapid melee taps buffer one near-future swing, and pause/tool changes discard queued hits',()=>{
  const swing=new MeleeSwing();swing.trigger(1,0);swing.advance(.24);swing.trigger(1,.5,true);swing.trigger(1,.51,true);swing.advance(.67);
  assert.ok(swing.attack);assert.equal(swing.attack.startedAt,.67);assert.equal(swing.advance(.91),1);swing.reset();assert.equal(swing.advance(3),null);
  swing.trigger(2,4);swing.trigger(2,4.05,true);swing.advance(4.7);assert.equal(swing.attack,null,'old tap requests expire');
});
await initPhysics();
await test('moving targets keep their wrap and physical colliders together and can be hit by fast blaster pellets',()=>{
  const arena={scene:new THREE.Scene(),surfaces:[] as WrapSurface[],objects:[] as WrappedObject[]};
  const targets=new MovingTargets(arena,true);let impacts=0;
  const physics=new ArenaPhysics(arena.objects,(item)=>{if(item.kind==='shot')impacts++;});
  const first=physics.movingTargets[0],origin=first.object.group.position.clone();
  physics.spawn(new THREE.Group(),'shot',origin.clone().add(new THREE.Vector3(0,0,2)),new THREE.Vector3(0,0,-42),0);
  for(let i=1;i<=30;i++){physics.moveTargets(i/60);physics.step();}
  assert.ok(impacts>0,'continuous collision detection hits the moving panel');
  const expected=targetPosition(first.object.motion!,.5),p=first.body.translation();
  assert.ok(expected.distanceTo(first.object.group.position)<.001);assert.ok(expected.distanceTo(new THREE.Vector3(p.x,p.y,p.z))<.001);
  assert.ok(origin.distanceTo(expected)>.03,'target actually moves');
  assert.ok(first.object.surfaces[0].worldPosition(12).distanceTo(expected)<1);
  physics.dispose();targets.dispose();arena.surfaces.forEach(s=>s.dispose());
});
await test('a target rewards one hit and reinflates its real bubbles for another pass',()=>{
  const arena={scene:new THREE.Scene(),surfaces:[] as WrapSurface[],objects:[] as WrappedObject[]},targets=new MovingTargets(arena,true);
  const surface=arena.surfaces[0];let rewards=0;
  for(let i=0;i<surface.cells.length;i++)if(surface.pop(i,1)&&targets.notePop(surface,1))rewards++;
  assert.equal(rewards,1);assert.ok(surface.cells.some(c=>c.state===1));targets.update(4.3);assert.ok(surface.cells.every(c=>c.state===0));
  for(let i=0;i<12;i++)if(surface.pop(i,5)&&targets.notePop(surface,5))rewards++;
  assert.equal(rewards,2);targets.reset();assert.ok(targets.targets.every(t=>t.pops===0&&t.respawnAt===0));
  targets.dispose();arena.surfaces.forEach(s=>s.dispose());
});
await test('dense impact effects stay bounded on phones and reset releases all active particles',()=>{
  const scene=new THREE.Scene(),effects=new WorldEffects(scene,true);
  for(let i=0;i<100;i++)effects.burst(new THREE.Vector3(),new THREE.Vector3(0,1,0),3,0xffffff,true);
  effects.update(1/60);const particles=scene.children.find(o=>o instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
  assert.equal(particles.count,effects.capacity);effects.update(1);assert.equal(particles.count,0);
  effects.burst(new THREE.Vector3(),new THREE.Vector3(0,1,0));effects.reset();assert.equal(particles.count,0);effects.dispose();assert.equal(scene.children.length,0);
});
