import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchGesture, thumbstickVector, touchLookDelta } from '../lib/game/touch';
import { BubbleGame } from '../lib/game/game';
import { WrapSurface } from '../lib/game/arena';

await test('movement, looking and firing each retain their own finger during simultaneous gestures',()=>{
  const move=new TouchGesture(),look=new TouchGesture(),fire=new TouchGesture();
  assert.ok(move.start(1,30,650));assert.ok(look.start(2,300,400));assert.ok(fire.start(3,300,680));
  assert.equal(look.start(4,180,210),false,'a second finger cannot steal an active look');
  assert.equal(look.move(4,300,310),null);assert.equal(look.end(4),false);
  assert.deepEqual(look.move(2,318,390),{x:18,y:-10});
  assert.equal(move.end(2),false,'releasing aim does not stop movement');
  assert.deepEqual(move.move(1,45,630),{x:15,y:-20});
  assert.ok(fire.end(3));assert.equal(fire.move(3,310,620),null);
  look.reset();assert.equal(look.move(2,400,300),null,'cancel/pause removes the old gesture');
  assert.ok(look.start(5,200,400));assert.deepEqual(look.move(5,195,405),{x:-5,y:5});
});
await test('thumbstick rejects center drift and preserves analog direction without diagonal speed boosts',()=>{
  const center=thumbstickVector(3,2,36);assert.equal(center.x,0);assert.equal(center.y,0);
  const right=thumbstickVector(18,0,36);assert.ok(right.x>0&&right.x<1);assert.equal(right.y,0);
  const diagonal=thumbstickVector(200,-200,36);
  assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<1e-10);
  assert.ok(Math.abs(Math.hypot(diagonal.knobX,diagonal.knobY)-36)<1e-10);
  assert.ok(diagonal.x>0&&diagonal.y<0);
});
await test('phone and landscape swipes cover a comparable look angle',()=>{
  const portrait=touchLookDelta(390/4,0,390),landscape=touchLookDelta(844/4,0,844);
  assert.ok(Math.abs(portrait.x-landscape.x)<1e-10);
});
await test('an arena tap activates once, while a drag, long press, cancelled gesture or another finger never becomes a tap',()=>{
  const gesture=new TouchGesture();
  gesture.start(1,180,300,0);assert.ok(gesture.finishTap(1,183,303,120));assert.equal(gesture.finishTap(1,183,303,150),false);
  gesture.start(2,180,300,200);gesture.move(2,230,300);gesture.move(2,180,300);
  assert.equal(gesture.finishTap(2,180,300,300),false,'returning a drag to its start must not fire');
  gesture.start(3,180,300,400);assert.equal(gesture.finishTap(4,180,300,410),false);assert.equal(gesture.finishTap(3,180,300,900),false);
  gesture.start(5,180,300,1000);gesture.end(5);assert.equal(gesture.finishTap(5,180,300,1100),false);
});
await test('interrupted charged throws cancel without throwing a ball or held parcel',()=>{
  const game=Object.create(BubbleGame.prototype) as BubbleGame;
  let throws=0;
  Object.assign(game,{down:true,snapshot:{playing:true,tool:3,charge:.8},pressedBubble:null,throwItem:()=>{throws++;}});
  game.actionCancel();game.actionUp();
  assert.equal(throws,0);assert.equal(game.snapshot.charge,0);
});
await test('lighter mobile pockets preserve every bubble, its location and its pop/reset state',()=>{
  const desktop=new WrapSurface(2.6,2.6,0xffffff),mobile=new WrapSurface(2.6,2.6,0xffffff,.26,true);
  assert.equal(mobile.cells.length,desktop.cells.length);
  assert.ok(mobile.mesh.geometry.getAttribute('position').count<desktop.mesh.geometry.getAttribute('position').count*.7);
  assert.deepEqual(mobile.cells.map(c=>[c.x,c.z,c.radius]),desktop.cells.map(c=>[c.x,c.z,c.radius]));
  assert.ok(mobile.pop(10,1));mobile.updateCell(10,1.2);assert.equal(mobile.cells[10].state,2);
  mobile.reset();assert.equal(mobile.cells[10].state,0);desktop.dispose();mobile.dispose();
});
