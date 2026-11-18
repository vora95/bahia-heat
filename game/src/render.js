// Renderer + chase camera. Sunset chase-cam from behind the car / over the shoulder on foot.
import * as THREE from './three-shim.js';
import { lerp } from './config.js';

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return { renderer, camera };
}

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 8, -14);
    this.look = new THREE.Vector3(0, 1, 0);
    this.mode = 0; // 0 near, 1 far, 2 high
  }
  cycle() { this.mode = (this.mode + 1) % 3; }
  update(dt, x, z, heading, speed, inCar) {
    const dist = inCar ? [9.5, 13, 17][this.mode] : [6.5, 9, 12][this.mode];
    const height = inCar ? [3.6, 5, 8][this.mode] : [3.2, 4.5, 7][this.mode];
    const backX = x - Math.sin(heading) * dist;
    const backZ = z - Math.cos(heading) * dist;
    const k = 1 - Math.pow(0.0015, dt); // smooth follow
    this.pos.x = lerp(this.pos.x, backX, k);
    this.pos.y = lerp(this.pos.y, height, k);
    this.pos.z = lerp(this.pos.z, backZ, k);
    const lookX = x + Math.sin(heading) * (6 + Math.abs(speed) * 0.12);
    const lookZ = z + Math.cos(heading) * (6 + Math.abs(speed) * 0.12);
    this.look.x = lerp(this.look.x, lookX, 1 - Math.pow(0.0005, dt));
    this.look.y = lerp(this.look.y, inCar ? 1.6 : 1.4, 1 - Math.pow(0.0005, dt));
    this.look.z = lerp(this.look.z, lookZ, 1 - Math.pow(0.0005, dt));
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
  snap(x, z, heading, inCar) {
    const dist = inCar ? 9.5 : 6.5;
    const height = inCar ? 3.6 : 3.2;
    this.pos.set(x - Math.sin(heading) * dist, height, z - Math.cos(heading) * dist);
    this.look.set(x + Math.sin(heading) * 6, 1.6, z + Math.cos(heading) * 6);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
