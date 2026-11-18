// Bahia PD: pursuit cars, roadblocks and the police helicopter with searchlight.
// Also produces the named-unit data for the HUD response panel.
import * as THREE from './three-shim.js';
import { buildPoliceMesh } from './vehicles.js';
import { mulberry32, pick } from './random.js';
import { collideCircle, nearestRoadPoint } from './world.js';

const OFFICERS = [
  'REYES', 'ORTIZ', 'MARSH', 'KOVAC', 'DIALLO', 'SANTOS', 'VANCE', 'PRYCE',
  'HALE', 'QUINN', 'FROST', 'IBARRA', 'NASH', 'CALLA', 'DUARTE', 'WELLS',
];
const AIR_UNITS = ['AIR-1', 'AIR-2'];

export class Police {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = mulberry32(seed);
    this.units = [];       // pursuit cars
    this.roadblocks = [];  // {mesh, x, z, ttl}
    this.heli = null;      // {group, rotor, cone, light}
    this.flashT = 0;
    this.spawnT = 0;
    this.nextOfficer = 0;
  }
  officerName() {
    const n = OFFICERS[this.nextOfficer % OFFICERS.length];
    this.nextOfficer += 1;
    return n;
  }
  desiredCount(wanted) {
    return [0, 1, 2, 3, 4, 5][Math.max(0, Math.min(5, wanted))];
  }
  spawnUnit(px, pz) {
    const mesh = buildPoliceMesh();
    this.scene.add(mesh);
    const a = this.rng() * Math.PI * 2;
    const d = 55 + this.rng() * 30;
    const u = {
      mesh,
      x: px + Math.sin(a) * d, z: pz + Math.cos(a) * d,
      heading: a, speed: 0,
      name: this.officerName(),
      status: 'EN ROUTE',
      ramCd: 0,
    };
    this.units.push(u);
    return u;
  }
  spawnRoadblock(px, pz, heading) {
    // two cars + striped barrier across the road ahead of the player
    const group = new THREE.Group();
    const meshes = [];
    for (const s of [-4.5, 4.5]) {
      const m = buildPoliceMesh();
      m.position.set(s, 0, 0);
      m.rotation.y = Math.PI / 2;
      group.add(m);
      meshes.push(m);
    }
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.9, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    stripe.position.set(0, 0.9, 0);
    group.add(stripe);
    const fx = px + Math.sin(heading) * 42, fz = pz + Math.cos(heading) * 42;
    const rp = nearestRoadPoint(fx, fz);
    group.position.set(rp.x, 0, rp.z);
    group.rotation.y = heading + Math.PI / 2;
    this.scene.add(group);
    this.roadblocks.push({ group, meshes, x: rp.x, z: rp.z, ttl: 26 });
    return rp;
  }
  spawnHeli(px, pz, heading = 0) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1c2a3a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 6.5), bodyMat);
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 5), bodyMat);
    tail.position.set(0, 0.4, -5.2);
    g.add(tail);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.8),
      new THREE.MeshPhongMaterial({ color: 0x9fd8ff, shininess: 120 }));
    glass.position.set(0, 0.3, 2.6);
    g.add(glass);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.1, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111116 }));
    rotor.position.y = 1.3;
    g.add(rotor);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x111116 }));
    tailRotor.position.set(0.6, 0.6, -7.4);
    g.add(tailRotor);
    // searchlight: visible cone + real spotlight (apex at the heli, wide end at the street)
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(12, 55, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    cone.position.y = -27.5;
    g.add(cone);
    const light = new THREE.SpotLight(0xfff2b0, 2.2, 90, 0.32, 0.5, 1.2);
    light.position.set(0, -1, 0);
    g.add(light);
    g.add(light.target);
    g.position.set(px + Math.sin(heading) * 30, 55, pz + Math.cos(heading) * 30);
    this.scene.add(g);
    this.heli = { group: g, rotor, cone, light, name: pick(this.rng, AIR_UNITS), status: 'SEARCHLIGHT' };
  }
  update(dt, px, pz, pHeading, wanted, playerSpeed) {
    this.flashT += dt;
    const flash = Math.floor(this.flashT * 6) % 2 === 0;
    // maintain pursuit count
    const want = this.desiredCount(wanted);
    this.spawnT -= dt;
    if (this.units.length < want && this.spawnT <= 0) {
      this.spawnUnit(px, pz);
      this.spawnT = 2.5;
    }
    if (this.units.length > want) {
      const u = this.units.pop();
      this.scene.remove(u.mesh);
    }
    for (const u of this.units) {
      // steer toward predicted player position
      const tx = px + Math.sin(pHeading) * playerSpeed * 0.5;
      const tz = pz + Math.cos(pHeading) * playerSpeed * 0.5;
      const wantH = Math.atan2(tx - u.x, tz - u.z);
      let dh = wantH - u.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      u.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      const target = wanted >= 4 ? 30 : 24;
      u.speed += (target - u.speed) * dt * 0.7;
      u.x += Math.sin(u.heading) * u.speed * dt;
      u.z += Math.cos(u.heading) * u.speed * dt;
      const res = collideCircle(u.x, u.z, 2.1);
      u.x = res.x; u.z = res.z;
      u.mesh.position.set(u.x, 0, u.z);
      u.mesh.rotation.y = u.heading;
      const d = Math.hypot(u.x - px, u.z - pz);
      u.status = d < 7 ? 'RAMMING' : 'PURSUIT';
      u.dist = Math.round(d);
      // flash light bar
      u.mesh.userData.lightRed.material.color.setHex(flash ? 0xff2222 : 0x551111);
      u.mesh.userData.lightBlue.material.color.setHex(flash ? 0x112255 : 0x2266ff);
      u.ramCd -= dt;
    }
    // roadblocks at wanted >= 3, refreshed while wanted
    if (wanted >= 3 && this.roadblocks.length === 0 && this.rng() < dt * 0.25) {
      this.spawnRoadblock(px, pz, pHeading);
    }
    for (let i = this.roadblocks.length - 1; i >= 0; i--) {
      const rb = this.roadblocks[i];
      rb.ttl -= dt;
      const fl = Math.floor(this.flashT * 6) % 2 === 0;
      for (const m of rb.meshes) {
        m.userData.lightRed.material.color.setHex(fl ? 0xff2222 : 0x551111);
        m.userData.lightBlue.material.color.setHex(fl ? 0x112255 : 0x2266ff);
      }
      if (rb.ttl <= 0 || wanted < 3) {
        this.scene.remove(rb.group);
        this.roadblocks.splice(i, 1);
      }
    }
    // helicopter at wanted >= 3
    if (wanted >= 3 && !this.heli) this.spawnHeli(px, pz, pHeading);
    if (wanted < 3 && this.heli) {
      this.scene.remove(this.heli.group);
      this.heli = null;
    }
    if (this.heli) {
      const h = this.heli;
      // hover ahead of the player, high above the rooftops so it stays visible
      const tx = px + Math.sin(pHeading) * 28, tz = pz + Math.cos(pHeading) * 28;
      h.group.position.x += (tx - h.group.position.x) * dt * 0.8;
      h.group.position.z += (tz - h.group.position.z) * dt * 0.8;
      h.group.position.y = 55 + Math.sin(this.flashT * 0.9) * 1.5;
      h.group.rotation.y = Math.atan2(px - h.group.position.x, pz - h.group.position.z);
      h.rotor.rotation.y += dt * 22;
      h.light.target.position.set(px - h.group.position.x, -55, pz - h.group.position.z);
      h.status = 'SEARCHLIGHT';
      h.dist = Math.round(Math.hypot(px - h.group.position.x, pz - h.group.position.z));
    }
  }
  // panel rows for the HUD
  panelRows(px, pz) {
    const rows = [];
    for (const u of this.units) {
      rows.push({ name: 'UNIT ' + u.name, dist: (u.dist ?? 0) + 'm', status: u.status });
    }
    for (const rb of this.roadblocks) {
      rows.push({ name: 'ROADBLOCK', dist: Math.round(Math.hypot(rb.x - px, rb.z - pz)) + 'm', status: 'ROADBLOCK' });
    }
    if (this.heli) rows.push({ name: this.heli.name, dist: (this.heli.dist ?? 0) + 'm', status: 'SEARCHLIGHT' });
    return rows;
  }
  // nearest police car to a point (for ramming / combat)
  nearest(px, pz, maxD) {
    let best = null, bd = maxD * maxD;
    for (const u of this.units) {
      const d2 = (u.x - px) ** 2 + (u.z - pz) ** 2;
      if (d2 < bd) { bd = d2; best = u; }
    }
    return best;
  }
  damageUnit(u, dmg) {
    u.hp = (u.hp ?? 100) - dmg;
    if (u.hp <= 0) {
      this.scene.remove(u.mesh);
      this.units.splice(this.units.indexOf(u), 1);
      return true;
    }
    return false;
  }
}
