import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PALETTE = { pearl: 0xd5e5e8, blue: 0x77cbdc, pink: 0xeeb8bf, yellow: 0xe3db91, mint: 0x95c7af };
const up = new THREE.Vector3(0, 1, 0);
const dummy = new THREE.Object3D();
const dome = new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
const rim = new THREE.TorusGeometry(0.99, 0.035, 3, 8);
rim.rotateX(-Math.PI / 2);
export const bubbleGeometry = mergeGeometries([dome, rim]);
dome.dispose(); rim.dispose();

export type BubbleCell = { x: number; z: number; radius: number; state: number; poppedAt: number; pressure: number; scheduled: boolean };
export class WrapSurface {
  group = new THREE.Group();
  mesh: THREE.InstancedMesh;
  cells: BubbleCell[] = [];
  cols: number;
  rows: number;
  dirty = true;
  material: THREE.MeshPhysicalMaterial;
  constructor(public width: number, public depth: number, public color: number, public spacing = 0.26) {
    this.cols = Math.max(1, Math.floor(width / spacing));
    this.rows = Math.max(1, Math.floor(depth / spacing));
    this.material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.23, metalness: 0.14,
      clearcoat: 1, clearcoatRoughness: 0.075, envMapIntensity: 1.35,
      iridescence: 0.25, iridescenceIOR: 1.3, iridescenceThicknessRange: [180, 330],
      transparent: true, opacity: 0.91, depthWrite: true,
    });
    this.mesh = new THREE.InstancedMesh(bubbleGeometry, this.material, this.cols * this.rows);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.userData.surface = this;
    const base = new THREE.Color(color);
    for (let z = 0; z < this.rows; z++) for (let x = 0; x < this.cols; x++) {
      const i = this.cells.length;
      const radius = Math.min(width / this.cols, depth / this.rows) * 0.445;
      this.cells.push({ x: (x + .5) * width / this.cols - width / 2, z: (z + .5) * depth / this.rows - depth / 2, radius, state: 0, poppedAt: -1, pressure: 0, scheduled: false });
      this.mesh.setColorAt(i, base.clone().multiplyScalar(.95 + Math.random() * .1));
      this.updateCell(i, 0);
    }
    this.mesh.computeBoundingSphere();
    this.group.add(this.mesh);
  }
  updateCell(i: number, now: number) {
    const c = this.cells[i];
    let height = .6 * (1 - c.pressure * .62);
    if (c.state === 1) {
      const age = Math.max(0, now - c.poppedAt);
      height = age < .12 ? .6 * Math.pow(1 - age / .12, 3) + .045 : .045;
      if (age >= .12) c.state = 2;
    } else if (c.state === 2) height = .045;
    dummy.position.set(c.x, .017, c.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(c.radius * (c.state ? 1.025 : 1), c.radius * height, c.radius * (c.state ? 1.025 : 1));
    dummy.updateMatrix(); this.mesh.setMatrixAt(i, dummy.matrix);
    this.dirty = true;
  }
  reset() {
    const base = new THREE.Color(this.color);
    this.cells.forEach((c, i) => { c.state = 0; c.poppedAt = -1; c.pressure = 0; c.scheduled = false; this.mesh.setColorAt(i, base); this.updateCell(i, 0); });
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.flush();
  }
  pop(i: number, now: number) {
    const c = this.cells[i];
    if (!c || c.state) return false;
    c.state = 1; c.scheduled = false; c.poppedAt = now; c.pressure = 0;
    this.mesh.setColorAt(i, new THREE.Color(this.color).multiplyScalar(.73));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.updateCell(i, now);
    return true;
  }
  worldPosition(i: number, target = new THREE.Vector3()) {
    const c = this.cells[i];
    return this.group.localToWorld(target.set(c.x, .09, c.z));
  }
  flush() { if (this.dirty) { this.mesh.instanceMatrix.needsUpdate = true; this.dirty = false; } }
  dispose() { this.material.dispose(); this.mesh.dispose(); }
}

export type WrappedObject = { group: THREE.Group; size: THREE.Vector3; surfaces: WrapSurface[]; dynamic: boolean; name: string; color: number };
export type Arena = { scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; surfaces: WrapSurface[]; objects: WrappedObject[]; environment: THREE.WebGLRenderTarget; dispose: () => void };

export function createArena(container: HTMLElement): Arena {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe1eaed);
  scene.fog = new THREE.Fog(0xe1eaed, 22, 64);
  const camera = new THREE.PerspectiveCamera(66, container.clientWidth / container.clientHeight, .06, 100);
  camera.position.set(10.8, 7.7, 13.2);
  camera.lookAt(-2, 2.1, -5);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.17;
  container.appendChild(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const environment = pmrem.fromScene(roomEnv, .025);
  scene.environment = environment.texture;
  roomEnv.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe6f9ff, 0x83918d, 2.6));
  const sun = new THREE.DirectionalLight(0xfff7eb, 3.4);
  sun.position.set(-6, 14, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left:-19, right:19, top:24, bottom:-24, near:.1, far:48 });
  sun.shadow.normalBias = .04; sun.shadow.bias = -.00015;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xb1ecff, 1.7); fill.position.set(11, 6, -13); scene.add(fill);
  const surfaces: WrapSurface[] = [];
  const objects: WrappedObject[] = [];
  const ownedGeometries = new Set<THREE.BufferGeometry>();
  const ownedMaterials = new Set<THREE.Material>();
  function box(name: string, size: [number, number, number], position: [number, number, number], color: number, dynamic = false, faces = ['top','front','back','left','right']) {
    const group = new THREE.Group(); group.position.set(...position);
    const geometry = new RoundedBoxGeometry(...size, 2, .09);
    const material = new THREE.MeshStandardMaterial({ color, roughness:.58, metalness:.025 });
    ownedGeometries.add(geometry); ownedMaterials.add(material);
    const core = new THREE.Mesh(geometry, material); core.castShadow = true; core.receiveShadow = true;
    group.add(core); scene.add(group);
    const obj: WrappedObject = { group, size:new THREE.Vector3(...size), surfaces:[], dynamic, name, color };
    const [w,h,d] = size;
    const configs: Record<string, { w:number; d:number; p:[number,number,number]; n:[number,number,number] }> = {
      top: { w,d,p:[0,h/2,0],n:[0,1,0] },
      bottom: { w,d,p:[0,-h/2,0],n:[0,-1,0] },
      front: { w,d:h,p:[0,0,d/2],n:[0,0,1] },
      back: { w,d:h,p:[0,0,-d/2],n:[0,0,-1] },
      left: { w:h,d:d,p:[-w/2,0,0],n:[-1,0,0] },
      right: { w:h,d:d,p:[w/2,0,0],n:[1,0,0] },
    };
    for (const f of faces) {
      const c = configs[f];
      const wrap = new WrapSurface(c.w-.045, c.d-.045, color, dynamic ? .22 : .26);
      wrap.group.position.set(...c.p);
      wrap.group.quaternion.setFromUnitVectors(up, new THREE.Vector3(...c.n));
      wrap.group.userData.wrappedObject = obj;
      group.add(wrap.group); obj.surfaces.push(wrap); surfaces.push(wrap);
    }
    core.userData.wrappedObject = obj;
    objects.push(obj); return obj;
  }
  box('Floor', [26,.35,30], [0,-.175,-2], PALETTE.pearl, false, ['top']);
  box('Back wall', [26,9,.4], [0,4.5,-17.2], PALETTE.pearl, false, ['front']);
  box('Left wall', [.4,9,30], [-13.2,4.5,-2], PALETTE.pearl, false, ['right']);
  box('Right wall', [.4,9,30], [13.2,4.5,-2], PALETTE.pearl, false, ['left']);
  box('Front wall', [26,9,.4], [0,4.5,13.2], PALETTE.pearl, false, ['back']);
  box('Ceiling', [26,.3,30], [0,9.2,-2], PALETTE.pearl, false, ['bottom']);
  // The central arch is physically traversable and entirely wrapped.
  box('Arch left', [2,5.5,2.4], [2,2.75,-8.8], PALETTE.blue);
  box('Arch right', [2,5.5,2.4], [8,2.75,-8.8], PALETTE.blue);
  box('Arch crown', [8,1.7,2.4], [5,6.35,-8.8], PALETTE.blue, false, ['top','bottom','front','back','left','right']);
  box('Low step', [3.8,.65,2], [-6,.325,-2], PALETTE.pink);
  box('Middle step', [3.8,1.3,2], [-6,.65,-4], PALETTE.pink);
  box('High step', [3.8,2.1,2.2], [-6,1.05,-6.1], PALETTE.pink);
  box('First pop', [2.4,1.8,.7], [0,.9,6.7], PALETTE.pearl);
  box('Pop plinth', [2.3,1.25,2.3], [3,.625,2], PALETTE.mint);
  box('Long bench', [5,1.1,1.8], [-6,.55,5], PALETTE.yellow);
  box('Back platform', [5.6,.8,3.2], [-6.5,.4,-13.8], PALETTE.mint);
  box('Left tower', [2,3.6,2], [-10.4,1.8,-9.8], PALETTE.pearl);
  box('Right tower', [2,2.6,2], [10.4,1.3,-2.4], PALETTE.yellow);
  // Smaller objects are dynamic: pick them up, throw them, topple the stacks.
  const allFaces = ['top','bottom','front','back','left','right'];
  for (let layer=0; layer<3; layer++) for (let i=0; i<3-layer; i++) {
    box('Wrapped cube', [1.15,1.15,1.15], [-7.9+i*1.2+layer*.6,1.42+layer*1.17,-13.7], [PALETTE.pink,PALETTE.blue,PALETTE.yellow][layer], true, allFaces);
  }
  box('Wrapped parcel', [1.2,.85,.85], [-2.2,.6,6.2], PALETTE.pink, true, allFaces);
  box('Wrapped cube', [.85,.85,.85], [2.8,1.9,2], PALETTE.blue, true, allFaces);
  box('Wrapped parcel', [1.5,.75,.85], [5,.6,-2.8], PALETTE.yellow, true, allFaces);
  // Real light fixtures and thin seam rails give scale without cluttering the room.
  const lightMaterial = new THREE.MeshBasicMaterial({ color:0xf5ffff });
  ownedMaterials.add(lightMaterial);
  for (const x of [-8,0,8]) {
    const g = new THREE.BoxGeometry(.3,.06,21); ownedGeometries.add(g);
    const strip = new THREE.Mesh(g,lightMaterial); strip.position.set(x,8.97,-2); scene.add(strip);
  }
  const railMaterial = new THREE.MeshStandardMaterial({ color:0x8fa4aa,roughness:.5,metalness:.4 }); ownedMaterials.add(railMaterial);
  for (const x of [-12.94,12.94]) {
    const g=new THREE.BoxGeometry(.035,.05,29.8); ownedGeometries.add(g);
    const rail=new THREE.Mesh(g,railMaterial); rail.position.set(x,.12,-2); scene.add(rail);
  }
  scene.updateMatrixWorld(true);
  return { scene,camera,renderer,surfaces,objects,environment,dispose:()=>{
    surfaces.forEach(s=>s.dispose()); ownedGeometries.forEach(g=>g.dispose()); ownedMaterials.forEach(m=>m.dispose());
    environment.dispose(); renderer.dispose(); renderer.domElement.remove();
  }};
}
