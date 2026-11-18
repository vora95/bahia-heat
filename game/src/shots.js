// Screenshot staging: deterministic scene setups per ?shot= value.
// The game is fully playable; these presets only choose starting conditions
// so each screenshot shows a different system at its best.
export function shotParams() {
  const q = new URLSearchParams(window.location.search);
  return q.get('shot') || 'play';
}

export const SHOTS = {
  // COVER: active police chase + heli + wanted 4 + mission 3 dialog open.
  cover: {
    seed: 7, mission: 1, wanted: 4, money: 18450, rep: 1960,
    car: 'brisa', carX: -150, carZ: -57, heading: Math.PI / 2, speed: 26,
    police: 3, heli: true, dialog: 'lucia', onFoot: false,
    clock: 'FRI 17:42', radio: 0,
  },
  // driving the coast road at sunset, traffic around, wanted 1.
  drive: {
    seed: 11, mission: 1, wanted: 1, money: 8450, rep: 640,
    car: 'marea', carX: -180, carZ: 60, heading: Math.PI, speed: 33,
    police: 1, heli: false, dialog: null, onFoot: false,
    clock: 'FRI 18:05', radio: 1,
  },
  // on-foot warehouse job: guards, crate, pistol out, wanted 2.
  mission: {
    seed: 21, mission: 4, wanted: 2, money: 12450, rep: 1320,
    car: null, carX: 120, carZ: -150, heading: Math.PI / 2, speed: 0,
    police: 1, heli: false, dialog: 'faro', onFoot: true,
    clock: 'FRI 19:12', radio: 2,
  },
  // on foot in the plaza at sunset, pedestrians, dialog with Carmen.
  walk: {
    seed: 31, mission: 0, wanted: 0, money: 2450, rep: 120,
    car: null, carX: -60, carZ: 60, heading: Math.PI, speed: 0,
    police: 0, heli: false, dialog: 'carmen', onFoot: true,
    clock: 'FRI 17:24', radio: 3,
  },
};
