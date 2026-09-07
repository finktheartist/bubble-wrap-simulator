import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { WrappedObject } from './arena';
import { targetPosition } from './targets';

let rapierReady: Promise<void> | undefined;
export const initPhysics = () => rapierReady ??= RAPIER.init();
export type PhysicsItem = { body:RAPIER.RigidBody; collider:RAPIER.Collider; group:THREE.Group; name:string; wrapped?:WrappedObject; kind:'parcel'|'ball'|'bomb'|'shot'|'rocket'; born:number; fuse:number; speed:number; initial:THREE.Vector3; radius:number; impactPoint?:THREE.Vector3 };
export class ArenaPhysics {
  world = new RAPIER.World({x:0,y:-9.81,z:0});
  events = new RAPIER.EventQueue(true);
  player: RAPIER.RigidBody;
  playerCollider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
  items:PhysicsItem[]=[];
  lookup=new Map<number,PhysicsItem>();
  grounded=false;
  verticalVelocity=0;
  held:PhysicsItem|null=null;
  movingTargets:{object:WrappedObject;body:RAPIER.RigidBody}[]=[];
  constructor(objects:WrappedObject[], public onImpact:(item:PhysicsItem,point:THREE.Vector3,speed:number)=>void) {
    this.world.timestep=1/60;
    for(const o of objects) {
      const p=o.group.position;
      const desc=(o.motion?RAPIER.RigidBodyDesc.kinematicPositionBased():o.dynamic?RAPIER.RigidBodyDesc.dynamic():RAPIER.RigidBodyDesc.fixed()).setTranslation(p.x,p.y,p.z);
      if(o.dynamic) desc.setCcdEnabled(true).setLinearDamping(.14).setAngularDamping(.28);
      const body=this.world.createRigidBody(desc);
      const size=o.size;
      const cd=RAPIER.ColliderDesc.cuboid(size.x/2,size.y/2,size.z/2).setFriction(.62).setRestitution(.16);
      if(o.dynamic) cd.setMass(2.5).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      const collider=this.world.createCollider(cd,body);
      if(o.motion)this.movingTargets.push({object:o,body});
      if(o.dynamic) {
        const item:PhysicsItem={body,collider,group:o.group,name:o.name,wrapped:o,kind:'parcel',born:0,fuse:-1,speed:0,initial:p.clone(),radius:size.length()/2};
        this.items.push(item);this.lookup.set(collider.handle,item);o.group.userData.physicsItem=item;
      }
    }
    this.player=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,.88,9.5));
    this.playerCollider=this.world.createCollider(RAPIER.ColliderDesc.capsule(.55,.28).setFriction(0),this.player);
    this.controller=this.world.createCharacterController(.025);
    this.controller.enableAutostep(.72,.25,true);
    this.controller.enableSnapToGround(.25);
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.controller.setCharacterMass(70);
    this.world.step();
  }
  move(x:number,z:number,jump:boolean,dt:number) {
    if(jump&&this.grounded) this.verticalVelocity=5.7;
    else if(this.grounded&&this.verticalVelocity<0) this.verticalVelocity=-.4;
    this.verticalVelocity-=9.81*dt;
    this.controller.computeColliderMovement(this.playerCollider,{x:x*dt,y:this.verticalVelocity*dt,z:z*dt},undefined,undefined,c=>c.handle!==this.held?.collider.handle);
    const d=this.controller.computedMovement();
    const p=this.player.translation();
    this.player.setNextKinematicTranslation({x:p.x+d.x,y:p.y+d.y,z:p.z+d.z});
    this.grounded=this.controller.computedGrounded();
    if(this.grounded&&this.verticalVelocity<0) this.verticalVelocity=0;
    if(p.y<-5) {this.player.setTranslation({x:0,y:.88,z:9.5},true);this.verticalVelocity=0;}
  }
  spawn(group:THREE.Group,kind:PhysicsItem['kind'],position:THREE.Vector3,velocity:THREE.Vector3,now:number):PhysicsItem {
    const radius=kind==='ball'?.28:kind==='bomb'?.19:kind==='rocket'?.12:.075;
    const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x,position.y,position.z).setLinvel(velocity.x,velocity.y,velocity.z).setCcdEnabled(true).setLinearDamping(kind==='rocket'?0:.035).setAngularDamping(.1));
    const collider=this.world.createCollider(RAPIER.ColliderDesc.ball(radius).setMass(kind==='ball'?7:kind==='bomb'?1.2:kind==='rocket'?.65:.15).setRestitution(kind==='rocket'?0:kind==='ball'?.42:kind==='bomb'?.3:.65).setFriction(.55).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);
    if(kind==='rocket'){
      body.setGravityScale(0,true);body.lockRotations(true,true);
      const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1),velocity.clone().normalize());body.setRotation(q,true);group.quaternion.copy(q);
    }else body.setAngvel({x:velocity.z*1.3,y:1,z:-velocity.x},true);
    group.position.copy(position);
    const item:PhysicsItem={body,collider,group,name:kind==='ball'?'Bowling ball':kind==='bomb'?'Pop bomb':kind==='rocket'?'Pop rocket':'Blaster pellet',kind,born:now,fuse:kind==='bomb'?now+1.5:kind==='rocket'?now+3.5:-1,speed:velocity.length(),initial:position.clone(),radius};
    this.items.push(item);this.lookup.set(collider.handle,item);group.userData.physicsItem=item;
    return item;
  }
  grab(item:PhysicsItem) { this.release();this.held=item;item.body.setGravityScale(0,true);item.body.setLinearDamping(6);item.body.setAngularDamping(8); }
  holdAt(target:THREE.Vector3) {
    const item=this.held;if(!item) return;
    const p=item.body.translation();
    const delta=target.clone().sub(new THREE.Vector3(p.x,p.y,p.z));
    if(delta.length()>5){this.release();return;}
    // Spring-like servo keeps collisions active while a parcel is held.
    const desired=delta.multiplyScalar(13).clampLength(0,22);
    item.body.setLinvel(desired,true);
    item.body.setAngvel({x:0,y:0,z:0},true);
  }
  release(velocity?:THREE.Vector3) {
    const item=this.held;if(!item)return;
    item.body.setGravityScale(1,true);item.body.setLinearDamping(.14);item.body.setAngularDamping(.28);
    if(velocity){item.body.setLinvel(velocity,true);item.body.setAngvel({x:2,y:3,z:-2},true);}
    this.held=null;
  }
  step() {
    for(const item of this.items){const v=item.body.linvel();item.speed=Math.hypot(v.x,v.y,v.z);}
    this.world.step(this.events);
    for(const {object,body} of this.movingTargets){const p=body.translation(),q=body.rotation();object.group.position.set(p.x,p.y,p.z);object.group.quaternion.set(q.x,q.y,q.z,q.w);object.group.updateMatrixWorld(true);}
    for(const item of this.items){const p=item.body.translation(),r=item.body.rotation();item.group.position.set(p.x,p.y,p.z);item.group.quaternion.set(r.x,r.y,r.z,r.w);item.group.updateMatrixWorld(true);}
    this.events.drainCollisionEvents((a,b,started)=>{
      if(!started || a===this.playerCollider.handle || b===this.playerCollider.handle) return;
      const ia=this.lookup.get(a),ib=this.lookup.get(b);
      // A rocket must register a contact even if the object it hits moves faster.
      const item=ia?.kind==='rocket'?ia:ib?.kind==='rocket'?ib:(ia?.speed??0)>(ib?.speed??0)?ia:ib;
      if(!item || item===this.held || item.speed<1.05)return;
      const ca=this.world.getCollider(a),cb=this.world.getCollider(b);
      let point:THREE.Vector3|null=null;
      this.world.contactPair(ca,cb,m=>{if(point)return;const p=m.solverContactPoint(0);if(p)point=new THREE.Vector3(p.x,p.y,p.z);});
      if(point) this.onImpact(item,point,item.speed);
    });
  }
  moveTargets(now:number) {
    for(const {object,body} of this.movingTargets){
      const motion=object.motion!;body.setNextKinematicTranslation(targetPosition(motion,now));
      body.setNextKinematicRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.sin(now*motion.speed+motion.phase)*.18,Math.sin(now*.8+motion.phase)*.05)));
    }
  }
  blast(point:THREE.Vector3,radius:number,strength:number) {
    this.release();
    for(const item of this.items) {
      const p=item.group.position;
      const dir=p.clone().sub(point),distance=dir.length();
      if(distance>radius)continue;
      dir.y+=.6;dir.normalize();
      item.body.applyImpulse(dir.multiplyScalar(strength*(1-distance/radius)*item.body.mass()),true);
      item.body.applyTorqueImpulse({x:(Math.random()-.5)*2,y:1,z:(Math.random()-.5)*2},true);
    }
  }
  /** Mass-independent suction toward a hovering pile; rigid collisions remain active. */
  suction(origin:THREE.Vector3,direction:THREE.Vector3,dt:number):THREE.Vector3[] {
    const gathered:THREE.Vector3[]=[],target=origin.clone().addScaledVector(direction,2.1);
    for(const item of this.items){
      if(item===this.held||item.kind==='shot'||item.kind==='rocket')continue;
      const position=item.group.position,offset=position.clone().sub(origin),depth=offset.dot(direction);
      if(depth<.65||depth>8||offset.clone().addScaledVector(direction,-depth).length()>.5+depth*.46)continue;
      const ray=new RAPIER.Ray(origin,offset.clone().normalize());
      const obstruction=this.world.castRay(ray,offset.length(),true,undefined,undefined,this.playerCollider);
      if(obstruction&&obstruction.collider.handle!==item.collider.handle)continue;
      const desired=target.clone().sub(position).multiplyScalar(5).clampLength(0,13),velocity=item.body.linvel();
      const impulse=desired.sub(new THREE.Vector3(velocity.x,velocity.y,velocity.z)).multiplyScalar(item.body.mass()*(1-Math.exp(-7*dt)));
      impulse.y+=9.81*item.body.mass()*dt;
      item.body.applyImpulse(impulse,true);gathered.push(position.clone());
    }
    return gathered;
  }
  remove(item:PhysicsItem) {
    if(this.held===item)this.release();
    this.lookup.delete(item.collider.handle);this.world.removeRigidBody(item.body);
    this.items.splice(this.items.indexOf(item),1);item.group.removeFromParent();
  }
  reset() {
    this.release();
    // Snapshot preserves iteration while temporary bodies are removed.
    for(const item of this.items.slice()) {
      if(item.kind!=='parcel'){this.remove(item);continue;}
      item.body.setTranslation(item.initial,true);item.body.setRotation({x:0,y:0,z:0,w:1},true);item.body.setLinvel({x:0,y:0,z:0},true);item.body.setAngvel({x:0,y:0,z:0},true);
      item.group.position.copy(item.initial);item.group.quaternion.identity();
    }
    this.player.setTranslation({x:0,y:.88,z:9.5},true);this.verticalVelocity=0;
    this.world.step();
  }
  dispose(){this.events.free();this.world.free();}
}
