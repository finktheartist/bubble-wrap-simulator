import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeTool, disposeTool } from '../lib/game/tools';

await test('all six physical tool models have valid finite geometry and useful portrait bounds',()=>{
  for(let tool=0;tool<6;tool++){
    const model=makeTool(tool,true),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
    assert.ok(size.x>.05&&size.y>.1&&size.z>.05);assert.ok(size.length()<1.6);
    model.traverse(object=>{if(object instanceof THREE.Mesh){
      const p=object.geometry.getAttribute('position'),n=object.geometry.getAttribute('normal');
      assert.ok([...p.array,...n.array].every(Number.isFinite));assert.ok(object.castShadow);
    }});
    disposeTool(model);
  }
});
await test('bowling ball finger wells sit inside its collision sphere with dark recessed interiors',()=>{
  const ball=makeTool(3),mesh=ball.children[0] as THREE.Mesh;
  const p=mesh.geometry.getAttribute('position'),colors=mesh.geometry.getAttribute('color');
  let recessed=0;const v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){
    const radius=v.fromBufferAttribute(p,i).length();assert.ok(radius<=.280001);
    if(radius<.16){recessed++;assert.ok(colors.getX(i)<.15);}
  }
  assert.ok(recessed>20,'holes must be recessed geometry rather than raised black shapes');disposeTool(ball);
});
