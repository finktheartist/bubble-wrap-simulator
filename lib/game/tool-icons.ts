import * as THREE from 'three';
import { makeTool, disposeTool, TOOL_INFO } from './tools';

/** Menu portraits use the same geometry and materials as the tools in your hand. */
export function renderToolIcons(renderer: THREE.WebGLRenderer, environment: THREE.Texture): string[] {
  const size = 144;
  const target = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.environment = environment;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7b9498, 3));
  const light = new THREE.DirectionalLight(0xfff7eb, 3);
  light.position.set(-3, 4, 5); scene.add(light);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 12);
  const previousTarget = renderer.getRenderTarget();
  const previousColor = renderer.getClearColor(new THREE.Color());
  const previousAlpha = renderer.getClearAlpha();
  const previousAutoClear = renderer.autoClear;
  const pixels = new Uint8Array(size * size * 4);
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) { target.dispose(); return []; }
  const image = context.createImageData(size, size);
  const icons: string[] = [];
  try {
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(target);
    for (let i = 0; i < TOOL_INFO.length; i++) {
      const model = makeTool(i);
      // Show the ball's finger holes, the blaster's profile, and each tool's grip.
      model.rotation.set(.06, i === 4 ? 1.15 : -.16, i === 1 || i === 2 ? -.42 : -.12);
      scene.add(model); model.updateMatrixWorld(true);
      try {
        const bounds = new THREE.Box3().setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        const dimensions = bounds.getSize(new THREE.Vector3());
        const half = Math.max(dimensions.x, dimensions.y) * .64;
        camera.left = -half; camera.right = half; camera.top = half; camera.bottom = -half;
        camera.position.copy(center).add(new THREE.Vector3(0, .04, 4));
        camera.lookAt(center); camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
        for (let y = 0; y < size; y++) {
          const start = (size - y - 1) * size * 4;
          image.data.set(pixels.subarray(start, start + size * 4), y * size * 4);
        }
        context.putImageData(image, 0, 0);
        icons.push(canvas.toDataURL('image/png'));
      } finally { scene.remove(model); disposeTool(model); }
    }
  } finally {
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(previousColor, previousAlpha);
    renderer.autoClear = previousAutoClear;
    target.dispose();
  }
  return icons;
}
