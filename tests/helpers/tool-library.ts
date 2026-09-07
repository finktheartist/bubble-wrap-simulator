import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ToolLibrary } from '../../lib/game/tools';

/** Parse the actual exported meshes in Node. Only GPU image decoding is stubbed. */
export function loadTestToolLibrary() {
  const loader=new GLTFLoader();
  loader.register(()=>({name:'TEST_image_decode',loadTexture:async()=>new THREE.Texture()}));
  return ToolLibrary.load(async url=>{
    const bytes=await readFile(new URL(`../../public${url}`,import.meta.url));
    const data=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    return (await loader.parseAsync(data,'')).scene;
  });
}
