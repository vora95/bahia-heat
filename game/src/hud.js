// HUD: DOM panels, 2D minimap, canvas-drawn character portraits, dialog box.
import { fmtMoney, repRank, districtAt, streetAt, RADIO, WEAPONS } from './config.js';

const $ = (id) => document.getElementById(id);
const els = {};
let minimapCtx = null, portraitCtx = null;
let dialogQueue = [];
let dialogOpen = false;
let radioIdx = 0, radioT = 0;

export function setRadio(i) { radioIdx = i % RADIO.length; radioT = 0; }
export function initHud() {
  for (const id of ['hud', 'money', 'repName', 'repFill', 'repText', 'hpVal', 'arVal', 'misVal',
    'objTitle', 'objFill', 'objDist', 'objTimer', 'objStep', 'stars', 'clock', 'location',
    'respList', 'speedNum', 'carName', 'carCond', 'weapons', 'dialog', 'portrait', 'dlgName',
    'dlgText', 'toast', 'radioStation', 'radioTrack', 'titleScreen', 'pauseScreen',
    'overScreen', 'overText', 'saveNote', 'startBtn', 'resumeBtn', 'retryBtn']) {
    els[id] = $(id);
  }
  minimapCtx = $('minimap').getContext('2d');
  portraitCtx = $('portrait').getContext('2d');
  buildWeaponSlots();
}

function buildWeaponSlots() {
  els.weapons.innerHTML = '';
  WEAPONS.forEach((w, i) => {
    const d = document.createElement('div');
    d.className = 'slot' + (i === 0 ? ' active' : '');
    d.id = 'slot' + i;
    d.innerHTML = '<div class="w-name">' + (i + 1) + ' · ' + w.name + '</div><div class="w-ammo" id="ammo' + i + '">—</div>';
    els.weapons.appendChild(d);
  });
}

export function showHud(v) { els.hud.classList.toggle('hidden', !v); }
export function showTitle(v) { els.titleScreen.classList.toggle('hidden', !v); }
export function showPause(v) { els.pauseScreen.classList.toggle('hidden', !v); }
export function showOver(v, text) {
  els.overScreen.classList.toggle('hidden', !v);
  if (text) els.overText.textContent = text;
}
export function setSaveNote(t) { els.saveNote.textContent = t; }
export function onStart(cb) { els.startBtn.addEventListener('click', cb); }
export function onResume(cb) { els.resumeBtn.addEventListener('click', cb); }
export function onRetry(cb) { els.retryBtn.addEventListener('click', cb); }

let toastT = null;
export function toast(msg) {
  els.toast.textContent = msg;
  els.toast.style.display = 'block';
  if (toastT) clearTimeout(toastT);
  toastT = setTimeout(() => { els.toast.style.display = 'none'; }, 2200);
}

// --- portraits: stylized faces drawn on a 2D canvas, one per character ---
export function drawPortrait(char) {
  const g = portraitCtx;
  const W = 76, H = 76;
  g.clearRect(0, 0, W, H);
  g.fillStyle = char.accent;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#2a1430';
  g.fillRect(0, 56, W, 20);
  // shoulders / outfit
  g.fillStyle = '#1c1c26';
  g.beginPath(); g.moveTo(8, 76); g.quadraticCurveTo(38, 46, 68, 76); g.closePath(); g.fill();
  g.fillStyle = char.accent;
  g.fillRect(30, 58, 16, 18);
  // face
  g.fillStyle = char.skin;
  g.beginPath(); g.ellipse(38, 36, 17, 20, 0, 0, Math.PI * 2); g.fill();
  // hair / headwear
  g.fillStyle = char.hair;
  if (char.style === 'bun') {
    g.beginPath(); g.ellipse(38, 20, 16, 9, 0, Math.PI, 0); g.fill();
    g.beginPath(); g.arc(38, 12, 6, 0, Math.PI * 2); g.fill();
  } else if (char.style === 'long') {
    g.beginPath(); g.ellipse(38, 30, 19, 22, 0, Math.PI, 0); g.fill();
    g.fillRect(19, 30, 5, 24); g.fillRect(52, 30, 5, 24);
  } else if (char.style === 'beard') {
    g.beginPath(); g.ellipse(38, 18, 16, 8, 0, Math.PI, 0); g.fill();
    g.beginPath(); g.ellipse(38, 50, 14, 10, 0, 0, Math.PI); g.fill();
  } else if (char.style === 'cap') {
    g.beginPath(); g.ellipse(38, 22, 17, 9, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#3d8b40';
    g.fillRect(20, 20, 36, 5);
  } else if (char.style === 'bob') {
    g.beginPath(); g.ellipse(38, 30, 19, 20, 0, Math.PI, 0); g.fill();
    g.fillRect(19, 28, 6, 16); g.fillRect(51, 28, 6, 16);
  } else { // bald
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.beginPath(); g.ellipse(38, 34, 17, 20, 0, 0, Math.PI * 2); g.fill();
  }
  // eyes + brows + mouth
  g.fillStyle = '#14141c';
  g.beginPath(); g.arc(31, 36, 2.2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(45, 36, 2.2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#14141c'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(28, 30); g.lineTo(34, 29); g.moveTo(42, 29); g.lineTo(48, 30); g.stroke();
  g.strokeStyle = '#7a3a2a'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(32, 48); g.quadraticCurveTo(38, 52, 44, 48); g.stroke();
}

// --- dialog ---
export function showDialog(char, lines) {
  dialogQueue = lines.slice();
  drawPortrait(char);
  els.dlgName.textContent = char.name + ' — ' + char.role;
  els.dialog.classList.add('show');
  dialogOpen = true;
  advanceDialog();
}
export function advanceDialog() {
  if (!dialogOpen) return false;
  const line = dialogQueue.shift();
  if (line === undefined) {
    els.dialog.classList.remove('show');
    dialogOpen = false;
    return false;
  }
  els.dlgText.textContent = '“' + line + '”';
  return true;
}
export function isDialogOpen() { return dialogOpen; }
export function hideDialog() {
  els.dialog.classList.remove('show');
  dialogOpen = false;
}

// --- per-frame HUD update ---
export function updateHud(S, dt) {
  els.money.textContent = fmtMoney(S.money);
  const rep = repRank(S.rep);
  els.repName.textContent = rep.name;
  els.repFill.style.width = Math.round((rep.cur / rep.need) * 100) + '%';
  els.repText.textContent = rep.cur + '/' + rep.need + ' REP';
  els.hpVal.textContent = Math.round(S.hp);
  els.arVal.textContent = Math.round(S.armor);
  els.misVal.textContent = S.missionsDone + '/6';
  // objective
  if (S.mission) {
    els.objTitle.textContent = S.mission.title;
    els.objFill.style.width = Math.round(S.missionProgress * 100) + '%';
    els.objDist.textContent = S.missionDist != null ? Math.round(S.missionDist) + ' m' : '—';
    els.objTimer.textContent = S.missionTimer != null ? '⏱ ' + Math.ceil(S.missionTimer) + 's' : '';
    els.objStep.textContent = S.missionStep;
  } else {
    els.objTitle.textContent = S.allDone ? 'ALL JOBS DONE — Bahia is yours' : 'Free roam — Bahia is yours';
    els.objFill.style.width = S.allDone ? '100%' : '0%';
    els.objDist.textContent = '—';
    els.objTimer.textContent = '';
    els.objStep.textContent = S.allDone ? '6/6' : '0/6';
  }
  // wanted stars
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < S.wanted ? '★' : '<span class="off">★</span>';
  els.stars.innerHTML = stars;
  els.clock.textContent = S.clock;
  els.location.textContent = districtAt(S.px, S.pz) + ' · ' + streetAt(S.px, S.pz);
  // response panel
  if (S.responseRows.length === 0) {
    els.respList.innerHTML = '<div class="unit"><span class="u-name">—</span><span class="u-dist">NO UNITS</span></div>';
  } else {
    els.respList.innerHTML = S.responseRows.map((r) => {
      const cls = r.status === 'PURSUIT' ? 'st-pursuit' : r.status === 'RAMMING' ? 'st-ram'
        : r.status === 'ROADBLOCK' ? 'st-road' : r.status === 'SEARCHLIGHT' ? 'st-search' : 'st-enroute';
      return '<div class="unit"><span class="u-name">' + r.name + '</span><span class="u-dist">' + r.dist + '</span><span class="u-stat ' + cls + '">' + r.status + '</span></div>';
    }).join('');
  }
  // speed
  els.speedNum.textContent = Math.round(Math.abs(S.speedKmh));
  els.carName.textContent = S.inCar ? S.carName : 'ON FOOT';
  els.carCond.textContent = S.inCar ? 'CONDITION ' + Math.round(S.condition) + '% · ' + (S.stolen ? 'STOLEN' : 'YOURS') : 'WASD to walk · E to enter a car';
  // weapons
  for (let i = 0; i < WEAPONS.length; i++) {
    const slot = $('slot' + i);
    const ammo = $('ammo' + i);
    if (!slot || !ammo) continue;
    slot.classList.toggle('active', S.weaponSlot === i);
    slot.classList.toggle('locked', !S.unlocked[i]);
    ammo.textContent = WEAPONS[i].ammo === Infinity ? '∞' : (S.ammo[i] + ' / ' + WEAPONS[i].maxAmmo);
  }
  // radio
  radioT += dt;
  if (radioT > 45) { radioT = 0; radioIdx = (radioIdx + 1) % RADIO.length; }
  els.radioStation.textContent = '♪ ' + RADIO[radioIdx].station;
  els.radioTrack.textContent = RADIO[radioIdx].track;
  // minimap
  drawMinimap(S);
}

function drawMinimap(S) {
  const g = minimapCtx, W = 180, H = 180;
  const sc = W / 440;
  const toX = (x) => (x + 220) * sc;
  const toZ = (z) => (z + 220) * sc;
  g.fillStyle = '#241a2e';
  g.fillRect(0, 0, W, H);
  // ocean + sand (west edge)
  g.fillStyle = '#14506e';
  g.fillRect(0, 0, toX(-196), H);
  g.fillStyle = '#d9a86c';
  g.fillRect(toX(-196), 0, toX(-176) - toX(-196), H);
  // roads
  g.strokeStyle = '#5a4a5a';
  g.lineWidth = 5;
  for (const r of [-180, -120, -60, 0, 60, 120, 180]) {
    g.beginPath(); g.moveTo(toX(r), 0); g.lineTo(toX(r), H); g.stroke();
    g.beginPath(); g.moveTo(0, toZ(r)); g.lineTo(W, toZ(r)); g.stroke();
  }
  // mission marker
  if (S.missionTarget) {
    g.fillStyle = '#ffd23e';
    g.beginPath(); g.arc(toX(S.missionTarget.x), toZ(S.missionTarget.z), 6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd23e'; g.lineWidth = 2;
    g.beginPath(); g.arc(toX(S.missionTarget.x), toZ(S.missionTarget.z), 10, 0, Math.PI * 2); g.stroke();
  }
  // traffic (grey)
  g.fillStyle = '#9aa2b0';
  for (const t of S.trafficDots) g.fillRect(toX(t.x) - 1.5, toZ(t.z) - 1.5, 3, 3);
  // police (red)
  g.fillStyle = '#ff3b30';
  for (const t of S.policeDots) {
    g.beginPath(); g.arc(toX(t.x), toZ(t.z), 3.5, 0, Math.PI * 2); g.fill();
  }
  // helicopter (white)
  if (S.heliDot) {
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(toX(S.heliDot.x), toZ(S.heliDot.z), 4, 0, Math.PI * 2); g.fill();
  }
  // player arrow
  const px = toX(S.px), pz = toZ(S.pz);
  g.save();
  g.translate(px, pz);
  g.rotate(Math.atan2(Math.sin(S.heading), Math.cos(S.heading)) * -1 + Math.PI);
  g.fillStyle = '#7dff8a';
  g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
  g.restore();
}
