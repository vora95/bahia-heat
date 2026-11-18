// Vehicles: low-poly box-built cars (5 stealable models), traffic AI, player car physics.
import * as THREE from './three-shim.js';
import { CAR_MODELS, clamp } from './config.js';
import { mulberry32, range, pick } from './random.js';
import { collideCircle, nearestRoadPoint } from './world.js';

const TRAFFIC_COLORS = [0xcccccc, 0x3a3a4a, 0x7a2a2a, 0x2a5a7a, 0xd8d8d8, 0x4a3a5a];

export function buildCarMesh(model, opts = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: model.color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14141c });
  const chrome = new THREE.MeshLambertMaterial({ color: 0x9aa2b0 });
  const L = opts.length || 4.4, W = opts.width || 2.0;
  // body
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, 0.75, L), paint);
  body.position.y = 0.65;
  g.add(body);
  // cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, 0.62, L * 0.48), dark);
  cabin.position.set(0, 1.3, -L * 0.05);
  g.add(cabin);
  // hood/trunk hints
  const hood = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.14, L * 0.2), chrome);
  hood.position.set(0, 1.06, L * 0.36);
  g.add(hood);
  // headlights + taillights (emissive so they read at sunset)
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tl = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), hl);
    h.position.set(s * (W / 2 - 0.3), 0.72, L / 2 + 0.02);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), tl);
    t.position.set(s * (W / 2 - 0.3), 0.72, -L / 2 - 0.02);
    g.add(t);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0c10 });
  const wheels = [];
  for (const [wx, wz] of [[-W / 2, L * 0.32], [W / 2, L * 0.32], [-W / 2, -L * 0.32], [W / 2, -L * 0.32]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
    wheels.push(w);
  }
  if (opts.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffe95c }));
    sign.position.set(0, 1.78, -L * 0.05);
    g.add(sign);
  }
  if (opts.pickup) {
    // open bed instead of cabin
    cabin.visible = false;
    const bed = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.5, L * 0.42), paint);
    bed.position.set(0, 1.15, -L * 0.24);
    g.add(bed);
  }
  g.userData.wheels = wheels;
  return g;
}

export function buildPoliceMesh() {
  const g = buildCarMesh({ color: 0xf0f0f0, name: 'Bahia PD' }, { length: 4.6 });
  // black hood + doors band
  const band = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.4, 4.2),
    new THREE.MeshLambertMaterial({ color: 0x14141c }));
  band.position.y = 0.85;
  g.add(band);
  // light bar: red + blue, flashed by police.js via userData
  const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x222226 }));
  barBase.position.set(0, 1.72, -0.2);
  g.add(barBase);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.46),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  red.position.set(-0.28, 1.74, -0.2);
  g.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.46),
    new THREE.MeshBasicMaterial({ color: 0x2266ff }));
  blue.position.set(0.28, 1.74, -0.2);
  g.add(blue);
  g.userData.lightRed = red;
  g.userData.lightBlue = blue;
  return g;
}

// ---- player car ----
export class PlayerCar {
  constructor(scene, model) {
    this.model = model;
    this.mesh = buildCarMesh(model, { taxi: model.key === 'tortuga', pickup: model.key === 'cangrejo' });
    scene.add(this.mesh);
    this.x = 0; this.z = 0; this.heading = 0; this.speed = 0;
    this.condition = 100;
    this.spin = 0;
  }
  setModel(scene, model) {
    scene.remove(this.mesh);
    this.model = model;
    this.mesh = buildCarMesh(model, { taxi: model.key === 'tortuga', pickup: model.key === 'cangrejo' });
    scene.add(this.mesh);
    this.condition = Math.max(this.condition, 70);
  }
  place(x, z, heading) { this.x = x; this.z = z; this.heading = heading; this.speed = 0; this.sync(); }
  sync() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * 0.02;
  }
  update(dt, input, handbrake) {
    const m = this.model;
    const steerTarget = input.steer * (this.speed >= 0 ? 1 : -1);
    this.spin += (steerTarget * 0.55 * clamp(Math.abs(this.speed) / 12, 0, 1) - this.spin) * Math.min(1, dt * 8);
    this.heading += this.spin * dt * (this.speed >= 0 ? 1 : -1) * (handbrake ? 1.6 : 1);
    const accel = input.throttle > 0 ? m.accel : (input.throttle < 0 ? -m.accel * 0.8 : 0);
    this.speed += accel * dt;
    // drag + rolling resistance
    this.speed -= this.speed * (handbrake ? 1.9 : 0.55) * dt;
    if (input.throttle === 0 && Math.abs(this.speed) < 0.4) this.speed = 0;
    this.speed = clamp(this.speed, -11, m.top);
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const res = collideCircle(nx, nz, 2.1);
    if (res.hit) {
      if (Math.abs(this.speed) > 9) {
        this.condition = Math.max(5, this.condition - Math.abs(this.speed) * 0.35);
      }
      this.speed *= 0.45;
    }
    this.x = res.x; this.z = res.z;
    this.sync();
    return res.hit;
  }
}

// ---- traffic ----
export class Traffic {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = mulberry32(seed);
    this.cars = [];
    for (let i = 0; i < 16; i++) this.spawn();
  }
  spawn() {
    const rng = this.rng;
    const model = pick(rng, CAR_MODELS);
    const mesh = buildCarMesh({ color: pick(rng, TRAFFIC_COLORS), name: model.name });
    this.scene.add(mesh);
    const onXRoad = rng() < 0.5;
    const road = pick(rng, [-180, -120, -60, 0, 60, 120, 180]);
    const along = range(rng, -190, 190);
    const car = {
      mesh, model,
      x: onXRoad ? along : road + (rng() < 0.5 ? 3 : -3),
      z: onXRoad ? road + (rng() < 0.5 ? 3 : -3) : along,
      heading: onXRoad ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI),
      speed: range(rng, 7, 13),
      targetSpeed: range(rng, 7, 13),
      panic: 0,
    };
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    this.cars.push(car);
    return car;
  }
  update(dt, playerX, playerZ, wanted) {
    for (const c of this.cars) {
      // panic: swerve away when the player is wanted and close, or after gunfire
      const d2 = (c.x - playerX) ** 2 + (c.z - playerZ) ** 2;
      if (wanted >= 2 && d2 < 900) c.panic = Math.max(c.panic, 1.2);
      if (c.panic > 0) {
        c.panic -= dt;
        c.speed = Math.min(c.speed + dt * 6, 20);
      } else {
        c.speed += (c.targetSpeed - c.speed) * dt * 0.5;
      }
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      // at intersections, sometimes turn
      const nearInt = (Math.abs(((c.x % 60) + 60) % 60) < 3 || Math.abs(((c.z % 60) + 60) % 60) < 3);
      if (nearInt && this.rng() < dt * 0.5) {
        c.heading += (this.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
        // snap onto the new road
        const rp = nearestRoadPoint(c.x, c.z);
        c.x = rp.x; c.z = rp.z;
      }
      if (c.x > 198 || c.x < -198 || c.z > 198 || c.z < -198) {
        // wrap around the far side
        c.x = -c.x * 0.95; c.z = -c.z * 0.95;
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * 0.02;
    }
  }
  // nearest traffic car to a point (for stealing)
  nearest(x, z, maxD) {
    let best = null, bd = maxD * maxD;
    for (const c of this.cars) {
      const d2 = (c.x - x) ** 2 + (c.z - z) ** 2;
      if (d2 < bd) { bd = d2; best = c; }
    }
    return best;
  }
  remove(car) {
    this.scene.remove(car.mesh);
    this.cars.splice(this.cars.indexOf(car), 1);
    this.spawn();
  }
}

// Parked stealable cars (deterministic spots along Ocean Drive and plazas).
export function spawnParked(scene, seed) {
  const rng = mulberry32(seed);
  const spots = [];
  const defs = [
    { model: 'brisa', x: -168, z: -40, h: Math.PI / 2 },
    { model: 'marea', x: -168, z: 60, h: Math.PI / 2 },
    { model: 'onda', x: -52, z: -168, h: 0 },
    { model: 'tortuga', x: 8, z: -52, h: Math.PI },
    { model: 'cangrejo', x: 68, z: 128, h: -Math.PI / 2 },
    { model: 'onda', x: 128, z: 8, h: 0 },
    { model: 'brisa', x: -108, z: 128, h: Math.PI / 2 },
    { model: 'marea', x: 188, z: -108, h: -Math.PI / 2 },
  ];
  for (const d of defs) {
    const model = CAR_MODELS.find((m) => m.key === d.model);
    const mesh = buildCarMesh(model, { taxi: model.key === 'tortuga', pickup: model.key === 'cangrejo' });
    mesh.position.set(d.x, 0, d.z);
    mesh.rotation.y = d.h;
    scene.add(mesh);
    spots.push({ model, mesh, x: d.x, z: d.z, heading: d.h, taken: false });
  }
  return spots;
}
