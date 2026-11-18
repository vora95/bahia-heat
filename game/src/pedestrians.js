// Pedestrians: low-poly walkers on sidewalks; they panic and run when shots
// are fired or a wanted chase passes close by.
import * as THREE from './three-shim.js';
import { mulberry32, range, pick } from './random.js';
import { collideCircle } from './world.js';

const SHIRTS = [0xe8e8e8, 0xff7a2f, 0x2fd4ff, 0xffd23e, 0xd7263d, 0x7dff8a, 0xc9a2ff, 0x2f6fd0];
const SKINS = [0xe8b88a, 0xc98d5f, 0xa9764f, 0xf0c297, 0x8a5a3a];

function buildPedMesh(shirt, skin) {
  const g = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x2a2a3a }));
  legs.position.y = 0.35;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34),
    new THREE.MeshLambertMaterial({ color: shirt }));
  torso.position.y = 1.05;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6),
    new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.62;
  g.add(head);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14),
    new THREE.MeshLambertMaterial({ color: shirt }));
  armL.position.set(-0.4, 1.05, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.4;
  g.add(armR);
  g.userData.armL = armL;
  g.userData.armR = armR;
  return g;
}

export class Pedestrians {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = mulberry32(seed);
    this.peds = [];
    for (let i = 0; i < 26; i++) this.spawn();
  }
  spawn() {
    const rng = this.rng;
    const mesh = buildPedMesh(pick(rng, SHIRTS), pick(rng, SKINS));
    this.scene.add(mesh);
    const onX = rng() < 0.5;
    const road = pick(rng, [-180, -120, -60, 0, 60, 120, 180]);
    const along = range(rng, -190, 190);
    const side = rng() < 0.5 ? 8.5 : -8.5;
    const p = {
      mesh,
      x: onX ? along : road + side,
      z: onX ? road + side : along,
      heading: rng() * Math.PI * 2,
      speed: range(rng, 1.1, 1.9),
      panic: 0,
      walkPhase: rng() * 6,
      alive: true,
      hp: 100,
    };
    p.mesh.position.set(p.x, 0, p.z);
    this.peds.push(p);
    return p;
  }
  scare(x, z, radius) {
    for (const p of this.peds) {
      if (!p.alive) continue;
      const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d2 < radius * radius) {
        p.panic = 3 + Math.random() * 2;
        p.heading = Math.atan2(p.x - x, p.z - z);
      }
    }
  }
  update(dt, playerX, playerZ, wanted) {
    for (const p of this.peds) {
      if (!p.alive) continue;
      const d2 = (p.x - playerX) ** 2 + (p.z - playerZ) ** 2;
      if (wanted >= 3 && d2 < 1600) p.panic = Math.max(p.panic, 1.5);
      const sp = p.panic > 0 ? 5.2 : p.speed;
      if (p.panic > 0) p.panic -= dt;
      p.walkPhase += dt * (p.panic > 0 ? 14 : 7);
      p.x += Math.sin(p.heading) * sp * dt;
      p.z += Math.cos(p.heading) * sp * dt;
      // wander: occasionally pick a new heading on sidewalks
      if (Math.random() < dt * 0.15) p.heading += (Math.random() - 0.5) * 1.2;
      const res = collideCircle(p.x, p.z, 0.5);
      p.x = res.x; p.z = res.z;
      if (Math.abs(p.x) > 196 || Math.abs(p.z) > 196) p.heading += Math.PI;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      const swing = Math.sin(p.walkPhase) * (p.panic > 0 ? 0.9 : 0.5);
      p.mesh.userData.armL.rotation.x = swing;
      p.mesh.userData.armR.rotation.x = -swing;
    }
  }
  // nearest living pedestrian to a point within maxD
  nearest(x, z, maxD) {
    let best = null, bd = maxD * maxD;
    for (const p of this.peds) {
      if (!p.alive) continue;
      const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d2 < bd) { bd = d2; best = p; }
    }
    return best;
  }
  kill(p) {
    p.alive = false;
    p.mesh.rotation.z = Math.PI / 2;
    p.mesh.position.y = 0.3;
  }
}
