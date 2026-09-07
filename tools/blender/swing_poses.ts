import { writeFile, mkdir } from 'node:fs/promises';
import * as THREE from 'three';
import { heldToolPose, MELEE } from '../../lib/game/melee';
const poses=[];
for(const [layout,width,height] of [['desktop',960,540],['phone',360,780]] as const)for(const tool of [1,2] as const){
  for(const [stage,age] of [['rest',0],['windup',MELEE[tool].contact*.55],['contact',MELEE[tool].contact],['follow',MELEE[tool].contact+.1]] as const){
    const pose=heldToolPose(tool,width/height,{attack:{tool,age}}),matrix=new THREE.Matrix4().compose(new THREE.Vector3(...pose.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose.rotation)),new THREE.Vector3().setScalar(pose.scale));
    matrix.multiply(new THREE.Matrix4().makeTranslation(0,pose.gripY,0));
    matrix.multiply(new THREE.Matrix4().makeRotationY(pose.modelYaw));
    poses.push({layout,width,height,tool:tool===1?'mallet':'bat',stage,matrix:matrix.toArray()});
  }
}
await mkdir(new URL('../../outputs/toolkit/',import.meta.url),{recursive:true});
await writeFile(new URL('../../outputs/toolkit/swing-poses.json',import.meta.url),JSON.stringify(poses));
