import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const TOOL_INFO = [
  {name:'Fingertip',verb:'Click POP or press F',detail:'One bubble at a time. Take it slow.',key:'1'},
  {name:'Mallet',verb:'Click to smash',detail:'A reassuringly excessive rubber mallet.',key:'2'},
  {name:'Bat',verb:'Click to whack',detail:'A wide swing. A very good crackle.',key:'3'},
  {name:'Bowling ball',verb:'Hold & release to throw',detail:'Seven kilos of excellent decisions.',key:'4'},
  {name:'Pop blaster',verb:'Hold to shoot',detail:'Little pellets. Rapid-fire satisfaction.',key:'5'},
  {name:'Pop bomb',verb:'Click to throw',detail:'A short fuse. A room-shaking ripple.',key:'6'},
] as const;
export const TOOL_FILES = ['fingertip','mallet','bat','bowling-ball','pop-blaster','pop-bomb'] as const;
type LoadModel = (url:string) => Promise<THREE.Group>;

/** Each game owns one copy of the Blender assets; held tools, portraits and projectiles share it. */
export class ToolLibrary {
  private disposed=false;
  constructor(private readonly models:THREE.Group[]) {}

  static async load(loadModel?:LoadModel):Promise<ToolLibrary> {
    const loader=new GLTFLoader();
    const load=loadModel??(async(url:string)=>(await loader.loadAsync(url)).scene);
    const results=await Promise.allSettled(TOOL_FILES.map(file=>load(`/models/${file}.glb`)));
    const models=results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
    const library=new ToolLibrary(models);
    if(results.some(result=>result.status==='rejected')){
      library.dispose();
      throw new Error('The tool models could not load. Reload the arena to try again.');
    }
    return library;
  }

  create(tool:number,world=false):THREE.Group {
    if(this.disposed)throw new Error('Tool library has been disposed');
    const template=this.models[tool];if(!template)throw new RangeError(`Unknown tool: ${tool}`);
    const group=template.clone(true);group.name=TOOL_INFO[tool].name;
    group.userData.sharedToolAsset=true;
    group.traverse(object=>{
      if(object instanceof THREE.Mesh){
        object.castShadow=world;object.receiveShadow=world;
        const materials=Array.isArray(object.material)?object.material:[object.material];
        for(const material of materials)if(material instanceof THREE.MeshStandardMaterial){
          material.envMapIntensity=.8;
          if(material.normalMap)material.normalMap.anisotropy=2;
          if(material.map)material.map.anisotropy=4;
        }
      }
    });
    return group;
  }

  dispose() {
    if(this.disposed)return;this.disposed=true;
    const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    for(const model of this.models)model.traverse(object=>{
      if(object instanceof THREE.Mesh){
        geometry.add(object.geometry);
        for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);
      }
    });
    for(const material of materials)for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);
    geometry.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());
    const images=new Set<unknown>();
    textures.forEach(value=>{images.add(value.image);value.dispose();});
    for(const image of images)if(image&&typeof image==='object'&&'close' in image&&typeof image.close==='function')image.close();
    this.models.length=0;
  }
}

/** Removing an instance must never dispose resources still used by another ball or the tool belt. */
export function disposeTool(group:THREE.Group) {
  if(group.userData.sharedToolAsset)return;
  group.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});
}
