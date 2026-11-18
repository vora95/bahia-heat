// Combat: fists + three firearms, 4 weapon slots, ammo, reload, hitscan shots.
import * as THREE from './three-shim.js';
import { WEAPONS } from './config.js';
import { sfx } from './audio.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.slot = 0;
    this.ammo = WEAPONS.map((w) => w.ammo);
    this.unlocked = [true, true, false, false]; // SMG + shotgun unlock with REP
    this.cool = 0;
    this.tracer = null;
    this.tracerT = 0;
  }
  weapon() { return WEAPONS[this.slot]; }
  select(slot) {
    if (slot >= 0 && slot < WEAPONS.length && this.unlocked[slot]) {
      this.slot = slot;
      sfx('click');
      return true;
    }
    return false;
  }
  unlockCheck(rep) {
    if (rep >= 500) this.unlocked[2] = true;
    if (rep >= 1200) this.unlocked[3] = true;
  }
  reload() {
    const w = this.weapon();
    if (w.ammo === Infinity || this.ammo[this.slot] === w.maxAmmo) return;
    this.ammo[this.slot] = w.maxAmmo;
    sfx('click');
  }
  // Hitscan attack from (x,z) facing heading. targets: [{x,z,hp,alive,kind,ref}]
  // Returns {hit, target, kind} or null.
  attack(x, z, heading, targets) {
    if (this.cool > 0) return null;
    const w = this.weapon();
    this.cool = w.rate;
    if (w.key === 'fists') {
      sfx('punch');
      let best = null, bd = w.range * w.range;
      for (const t of targets) {
        if (!t.alive) continue;
        const d2 = (t.x - x) ** 2 + (t.z - z) ** 2;
        if (d2 < bd) { bd = d2; best = t; }
      }
      if (best) return { hit: true, target: best, kind: best.kind, dmg: w.dmg };
      return { hit: false };
    }
    if (this.ammo[this.slot] <= 0) { sfx('click'); return { hit: false, dry: true }; }
    this.ammo[this.slot] -= 1;
    sfx('shot');
    const dirX = Math.sin(heading), dirZ = Math.cos(heading);
    let best = null, bd = w.range * w.range;
    for (const t of targets) {
      if (!t.alive) continue;
      const dx = t.x - x, dz = t.z - z;
      const along = dx * dirX + dz * dirZ;
      if (along < 0 || along > w.range) continue;
      const perp = Math.abs(dx * dirZ - dz * dirX);
      if (perp > 2.2) continue;
      const d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = t; }
    }
    // tracer line
    const endD = best ? Math.sqrt(bd) : w.range;
    this.showTracer(x, z, heading, endD);
    if (best) return { hit: true, target: best, kind: best.kind, dmg: w.dmg };
    return { hit: false };
  }
  showTracer(x, z, heading, len) {
    this.clearTracer();
    const g = new THREE.BufferGeometry();
    const y = 1.4;
    const pts = [
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(x + Math.sin(heading) * len, y, z + Math.cos(heading) * len),
    ];
    g.setFromPoints(pts);
    this.tracer = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe95c }));
    this.scene.add(this.tracer);
    this.tracerT = 0.09;
  }
  clearTracer() {
    if (this.tracer) { this.scene.remove(this.tracer); this.tracer.geometry.dispose(); this.tracer = null; }
  }
  update(dt) {
    if (this.cool > 0) this.cool -= dt;
    if (this.tracerT > 0) {
      this.tracerT -= dt;
      if (this.tracerT <= 0) this.clearTracer();
    }
  }
}
