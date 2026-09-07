import * as THREE from 'three';
import { heldToolPose } from './melee';
import { TOOL_MUZZLES } from './tool-info';

/** Match the separately rendered tool camera's opening to a point in the arena camera. */
export function toolMuzzlePosition(tool:number,camera:THREE.PerspectiveCamera,recoil=0):THREE.Vector3 {
  const pose=heldToolPose(tool,camera.aspect,{recoil});
  const point=new THREE.Vector3(...TOOL_MUZZLES[tool]).multiplyScalar(pose.scale).applyEuler(new THREE.Euler(...pose.rotation)).add(new THREE.Vector3(...pose.position));
  const fovRatio=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.tan(Math.PI/6);
  point.x*=fovRatio;point.y*=fovRatio;return camera.localToWorld(point);
}

/** Small flight model, with -Z pointing forward. Instances own their simple resources. */
export function createRocket():THREE.Group {
  const rocket=new THREE.Group();rocket.name='Pop rocket';
  const enamel=new THREE.MeshStandardMaterial({color:0xd9772e,metalness:.35,roughness:.36});
  const steel=new THREE.MeshStandardMaterial({color:0x4e5a60,metalness:.8,roughness:.3});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.058,.06,.32,16),enamel);body.rotation.x=-Math.PI/2;rocket.add(body);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.058,.15,16),steel);nose.rotation.x=-Math.PI/2;nose.position.z=-.235;rocket.add(nose);
  const collar=new THREE.Mesh(new THREE.TorusGeometry(.062,.007,6,20),steel);collar.position.z=.13;rocket.add(collar);
  const finGeo=new THREE.BoxGeometry(.006,.085,.105);
  for(let i=0;i<4;i++){const fin=new THREE.Mesh(finGeo,steel),a=i*Math.PI/2;fin.position.set(Math.sin(a)*.066,Math.cos(a)*.066,.12);fin.rotation.z=-a;rocket.add(fin);}
  const ember=new THREE.Mesh(new THREE.SphereGeometry(.031,10,6),new THREE.MeshBasicMaterial({color:0xffdb7c,toneMapped:false}));ember.position.z=.18;ember.scale.z=1.6;rocket.add(ember);
  rocket.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=true;});return rocket;
}
