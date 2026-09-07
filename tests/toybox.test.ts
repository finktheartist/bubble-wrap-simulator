import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BubbleGame } from '../lib/game/game';
import { ArenaPhysics, initPhysics, type PhysicsItem } from '../lib/game/physics';
import { WrapSurface, type WrappedObject } from '../lib/game/arena';
import { WorldEffects, ToolEffects } from '../lib/game/effects';
import { TOOL_INFO, TOOL_MUZZLES, cycleTool, toolShortcut } from '../lib/game/tool-info';
import { createRocket, toolMuzzlePosition } from '../lib/game/projectiles';
import { disposeTool } from '../lib/game/tools';
import { heldToolPose } from '../lib/game/melee';
import { loadTestToolLibrary } from './helpers/tool-library';

await initPhysics();
const tools=await loadTestToolLibrary();
function box(name:string,size:[number,number,number],position:[number,number,number],dynamic=false):WrappedObject {
  const group=new THREE.Group();group.position.set(...position);return {group,size:new THREE.Vector3(...size),name,dynamic,color:0xffffff,surfaces:[]};
}
function fixture(tool:number){
  const surface=new WrapSurface(2.4,1.8,0xd5e5e8);
  surface.group.position.set(0,1.64,6.405);surface.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1));
  const scene=new THREE.Scene();scene.add(surface.group);scene.updateMatrixWorld(true);
  const camera=new THREE.PerspectiveCamera(66,1,.06,100);camera.position.set(0,1.64,9.5);camera.updateMatrixWorld();
  const physics=new ArenaPhysics([box('Target backing',[2.4,1.8,.12],[0,1.64,6.3])],()=>{});
  const game=Object.create(BubbleGame.prototype) as BubbleGame,effects=new WorldEffects(scene,true),toolEffects=new ToolEffects(new THREE.Scene());
  Object.assign(game,{arena:{camera,scene,surfaces:[surface]},physics,tools,effects,toolEffects,movingTargets:{notePop:()=>null},time:10,nextAction:0,down:false,touch:true,recoil:0,
    snapshot:{playing:true,tool,pops:0,combo:0,best:0,charge:0},audio:{start:async()=>{},pop:()=>{},thump:()=>{},swish:()=>{}},
    activePops:new Map(),queued:[],particles:[],rays:[],pressedBubble:null,lastPop:-10,melee:{advance:()=>null},
  });
  const internal=game as unknown as {impact:(item:PhysicsItem,point:THREE.Vector3,speed:number)=>void;updateInteraction:(dt?:number)=>void;updateProjectiles:(dt:number)=>void;queued:unknown[];rays:{mesh:THREE.Mesh}[]};
  physics.onImpact=(...args)=>internal.impact(...args);
  return {game,physics,internal,scene,effects,dispose(){for(const item of physics.items)disposeTool(item.group);for(const {mesh} of internal.rays){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}physics.dispose();surface.dispose();effects.dispose();toolEffects.dispose();}};
}

await test('a rocket tap flies forward, hits a physical target, then detonates once outside collision dispatch',()=>{
  const f=fixture(6);f.game.tapTool();const rocket=f.physics.items[0];
  assert.equal(rocket.kind,'rocket');assert.equal(rocket.body.gravityScale(),0);assert.equal(Boolean(rocket.impactPoint),false);
  const facing=new THREE.Vector3(0,0,-1).applyQuaternion(rocket.group.quaternion);
  assert.ok(facing.dot(new THREE.Vector3(0,0,-1))>.94,'rocket faces its trajectory toward the crosshair');
  f.game.time+=.1;f.game.tapTool();assert.equal(f.physics.items.length,1,'rapid taps respect launcher recovery');
  for(let i=0;i<30&&!rocket.impactPoint;i++){f.game.time+=1/60;f.physics.step();}
  assert.ok(rocket.impactPoint,'CCD reports an impact on the backing');
  assert.ok(rocket.impactPoint.z>6.2&&rocket.impactPoint.z<6.7);
  assert.equal(f.physics.items.length,1,'callback has not mutated the borrowed physics world');
  f.internal.updateProjectiles(1/60);assert.equal(f.physics.items.length,0);assert.ok(f.internal.queued.length>20,'blast schedules real bubbles');
  const queued=f.internal.queued.length;f.internal.updateProjectiles(1/60);assert.equal(f.internal.queued.length,queued,'one rocket cannot explode twice');
  f.dispose();
});

await test('a missed rocket expires, and removing its flight model releases every unique GPU resource once',()=>{
  const f=fixture(6),model=createRocket(),geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();let disposedGeometry=0,disposedMaterials=0;
  model.traverse(o=>{if(o instanceof THREE.Mesh){geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  geometry.forEach(g=>g.addEventListener('dispose',()=>{disposedGeometry++;}));materials.forEach(m=>m.addEventListener('dispose',()=>{disposedMaterials++;}));
  const rocket=f.physics.spawn(model,'rocket',new THREE.Vector3(0,30,0),new THREE.Vector3(0,0,-27),f.game.time);
  f.game.time=rocket.fuse+.01;f.internal.updateProjectiles(1/60);assert.equal(f.physics.items.length,0);
  assert.equal(disposedGeometry,geometry.size);assert.equal(disposedMaterials,materials.size);f.dispose();
});

await test('bowling cannon fires heavy balls on tap and repeats only while the action remains held',()=>{
  const f=fixture(7);f.game.actionDown();const ball=f.physics.items[0];
  assert.equal(ball.kind,'ball');assert.ok(Math.abs(ball.body.mass()-7)<.001);assert.ok(ball.speed>30);
  f.game.time+=.3;f.internal.updateInteraction();assert.equal(f.physics.items.length,1);
  f.game.time+=.5;f.internal.updateInteraction();assert.equal(f.physics.items.length,2);
  f.game.actionUp();f.game.time+=1;f.internal.updateInteraction();assert.equal(f.physics.items.length,2,'release stops automatic bowling');f.dispose();
});

await test('vacuum taps pop reachable wrap; holding continues and cancel stops suction',()=>{
  const f=fixture(8);f.game.tapTool();assert.ok(f.internal.queued.length>0,'a quick mobile tap still performs a useful action');
  const ball=f.physics.spawn(new THREE.Group(),'ball',new THREE.Vector3(.65,1.64,7),new THREE.Vector3(),f.game.time);
  f.physics.step();f.game.time+=.1;f.game.actionDown();assert.ok(ball.body.linvel().x<0,'suction pulls off-center props into a pile');
  f.game.actionCancel();const velocity=ball.body.linvel();f.game.time+=.1;f.internal.updateInteraction();assert.deepEqual(ball.body.linvel(),velocity,'cancel does not leave an invisible vacuum running');f.dispose();
});

await test('suction has bounded reach, respects walls and leaves dynamic collisions and gravity enabled',()=>{
  const physics=new ArenaPhysics([box('Occluder',[.2,3,3],[2,1.5,0])],()=>{}),origin=new THREE.Vector3(0,1.5,0),direction=new THREE.Vector3(1,0,0);
  const front=physics.spawn(new THREE.Group(),'ball',new THREE.Vector3(1.1,1.5,0),new THREE.Vector3(),0);
  const hidden=physics.spawn(new THREE.Group(),'ball',new THREE.Vector3(4,1.5,0),new THREE.Vector3(),0);
  const far=physics.spawn(new THREE.Group(),'ball',new THREE.Vector3(10,1.5,0),new THREE.Vector3(),0);
  const side=physics.spawn(new THREE.Group(),'ball',new THREE.Vector3(1,1.5,4),new THREE.Vector3(),0);
  physics.step();const hiddenVelocity=hidden.body.linvel();physics.suction(origin,direction,1/60);
  assert.ok(front.body.linvel().x>0);assert.deepEqual(hidden.body.linvel(),hiddenVelocity,'no pulling through a wall');
  assert.equal(far.body.linvel().x,0);assert.equal(side.body.linvel().x,0);assert.equal(front.body.gravityScale(),1);assert.ok(front.body.isDynamic());
  for(let i=0;i<90;i++){physics.suction(origin,direction,1/60);physics.step();}
  assert.ok(front.group.position.x<1.8,'gathered ball cannot be pulled through the wall');physics.dispose();
});

await test('new tool assets and shortcuts stay reachable, and held silhouettes fit phone and desktop views',()=>{
  for(let i=0;i<TOOL_INFO.length;i++)assert.equal(toolShortcut(`Digit${i+1}`),i);
  assert.equal(toolShortcut('Digit0'),null);assert.equal(cycleTool(8,1),0);assert.equal(cycleTool(0,-1),8);
  for(const aspect of [320/740,390/844,.75,.98,1,4/3,844/390,16/9])for(const tool of [6,7,8])for(const recoil of [0,1]){
    const model=tools.create(tool),pose=heldToolPose(tool,aspect,{recoil});model.position.set(...pose.position);model.rotation.set(...pose.rotation);model.scale.setScalar(pose.scale);model.updateMatrixWorld(true);
    const camera=new THREE.PerspectiveCamera(60,aspect,.01,10);camera.updateMatrixWorld();
    // Project actual vertices: the empty corners of an axis-aligned box exaggerate long barrels.
    const points:THREE.Vector3[]=[];model.traverse(o=>{if(o instanceof THREE.Mesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).project(camera));}});
    assert.ok(points.every(p=>p.z<1&&p.x<1&&p.x>-1&&p.y<.6&&p.y>-1),`${TOOL_INFO[tool].name} must fit at aspect ${aspect}, recoil ${recoil}`);
    assert.ok(points.every(p=>p.y<-.01||p.x>.1),`${TOOL_INFO[tool].name} leaves the reticle clear at aspect ${aspect}, recoil ${recoil}`);
  }
});

await test('rocket trails and inward vacuum effects share the phone particle budget and disappear after use',()=>{
  const scene=new THREE.Scene(),effects=new WorldEffects(scene,true);
  for(let i=0;i<100;i++){effects.exhaust(new THREE.Vector3(),new THREE.Vector3(0,0,1));effects.suction(new THREE.Vector3(0,0,-3),new THREE.Vector3());}
  effects.update(1/60);const mesh=scene.children.find(o=>o instanceof THREE.InstancedMesh) as THREE.InstancedMesh;assert.ok(mesh.count<=180);
  effects.update(1);assert.equal(mesh.count,0);effects.dispose();assert.equal(scene.children.length,0);
});
await test('rocket, cannon and vacuum effects align with model openings across the separate arena and tool cameras',()=>{
  for(const aspect of [390/844,16/9])for(const tool of [6,7,8]){
    const arenaCamera=new THREE.PerspectiveCamera(66,aspect,.06,100);arenaCamera.position.set(3,2,-1);arenaCamera.rotation.set(-.2,1.3,0,'YXZ');arenaCamera.updateMatrixWorld();
    const toolCamera=new THREE.PerspectiveCamera(60,aspect,.01,10),pose=heldToolPose(tool,aspect,{recoil:.4});
    const actualOpening=new THREE.Vector3(...TOOL_MUZZLES[tool]).multiplyScalar(pose.scale).applyEuler(new THREE.Euler(...pose.rotation)).add(new THREE.Vector3(...pose.position)).project(toolCamera);
    const worldOpening=toolMuzzlePosition(tool,arenaCamera,.4).project(arenaCamera);
    assert.ok(Math.abs(actualOpening.x-worldOpening.x)<1e-6&&Math.abs(actualOpening.y-worldOpening.y)<1e-6,'world effects originate at the visible model opening even while looking around');
  }
});
tools.dispose();
