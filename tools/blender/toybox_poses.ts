import { writeFile, mkdir } from 'node:fs/promises';
import * as THREE from 'three';
import { heldToolPose } from '../../lib/game/melee';
import { TOOL_INFO } from '../../lib/game/tool-info';
const poses=[];
for(const [layout,width,height] of [['desktop',960,540],['phone',360,780],['landscape',844,390]] as const)for(const tool of [6,7,8]){
  for(const [stage,recoil] of [['rest',0],['firing',1]] as const){
    const pose=heldToolPose(tool,width/height,{recoil}),matrix=new THREE.Matrix4().compose(new THREE.Vector3(...pose.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose.rotation)),new THREE.Vector3().setScalar(pose.scale));
    poses.push({layout,width,height,tool:TOOL_INFO[tool].file,stage,matrix:matrix.toArray()});
  }
}
await mkdir(new URL('../../outputs/toolkit/',import.meta.url),{recursive:true});
await writeFile(new URL('../../outputs/toolkit/toybox-poses.json',import.meta.url),JSON.stringify(poses));
