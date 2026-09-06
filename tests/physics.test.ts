import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ArenaPhysics,initPhysics } from '../lib/game/physics';
import { WrapSurface,type WrappedObject } from '../lib/game/arena';
await initPhysics();
function box(name:string,size:[number,number,number],p:[number,number,number],dynamic=false):WrappedObject {const group=new THREE.Group();group.position.set(...p);return {group,size:new THREE.Vector3(...size),surfaces:[],dynamic,name,color:0xffffff};}
const floor=()=>box('floor',[26,.4,30],[0,-.2,0]);

await test('bubble pops once, animates flat, and can be reinflated',()=>{
  const surface=new WrapSurface(3,3,0xd5e5e8);
  assert.ok(surface.cells.length>15);
  assert.equal(surface.pop(4,1),true);
  assert.equal(surface.pop(4,1.1),false);
  surface.updateCell(4,1.2);
  assert.equal(surface.cells[4].state,2);
  const m=new THREE.Matrix4();surface.mesh.getMatrixAt(4,m);
  const scale=new THREE.Vector3().setFromMatrixScale(m);
  assert.ok(scale.y<scale.x*.08,'a spent dome remains visibly flat');
  surface.reset();
  assert.equal(surface.cells[4].state,0);
  assert.equal(surface.pop(4,3),true);
  surface.dispose();
});

await test('character walks on floor, stops at a wall, jumps, and lands',()=>{
  const world=new ArenaPhysics([floor(),box('wall',[.4,5,30],[4.2,2.5,0])],()=>{});
  world.player.setTranslation({x:0,y:.9,z:0},true);world.world.step();
  for(let i=0;i<150;i++){world.move(4,0,false,1/60);world.step();}
  const p=world.player.translation();
  assert.ok(p.x>3&&p.x<3.75,`wall should stop capsule: ${p.x}`);
  assert.ok(p.y>.8&&p.y<1,'standing on floor');
  assert.equal(world.grounded,true);
  let highest=p.y;
  for(let i=0;i<120;i++){world.move(0,0,i===0,1/60);world.step();highest=Math.max(highest,world.player.translation().y);}
  assert.ok(highest>1.9,`jump reaches ${highest}`);
  assert.ok(world.player.translation().y<1,'lands again');
  world.dispose();
});

await test('high speed ball produces real contact points without passing through a wall',()=>{
  const impacts:{p:THREE.Vector3;speed:number}[]=[];
  const world=new ArenaPhysics([floor(),box('wall',[.4,6,30],[4.2,3,0])],(_item,p,speed)=>impacts.push({p,speed}));
  const item=world.spawn(new THREE.Group(),'ball',new THREE.Vector3(0,2,0),new THREE.Vector3(24,0,0),0);
  for(let i=0;i<120;i++)world.step();
  assert.ok(impacts.some(i=>i.speed>15&&i.p.x>3.5),'a fast impact reports a contact at the wall');
  assert.ok(item.group.position.x<4,'CCD prevents tunneling');
  assert.ok(item.group.position.y>.2,'ball stays above floor');
  world.dispose();
});

await test('grabbing preserves collisions; release restores gravity and throw velocity',()=>{
  const world=new ArenaPhysics([floor(),box('wall',[.4,6,30],[2.2,3,0])],()=>{});
  const item=world.spawn(new THREE.Group(),'ball',new THREE.Vector3(0,1,0),new THREE.Vector3(),0);
  world.grab(item);
  for(let i=0;i<90;i++){world.holdAt(new THREE.Vector3(3,1,0));world.step();}
  assert.ok(item.group.position.x<1.8,'held item cannot pass through wall');
  world.release(new THREE.Vector3(-10,3,0));
  assert.equal(world.held,null);
  assert.equal(item.body.gravityScale(),1);
  assert.ok(item.body.linvel().x<-9);
  world.dispose();
});

await test('blast falloff moves nearby props more strongly and reset restores parcels',()=>{
  const parcel=box('parcel',[1,1,1],[1,.8,0],true);
  const world=new ArenaPhysics([floor(),parcel],()=>{});
  const near=world.spawn(new THREE.Group(),'ball',new THREE.Vector3(2,1,0),new THREE.Vector3(),0);
  const far=world.spawn(new THREE.Group(),'ball',new THREE.Vector3(5,1,0),new THREE.Vector3(),0);
  world.blast(new THREE.Vector3(0,1,0),7,10);
  assert.ok(near.body.linvel().x>far.body.linvel().x);
  assert.ok(far.body.linvel().x>0);
  for(let i=0;i<20;i++)world.step();
  world.reset();
  assert.equal(world.items.length,1);
  assert.ok(Math.abs(world.items[0].body.translation().x-1)<.02);
  assert.equal(world.held,null);
  world.dispose();
});
