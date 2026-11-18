// Bahia Heat — shared constants and data. All names, places and people are original.
export const WORLD = {
  half: 200,            // city extends -200..200 on x and z
  roadGap: 60,          // block size
  roadWidth: 12,
  beachX: -176,         // west of this is sand, then ocean
  oceanX: -196,
};

export const DISTRICTS = [
  { name: 'Playa Dorada', x0: -200, z0: -200, x1: -60, z1: -20 },
  { name: 'Coral Shore', x0: -200, z0: -20, x1: -60, z1: 200 },
  { name: 'Puerto Viejo', x0: -60, z0: -200, x1: 80, z1: -20 },
  { name: 'Las Palmas', x0: -60, z0: -20, x1: 80, z1: 200 },
  { name: 'Mirador Hills', x0: 80, z0: -200, x1: 200, z1: 200 },
];

export const STREETS = [
  'Ocean Drive', 'Palmera Boulevard', 'Calle del Sol', 'Harbor Lane',
  'Avenida Brisa', 'Coral Way', 'Mirador Avenue', 'Palm Court',
];

export const CAR_MODELS = [
  { key: 'brisa', name: 'Brisa GT', color: 0xd7263d, top: 41, accel: 16, seats: 2, price: 0 },
  { key: 'onda', name: 'Onda Sedan', color: 0x2f6fd0, top: 34, accel: 13, seats: 4, price: 0 },
  { key: 'tortuga', name: 'Tortuga Taxi', color: 0xf2b705, top: 32, accel: 12, seats: 4, price: 0 },
  { key: 'cangrejo', name: 'Cangrejo Pickup', color: 0x3d8b40, top: 35, accel: 13, seats: 3, price: 0 },
  { key: 'marea', name: 'Marea Coupe', color: 0x8e2fbf, top: 44, accel: 18, seats: 2, price: 0 },
];

export const WEAPONS = [
  { key: 'fists', name: 'Fists', ammo: Infinity, maxAmmo: Infinity, dmg: 20, rate: 0.35, range: 2.6 },
  { key: 'brisa9', name: 'Brisa 9mm', ammo: 12, maxAmmo: 12, dmg: 34, rate: 0.28, range: 55 },
  { key: 'onda', name: 'Onda SMG', ammo: 30, maxAmmo: 30, dmg: 22, rate: 0.09, range: 48 },
  { key: 'trueno', name: 'Trueno 12', ammo: 6, maxAmmo: 6, dmg: 90, rate: 0.8, range: 30 },
];

export const CHARACTERS = {
  carmen: { name: 'Doña Carmen', skin: '#c98d5f', hair: '#3a3a3a', style: 'bun', accent: '#d7263d', role: 'Fixer of Playa Dorada' },
  lucia: { name: 'Lucía Vega', skin: '#e8b88a', hair: '#1c1c22', style: 'long', accent: '#2f6fd0', role: 'Wheelwoman' },
  faro: { name: 'El Faro', skin: '#a9764f', hair: '#e8e8e8', style: 'beard', accent: '#f2b705', role: 'Harbor boss' },
  tomas: { name: 'Tomás El Rápido', skin: '#d9a06b', hair: '#101010', style: 'cap', accent: '#3d8b40', role: 'Rival driver' },
  nina: { name: 'Nina Costa', skin: '#f0c297', hair: '#6b2f1c', style: 'bob', accent: '#8e2fbf', role: 'Lookout' },
  anselmo: { name: 'Padre Anselmo', skin: '#c98d5f', hair: '#d8d8d8', style: 'bald', accent: '#e8e8e8', role: 'Mirador contact' },
};

export const RADIO = [
  { station: 'SOL FM 101.9', track: 'Sunset Synth — "Neon Tide"' },
  { station: 'CORAL 88.1', track: 'Palma Drive — "Midnight Surf"' },
  { station: 'BRISA BOSSA 96.4', track: 'Marina Luz — "Café del Mar"' },
  { station: 'WAVE 104', track: 'Tide Runner — "Golden Hour"' },
];

export const REP_RANKS = [
  { at: 0, name: 'ROOKIE' }, { at: 500, name: 'HUSTLER' }, { at: 1200, name: 'STREET KING' },
  { at: 2400, name: 'BAY LEGEND' }, { at: 4000, name: 'EL JEFE' },
];

export function repRank(rep) {
  let r = REP_RANKS[0];
  for (const x of REP_RANKS) if (rep >= x.at) r = x;
  const next = REP_RANKS.find((x) => x.at > rep);
  return { name: r.name, cur: rep - r.at, need: next ? next.at - r.at : 1 };
}

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  return 'Bahia';
}

export function streetAt(x, z) {
  const roads = [-180, -120, -60, 0, 60, 120, 180];
  let best = 0, bd = 1e9;
  for (const r of roads) { const d = Math.min(Math.abs(x - r), Math.abs(z - r)); if (d < bd) { bd = d; best = r; } }
  const idx = ((Math.round(best / 60) + 3) % STREETS.length + STREETS.length) % STREETS.length;
  return STREETS[idx];
}

export function fmtMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
