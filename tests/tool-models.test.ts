import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { ToolLibrary, disposeTool, TOOL_FILES } from '../lib/game/tools';
import { loadTestToolLibrary } from './helpers/tool-library';

const tools=await loadTestToolLibrary();
await test('all six exported Blender tools have finite geometry, UVs, useful bounds and a bounded triangle count',()=>{
  for(let tool=0;tool<6;tool++){
    const model=tools.create(tool,true),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
    assert.ok(size.x>.025&&size.y>.1&&size.z>.025);assert.ok(size.length()<1.6);
    let triangles=0;
    model.traverse(object=>{if(object instanceof THREE.Mesh){
      const p=object.geometry.getAttribute('position'),n=object.geometry.getAttribute('normal'),uv=object.geometry.getAttribute('uv');
      assert.ok([...p.array,...n.array,...uv.array].every(Number.isFinite));assert.ok(object.castShadow);
      triangles+=(object.geometry.index?.count??p.count)/3;
    }});
    assert.ok(triangles>1000&&triangles<45000,`tool ${tool}: ${triangles} triangles`);disposeTool(model);
  }
});
await test('bowling ball has three cylindrical finger wells inside the existing collision sphere',()=>{
  const ball=tools.create(3);ball.updateMatrixWorld(true);
  const n=[new THREE.Vector3(-.19,.32,.93),new THREE.Vector3(.19,.32,.93),new THREE.Vector3(0,-.115,.994)].map(v=>v.normalize());
  for(const direction of n){
    const ray=new THREE.Raycaster(direction.clone().multiplyScalar(.5),direction.clone().negate());
    const hits=ray.intersectObject(ball,true);
    assert.ok(hits.length>0);assert.ok(hits[0].distance>.27,'ray enters a real hole before hitting its bottom');
  }
  const ray=new THREE.Raycaster(new THREE.Vector3(.5,0,0),new THREE.Vector3(-1,0,0));
  assert.ok(Math.abs(ray.intersectObject(ball,true)[0].distance-.22)<.002,'outer shell matches 0.28m collider');
});
await test('disposing a thrown instance preserves geometry and materials used by other instances',()=>{
  const one=tools.create(3),two=tools.create(3);
  const a:THREE.Mesh[]=[],b:THREE.Mesh[]=[];
  one.traverse(o=>{if(o instanceof THREE.Mesh)a.push(o);});two.traverse(o=>{if(o instanceof THREE.Mesh)b.push(o);});
  let disposed=0;a[0].geometry.addEventListener('dispose',()=>{disposed++;});
  assert.equal(a[0].geometry,b[0].geometry);assert.equal(a[0].material,b[0].material);
  disposeTool(one);assert.equal(disposed,0);
  one.position.x=5;assert.equal(two.position.x,0,'instance transforms remain independent');
});
await test('all asset textures are embedded, and a failed load releases successful partial loads',async()=>{
  for(const name of TOOL_FILES){
    const bytes=await readFile(new URL(`../public/models/${name}.glb`,import.meta.url));
    assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);
    const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length).toString());
    assert.ok(json.images.length>=2,'baked color and normal maps travel with the model');
    assert.ok(json.images.every((image:{bufferView?:number;uri?:string})=>typeof image.bufferView==='number'&&!image.uri));
  }
  let disposed=0;
  await assert.rejects(ToolLibrary.load(async url=>{
    if(url.includes('bat.glb'))throw new Error('Offline');
    const group=new THREE.Group(),geo=new THREE.BoxGeometry();geo.addEventListener('dispose',()=>{disposed++;});
    group.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial()));return group;
  }),/tool models could not load/);
  assert.equal(disposed,5);
});
tools.dispose();
