import * as THREE from 'three';

// A shallow thermoformed pocket with a broad, flat heat weld. The outer lip is
// part of the same film, rather than a separate torus that reads as a metal rim.
export function createBubbleGeometry() {
  const geometry = new THREE.LatheGeometry([
    new THREE.Vector2(1.055, 0),
    new THREE.Vector2(.975, .025),
    new THREE.Vector2(.92, .17),
    new THREE.Vector2(.83, .63),
    new THREE.Vector2(.60, .92),
    new THREE.Vector2(.30, 1),
    new THREE.Vector2(0, 1.015),
  ], 16);
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const angle = Math.atan2(z, x);
    const irregularity = 1 + .012 * Math.sin(angle * 3) + .006 * Math.cos(angle * 5);
    position.setXYZ(i, x * irregularity, y * (1 + .015 * Math.sin(angle * 4)), z * irregularity);
    uv.setXY(i, x / 2.11 + .5, z / 2.11 + .5);
  }
  geometry.computeVertexNormals();

  // The collapsed pocket keeps its weld and folds inward. Target normals must
  // follow the folds too, or the empty plastic still shades as an inflated dome.
  const collapsed = geometry.clone();
  const folded = collapsed.getAttribute('position');
  for (let i = 0; i < folded.count; i++) {
    const x = position.getX(i), z = position.getZ(i);
    const radius = Math.hypot(x, z);
    const envelope = THREE.MathUtils.smoothstep(radius, 0, .32) * (1 - THREE.MathUtils.smoothstep(radius, .80, 1.02));
    const fold = Math.pow(Math.abs(Math.sin(x * 10 + z * 6 + .7)), 5);
    const crossFold = Math.pow(Math.abs(Math.sin(z * 13 - x * 4)), 7);
    folded.setXYZ(i, x, .018 + envelope * (.10 + fold * .65 + crossFold * .32), z);
  }
  collapsed.computeVertexNormals();
  geometry.setAttribute('creasePosition', folded.clone());
  geometry.setAttribute('creaseNormal', collapsed.getAttribute('normal').clone());
  collapsed.dispose();
  geometry.computeBoundingSphere();
  return geometry;
}

// Small, deterministic material maps: no downloads, image assets, or canvas.
// Gradients provide subtle stretched-film normals; mipmaps suppress distant sparkle.
function filmHeight(x: number, y: number) {
  return .30 * Math.sin(x * Math.PI * 8 + .8 * Math.sin(y * Math.PI * 6))
    + .18 * Math.sin((x * 11 + y * 7) * Math.PI * 2)
    + .06 * Math.sin((x * 29 - y * 23) * Math.PI * 2);
}

export function createFilmMaps() {
  const size = 128, normalData = new Uint8Array(size * size * 4), backingData = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, index = (y * size + x) * 4;
    const dx = (filmHeight(u + 1 / size, v) - filmHeight(u - 1 / size, v)) * .8;
    const dy = (filmHeight(u, v + 1 / size) - filmHeight(u, v - 1 / size)) * .8;
    const normal = new THREE.Vector3(-dx, -dy, 1).normalize();
    normalData.set([Math.round((normal.x * .5 + .5) * 255), Math.round((normal.y * .5 + .5) * 255), Math.round((normal.z * .5 + .5) * 255), 255], index);
    const radius = Math.hypot((u - .5) * 2, (v - .5) * 2);
    const contact = Math.exp(-(((radius - .85) / .075) ** 2));
    const weld = Math.exp(-(((radius - .94) / .027) ** 2));
    const grain = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    const value = Math.round(255 * THREE.MathUtils.clamp(.97 - contact * .17 + weld * .025 + (grain - Math.floor(grain) - .5) * .018, 0, 1));
    backingData.set([value, value, value, 255], index);
  }
  const normal = new THREE.DataTexture(normalData, size, size, THREE.RGBAFormat);
  const backing = new THREE.DataTexture(backingData, size, size, THREE.RGBAFormat);
  backing.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [normal, backing]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
  }
  return { normal, backing };
}

export function createPlasticMaterial(normal: THREE.Texture) {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: .16,
    transmission: .96, thickness: .012, ior: 1.47,
    clearcoat: .28, clearcoatRoughness: .13,
    envMapIntensity: 1.15,
    normalMap: normal, normalScale: new THREE.Vector2(.22, .22),
    opacity: 1, transparent: false, depthWrite: true,
  });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float collapse;
        attribute vec3 creasePosition;
        attribute vec3 creaseNormal;
        varying float vCollapse;
        varying vec2 vFilmUv;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        objectNormal = normalize(mix(objectNormal, creaseNormal, collapse));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed = mix(transformed, creasePosition, collapse);
        vCollapse = collapse;
        vFilmUv = uv;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vCollapse;
        varying vec2 vFilmUv;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float weld = smoothstep(.42, .50, length(vFilmUv - .5));
        roughnessFactor = clamp(roughnessFactor + weld * .17 + vCollapse * .055, .08, .55);`)
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace(
        'mapN.xy *= normalScale;', 'mapN.xy *= normalScale * (1.0 + vCollapse * 4.0);'));
  };
  material.customProgramCacheKey = () => 'bubble-film-v1';
  return material;
}

/** One reusable studio reflection environment, built from actual light panels. */
export function createPackingEnvironment() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x454a50);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(32, 18, 40), new THREE.MeshBasicMaterial({ color: 0x8b9196, side: THREE.BackSide }));
  shell.position.y = 5;
  scene.add(shell);
  const panels: THREE.Mesh[] = [shell];
  const panel = (w: number, h: number, color: number, intensity: number, position: [number, number, number], target: [number, number, number]) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    mesh.position.set(...position); mesh.lookAt(...target); scene.add(mesh); panels.push(mesh);
  };
  panel(5, 7, 0xfff7e9, 5.5, [-10, 7, 5], [0, 2, -3]);
  panel(3, 9, 0xe8f4ff, 2.8, [11, 5, -8], [0, 2, -3]);
  for (const x of [-8, 0, 8]) panel(.7, 20, 0xffffff, 4, [x, 8.8, -2], [x, 0, -2]);
  panel(6, 10, 0x12161a, 1, [0, 3, 12], [0, 3, 0]);
  return { scene, dispose: () => panels.forEach(mesh => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }) };
}
