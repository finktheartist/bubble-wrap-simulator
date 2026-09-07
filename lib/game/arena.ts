import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { createBubbleGeometry, createFilmMaps, createPackingEnvironment, createPlasticMaterial } from './plastic';

export const PALETTE = { pearl: 0xd8dddb, blue: 0x92b6bf, pink: 0xcdaeb0, yellow: 0xcec5a0, mint: 0xa8bcae };
const up = new THREE.Vector3(0, 1, 0);
const dummy = new THREE.Object3D();
export const bubbleGeometry = createBubbleGeometry();
const mobileBubbleGeometry = createBubbleGeometry(10);
let sharedMaps: ReturnType<typeof createFilmMaps> | undefined;
let mapUsers = 0;

export type BubbleCell = { x: number; z: number; radius: number; state: number; poppedAt: number; pressure: number; scheduled: boolean; variation: number };
export class WrapSurface {
  group = new THREE.Group();
  mesh: THREE.InstancedMesh;
  cells: BubbleCell[] = [];
  cols: number;
  rows: number;
  dirty = true;
  material: THREE.MeshPhysicalMaterial;
  private collapse: THREE.InstancedBufferAttribute;
  private sheet: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial>;
  private sheetNormal: THREE.Texture;
  private sheetBacking: THREE.Texture;
  private disposed = false;
  constructor(public width: number, public depth: number, public color: number, public spacing = 0.26, mobile = false) {
    this.cols = Math.max(1, Math.floor(width / spacing));
    this.rows = Math.max(1, Math.floor(depth / spacing));
    const maps = sharedMaps ??= createFilmMaps(); mapUsers++;
    this.material = createPlasticMaterial(maps.normal);
    const geometry = (mobile ? mobileBubbleGeometry : bubbleGeometry).clone();
    this.collapse = new THREE.InstancedBufferAttribute(new Float32Array(this.cols * this.rows), 1).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('collapse', this.collapse);
    this.mesh = new THREE.InstancedMesh(geometry, this.material, this.cols * this.rows);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.userData.surface = this;
    for (let z = 0; z < this.rows; z++) for (let x = 0; x < this.cols; x++) {
      const i = this.cells.length;
      const seed = Math.sin((i + 1) * 127.1 + width * 311.7 + depth * 74.7) * 43758.5453;
      const variation = seed - Math.floor(seed);
      const radius = Math.min(width / this.cols, depth / this.rows) * .445;
      this.cells.push({ x: (x + .5) * width / this.cols - width / 2, z: (z + .5) * depth / this.rows - depth / 2, radius, state: 0, poppedAt: -1, pressure: 0, scheduled: false, variation });
      this.updateCell(i, 0);
    }
    this.mesh.computeBoundingSphere();
    // A continuous backing film joins the cells and carries fine contact shadows
    // around their welds. Color belongs to the backing; the air pocket is clear.
    this.sheetNormal = maps.normal.clone(); this.sheetNormal.repeat.set(this.cols / 3, this.rows / 3);
    this.sheetBacking = maps.backing.clone(); this.sheetBacking.repeat.set(this.cols, this.rows);
    this.sheet = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), .06),
      map: this.sheetBacking, normalMap: this.sheetNormal, normalScale: new THREE.Vector2(.16, .16),
      metalness: 0, roughness: .46, clearcoat: .5, clearcoatRoughness: .28, envMapIntensity: .55,
    }));
    this.sheet.rotation.x = -Math.PI / 2; this.sheet.position.y = .013;
    this.sheet.receiveShadow = true;
    this.group.add(this.sheet, this.mesh);
    this.flush();
  }
  updateCell(i: number, now: number) {
    const c = this.cells[i];
    let collapse = c.state === 2 ? 1 : 0;
    if (c.state === 1) {
      const age = Math.max(0, now - c.poppedAt);
      collapse = 1 - Math.pow(Math.max(0, 1 - age / .12), 3);
      if (age >= .12) c.state = 2;
    }
    const inflated = .60 * (1 - c.pressure * .62) * (.97 + c.variation * .06);
    const height = THREE.MathUtils.lerp(inflated, .045, collapse);
    dummy.position.set(c.x, .017, c.z);
    dummy.rotation.set(0, c.variation * Math.PI * 2, 0);
    dummy.scale.set(c.radius * (.99 + c.variation * .02), c.radius * height, c.radius * (1.01 - c.variation * .02));
    dummy.updateMatrix(); this.mesh.setMatrixAt(i, dummy.matrix);
    this.collapse.setX(i, collapse);
    this.dirty = true;
  }
  reset() {
    this.cells.forEach((c, i) => { c.state = 0; c.poppedAt = -1; c.pressure = 0; c.scheduled = false; this.updateCell(i, 0); });
    this.flush();
  }
  pop(i: number, now: number) {
    const c = this.cells[i];
    if (!c || c.state) return false;
    c.state = 1; c.scheduled = false; c.poppedAt = now; c.pressure = 0;
    this.updateCell(i, now);
    return true;
  }
  worldPosition(i: number, target = new THREE.Vector3()) {
    const c = this.cells[i];
    return this.group.localToWorld(target.set(c.x, .09, c.z));
  }
  flush() { if (this.dirty) { this.mesh.instanceMatrix.needsUpdate = true; this.collapse.needsUpdate = true; this.dirty = false; } }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.material.dispose(); this.mesh.geometry.dispose(); this.mesh.dispose();
    this.sheet.geometry.dispose(); this.sheet.material.dispose(); this.sheetNormal.dispose(); this.sheetBacking.dispose();
    if (--mapUsers === 0) { sharedMaps?.normal.dispose(); sharedMaps?.backing.dispose(); sharedMaps = undefined; }
  }
}

export type WrappedObject = { group: THREE.Group; size: THREE.Vector3; surfaces: WrapSurface[]; dynamic: boolean; name: string; color: number };
export type Arena = { scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; surfaces: WrapSurface[]; objects: WrappedObject[]; environment: THREE.WebGLRenderTarget; dispose: () => void };

export function createArena(container: HTMLElement, touch = false): Arena {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcbd2d5);
  scene.fog = new THREE.Fog(0xcbd2d5, 30, 78);
  const camera = new THREE.PerspectiveCamera(66, container.clientWidth / container.clientHeight, .06, 100);
  camera.position.set(10.8, 7.7, 13.2);
  camera.lookAt(-2, 2.1, -5);
  const renderer = new THREE.WebGLRenderer({ antialias: !touch, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, touch ? 1 : 1.5));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.transmissionResolutionScale = touch ? .45 : .75;
  container.appendChild(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = createPackingEnvironment();
  const environment = pmrem.fromScene(roomEnv.scene, .018);
  scene.environment = environment.texture;
  roomEnv.dispose(); pmrem.dispose();
  scene.environmentIntensity = .65;
  scene.add(new THREE.HemisphereLight(0xe9f0f5, 0x6e7473, .85));
  const sun = new THREE.DirectionalLight(0xfff5e4, 2.5);
  sun.position.set(-10, 8.5, 8); sun.target.position.set(1, 0, -7); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left:-19, right:19, top:24, bottom:-24, near:.1, far:48 });
  sun.shadow.normalBias = .012; sun.shadow.bias = -.00008; sun.shadow.radius = 2;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xdcecff, .65); fill.position.set(11, 6, -13); scene.add(fill);
  RectAreaLightUniformsLib.init();
  for (const x of [-8, 0, 8]) {
    const light = new THREE.RectAreaLight(0xfffcf5, 2.2, .65, 20);
    light.position.set(x, 8.9, -2); light.lookAt(x, 0, -2); scene.add(light);
  }
  const surfaces: WrapSurface[] = [];
  const objects: WrappedObject[] = [];
  const ownedGeometries = new Set<THREE.BufferGeometry>();
  const ownedMaterials = new Set<THREE.Material>();
  function box(name: string, size: [number, number, number], position: [number, number, number], color: number, dynamic = false, faces = ['top','front','back','left','right']) {
    const group = new THREE.Group(); group.position.set(...position);
    const geometry = new RoundedBoxGeometry(...size, 2, .09);
    const material = new THREE.MeshStandardMaterial({ color, roughness:.72, metalness:0 });
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
      const wrap = new WrapSurface(c.w-.045, c.d-.045, color, dynamic ? .22 : .26, touch);
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
  const lightMaterial = new THREE.MeshBasicMaterial({ color:new THREE.Color(0xfffcf5).multiplyScalar(3), toneMapped:false });
  ownedMaterials.add(lightMaterial);
  for (const x of [-8,0,8]) {
    const g = new THREE.BoxGeometry(.65,.06,20); ownedGeometries.add(g);
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
