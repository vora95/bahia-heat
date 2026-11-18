// Six chained story jobs. Each job: giver with portrait dialog, objective with
// stage bar / timer / distance, reward cash + REP. All characters and places original.
import { CHARACTERS } from './config.js';

export const MISSIONS = [
  {
    id: 1, title: 'JOB 1/6 · A FAVOR FOR CARMEN', giver: 'carmen',
    brief: 'A package is waiting at the Playa Dorada pier. Pick it up — and do not open it.',
    lines: [
      'You look hungry, kid. Good. Hunger gets things done in Bahia.',
      'A package waits at the end of the Playa pier. Bring it to me. No questions, no peeking.',
    ],
    objective: 'Pick up the package at Playa Dorada pier',
    target: { x: -206, z: -60, r: 8 },
    reward: 1500, rep: 150,
  },
  {
    id: 2, title: 'JOB 2/6 · HARBOR RUN', giver: 'lucia',
    brief: 'Deliver the package to El Faro at the harbor before the tide turns. Ninety seconds.',
    lines: [
      'Carmen says you drive like the wind owes you money. Prove it.',
      'El Faro waits at Puerto Viejo harbor. Ninety seconds — the tide does not negotiate.',
    ],
    objective: 'Deliver the package to El Faro — Puerto Viejo harbor',
    target: { x: 40, z: -180, r: 9 },
    timer: 90, reward: 2500, rep: 200,
  },
  {
    id: 3, title: 'JOB 3/6 · THE MAREA GT', giver: 'faro',
    brief: 'A purple Marea Coupe is parked on Ocean Drive. It is mine now. Bring it to the garage.',
    lines: [
      'You did good, kid. The harbor remembers.',
      'A purple Marea Coupe sits on Ocean Drive, keys in the sun visor. Steal it. Bring it to my garage on Calle del Sol.',
    ],
    objective: 'Steal the Marea Coupe, then reach the garage',
    target: { x: -168, z: 60, r: 6 },
    target2: { x: -30, z: 30, r: 9 },
    needsCar: 'marea', reward: 4000, rep: 300,
  },
  {
    id: 4, title: 'JOB 4/6 · CATCH TOMÁS', giver: 'nina',
    brief: 'Tomás El Rápido is running with our money. Ram his car three times to stop him.',
    lines: [
      'Tomás took the job money and ran. Typical Tomás.',
      'He is circling Las Palmas in a green pickup. Ram him three times — gently, if you can.',
    ],
    objective: 'Ram Tomás’s pickup 3 times to stop him',
    target: { x: 60, z: 120, r: 10 },
    chase: true, rams: 3, reward: 5000, rep: 350,
  },
  {
    id: 5, title: 'JOB 5/6 · THE WAREHOUSE', giver: 'faro',
    brief: 'On foot: three guards watch the harbor warehouse crate. Deal with them, take the crate.',
    lines: [
      'The crate in warehouse 4 belongs to us again. Three of my old boys guard it — they will not move politely.',
      'Go on foot. Fists or iron, your choice. Bring the crate to the pier gate.',
    ],
    objective: 'Deal with 3 guards, take the crate to the pier gate',
    target: { x: 140, z: -150, r: 10 },
    target2: { x: -196, z: -60, r: 9 },
    guards: 3, onFoot: true, reward: 6500, rep: 450,
  },
  {
    id: 6, title: 'JOB 6/6 · FIVE-STAR ESCAPE', giver: 'anselmo',
    brief: 'The whole department is coming. Survive sixty seconds at five stars and reach Mirador Hills.',
    lines: [
      'My child, the city is awake and it is angry. Five stars, and every siren in Bahia.',
      'Survive one minute. Then come to the Mirador chapel — I will pray for your tires.',
    ],
    objective: 'Survive 60s at 5 stars, then reach Mirador chapel',
    target: { x: 170, z: 170, r: 12 },
    timer: 60, forceWanted: 5, reward: 9000, rep: 600,
  },
];

export class MissionRunner {
  constructor(onEvent) {
    this.onEvent = onEvent; // (type, payload)
    this.index = 0;
    this.stage = 0;         // 0 = go to target, 1 = go to target2 (if any)
    this.timer = 0;
    this.ramsDone = 0;
    this.guardsDown = 0;
    this.done = false;
    this.dialogShown = false;
  }
  get current() { return this.index < MISSIONS.length ? MISSIONS[this.index] : null; }
  get target() {
    const m = this.current;
    if (!m) return null;
    return this.stage === 0 ? m.target : (m.target2 || m.target);
  }
  start() {
    const m = this.current;
    if (!m) return;
    this.stage = 0; this.timer = m.timer || 0; this.ramsDone = 0; this.guardsDown = 0;
    this.dialogShown = true;
    this.onEvent('dialog', { char: CHARACTERS[m.giver], lines: m.lines });
    this.onEvent('mission', { title: m.title, brief: m.brief });
    if (m.forceWanted) this.onEvent('wanted', { wanted: m.forceWanted });
  }
  progress(px, pz) {
    // returns 0..1 for the stage bar
    const t = this.target;
    if (!t) return 1;
    const d = Math.hypot(px - t.x, pz - t.z);
    return Math.max(0, Math.min(1, 1 - d / 320));
  }
  update(dt, px, pz, inCar, carModel) {
    const m = this.current;
    if (!m || this.done) return;
    if (m.timer) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.onEvent('fail', { reason: 'Out of time — the job fell through.' });
        this.resetToStart();
        return;
      }
    }
    const t = this.target;
    if (!t) return;
    const d = Math.hypot(px - t.x, pz - t.z);
    if (d > t.r) return;
    // arrived at a stage target
    if (m.needsCar && this.stage === 0) {
      if (!inCar || carModel !== m.needsCar) {
        this.onEvent('hint', { text: 'You need the ' + m.needsCar.toUpperCase() + ' — steal it first!' });
        return;
      }
    }
    if (m.onFoot && this.stage === 0) {
      if (inCar) {
        this.onEvent('hint', { text: 'On foot for this one — park the car and walk in.' });
        return;
      }
      if (this.guardsDown < (m.guards || 0)) {
        this.onEvent('hint', { text: 'Guards left: ' + (m.guards - this.guardsDown) });
        return;
      }
    }
    if (m.chase && this.stage === 0) {
      if (this.ramsDone < (m.rams || 0)) return; // rams counted by main.js
    }
    if (m.target2 && this.stage === 0) {
      this.stage = 1;
      this.onEvent('stage', { text: 'Stage 2 — ' + (m.id === 3 ? 'now bring it to the garage' : 'now take it to the gate') });
      return;
    }
    this.complete();
  }
  complete() {
    const m = this.current;
    this.onEvent('complete', { money: m.reward, rep: m.rep, title: m.title });
    this.index += 1;
    if (this.index >= MISSIONS.length) {
      this.done = true;
      this.onEvent('allDone', {});
    } else {
      this.start();
    }
  }
  resetToStart() {
    const m = this.current;
    this.stage = 0; this.timer = m.timer || 0; this.ramsDone = 0; this.guardsDown = 0;
  }
}
