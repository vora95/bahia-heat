// WebAudio synth: engine hum, sirens, gunshots, radio jingle, UI blips. No audio files.
let ctx = null, master = null, engineOsc = null, engineGain = null;
let muted = false, radioTimer = 0, radioStep = 0;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
  } catch (e) { ctx = null; }
}

export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
export function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; }

export function setEngine(rpm01, on) {
  if (!ctx || !engineOsc) return;
  const t = ctx.currentTime;
  engineOsc.frequency.setTargetAtTime(48 + rpm01 * 130, t, 0.08);
  engineGain.gain.setTargetAtTime(on ? 0.05 + rpm01 * 0.05 : 0, t, 0.1);
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol || 0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol, freq) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1800;
  const g = ctx.createGain(); g.gain.value = vol || 0.25;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}

export function sfx(name) {
  if (!ctx) return;
  if (name === 'shot') { noiseBurst(0.14, 0.35, 2400); blip(160, 0.1, 'square', 0.2, 60); }
  else if (name === 'punch') { noiseBurst(0.08, 0.3, 900); }
  else if (name === 'pickup') { blip(660, 0.09, 'sine', 0.15); setTimeout(() => blip(990, 0.12, 'sine', 0.15), 90); }
  else if (name === 'cash') { blip(880, 0.08, 'sine', 0.14); setTimeout(() => blip(1174, 0.1, 'sine', 0.14), 80); setTimeout(() => blip(1568, 0.16, 'sine', 0.14), 160); }
  else if (name === 'siren') { blip(720, 0.5, 'sine', 0.05, 980); }
  else if (name === 'alarm') { blip(520, 0.16, 'square', 0.08, 780); }
  else if (name === 'click') { blip(440, 0.05, 'sine', 0.1); }
  else if (name === 'crash') { noiseBurst(0.25, 0.4, 700); }
  else if (name === 'mission') { blip(523, 0.12, 'sine', 0.14); setTimeout(() => blip(659, 0.12, 'sine', 0.14), 110); setTimeout(() => blip(784, 0.2, 'sine', 0.14), 220); }
}

// Tiny synthwave radio loop: a repeating bass + sparkle arpeggio, scheduled per bar.
const BASS = [55, 55, 65.41, 49];
const ARP = [220, 261.63, 329.63, 440, 329.63, 261.63];
export function radioTick(dt, on) {
  if (!ctx || muted || !on) return;
  radioTimer += dt;
  if (radioTimer < 0.42) return;
  radioTimer = 0;
  const step = radioStep++;
  const bar = Math.floor(step / 8) % 4;
  blip(BASS[bar], 0.4, 'triangle', 0.05);
  if (step % 2 === 0) blip(ARP[step % ARP.length] * 2, 0.18, 'sine', 0.03);
}
