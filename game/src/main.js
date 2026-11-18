// Bahia Heat — boot, game loop, player (on foot + in car), wanted system,
// mission wiring, combat wiring, save/load, screenshot staging.
import * as THREE from './three-shim.js';
import { CAR_MODELS, WEAPONS, CHARACTERS, clamp, lerp } from './config.js';
import { mulberry32 } from './random.js';
import { initInput, axis, down, pressed } from './input.js';
import { buildWorld, collideCircle } from './world.js';
import { PlayerCar, Traffic, spawnParked, buildCarMesh } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { MissionRunner, MISSIONS } from './missions.js';
import { Combat } from './combat.js';
import { createRenderer, ChaseCamera } from './render.js';
import { initHud, showHud, showTitle, showPause, showOver, setSaveNote, toast,
  updateHud, showDialog, advanceDialog, isDialogOpen, hideDialog, onStart, onResume, onRetry, setRadio } from './hud.js';
import { initAudio, resumeAudio, toggleMute, setEngine, sfx, radioTick } from './audio.js';
import { shotParams, SHOTS } from './shots.js';

const SAVE_KEY = 'bahia-heat-save-v1';
const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const shotName = shotParams();
const shot = SHOTS[shotName] || null;

initInput();
initHud();

// ---------- state ----------
const S = {
  money: 2450, rep: 120, hp: 100, armor: 0, wanted: 0, heat: 0,
  missionsDone: 0, allDone: false,
  mission: null, missionProgress: 0, missionDist: null, missionTimer: null, missionStep: '0/6',
  missionTarget: null,
  px: -150, pz: -30, heading: Math.PI / 2, speedKmh: 0,
  inCar: false, carName: 'ON FOOT', condition: 100, stolen: false,
  weaponSlot: 0, ammo: WEAPONS.map((w) => w.ammo), unlocked: [true, true, false, false],
  responseRows: [], trafficDots: [], policeDots: [], heliDot: null,
  clock: 'FRI 17:24', clockMin: 17 * 60 + 24,
};

// ---------- world ----------
const seed = shot ? shot.seed : 7;
const { scene } = buildWorld(seed);
const { renderer, camera } = createRenderer(document.getElementById('game'));
const cam = new ChaseCamera(camera);
const traffic = new Traffic(scene, seed + 100);
const peds = new Pedestrians(scene, seed + 200);
const police = new Police(scene, seed + 300);
const combat = new Combat(scene);
const parked = spawnParked(scene, seed + 400);

// player figure (on foot)
function buildPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xff7a2f });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a06b });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.3), new THREE.MeshLambertMaterial({ color: 0x2a2a3a }));
  legs.position.y = 0.38; g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.8, 0.36), jacket);
  torso.position.y = 1.12; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6), skin);
  head.position.y = 1.7; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.44), new THREE.MeshLambertMaterial({ color: 0x1c1c22 }));
  cap.position.y = 1.88; g.add(cap);
  return g;
}
const playerMesh = buildPlayerMesh();
scene.add(playerMesh);

const player = {
  x: S.px, z: S.pz, heading: S.heading, speed: 0, onFoot: true,
  car: null, bustedT: 0, hpRegen: 0,
};

// mission beacon (glowing column + floating marker at the active target)
const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22, depthWrite: false });
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 60, 12, 1, true), beaconMat);
beacon.position.y = 30;
scene.add(beacon);
const beaconGem = new THREE.Mesh(new THREE.OctahedronGeometry(1.6),
  new THREE.MeshBasicMaterial({ color: 0xffd23e }));
beaconGem.position.y = 14;
scene.add(beaconGem);

// mission 4 chase target (Tomás) + mission 5 guards + crate
let tomas = null, tomasRams = 0, tomasRamCd = 0;
let guards = [], crateMesh = null, crateTaken = false;

function spawnTomas() {
  const mesh = buildCarMesh({ color: 0x3d8b40, name: 'Tomas Pickup' }, { pickup: true });
  scene.add(mesh);
  tomas = { mesh, x: 60, z: 120, heading: 0, speed: 20, hp: 100 };
}
function spawnGuards() {
  guards = [];
  const spots = [[138, -156], [138, -144], [138, -150]];
  for (const [gx, gz] of spots) {
    const g = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), dark);
    legs.position.y = 0.38; g.add(legs);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.38), dark);
    torso.position.y = 1.12; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xc98d5f }));
    head.position.y = 1.7; g.add(head);
    g.position.set(gx, 0, gz);
    scene.add(g);
    guards.push({ mesh: g, x: gx, z: gz, heading: 0, hp: 100, alive: true, kind: 'guard', punchCd: 0 });
  }
  crateMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 2.2),
    new THREE.MeshBasicMaterial({ color: 0xffe95c }));
  crateMesh.position.set(140, 0.8, -150);
  scene.add(crateMesh);
}

// ---------- missions ----------
const runner = new MissionRunner((type, p) => {
  if (type === 'dialog') showDialog(p.char, p.lines);
  else if (type === 'mission') { sfx('mission'); toast(p.title); }
  else if (type === 'wanted') { S.wanted = p.wanted; S.heat = 30; }
  else if (type === 'hint') toast(p.text);
  else if (type === 'stage') toast(p.text);
  else if (type === 'fail') { toast(p.reason); sfx('alarm'); }
  else if (type === 'complete') {
    S.money += p.money; S.rep += p.rep; S.missionsDone += 1;
    sfx('cash'); toast('JOB DONE  +' + p.money + '  +' + p.rep + ' REP');
    combat.unlockCheck(S.rep);
    saveGame();
  } else if (type === 'allDone') {
    S.allDone = true;
    toast('ALL 6 JOBS DONE — you run Bahia now.');
  }
});

function currentMissionState() {
  const m = runner.current;
  if (!m) { S.mission = null; S.missionTarget = null; S.missionTimer = null; return; }
  S.mission = { title: m.title };
  S.missionStep = (runner.index + 1) + '/6 · stage ' + (runner.stage + 1);
  const t = runner.target;
  S.missionTarget = t ? { x: t.x, z: t.z } : null;
  S.missionProgress = runner.progress(player.x, player.z);
  S.missionDist = t ? Math.hypot(player.x - t.x, player.z - t.z) : null;
  S.missionTimer = m.timer ? runner.timer : null;
  beacon.visible = !!t;
  if (t) {
    beacon.position.set(t.x, 30, t.z);
    beaconGem.position.set(t.x, 14 + Math.sin(performance.now() / 400) * 1.2, t.z);
    beaconGem.rotation.y += 0.03;
  }
}

// ---------- save / load ----------
function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: S.money, rep: S.rep, missionsDone: S.missionsDone, missionIndex: runner.index,
      hp: S.hp, armor: S.armor,
    }));
    toast('✓ AUTOSAVED');
  } catch (e) { /* storage off: session only */ }
}
function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

// ---------- wanted ----------
function addWanted(n) {
  const before = S.wanted;
  S.wanted = clamp(S.wanted + n, 0, 5);
  S.heat = 30;
  if (S.wanted > before) sfx('siren');
}

// ---------- enter / exit car ----------
function nearestStealable() {
  let best = null, bd = 7 * 7;
  for (const s of parked) {
    if (s.taken) continue;
    const d2 = (s.x - player.x) ** 2 + (s.z - player.z) ** 2;
    if (d2 < bd) { bd = d2; best = { kind: 'parked', ref: s }; }
  }
  const t = traffic.nearest(player.x, player.z, 7);
  if (t) {
    const d2 = (t.x - player.x) ** 2 + (t.z - player.z) ** 2;
    if (d2 < bd) best = { kind: 'traffic', ref: t };
  }
  return best;
}
function enterCar(found) {
  const model = found.ref.model;
  player.car = new PlayerCar(scene, model);
  player.car.place(found.ref.x, found.ref.z, found.ref.heading ?? 0);
  player.onFoot = false;
  S.inCar = true; S.carName = model.name; S.stolen = true;
  S.condition = player.car.condition;
  playerMesh.visible = false;
  if (found.kind === 'parked') found.ref.taken = true;
  else traffic.remove(found.ref);
  addWanted(1);
  toast('VEHICLE STOLEN: ' + model.name.toUpperCase());
  sfx('alarm');
  peds.scare(player.x, player.z, 25);
}
function exitCar() {
  if (!player.car || Math.abs(player.car.speed) > 3) return;
  player.x = player.car.x - Math.sin(player.car.heading) * 3;
  player.z = player.car.z - Math.cos(player.car.heading) * 3;
  player.heading = player.car.heading;
  player.onFoot = true;
  S.inCar = false; S.carName = 'ON FOOT';
  playerMesh.visible = true;
  playerMesh.position.set(player.x, 0, player.z);
  scene.remove(player.car.mesh);
  player.car = null;
}

// ---------- combat targets ----------
function combatTargets() {
  const list = [];
  for (const p of peds.peds) list.push({ x: p.x, z: p.z, alive: p.alive, kind: 'ped', ref: p });
  for (const g of guards) list.push({ x: g.x, z: g.z, alive: g.alive, kind: 'guard', ref: g });
  for (const u of police.units) list.push({ x: u.x, z: u.z, alive: true, kind: 'cop', ref: u });
  if (tomas) list.push({ x: tomas.x, z: tomas.z, alive: tomas.hp > 0, kind: 'tomas', ref: tomas });
  return list;
}
function applyHit(res) {
  if (!res || !res.hit) return;
  const t = res.target;
  if (t.kind === 'ped') {
    t.ref.hp -= res.dmg;
    if (t.ref.hp <= 0) { peds.kill(t.ref); addWanted(1); toast('Pedestrian down — the heat rises.'); }
    else peds.scare(t.ref.x, t.ref.z, 30);
  } else if (t.kind === 'guard') {
    t.ref.hp -= res.dmg;
    if (t.ref.hp <= 0 && t.ref.alive) {
      t.ref.alive = false;
      t.ref.mesh.rotation.z = Math.PI / 2;
      t.ref.mesh.position.y = 0.3;
      runner.guardsDown += 1;
      addWanted(1);
      toast('Guard down (' + runner.guardsDown + '/3)');
    }
  } else if (t.kind === 'cop') {
    if (police.damageUnit(t.ref, res.dmg)) { addWanted(2); toast('Officer down — they will not forget this.'); }
    else addWanted(1);
  } else if (t.kind === 'tomas') {
    tomas.hp -= res.dmg;
    if (tomas.hp <= 0) { scene.remove(tomas.mesh); tomas = null; }
  }
}

// ---------- per-frame update ----------
let screen = 'title'; // title | play | paused | over
let saveT = 0, clockT = 0, sirenT = 0;

function update(dt) {
  const a = axis();
  const handbrake = down('Space');
  // pause
  if (pressed('KeyP') || pressed('Escape')) {
    if (screen === 'play') { screen = 'paused'; showPause(true); }
    else if (screen === 'paused') { screen = 'play'; showPause(false); }
  }
  if (screen !== 'play') return;
  if (pressed('KeyM')) { const m = toggleMute(); toast(m ? 'MUTED' : 'SOUND ON'); }
  if (pressed('KeyC')) cam.cycle();
  if (pressed('Digit1')) combat.select(0);
  if (pressed('Digit2')) combat.select(1);
  if (pressed('Digit3')) combat.select(2);
  if (pressed('Digit4')) combat.select(3);
  if (pressed('KeyR')) combat.reload();
  if (pressed('KeyE')) {
    if (isDialogOpen()) advanceDialog();
    else if (player.onFoot) {
      const found = nearestStealable();
      if (found) enterCar(found);
    } else exitCar();
  }
  // dialog advance with Enter too
  if (pressed('Enter') && isDialogOpen()) advanceDialog();

  // clock
  clockT += dt;
  if (clockT > 20) {
    clockT = 0;
    S.clockMin += 1;
    const hh = Math.floor(S.clockMin / 60) % 24, mm = S.clockMin % 60;
    S.clock = 'FRI ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }
  radioTick(dt, true);

  // ---- movement ----
  if (player.onFoot) {
    const sp = 5.5;
    const mx = Math.sin(player.heading), mz = Math.cos(player.heading);
    let vx = 0, vz = 0;
    if (a.throttle !== 0 || a.steer !== 0) {
      // WASD relative to camera heading (player heading)
      const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
      const rx = Math.sin(player.heading - Math.PI / 2), rz = Math.cos(player.heading - Math.PI / 2);
      vx = fx * a.throttle + rx * -a.steer;
      vz = fz * a.throttle + rz * -a.steer;
      const len = Math.hypot(vx, vz) || 1;
      vx /= len; vz /= len;
      player.heading = Math.atan2(vx, vz);
      const res = collideCircle(player.x + vx * sp * dt, player.z + vz * sp * dt, 0.6);
      player.x = res.x; player.z = res.z;
      player.speed = sp;
    } else player.speed = 0;
    playerMesh.position.set(player.x, 0, player.z);
    playerMesh.rotation.y = player.heading;
    // walk bob
    playerMesh.position.y = player.speed > 0 ? Math.abs(Math.sin(performance.now() / 130)) * 0.08 : 0;
    setEngine(0, false);
  } else if (player.car) {
    const hit = player.car.update(dt, a, handbrake);
    if (hit) sfx('crash');
    player.x = player.car.x; player.z = player.car.z; player.heading = player.car.heading;
    player.speed = player.car.speed;
    S.condition = player.car.condition;
    setEngine(Math.abs(player.car.speed) / player.car.model.top, true);
    // ram Tomás
    if (tomas && tomasRamCd <= 0) {
      const d = Math.hypot(tomas.x - player.x, tomas.z - player.z);
      if (d < 5 && Math.abs(player.car.speed) > 8) {
        tomasRamCd = 1.2;
        tomas.hp -= 34;
        runner.ramsDone += 1;
        sfx('crash');
        toast('RAM! Tomás is wobbling (' + runner.ramsDone + '/3)');
        if (tomas.hp <= 0) {
          scene.remove(tomas.mesh); tomas = null;
          if (runner.current && runner.current.id === 4) runner.complete();
        }
      }
    }
    tomasRamCd -= dt;
  }
  S.px = player.x; S.pz = player.z; S.heading = player.heading;
  S.speedKmh = Math.abs(player.speed) * 3.6;

  // ---- traffic / peds / police ----
  traffic.update(dt, player.x, player.z, S.wanted);
  peds.update(dt, player.x, player.z, S.wanted);
  police.update(dt, player.x, player.z, player.heading, S.wanted, player.speed);
  // traffic collisions with player car
  if (player.car) {
    for (const c of traffic.cars) {
      const d2 = (c.x - player.x) ** 2 + (c.z - player.z) ** 2;
      if (d2 < 16) {
        player.car.speed *= 0.7;
        c.speed *= 0.5;
        player.car.condition = Math.max(5, player.car.condition - 2);
      }
    }
    for (const u of police.units) {
      const d2 = (u.x - player.x) ** 2 + (u.z - player.z) ** 2;
      if (d2 < 16) {
        player.car.speed *= 0.6;
        player.car.condition = Math.max(5, player.car.condition - 4);
        if (u.ramCd <= 0) { u.ramCd = 1.5; sfx('crash'); }
      }
    }
  }
  // guards chase + punch the player on foot
  for (const g of guards) {
    if (!g.alive) continue;
    const d = Math.hypot(g.x - player.x, g.z - player.z);
    if (player.onFoot && d < 26) {
      g.heading = Math.atan2(player.x - g.x, player.z - g.z);
      g.x += Math.sin(g.heading) * 4.4 * dt;
      g.z += Math.cos(g.heading) * 4.4 * dt;
      g.mesh.position.set(g.x, 0, g.z);
      g.mesh.rotation.y = g.heading;
      g.punchCd -= dt;
      if (d < 2 && g.punchCd <= 0) {
        g.punchCd = 1.1;
        S.hp = Math.max(0, S.hp - 9);
        sfx('punch');
      }
    }
  }
  // Tomás flees
  if (tomas) {
    const away = Math.atan2(tomas.x - player.x, tomas.z - player.z);
    tomas.heading += clamp(((away - tomas.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1.6 * dt, 1.6 * dt);
    tomas.x += Math.sin(tomas.heading) * tomas.speed * dt;
    tomas.z += Math.cos(tomas.heading) * tomas.speed * dt;
    const res = collideCircle(tomas.x, tomas.z, 2.1);
    tomas.x = res.x; tomas.z = res.z;
    tomas.mesh.position.set(tomas.x, 0, tomas.z);
    tomas.mesh.rotation.y = tomas.heading;
  }
  // crate pickup
  if (crateMesh && !crateTaken && runner.current && runner.current.id === 5 && runner.stage === 0
      && runner.guardsDown >= 3 && player.onFoot) {
    if (Math.hypot(player.x - 140, player.z + 150) < 4) {
      crateTaken = true;
      scene.remove(crateMesh);
      sfx('pickup');
      runner.stage = 1;
      toast('Crate secured — take it to the pier gate.');
    }
  }

  // ---- combat input ----
  combat.update(dt);
  if (pressed('KeyF') && player.onFoot) applyHit(combat.attack(player.x, player.z, player.heading, combatTargets()));
  if (pressed('KeyG')) {
    const res = combat.attack(player.x, player.z, player.heading, combatTargets());
    applyHit(res);
    if (res && res.hit) peds.scare(player.x, player.z, 40);
    else if (res && !res.dry) peds.scare(player.x, player.z, 25);
  }

  // ---- wanted decay / busted / hp ----
  S.heat -= dt;
  if (S.heat <= 0 && S.wanted > 0) {
    const nearestCop = police.nearest(player.x, player.z, 60);
    if (!nearestCop && !police.heli) {
      S.wanted = Math.max(0, S.wanted - 1);
      S.heat = 8;
      if (S.wanted === 0) toast('You lost them. For now.');
    } else S.heat = 4;
  }
  if (player.onFoot && S.wanted > 0) {
    const cop = police.nearest(player.x, player.z, 3);
    if (cop) {
      player.bustedT += dt;
      if (player.bustedT > 1.5) { endGame('BUSTED', 'The Bahia PD finally caught up with you.'); return; }
    } else player.bustedT = 0;
  }
  if (S.hp <= 0) { endGame('WASTED', 'Bahia chewed you up. The streets forget fast.'); return; }
  if (S.wanted === 0 && S.hp < 100) S.hp = Math.min(100, S.hp + dt * 1.5);
  sirenT += dt;
  if (S.wanted >= 1 && sirenT > 2.4) { sirenT = 0; sfx('siren'); }

  // ---- missions ----
  if (runner.current) {
    if (runner.current.id === 4 && !tomas) spawnTomas();
    if (runner.current.id === 5 && guards.length === 0) spawnGuards();
    runner.update(dt, player.x, player.z, !player.onFoot, player.car ? player.car.model.key : null);
    if (runner.current && runner.current.id === 4 && runner.ramsDone >= 3 && tomas) {
      scene.remove(tomas.mesh); tomas = null; runner.complete();
    }
  }
  currentMissionState();
  S.responseRows = police.panelRows(player.x, player.z);
  S.trafficDots = traffic.cars.map((c) => ({ x: c.x, z: c.z }));
  S.policeDots = police.units.map((u) => ({ x: u.x, z: u.z }));
  S.heliDot = police.heli ? { x: police.heli.group.position.x, z: police.heli.group.position.z } : null;
  S.weaponSlot = combat.slot;
  S.ammo = combat.ammo.slice();
  S.unlocked = combat.unlocked.slice();

  // autosave
  saveT += dt;
  if (saveT > 12) { saveT = 0; saveGame(); }

  // camera + HUD
  cam.update(dt, player.x, player.z, player.heading, player.speed, !player.onFoot);
  updateHud(S, dt);
}

function endGame(kind, text) {
  screen = 'over';
  showOver(true, text);
  setEngine(0, false);
  document.getElementById('overScreen').querySelector('h1').textContent = kind;
}

function startGame() {
  initAudio(); resumeAudio();
  showTitle(false);
  showHud(true);
  screen = 'play';
  cam.snap(player.x, player.z, player.heading, !player.onFoot);
  if (!shot) runner.start();
  sfx('mission');
}

// ---------- screenshot staging ----------
function applyShot() {
  const p = shot;
  const m = MISSIONS[p.mission];
  S.money = p.money; S.rep = p.rep; S.wanted = p.wanted; S.heat = 60;
  S.clock = p.clock;
  runner.index = p.mission;
  runner.start();
  if (p.mission === 4) spawnGuards();
  // place player
  if (p.car) {
    const model = CAR_MODELS.find((c) => c.key === p.car);
    player.car = new PlayerCar(scene, model);
    player.car.place(p.carX, p.carZ, p.heading);
    player.car.speed = p.speed;
    player.car.condition = 82;
    player.onFoot = false;
    S.inCar = true; S.carName = model.name; S.stolen = true; S.condition = 82;
    playerMesh.visible = false;
    player.x = p.carX; player.z = p.carZ; player.heading = p.heading; player.speed = p.speed;
  } else {
    player.x = p.carX; player.z = p.carZ; player.heading = p.heading;
    player.onFoot = true;
    playerMesh.position.set(player.x, 0, player.z);
    playerMesh.rotation.y = player.heading;
    S.inCar = false;
  }
  S.px = player.x; S.pz = player.z; S.heading = player.heading;
  // police preset: cars behind the player, already pursuing
  for (let i = 0; i < p.police; i++) {
    const u = police.spawnUnit(player.x, player.z);
    const back = 12 + i * 9;
    const side = (i - 1) * 6;
    u.x = player.x - Math.sin(player.heading) * back + Math.cos(player.heading) * side;
    u.z = player.z - Math.cos(player.heading) * back - Math.sin(player.heading) * side;
    u.heading = player.heading;
    u.speed = p.speed * 0.92;
    u.status = i === 0 ? 'RAMMING' : 'PURSUIT';
    u.dist = Math.round(back);
  }
  if (p.heli) police.spawnHeli(player.x, player.z, player.heading);
  if (p.dialog) {
    const ch = CHARACTERS[p.dialog];
    showDialog(ch, m.lines);
  } else {
    hideDialog();
  }
  // settle the scene: run the world forward so chase spacing + camera look alive
  for (let i = 0; i < 150; i++) {
    traffic.update(STEP, player.x, player.z, S.wanted);
    peds.update(STEP, player.x, player.z, S.wanted);
    police.update(STEP, player.x, player.z, player.heading, S.wanted, player.speed);
  }
  cam.snap(player.x, player.z, player.heading, !player.onFoot);
  // one more camera settle pass
  for (let i = 0; i < 30; i++) cam.update(STEP, player.x, player.z, player.heading, player.speed, !player.onFoot);
  // dense traffic ahead for the chase shots (staged after the settle loop)
  if (shotName === 'cover' || shotName === 'drive') {
    traffic.cars.slice(0, 4).forEach((c, i) => {
      const d = 22 + i * 16;
      const side = (i % 2 === 0 ? -3 : 3);
      c.x = player.x + Math.sin(player.heading) * d + Math.cos(player.heading) * side;
      c.z = player.z + Math.cos(player.heading) * d - Math.sin(player.heading) * side;
      c.heading = player.heading;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
    });
  }
  // pedestrians crowded around the player for the walk shot
  if (shotName === 'walk') {
    const spots = [[-52, 52], [-68, 68], [-56, 72], [-66, 48], [-48, 64]];
    peds.peds.slice(0, 5).forEach((w, i) => {
      w.x = spots[i][0]; w.z = spots[i][1];
      w.mesh.position.set(w.x, 0, w.z);
    });
  }
  // helicopter into frame for the cover: lower + ahead, cone scaled to the street,
  // and lift the camera pitch so the sky (and the heli) enter the frame
  if (shotName === 'cover' && police.heli) {
    const h = police.heli;
    h.group.position.set(
      player.x + Math.sin(player.heading) * 38, 22,
      player.z + Math.cos(player.heading) * 38,
    );
    h.cone.scale.y = 0.4;
    h.cone.position.y = -11;
    camera.position.y += 2.5;
    camera.lookAt(
      player.x + Math.sin(player.heading) * 12, 6,
      player.z + Math.cos(player.heading) * 12,
    );
  }
  currentMissionState();
  S.responseRows = police.panelRows(player.x, player.z);
  S.trafficDots = traffic.cars.map((c) => ({ x: c.x, z: c.z }));
  S.policeDots = police.units.map((u) => ({ x: u.x, z: u.z }));
  S.heliDot = police.heli ? { x: police.heli.group.position.x, z: police.heli.group.position.z } : null;
  if (p.mission === 4) combat.select(1); else combat.select(0);
  S.weaponSlot = combat.slot; S.ammo = combat.ammo.slice(); S.unlocked = [true, true, true, false];
  S.speedKmh = Math.abs(p.speed) * 3.6;
  S.missionsDone = p.mission;
  setRadio(p.radio ?? 0);
  showHud(true);
  updateHud(S, 0);
}

// ---------- boot ----------
const saved = loadGame();
if (saved && !shot) {
  S.money = saved.money; S.rep = saved.rep; S.missionsDone = saved.missionsDone;
  S.hp = saved.hp; S.armor = saved.armor;
  runner.index = Math.min(saved.missionIndex || 0, MISSIONS.length - 1);
  setSaveNote('Save found: $' + saved.money + ' · ' + saved.missionsDone + '/6 jobs done · REP ' + saved.rep);
}

onStart(() => startGame());
onResume(() => { screen = 'play'; showPause(false); });
onRetry(() => {
  showOver(false);
  S.hp = 100; S.wanted = 0; S.heat = 0;
  player.x = -150; player.z = -30; player.heading = Math.PI / 2;
  if (player.car) { scene.remove(player.car.mesh); player.car = null; }
  player.onFoot = true; playerMesh.visible = true;
  playerMesh.position.set(player.x, 0, player.z);
  screen = 'play';
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') { screen = 'paused'; showPause(true); }
});

let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  if (screen === 'title') {
    // slow orbit behind the title screen
    const t = now / 1000;
    const cx = -150 + Math.sin(t * 0.05) * 30;
    camera.position.set(cx, 26, -60 + Math.cos(t * 0.05) * 30);
    camera.lookAt(-160, 4, 0);
    traffic.update(dt, 0, 0, 0);
    peds.update(dt, 0, 0, 0);
  } else if (screen === 'play' || screen === 'paused') {
    if (screen === 'play') {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 5) { update(STEP); acc -= STEP; n += 1; }
      if (n === 5) acc = 0;
    }
  }
  renderer.render(scene, camera);
}

if (shot) {
  screen = 'play';
  showTitle(false);
  applyShot();
  let painted = 0;
  const paint = () => {
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
} else {
  requestAnimationFrame(frame);
}
