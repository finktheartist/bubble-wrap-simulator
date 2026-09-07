import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WrapSurface, type Arena, type WrappedObject, type TargetMotion } from './arena';

export function targetPosition(motion:TargetMotion,time:number,out=new THREE.Vector3()) {
  return out.copy(motion.center).add(new THREE.Vector3(Math.sin(time*motion.speed+motion.phase)*motion.amplitude,Math.sin(time*motion.speed*1.4+motion.phase)*.22,Math.sin(time*motion.speed*.65)*.25));
}
type Target={object:WrappedObject;rim:THREE.MeshStandardMaterial;pops:number;respawnAt:number;color:number};
/** Three physical, reusable targets. Their wrap participates in the arena's normal pop pipeline. */
export class MovingTargets {
  readonly targets:Target[]=[];
  private bySurface=new Map<WrapSurface,Target>();
  private geometries=new Set<THREE.BufferGeometry>();private materials=new Set<THREE.Material>();
  constructor(arena:Pick<Arena,'scene'|'objects'|'surfaces'>,mobile=false) {
    const configs:[number,number,number,number,number,number,number][]=[
      [3.25,1.95,6.6,1.0,.65,-1.3,0x93e7e1],
      [-3.8,2.8,.8,2.3,.58,.7,0xf5b3c7],
      [6,3.15,-4.8,2.15,.82,1.4,0xe2ed90],
    ];
    configs.forEach(([x,y,z,amplitude,speed,phase,color],i)=>{
      const group=new THREE.Group();group.name=`Moving pop target ${i+1}`;
      const motion={center:new THREE.Vector3(x,y,z),amplitude,speed,phase};group.position.copy(targetPosition(motion,0));
      const rim=new THREE.MeshStandardMaterial({color:0x24414a,metalness:.65,roughness:.3,emissive:color,emissiveIntensity:.2});
      const coreGeometry=new RoundedBoxGeometry(1.42,1.42,.2,2,.09),core=new THREE.Mesh(coreGeometry,rim);core.castShadow=true;core.receiveShadow=true;group.add(core);
      this.geometries.add(coreGeometry);this.materials.add(rim);
      const faceSurfaces:WrapSurface[]=[];
      for(const sign of [1,-1]){
        const wrap=new WrapSurface(1.18,1.18,color,.23,mobile);
        wrap.group.position.z=sign*.112;wrap.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,sign));
        group.add(wrap.group);faceSurfaces.push(wrap);arena.surfaces.push(wrap);
        const railGeometry=new THREE.RingGeometry(.645,.664,64);
        const railMaterial=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,toneMapped:false,side:THREE.DoubleSide});
        const rail=new THREE.Mesh(railGeometry,railMaterial);rail.position.z=sign*.128;group.add(rail);
        this.geometries.add(railGeometry);this.materials.add(railMaterial);
        // A physical bullseye collar sits outside the poppable sheet, leaving every bubble exposed.
        for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
          const geo=new THREE.BoxGeometry(.09,.018,.006),mat=new THREE.MeshBasicMaterial({color:0xf6ffec});
          const mark=new THREE.Mesh(geo,mat);mark.position.set(Math.cos(a)*.65,Math.sin(a)*.65,sign*.135);mark.rotation.z=a;group.add(mark);this.geometries.add(geo);this.materials.add(mat);
        }
      }
      const object:WrappedObject={group,size:new THREE.Vector3(1.42,1.42,.2),surfaces:faceSurfaces,dynamic:false,name:group.name,color,motion};
      const target:Target={object,rim,pops:0,respawnAt:0,color};this.targets.push(target);faceSurfaces.forEach(s=>this.bySurface.set(s,target));
      arena.scene.add(group);arena.objects.push(object);
    });
    arena.scene.updateMatrixWorld(true);
  }
  notePop(surface:WrapSurface,now:number) {
    const t=this.bySurface.get(surface);if(!t||t.respawnAt)return null;
    if(++t.pops<12)return null;
    t.respawnAt=now+3.2;
    return {point:t.object.group.position.clone(),color:t.color};
  }
  update(now:number) {
    for(const t of this.targets){
      if(t.respawnAt&&now>=t.respawnAt){t.object.surfaces.forEach(s=>s.reset());t.pops=0;t.respawnAt=0;}
      t.rim.emissiveIntensity=t.respawnAt?.5+Math.sin(now*12)*.35:.15+Math.sin(now*2)*.06;
    }
  }
  reset(){for(const t of this.targets){t.pops=0;t.respawnAt=0;t.rim.emissiveIntensity=.2;}}
  dispose(){this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());}
}
