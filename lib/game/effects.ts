import * as THREE from 'three';
type Fragment={p:THREE.Vector3;v:THREE.Vector3;life:number;max:number;spin:number;color:THREE.Color;size:number};
type Ring={mesh:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>;life:number;max:number;radius:number};
type Beam={mesh:THREE.Mesh<THREE.CylinderGeometry,THREE.MeshBasicMaterial>;life:number;max:number};
const UP=new THREE.Vector3(0,1,0),FRONT=new THREE.Vector3(0,0,1);
/** Bounded shared geometry: air ripples, colored film flecks, and short shot streaks. */
export class WorldEffects {
  readonly capacity:number;
  private fragments:Fragment[]=[];private mesh:THREE.InstancedMesh;
  private rings:Ring[]=[];private beams:Beam[]=[];private dummy=new THREE.Object3D();
  constructor(private scene:THREE.Scene,mobile=false){
    this.capacity=mobile?180:320;
    this.mesh=new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1),new THREE.MeshBasicMaterial({toneMapped:false}),this.capacity);this.mesh.count=0;this.mesh.frustumCulled=false;scene.add(this.mesh);
    const ringGeo=new THREE.RingGeometry(.92,1,56),beamGeo=new THREE.CylinderGeometry(.007,.013,1,5);
    for(let i=0;i<12;i++){
      const ring=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));ring.visible=false;scene.add(ring);this.rings.push({mesh:ring,life:0,max:1,radius:1});
      const beam=new THREE.Mesh(beamGeo,new THREE.MeshBasicMaterial({color:0xe6ffc4,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));beam.visible=false;scene.add(beam);this.beams.push({mesh:beam,life:0,max:1});
    }
  }
  burst(point:THREE.Vector3,normal:THREE.Vector3,strength=1,color=0xe0ffc6,reward=false){
    this.ripple(point,normal,Math.min(2.4,.55+strength*.35),color,.34);
    const count=Math.min(reward?64:34,Math.round(strength*14));
    for(let i=0;i<count&&this.fragments.length<this.capacity;i++){
      const life=.3+Math.random()*.35;
      this.fragments.push({p:point.clone(),v:normal.clone().multiplyScalar(.7+Math.random()*2).add(new THREE.Vector3((Math.random()-.5)*4,Math.random()*2,(Math.random()-.5)*4)).multiplyScalar(Math.min(2,strength)),life,max:life,spin:Math.random()*6,size:(reward?.035:.023)*(1+Math.random()),color:new THREE.Color(reward?[color,0xfaffde,0xf1bedb][i%3]:color)});
    }
  }
  ripple(point:THREE.Vector3,normal:THREE.Vector3,radius:number,color:number,life:number){
    const ring=this.rings.find(r=>r.life<=0)??this.rings.reduce((a,b)=>a.life<b.life?a:b);
    ring.life=ring.max=life;ring.radius=radius;ring.mesh.visible=true;ring.mesh.position.copy(point).addScaledVector(normal,.025);ring.mesh.quaternion.setFromUnitVectors(FRONT,normal);ring.mesh.material.color.setHex(color);ring.mesh.scale.setScalar(.03);
  }
  streak(from:THREE.Vector3,to:THREE.Vector3){
    const beam=this.beams.find(b=>b.life<=0)??this.beams[0],dir=to.clone().sub(from);beam.life=beam.max=.075;beam.mesh.visible=true;
    beam.mesh.position.copy(from).add(to).multiplyScalar(.5);beam.mesh.quaternion.setFromUnitVectors(UP,dir.clone().normalize());beam.mesh.scale.set(1,dir.length(),1);
  }
  update(dt:number){
    let n=0;
    for(const p of this.fragments){p.life-=dt;if(p.life<=0)continue;p.v.y-=3.8*dt;p.v.multiplyScalar(Math.exp(-1.7*dt));p.p.addScaledVector(p.v,dt);p.spin+=dt*8;
      this.dummy.position.copy(p.p);this.dummy.rotation.set(p.spin,p.spin*.7,0);this.dummy.scale.setScalar(p.size*Math.min(1,p.life/.18));this.dummy.updateMatrix();this.mesh.setMatrixAt(n,this.dummy.matrix);this.mesh.setColorAt(n,p.color);this.fragments[n++]=p;}
    this.fragments.length=n;this.mesh.count=n;this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;
    for(const r of this.rings){r.life=Math.max(0,r.life-dt);r.mesh.visible=r.life>0;if(r.life){const p=1-r.life/r.max;r.mesh.scale.setScalar((.06+1-Math.pow(1-p,2))*r.radius);r.mesh.material.opacity=(1-p)*.62;}}
    for(const b of this.beams){b.life=Math.max(0,b.life-dt);b.mesh.visible=b.life>0;b.mesh.material.opacity=b.life/b.max*.8;}
  }
  reset(){this.fragments=[];this.mesh.count=0;for(const item of [...this.rings,...this.beams]){item.life=0;item.mesh.visible=false;}}
  dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();(this.mesh.material as THREE.Material).dispose();this.mesh.dispose();this.rings[0].mesh.geometry.dispose();this.beams[0].mesh.geometry.dispose();for(const item of [...this.rings,...this.beams]){item.mesh.removeFromParent();item.mesh.material.dispose();}}
}

/** A short ribbon follows the actual moving tool tip; the flash sits at the modeled muzzle. */
export class ToolEffects {
  private samples:{a:THREE.Vector3;b:THREE.Vector3;life:number}[]=[];
  private positions=new Float32Array(12*18);private colors=new Float32Array(12*24);
  private ribbon:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  private flash=new THREE.Group();private flashLife=0;
  constructor(scene:THREE.Scene){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('color',new THREE.BufferAttribute(this.colors,4).setUsage(THREE.DynamicDrawUsage));geo.setDrawRange(0,0);
    this.ribbon=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false}));this.ribbon.frustumCulled=false;scene.add(this.ribbon);
    const mat=new THREE.MeshBasicMaterial({color:0xeaffbf,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
    const core=new THREE.Mesh(new THREE.ConeGeometry(.032,.14,7),mat);core.rotation.x=-Math.PI/2;core.position.z=-.055;this.flash.add(core);
    const glow=new THREE.Mesh(new THREE.SphereGeometry(.042,12,8),mat.clone());glow.scale.set(1,1,.45);this.flash.add(glow);this.flash.visible=false;scene.add(this.flash);
  }
  fire(){this.flashLife=.065;}
  update(dt:number,model:THREE.Group,tool:number,trail:boolean){
    for(const s of this.samples)s.life-=dt;this.samples=this.samples.filter(s=>s.life>0);
    if(trail){const tip=tool===1?.31:.49;this.samples.unshift({a:model.localToWorld(new THREE.Vector3(0,tip,0)),b:model.localToWorld(new THREE.Vector3(0,tip-.13,0)),life:.15});this.samples.length=Math.min(this.samples.length,13);}
    let v=0;
    for(let i=0;i<this.samples.length-1;i++){
      const a=this.samples[i],b=this.samples[i+1];for(const [point,life] of [[a.a,a.life],[a.b,a.life],[b.a,b.life],[b.a,b.life],[a.b,a.life],[b.b,b.life]] as [THREE.Vector3,number][]){
        point.toArray(this.positions,v*3);this.colors.set([.78,1,.9,life/.15*.27],v*4);v++;
      }
    }
    this.ribbon.geometry.setDrawRange(0,v);this.ribbon.geometry.attributes.position.needsUpdate=true;this.ribbon.geometry.attributes.color.needsUpdate=true;
    this.flashLife=Math.max(0,this.flashLife-dt);this.flash.visible=tool===4&&this.flashLife>0;
    if(this.flash.visible){model.localToWorld(this.flash.position.set(0,.062,-.405));model.getWorldQuaternion(this.flash.quaternion);this.flash.scale.setScalar(.6+this.flashLife/.065);}
  }
  reset(){this.samples=[];this.ribbon.geometry.setDrawRange(0,0);this.flashLife=0;this.flash.visible=false;}
  dispose(){this.ribbon.removeFromParent();this.ribbon.geometry.dispose();this.ribbon.material.dispose();this.flash.removeFromParent();this.flash.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();o.material.dispose();}});}
}
