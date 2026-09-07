import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bindToolInput } from '../lib/game/input';
import { BubbleGame } from '../lib/game/game';
import { WrapSurface } from '../lib/game/arena';
import { ArenaPhysics, initPhysics } from '../lib/game/physics';
import { loadTestToolLibrary } from './helpers/tool-library';
import { MeleeSwing, MELEE } from '../lib/game/melee';
import { WorldEffects, ToolEffects } from '../lib/game/effects';

function dispatch(target:EventTarget,type:string,props:Record<string,unknown>) {
  const event=new Event(type,{cancelable:true});
  for(const [key,value] of Object.entries(props))Object.defineProperty(event,key,{value});
  target.dispatchEvent(event);
  return event;
}
await test('left click and F operate tools without pointer lock; release outside the arena ends the action',()=>{
  const doc=new EventTarget(),canvas=new EventTarget(),abort=new AbortController();
  let downs=0,ups=0,playing=true;
  bindToolInput(canvas as unknown as HTMLElement,doc as unknown as Document,{
    playing:()=>playing,locked:()=>false,down:()=>{downs++;},up:()=>{ups++;},look:()=>{},
  },abort.signal);
  dispatch(doc,'mousedown',{target:canvas,button:0});
  assert.equal(downs,1,'a click must not be swallowed by a mouse-capture request');
  dispatch(doc,'mouseup',{button:0});assert.equal(ups,1);
  dispatch(doc,'keydown',{code:'KeyF',repeat:false});
  dispatch(doc,'keydown',{code:'KeyF',repeat:true});
  assert.equal(downs,2,'keyboard autorepeat must not reset a charged throw');
  dispatch(doc,'keyup',{code:'KeyF'});assert.equal(ups,2);
  playing=false;
  dispatch(doc,'mousedown',{target:canvas,button:0});
  dispatch(doc,'keydown',{code:'KeyF',repeat:false});
  assert.equal(downs,2,'pause blocks firing');
  abort.abort();
});

await test('right drag looks around without firing; F does not fire while editing a setting',()=>{
  const doc=new EventTarget(),canvas=new EventTarget(),abort=new AbortController();
  const moves:number[][]=[];let downs=0;
  bindToolInput(canvas as unknown as HTMLElement,doc as unknown as Document,{
    playing:()=>true,locked:()=>false,down:()=>{downs++;},up:()=>{},look:(x,y)=>moves.push([x,y]),
  },abort.signal);
  dispatch(doc,'mousedown',{target:canvas,button:2,clientX:10,clientY:20});
  dispatch(doc,'mousemove',{clientX:30,clientY:15});
  dispatch(doc,'mouseup',{button:2});
  dispatch(doc,'mousemove',{clientX:60,clientY:40});
  assert.deepEqual(moves,[[20,-5]]);assert.equal(downs,0);
  dispatch(doc,'keydown',{target:{tagName:'INPUT'},code:'KeyF',repeat:false});
  assert.equal(downs,0);
  abort.abort();
});

await initPhysics();
await test('a quick tool-button tap pops immediately and every other tool produces its action',async()=>{
  // Exercise the real action/aim/physics pipeline without allocating a browser renderer.
  const surface=new WrapSurface(2.4,1.8,0xd5e5e8);
  surface.group.position.set(0,.9,7.05);
  surface.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1));
  const scene=new THREE.Scene();scene.add(surface.group);scene.updateMatrixWorld(true);
  const camera=new THREE.PerspectiveCamera(66,1,.06,100);
  camera.position.set(0,1.64,9.5);camera.rotation.set(-.08,0,0,'YXZ');camera.updateMatrixWorld();
  const physics=new ArenaPhysics([],()=>{});
  let audiblePops=0;
  const game=Object.create(BubbleGame.prototype) as BubbleGame;
  const tools=await loadTestToolLibrary(),effects=new WorldEffects(scene),toolEffects=new ToolEffects(new THREE.Scene());
  Object.assign(game,{
    arena:{camera,scene,surfaces:[surface]},physics,tools,effects,toolEffects,melee:new MeleeSwing(),movingTargets:{notePop:()=>null},time:1,nextAction:0,down:false,
    snapshot:{playing:true,tool:0,pops:0,combo:0,best:0,charge:0},
    audio:{start:async()=>{},pop:()=>{audiblePops++;},thump:()=>{},swish:()=>{}},
    activePops:new Map(),queued:[],particles:[],pressedBubble:null,lastPop:-10,
  });
  game.tapTool();
  assert.equal(game.snapshot.pops,1,'quick clicks should not require holding for a frame');
  assert.equal(audiblePops,1);
  game.time+=.12;game.tapTool();
  assert.equal(game.snapshot.pops,2,'nearby fresh cells can be popped without perfect pixel aiming');
  const internal=game as unknown as {queued:unknown[];melee:MeleeSwing;updateInteraction:()=>void};
  for(const tool of [1,2]){
    game.snapshot.tool=tool;game.time+=1;game.tapTool();
    assert.ok(internal.melee.attack,'a quick tap commits a full swing even after pointer release');
    internal.queued.length=0;game.time+=MELEE[tool as 1|2].contact;internal.updateInteraction();
    assert.ok(internal.queued.length>0,'contact during the visible strike schedules nearby bubbles');
    game.time+=1;internal.updateInteraction();
  }
  game.snapshot.tool=3;game.time+=1;game.actionDown();game.time+=.8;game.actionUp();
  assert.ok(physics.items.some(i=>i.kind==='ball'&&i.speed>20),'hold and release throws a charged ball');
  game.snapshot.tool=4;game.time+=1;game.tapTool();
  assert.ok(physics.items.some(i=>i.kind==='shot'),'quick taps fire the blaster too');
  game.snapshot.tool=5;game.time+=1;game.tapTool();
  assert.ok(physics.items.some(i=>i.kind==='bomb'&&i.fuse>game.time),'bomb tool spawns a fused bomb');
  physics.dispose();surface.dispose();tools.dispose();effects.dispose();toolEffects.dispose();
});
