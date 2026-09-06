import * as THREE from 'three';
import { createArena, WrapSurface, type Arena } from './arena';
import { ArenaPhysics, initPhysics, type PhysicsItem } from './physics';
import { PopAudio } from './audio';
import { renderToolIcons } from './tool-icons';
import { bindToolInput } from './input';
import { makeTool, disposeTool, TOOL_INFO } from './tools';

export type GameSnapshot={ready:boolean;playing:boolean;started:boolean;tool:number;pops:number;total:number;combo:number;best:number;hint:string;target:boolean;charge:number;held:string;fps:number;error:string;pointerLocked:boolean};
export type GameSettings={volume:number;sensitivity:number;shake:boolean;footsteps:boolean;muted:boolean;quality:'high'|'balanced'};
const DEFAULT:GameSnapshot={ready:false,playing:false,started:false,tool:0,pops:0,total:0,combo:0,best:0,hint:'',target:false,charge:0,held:'',fps:60,error:'',pointerLocked:false};
type Hit={surface:WrapSurface;index:number;point:THREE.Vector3;distance:number};
type Particle={p:THREE.Vector3;v:THREE.Vector3;life:number;max:number};
type ScheduledPop={surface:WrapSurface;index:number;at:number;strength:number};
export class BubbleGame {
  arena: Arena;
  physics: ArenaPhysics|null=null;
  audio=new PopAudio();
  toolIcons:string[]=[];
  snapshot={...DEFAULT};
  settings:GameSettings={volume:.65,sensitivity:1,shake:true,footsteps:true,muted:false,quality:'balanced'};
  keys=new Set<string>();
  time=0;private frame=0;private accumulator=0;private lastFrame=0;private lastPublish=0;private nextAction=0;
  private yaw=0;private pitch=-.07;private down=false;private pressedAt=0;private startedAt=0;
  private lastPop=-10;private lastFootstep=0;private shake=0;private swing=0;private recoil=0;
  private aimed:Hit|null=null;private pickup:PhysicsItem|null=null;private pressedBubble:{surface:WrapSurface;index:number}|null=null;
  private activePops=new Map<WrapSurface,Set<number>>();private queued:ScheduledPop[]=[];
  private particles:Particle[]=[];private particleGeometry=new THREE.BufferGeometry();private particleMaterial:THREE.PointsMaterial;private particleMesh:THREE.Points;
  private particleArray=new Float32Array(1500*3);
  private rays: {mesh:THREE.Mesh;life:number;max:number}[]=[];
  private toolScene=new THREE.Scene();private toolCamera=new THREE.PerspectiveCamera(60,1,.01,10);private toolModel:THREE.Group;
  private uiCallback:(s:GameSnapshot)=>void;private disposed=false;private touch=false;private touchMove={x:0,y:0};
  private movementX=0;private movementZ=0;private fpsSamples=0;private fpsElapsed=0;
  private resizeObserver:ResizeObserver;
  private abort=new AbortController();private unlockToCursor=false;
  constructor(private container:HTMLElement,onChange:(s:GameSnapshot)=>void) {
    this.uiCallback=onChange;
    this.arena=createArena(container);
    this.toolIcons=renderToolIcons(this.arena.renderer,this.arena.environment.texture);
    this.snapshot.total=this.arena.surfaces.reduce((n,s)=>n+s.cells.length,0);
    this.particleGeometry.setAttribute('position',new THREE.BufferAttribute(this.particleArray,3).setUsage(THREE.DynamicDrawUsage));
    this.particleGeometry.setDrawRange(0,0);
    this.particleMaterial=new THREE.PointsMaterial({color:0xf7ffff,size:.035,transparent:true,opacity:.8,depthWrite:false});
    this.particleMesh=new THREE.Points(this.particleGeometry,this.particleMaterial);this.particleMesh.frustumCulled=false;this.arena.scene.add(this.particleMesh);
    this.toolModel=makeTool(0);this.toolScene.add(this.toolModel);
    this.toolScene.environment=this.arena.environment.texture;
    this.toolScene.add(new THREE.HemisphereLight(0xffffff,0x68838a,3));
    const key=new THREE.DirectionalLight(0xfff6de,3);key.position.set(-3,4,2);this.toolScene.add(key);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
    this.bindEvents();
    this.arena.renderer.setAnimationLoop(this.animate);
  }
  async init() {
    try {
      await initPhysics();if(this.disposed)return;
      this.physics=new ArenaPhysics(this.arena.objects,(item,p,speed)=>this.impact(item,p,speed));
      this.snapshot.ready=true;this.publish();
    } catch(error) {this.snapshot.error=error instanceof Error?error.message:'Physics could not start';this.publish();}
  }
  private bindEvents() {
    const signal=this.abort.signal,canvas=this.arena.renderer.domElement;
    canvas.addEventListener('contextmenu',e=>e.preventDefault(),{signal});
    bindToolInput(canvas,document,{
      playing:()=>this.snapshot.playing,
      locked:()=>document.pointerLockElement===canvas,
      down:()=>this.actionDown(),up:()=>this.actionUp(),look:(x,y)=>this.look(x,y),
    },signal);
    document.addEventListener('pointerlockchange',()=>{
      if(this.disposed)return;
      const wasLocked=this.snapshot.pointerLocked;
      this.snapshot.pointerLocked=document.pointerLockElement===canvas;
      if(wasLocked&&!this.snapshot.pointerLocked&&!this.unlockToCursor)this.pause(false);
      this.unlockToCursor=false;this.publish();
    },{signal});
    document.addEventListener('pointerlockerror',()=>{
      this.snapshot.pointerLocked=false;this.publish();
    },{signal});
    document.addEventListener('keydown',e=>{
      if(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)return;
      if(this.snapshot.playing && ['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
      if(e.code==='Escape'){this.pause();return;}
      if(!this.snapshot.playing)return;
      this.keys.add(e.code);
      if(e.repeat)return;
      if(/^Digit[1-6]$/.test(e.code))this.selectTool(Number(e.code.at(-1))-1);
      if(e.code==='KeyE')this.grab();
      if(e.code==='KeyR')this.reset();
      if(e.code==='KeyL')void this.toggleMouseLook();
      if(e.code==='KeyQ')this.physics?.release();
    },{signal});
    document.addEventListener('keyup',e=>this.keys.delete(e.code),{signal});
    canvas.addEventListener('wheel',e=>{
      if(!this.snapshot.playing)return;e.preventDefault();this.selectTool((this.snapshot.tool+(e.deltaY>0?1:5))%6);
    },{signal,passive:false});
    window.addEventListener('blur',()=>this.pause(),{signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();},{signal});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.pause();this.snapshot.error='The graphics connection was interrupted. Reload to reinflate the arena.';this.publish();},{signal});
  }
  private async capture(){
    try {await this.arena.renderer.domElement.requestPointerLock();}
    catch {this.snapshot.pointerLocked=false;this.publish();}
  }
  async toggleMouseLook() {
    if(!this.snapshot.playing)return;
    if(document.pointerLockElement===this.arena.renderer.domElement){this.unlockToCursor=true;document.exitPointerLock();}
    else await this.capture();
  }
  async previewPop(){await this.audio.preview();}
  async start(touch=false) {
    if(!this.physics||!this.snapshot.ready)return;
    this.touch=touch;
    void this.audio.start().catch(()=>{this.snapshot.hint='Sound is unavailable in this browser.';});
    if(!this.snapshot.started){this.startedAt=this.time;this.yaw=0;this.pitch=-.08;}
    const position=this.physics.player.translation();
    this.arena.camera.position.set(position.x,position.y+.76,position.z);
    this.arena.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');this.arena.camera.updateMatrixWorld();
    this.snapshot.started=true;this.snapshot.playing=true;this.snapshot.hint='';this.keys.clear();this.down=false;this.publish();
    // Cursor mode keeps the action button and tool belt reachable immediately.
    // Mouse lock is an optional control, never a requirement for using a tool.
  }
  pause(exit=true) {
    this.snapshot.playing=false;this.down=false;this.keys.clear();this.touchMove={x:0,y:0};this.clearPressure();
    this.snapshot.charge=0;
    if(exit&&document.pointerLockElement===this.arena.renderer.domElement)document.exitPointerLock();
    this.publish();
  }
  look(dx:number,dy:number){this.yaw-=dx*.0022*this.settings.sensitivity;this.pitch=THREE.MathUtils.clamp(this.pitch-dy*.0022*this.settings.sensitivity,-1.48,1.48);}
  setTouchMove(x:number,y:number){this.touchMove={x,y};}
  jump(){if(this.snapshot.playing&&this.physics?.grounded)this.physics.verticalVelocity=5.7;}
  setSettings(partial:Partial<GameSettings>) {
    this.settings={...this.settings,...partial};this.audio.volume=this.settings.volume;this.audio.muted=this.settings.muted;this.audio.update();
    const r=this.arena.renderer;r.setPixelRatio(Math.min(window.devicePixelRatio,this.settings.quality==='high'?2:1.25));
    r.shadowMap.enabled=true;this.arena.scene.traverse(o=>{if(o instanceof THREE.DirectionalLight&&o.castShadow){const size=this.settings.quality==='high'?2048:1024;if(o.shadow.mapSize.x!==size){o.shadow.mapSize.set(size,size);o.shadow.map?.dispose();o.shadow.map=null;}}});this.resize();
  }
  selectTool(tool:number) {
    if(tool===this.snapshot.tool)return;
    this.down=false;this.clearPressure();this.snapshot.charge=0;
    this.snapshot.tool=tool;this.nextAction=0;this.toolScene.remove(this.toolModel);disposeTool(this.toolModel);this.toolModel=makeTool(tool);this.toolScene.add(this.toolModel);this.recoil=.2;this.publish();
  }
  actionDown() {
    if(!this.snapshot.playing||this.down)return;
    void this.audio.start().catch(()=>{});
    this.findAim();
    this.down=true;this.pressedAt=this.time;
    if(this.physics?.held) return;
    if(this.snapshot.tool===0)this.poke();
    if([1,2,4,5].includes(this.snapshot.tool))this.useTool();
  }
  tapTool(){this.actionDown();this.actionUp();}
  actionUp() {
    if(!this.down)return;
    if(this.snapshot.playing&&(this.snapshot.tool===3||this.physics?.held))this.throwItem();
    this.down=false;this.snapshot.charge=0;this.clearPressure();
  }
  private availableCell(hit:Hit):number|null {
    const local=hit.surface.group.worldToLocal(hit.point.clone());
    const s=hit.surface;
    let nearest:number|null=null,distance=.42*.42;
    const col=hit.index%s.cols,row=Math.floor(hit.index/s.cols);
    for(let z=Math.max(0,row-2);z<=Math.min(s.rows-1,row+2);z++)for(let x=Math.max(0,col-2);x<=Math.min(s.cols-1,col+2);x++){
      const index=z*s.cols+x,c=s.cells[index];if(c.state||c.scheduled)continue;
      const d=(c.x-local.x)**2+(c.z-local.z)**2;
      if(d<distance){distance=d;nearest=index;}
    }
    return nearest;
  }
  private poke() {
    const hit=this.aimed;
    if(!hit||hit.distance>=3||this.time<this.nextAction)return;
    const index=this.availableCell(hit);if(index===null)return;
    this.clearPressure();this.pop(hit.surface,index,1.1);this.recoil=.16;this.nextAction=this.time+.085;
  }
  private clearPressure() {
    const p=this.pressedBubble;if(p){p.surface.cells[p.index].pressure=0;p.surface.updateCell(p.index,this.time);p.surface.flush();}this.pressedBubble=null;
  }
  grab() {
    if(!this.physics)return;
    if(this.physics.held){this.physics.release();this.publish();return;}
    if(this.pickup&&this.pickup.kind!=='shot'){this.physics.grab(this.pickup);this.clearPressure();this.publish();}
  }
  reset() {
    if(!this.physics)return;
    for(const item of this.physics.items)if(item.kind!=='parcel')disposeTool(item.group);
    this.physics.reset();this.arena.surfaces.forEach(s=>s.reset());
    this.activePops.clear();this.queued=[];this.particles=[];this.lastPop=-10;
    this.rays.forEach(r=>{r.mesh.removeFromParent();r.mesh.geometry.dispose();(r.mesh.material as THREE.Material).dispose();});this.rays=[];
    this.snapshot.pops=0;this.snapshot.combo=0;this.snapshot.best=0;this.snapshot.charge=0;this.snapshot.held='';this.down=false;this.clearPressure();
    this.yaw=0;this.pitch=-.08;this.snapshot.hint='Fresh wrap. That never gets old.';this.publish();
  }
  private direction(){return new THREE.Vector3(0,0,-1).applyQuaternion(this.arena.camera.quaternion);}
  private throwItem() {
    const p=this.physics;if(!p)return;
    const charge=Math.min(1,(this.time-this.pressedAt)/1.05);
    const dir=this.direction();const velocity=dir.clone().multiplyScalar(9+charge*15);velocity.y+=1.3;
    if(p.held)p.release(velocity);
    else {const g=makeTool(3,true);this.arena.scene.add(g);const pos=this.arena.camera.position.clone().addScaledVector(dir,.8).add(new THREE.Vector3(0,-.18,0));p.spawn(g,'ball',pos,velocity,this.time);}
    this.recoil=.5;this.swing=.4;this.audio.thump(.25);this.trimProjectiles();
  }
  private useTool() {
    if(this.time<this.nextAction||!this.physics)return;
    const tool=this.snapshot.tool,dir=this.direction(),origin=this.arena.camera.position.clone();
    if(tool===1||tool===2) {
      this.nextAction=this.time+(tool===1?.5:.4);this.swing=1;
      const hit=this.aimed;
      if(hit&&hit.distance<(tool===1?3.7:4.1)) {
        this.burst(hit.point,tool===1?1.05:1.45,tool===1?2:1.5,.065);
        this.physics.blast(hit.point,tool===1?1.45:1.9,tool===1?4:6);
        this.audio.thump(tool===1?1.5:.8);this.shake=tool===1?.1:.06;
      } else if(this.pickup&&this.pickup.group.position.distanceTo(origin)<4.5) {
        this.pickup.body.applyImpulse(dir.clone().multiplyScalar((tool===1?9:15)*this.pickup.body.mass()),true);this.audio.thump(1);
      }
    } else if(tool===4) {
      this.nextAction=this.time+.105;this.recoil=.32;
      const pos=origin.addScaledVector(dir,.6);
      const g=new THREE.Group();const pellet=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),new THREE.MeshBasicMaterial({color:0xd9ff65}));g.add(pellet);this.arena.scene.add(g);
      this.physics.spawn(g,'shot',pos,dir.multiplyScalar(42),this.time);this.audio.pop(.35,0,1);this.trimProjectiles();
    } else if(tool===5) {
      this.nextAction=this.time+.8;this.swing=.75;
      const g=makeTool(5,true);this.arena.scene.add(g);
      const pos=origin.addScaledVector(dir,.8);const velocity=dir.multiplyScalar(13);velocity.y+=2.5;
      this.physics.spawn(g,'bomb',pos,velocity,this.time);this.audio.thump(.35);this.trimProjectiles();
    }
  }
  private trimProjectiles(){
    if(!this.physics)return;
    const projectiles=this.physics.items.filter(i=>i.kind!=='parcel');
    while(projectiles.length>45){const item=projectiles.shift()!;if(item===this.physics.held)continue;this.removeItem(item);}
  }
  private removeItem(item:PhysicsItem){this.physics?.remove(item);disposeTool(item.group);if(item.kind==='shot')item.group.traverse(o=>{if(o instanceof THREE.Mesh)(o.material as THREE.Material).dispose();});}
  private impact(item:PhysicsItem,point:THREE.Vector3,speed:number) {
    if(item.kind==='bomb')return;
    const radius=item.kind==='shot'?.48:THREE.MathUtils.clamp(.25+speed*.065+(item.kind==='ball'?.28:.16),.4,1.75);
    this.burst(point,radius,Math.min(2,speed*.14),.04);
    this.audio.thump(Math.min(1.1,speed*.07));
    if(item.kind==='shot')item.born=-100;
  }
  private burst(point:THREE.Vector3,radius:number,strength:number,spread=0) {
    const local=new THREE.Vector3();
    for(const s of this.arena.surfaces) {
      local.copy(point);s.group.worldToLocal(local);
      if(Math.abs(local.y)>radius+.2 || Math.abs(local.x)>s.width/2+radius || Math.abs(local.z)>s.depth/2+radius)continue;
      const minX=Math.max(0,Math.floor((local.x-radius+s.width/2)/s.width*s.cols));
      const maxX=Math.min(s.cols-1,Math.floor((local.x+radius+s.width/2)/s.width*s.cols));
      const minZ=Math.max(0,Math.floor((local.z-radius+s.depth/2)/s.depth*s.rows));
      const maxZ=Math.min(s.rows-1,Math.floor((local.z+radius+s.depth/2)/s.depth*s.rows));
      for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++) {
        const index=z*s.cols+x,c=s.cells[index];if(c.state||c.scheduled)continue;
        const distance=Math.hypot(c.x-local.x,local.y,c.z-local.z);
        if(distance>radius)continue;
        if(spread){c.scheduled=true;this.queued.push({surface:s,index,at:this.time+distance*spread+Math.random()*.025,strength});}
        else this.pop(s,index,strength);
      }
    }
  }
  private pop(surface:WrapSurface,index:number,strength=1) {
    if(!surface.pop(index,this.time))return;
    if(!this.activePops.has(surface))this.activePops.set(surface,new Set());this.activePops.get(surface)!.add(index);
    this.snapshot.pops++;
    this.snapshot.combo=this.time-this.lastPop<1.2?this.snapshot.combo+1:1;
    this.snapshot.best=Math.max(this.snapshot.best,this.snapshot.combo);this.lastPop=this.time;
    const point=surface.worldPosition(index);
    const relative=point.clone().sub(this.arena.camera.position);
    const right=new THREE.Vector3(1,0,0).applyQuaternion(this.arena.camera.quaternion);
    this.audio.pop(strength,relative.clone().normalize().dot(right),relative.length());
    const normal=new THREE.Vector3(0,1,0).transformDirection(surface.group.matrixWorld);
    const count=strength>1?3:2;
    for(let i=0;i<count&&this.particles.length<1500;i++)this.particles.push({p:point.clone(),v:normal.clone().multiplyScalar(.7+Math.random()*1.5).add(new THREE.Vector3((Math.random()-.5)*2,Math.random(),(Math.random()-.5)*2)),life:.28+Math.random()*.2,max:.5});
  }
  private explode(item:PhysicsItem) {
    const point=item.group.position.clone();
    this.removeItem(item);this.burst(point,5.8,2.7,.085);this.physics?.blast(point,7.4,11);this.audio.thump(2.8,true);
    this.shake=.32;
    const ring=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),new THREE.MeshBasicMaterial({color:0xe6ffb4,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide}));
    ring.position.copy(point);this.arena.scene.add(ring);this.rays.push({mesh:ring,life:.42,max:.42});
  }
  private findAim() {
    const origin=this.arena.camera.position,dir=this.direction();
    const ray=new THREE.Ray(origin,dir),localRay=new THREE.Ray(),inverse=new THREE.Matrix4(),point=new THREE.Vector3();
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.075);
    let hit:Hit|null=null;
    for(const s of this.arena.surfaces) {
      inverse.copy(s.group.matrixWorld).invert();localRay.copy(ray).applyMatrix4(inverse);
      if(localRay.direction.y>=-.0001)continue;
      if(!localRay.intersectPlane(plane,point))continue;
      if(Math.abs(point.x)>s.width/2 || Math.abs(point.z)>s.depth/2)continue;
      const world=s.group.localToWorld(point.clone()),distance=world.distanceTo(origin);
      if(distance>45 || (hit&&distance>=hit.distance))continue;
      const col=Math.min(s.cols-1,Math.max(0,Math.floor((point.x+s.width/2)/s.width*s.cols)));
      const row=Math.min(s.rows-1,Math.max(0,Math.floor((point.z+s.depth/2)/s.depth*s.rows)));
      hit={surface:s,index:row*s.cols+col,point:world,distance};
    }
    this.aimed=hit;this.pickup=null;
    let near=3.5;
    for(const item of this.physics?.items??[]) {
      if(item===this.physics?.held||item.kind==='shot')continue;
      if(ray.intersectSphere(new THREE.Sphere(item.group.position,item.radius),point)) {
        const d=point.distanceTo(origin);if(d<near&&(!hit||d<hit.distance+.55)){near=d;this.pickup=item;}
      }
    }
    const range=this.snapshot.tool===0?3:this.snapshot.tool===1?3.7:this.snapshot.tool===2?4.1:45;
    const available=hit&&(this.snapshot.tool===0?this.availableCell(hit)!==null:hit.surface.cells[hit.index].state===0);
    this.snapshot.target=Boolean(hit&&hit.distance<range&&available)||Boolean(this.pickup);
    this.snapshot.held=this.physics?.held?.name??'';
    if(this.physics?.held)this.snapshot.hint='Hold & release to throw · E to drop';
    else if(this.pickup)this.snapshot.hint=`E · Pick up ${this.pickup.name.toLowerCase()}`;
    else if(hit&&hit.distance<range){this.snapshot.hint=!available?'Aim at some fresh bubbles':this.snapshot.tool===0?'Click POP or press F · Hold for a crackle':TOOL_INFO[this.snapshot.tool].verb;}
    else this.snapshot.hint=this.snapshot.tool<=2?'Move closer to the bubbles':TOOL_INFO[this.snapshot.tool].verb;
  }
  private updateInteraction() {
    if(!this.physics)return;
    this.findAim();
    const tool=this.snapshot.tool;
    if(this.down&&(tool===3||this.physics.held)){this.snapshot.charge=Math.min(1,(this.time-this.pressedAt)/1.05);return;}
    if(this.down&&[1,2,4].includes(tool))this.useTool();
    if(this.down&&tool===0)this.poke();
  }

  private updateEffects(dt:number) {
    let remaining=0;
    for(const pop of this.queued){if(pop.at<=this.time)this.pop(pop.surface,pop.index,pop.strength);else this.queued[remaining++]=pop;}
    this.queued.length=remaining;
    for(const [s,indices] of this.activePops){for(const i of indices){s.updateCell(i,this.time);if(s.cells[i].state===2)indices.delete(i);}if(!indices.size)this.activePops.delete(s);}
    for(const s of this.arena.surfaces)s.flush();
    let count=0;
    for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;if(p.life<=0){this.particles.splice(i,1);continue;}p.v.y-=2*dt;p.p.addScaledVector(p.v,dt);this.particleArray[count*3]=p.p.x;this.particleArray[count*3+1]=p.p.y;this.particleArray[count*3+2]=p.p.z;count++;}
    this.particleGeometry.setDrawRange(0,count);this.particleGeometry.attributes.position.needsUpdate=true;
    for(let i=this.rays.length-1;i>=0;i--){const r=this.rays[i];r.life-=dt;if(r.life<=0){r.mesh.removeFromParent();r.mesh.geometry.dispose();(r.mesh.material as THREE.Material).dispose();this.rays.splice(i,1);continue;}r.mesh.scale.setScalar((1-r.life/r.max)*6);(r.mesh.material as THREE.MeshBasicMaterial).opacity=r.life/r.max*.18;}
    this.shake=Math.max(0,this.shake-dt*.65);this.swing=Math.max(0,this.swing-dt*3.6);this.recoil=Math.max(0,this.recoil-dt*3);
  }
  private animate=(stamp:number)=>{
    if(this.disposed)return;
    const dt=Math.min((stamp-this.lastFrame)/1000||1/60,.05);this.lastFrame=stamp;this.frame++;
    this.fpsElapsed+=dt;this.fpsSamples++;if(this.fpsElapsed>.75){this.snapshot.fps=Math.round(this.fpsSamples/this.fpsElapsed);this.fpsElapsed=0;this.fpsSamples=0;}
    const {camera,scene,renderer}=this.arena;
    if(this.snapshot.playing&&this.physics) {
      this.time+=dt;
      const forward=(this.keys.has('KeyW')?1:0)-(this.keys.has('KeyS')?1:0)-this.touchMove.y;
      const side=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0)+this.touchMove.x;
      const norm=Math.max(1,Math.hypot(forward,side)),speed=(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight'))?7:4.3;
      const targetX=(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*side)/norm*speed;
      const targetZ=(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*side)/norm*speed;
      this.movementX=THREE.MathUtils.damp(this.movementX,targetX,14,dt);this.movementZ=THREE.MathUtils.damp(this.movementZ,targetZ,14,dt);
      this.yaw+=((this.keys.has('ArrowLeft')?1:0)-(this.keys.has('ArrowRight')?1:0))*dt*1.8;this.pitch=THREE.MathUtils.clamp(this.pitch+((this.keys.has('ArrowUp')?1:0)-(this.keys.has('ArrowDown')?1:0))*dt*1.2,-1.48,1.48);
      camera.rotation.set(this.pitch,this.yaw,0,'YXZ');
      this.accumulator=Math.min(this.accumulator+dt,.1);
      while(this.accumulator>=1/60) {
        if(this.physics.held)this.physics.holdAt(camera.position.clone().addScaledVector(this.direction(),2));
        this.physics.move(this.movementX,this.movementZ,this.keys.has('Space'),1/60);
        this.physics.step();this.accumulator-=1/60;
      }
      const p=this.physics.player.translation();camera.position.set(p.x,p.y+.76,p.z);
      if(this.settings.shake){const s=this.shake;camera.position.x+=(Math.random()-.5)*s;camera.position.y+=(Math.random()-.5)*s*.6;}
      camera.updateMatrixWorld();scene.updateMatrixWorld(true);
      if(this.settings.footsteps&&this.physics.grounded&&Math.hypot(this.movementX,this.movementZ)>1&&this.time-this.lastFootstep>(speed>5?.2:.34)) {
        this.burst(new THREE.Vector3(p.x,p.y-.81,p.z),speed>5?.5:.31,.7);this.lastFootstep=this.time;
      }
      this.updateInteraction();
      // Snapshot: removing an expired projectile mutates the live array.
      for(const item of this.physics.items.slice()) {
        if(item.kind==='bomb'&&this.time>=item.fuse)this.explode(item);
        else if((item.kind==='shot'&&this.time-item.born>4)||(item.kind!=='parcel'&&(item.group.position.y<-5||this.time-item.born>75)))this.removeItem(item);
      }
      this.updateEffects(dt);
      if(this.time-this.lastPop>1.2)this.snapshot.combo=0;
    } else if(!this.snapshot.started) {
      camera.position.set(10.8,7.7,12.3);camera.lookAt(-2,2.1,-5);
    }
    renderer.autoClear=true;renderer.render(scene,camera);
    if(this.snapshot.playing&&!this.physics?.held) {
      const t=this.snapshot.tool,melee=t===1||t===2;
      const sw=Math.sin(this.swing*Math.PI);
      const bob=this.settings.shake?Math.sin(this.time*9)*Math.min(.018,Math.hypot(this.movementX,this.movementZ)*.005):0;
      this.toolModel.position.set(t===0?.34:t===4?.34:.43,-.31+bob-(this.snapshot.charge*.08),-0.73+this.recoil*.13);
      this.toolModel.rotation.set((melee?-.3:-.08)-sw*(melee?1.6:.5),-.18,melee?-.34-sw*.6:-.18);
      this.toolModel.scale.setScalar(t===2?.76:1);
      if(t===0){this.toolModel.position.y=-.32;this.toolModel.position.z=-.62-this.recoil*.35;}
      renderer.autoClear=false;renderer.clearDepth();renderer.render(this.toolScene,this.toolCamera);renderer.autoClear=true;
    }
    if(stamp-this.lastPublish>95){this.lastPublish=stamp;this.publish();}
  };
  private publish(){if(!this.disposed)this.uiCallback({...this.snapshot});}
  private resize(){const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.arena.renderer.setSize(w,h);this.arena.camera.aspect=w/h;this.arena.camera.updateProjectionMatrix();this.toolCamera.aspect=w/h;this.toolCamera.updateProjectionMatrix();}
  dispose() {
    this.disposed=true;this.abort.abort();this.resizeObserver.disconnect();this.arena.renderer.setAnimationLoop(null);
    if(document.pointerLockElement===this.arena.renderer.domElement)document.exitPointerLock();
    this.physics?.items.filter(i=>i.kind!=='parcel').forEach(i=>disposeTool(i.group));this.physics?.dispose();
    this.audio.dispose();disposeTool(this.toolModel);this.particleGeometry.dispose();this.particleMaterial.dispose();
    this.rays.forEach(r=>{r.mesh.geometry.dispose();(r.mesh.material as THREE.Material).dispose();});this.arena.dispose();
  }
}
