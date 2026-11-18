// Bahia city: sunset sky, ocean + beach, road grid, buildings with lit windows,
// palms, streetlights, billboards, pier. Deterministic from a seed.
import * as THREE from './three-shim.js';
import { WORLD } from './config.js';
import { mulberry32, range, rangeInt, pick } from './random.js';

let colliders = [];
const ROADS = [-180, -120, -60, 0, 60, 120, 180];

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function windowTexture(base, lit) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const cols = 6, rows = 12;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const on = Math.random() < lit;
        g.fillStyle = on ? (Math.random() < 0.5 ? '#ffd76a' : '#9fd8ff') : '#20202e';
        g.fillRect(8 + c * 19, 10 + r * 20, 12, 12);
      }
    }
  });
}

function makeSky() {
  const tex = canvasTexture(64, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, '#1c0b33');
    grad.addColorStop(0.35, '#5b2350');
    grad.addColorStop(0.62, '#c94b4b');
    grad.addColorStop(0.78, '#ff8c42');
    grad.addColorStop(0.9, '#ffb347');
    grad.addColorStop(1.0, '#ffd76a');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  const geo = new THREE.SphereGeometry(900, 24, 16);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, mat));
  // low sun disc over the ocean (west), with a warm halo
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(38, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
  sunDisc.position.set(-780, 85, 40);
  sunDisc.lookAt(0, 40, 0);
  group.add(sunDisc);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(110, 24),
    new THREE.MeshBasicMaterial({ color: 0xffb347, fog: false, transparent: true, opacity: 0.16 }));
  halo.position.set(-782, 85, 40);
  halo.lookAt(0, 40, 0);
  group.add(halo);
  return group;
}

function makeOcean() {
  const geo = new THREE.PlaneGeometry(260, 520, 1, 1);
  const mat = new THREE.MeshPhongMaterial({ color: 0x14506e, shininess: 90, specular: 0xff9a5c });
  const ocean = new THREE.Mesh(geo, mat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(WORLD.oceanX - 110, -0.4, 0);
  return ocean;
}

function makeGround() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 460),
    new THREE.MeshLambertMaterial({ color: 0x3d2f42 }),
  );
  base.rotation.x = -Math.PI / 2; base.position.set(0, -0.1, 0);
  group.add(base);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 460),
    new THREE.MeshLambertMaterial({ color: 0xd9a86c }),
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set(WORLD.beachX - 7, 0.02, 0);
  group.add(sand);
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2b33 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
  const sideMat = new THREE.MeshLambertMaterial({ color: 0x5d4a55 });
  for (const r of ROADS) {
    for (const horizontal of [false, true]) {
      const len = 400;
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, len), roadMat);
      strip.rotation.x = -Math.PI / 2;
      strip.rotation.z = horizontal ? Math.PI / 2 : 0;
      strip.position.set(horizontal ? 0 : r, 0.05, horizontal ? r : 0);
      group.add(strip);
      for (const s of [-1, 1]) {
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(4, len), sideMat);
        sw.rotation.x = -Math.PI / 2;
        sw.rotation.z = horizontal ? Math.PI / 2 : 0;
        const off = (WORLD.roadWidth / 2 + 2) * s;
        sw.position.set(horizontal ? 0 : r + off, 0.06, horizontal ? r + off : 0);
        group.add(sw);
      }
      for (let d = -190; d < 190; d += 16) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 5), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = horizontal ? Math.PI / 2 : 0;
        dash.position.set(horizontal ? d : r, 0.08, horizontal ? r : d);
        group.add(dash);
      }
    }
  }
  return group;
}

function makeBuildings(rng) {
  const group = new THREE.Group();
  colliders = [];
  const palette = ['#7a5a78', '#8a6a5a', '#5a6a8a', '#9a7a4a', '#6a5a6a', '#b07a5a', '#4a6a7a'];
  const texes = [
    windowTexture('#6a4a5a', 0.55), windowTexture('#4a4a6a', 0.45),
    windowTexture('#7a5a3a', 0.6), windowTexture('#3a3a52', 0.5),
  ];
  for (let bx = 0; bx < 6; bx++) {
    for (let bz = 0; bz < 6; bz++) {
      const cx = -150 + bx * 60, cz = -150 + bz * 60;
      // warehouse lot (mission 5): no random buildings, one big warehouse instead
      if (bx === 5 && bz === 0) {
        const wh = new THREE.Mesh(
          new THREE.BoxGeometry(26, 10, 30),
          new THREE.MeshLambertMaterial({ color: '#5a4a52', emissive: 0x140f12 }),
        );
        wh.position.set(156, 5, -150);
        group.add(wh);
        colliders.push({ x0: 143, x1: 169, z0: -165, z1: -135 });
        const door = new THREE.Mesh(
          new THREE.PlaneGeometry(10, 7),
          new THREE.MeshBasicMaterial({ color: 0xffd23e }),
        );
        door.position.set(142.9, 3.5, -150);
        door.rotation.y = -Math.PI / 2;
        group.add(door);
        const signTex = canvasTexture(256, 64, (g, w, h) => {
          g.fillStyle = '#0e2a3a'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#ffd23e'; g.font = 'bold 34px Verdana'; g.textAlign = 'center';
          g.fillText('WAREHOUSE 4', w / 2, 42);
        });
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(14, 3.5),
          new THREE.MeshBasicMaterial({ map: signTex }),
        );
        sign.position.set(142.9, 9, -150);
        sign.rotation.y = -Math.PI / 2;
        group.add(sign);
        continue;
      }
      const isBeachCol = bx === 0;
      const n = isBeachCol ? rangeInt(rng, 1, 2) : rangeInt(rng, 2, 4);
      for (let i = 0; i < n; i++) {
        const w = range(rng, 14, 26), d = range(rng, 14, 26);
        const h = isBeachCol ? range(rng, 8, 20) : range(rng, 10, 46);
        const x = cx + range(rng, -14, 14), z = cz + range(rng, -14, 14);
        if (Math.abs(x) < 12 || Math.abs(z) < 12) continue;
        if (x < WORLD.beachX + 6) continue;
        const mat = new THREE.MeshLambertMaterial({
          map: pick(rng, texes),
          color: pick(rng, palette),
          emissive: 0x1a0f14,
        });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(x, h / 2, z);
        group.add(b);
        colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
        if (h > 30) {
          const roof = new THREE.Mesh(
            new THREE.BoxGeometry(3, 5, 3),
            new THREE.MeshLambertMaterial({ color: 0x333340 }),
          );
          roof.position.set(x + w / 4, h + 2.5, z);
          group.add(roof);
        }
      }
    }
  }
  const hotelTex = windowTexture('#8a5a6a', 0.75);
  for (const [hx, hz, hh] of [[-168, -120, 52], [-168, 40, 44], [-168, 150, 58]]) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(20, hh, 20),
      new THREE.MeshLambertMaterial({ map: hotelTex, color: '#c98a6a', emissive: 0x241016 }),
    );
    m.position.set(hx, hh / 2, hz);
    group.add(m);
    colliders.push({ x0: hx - 10, x1: hx + 10, z0: hz - 10, z1: hz + 10 });
  }
  return group;
}

function makePalms(rng) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2f });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3d, side: THREE.DoubleSide });
  for (let i = 0; i < 90; i++) {
    const x = range(rng, -172, 195), z = range(rng, -195, 195);
    if (Math.abs(x) % 60 < 9 || Math.abs(z) % 60 < 9) {
      // near roads — line the sidewalks
    } else if (rng() < 0.6) continue;
    const h = range(rng, 5, 8);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, h, 5), trunkMat);
    trunk.position.set(x, h / 2, z);
    trunk.rotation.z = range(rng, -0.08, 0.08);
    group.add(trunk);
    for (let l = 0; l < 5; l++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.1), leafMat);
      const a = (l / 5) * Math.PI * 2 + rng();
      leaf.position.set(x + Math.cos(a) * 1.2, h + 0.3, z + Math.sin(a) * 1.2);
      leaf.rotation.set(-0.5, a, 0.3);
      group.add(leaf);
    }
  }
  return group;
}

function makeStreetlights() {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd76a });
  for (const r of ROADS) {
    for (let d = -180; d <= 180; d += 60) {
      for (const [dx, dz] of [[8, 0], [-8, 0]]) {
        const px = r + dx, pz = d + dz;
        if (px < WORLD.beachX) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 5), poleMat);
        pole.position.set(px, 3, pz);
        group.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampMat);
        lamp.position.set(px, 6.1, pz);
        group.add(lamp);
      }
    }
  }
  return group;
}

function makeBillboards() {
  const group = new THREE.Group();
  const ads = [
    ['BAHIA', '#ff7a2f', 'SUNSET CITY'],
    ['SOL FM', '#2fd4ff', '101.9 · ALL DAY'],
    ['MARINA', '#7dff8a', 'EAT · DANCE · STAY'],
    ['CORAL', '#ffd23e', 'BEACH HOTEL'],
  ];
  const spots = [[-60, -60], [60, 60], [0, 120], [120, -120], [-120, 120]];
  ads.forEach(([big, col, small], i) => {
    const tex = canvasTexture(256, 128, (g, w, h) => {
      g.fillStyle = '#160a20'; g.fillRect(0, 0, w, h);
      g.fillStyle = col; g.font = 'bold 44px Verdana'; g.textAlign = 'center';
      g.fillText(big, w / 2, 58);
      g.fillStyle = '#fff'; g.font = '20px Verdana';
      g.fillText(small, w / 2, 96);
    });
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 8),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
    );
    const [x, z] = spots[i];
    board.position.set(x, 10, z);
    board.rotation.y = (i % 2 === 0 ? 0.4 : -0.6);
    group.add(board);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 10, 5),
      new THREE.MeshLambertMaterial({ color: 0x333340 }),
    );
    post.position.set(x, 5, z);
    group.add(post);
  });
  return group;
}

function makePier() {
  const group = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 60), wood);
  deck.position.set(-206, 0.6, -60);
  group.add(deck);
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 5), wood);
    p.position.set(-210 + (i % 2) * 8, -0.5, -85 + i * 10);
    group.add(p);
  }
  colliders.push({ x0: -212, x1: -200, z0: -92, z1: -28 });
  return group;
}

export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe07a52, 160, 800);
  scene.add(makeSky());
  scene.add(makeOcean());
  scene.add(makeGround());
  scene.add(makeBuildings(rng));
  scene.add(makePalms(rng));
  scene.add(makeStreetlights());
  scene.add(makeBillboards());
  scene.add(makePier());
  const sun = new THREE.DirectionalLight(0xff8c42, 2.2);
  sun.position.set(-160, 60, -120);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0x8a4a7a, 0x2a1a20, 1.15);
  scene.add(hemi);
  return { scene, colliders };
}

// Circle vs building AABB push-out. Returns corrected {x,z} and whether a hit happened.
export function collideCircle(x, z, r) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.x0, Math.min(x, c.x1));
    const nz = Math.max(c.z0, Math.min(z, c.z1));
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        z = nz + (dz / d) * r;
      } else {
        x += r;
      }
    }
  }
  const B = WORLD.half - 4;
  x = Math.max(-B, Math.min(B, x));
  z = Math.max(-B, Math.min(B, z));
  return { x, z, hit };
}

export function nearestRoadPoint(x, z) {
  let bx = x, bz = z, bd = 1e9;
  for (const r of ROADS) {
    const d1 = Math.abs(x - r);
    if (d1 < bd) { bd = d1; bx = r; bz = z; }
    const d2 = Math.abs(z - r);
    if (d2 < bd) { bd = d2; bx = x; bz = r; }
  }
  return { x: bx, z: bz, d: bd };
}
