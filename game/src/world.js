// Puerto Luna — the island itself: a seeded city of roads, blocks and
// landmarks, plus the fresh game state that lives on it.

import { CFG, PALETTE } from './config.js';
import { makeRng } from './random.js';

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Push a circle out of an axis-aligned rectangle. Returns true when a hit
// happened and the circle was moved.
export function pushOutOfRect(px, py, r, rect) {
  const nx = clamp(px, rect.x, rect.x + rect.w);
  const ny = clamp(py, rect.y, rect.y + rect.h);
  const dx = px - nx;
  const dy = py - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return { x: nx + (dx / d) * r, y: ny + (dy / d) * r };
  }
  // Centre inside the rectangle: shove out along the smallest penetration.
  const left = px - rect.x;
  const right = rect.x + rect.w - px;
  const top = py - rect.y;
  const bottom = rect.y + rect.h - py;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: rect.x - r, y: py };
  if (m === right) return { x: rect.x + rect.w + r, y: py };
  if (m === top) return { x: px, y: rect.y - r };
  return { x: px, y: rect.y + rect.h + r };
}

// Build the island from a fixed seed: the same city on every load, so the
// screenshots and the playtests always show the same Puerto Luna.
export function genCity(seed) {
  const rng = makeRng(seed);
  const roadsV = [];
  const roadsH = [];
  for (let x = 300; x <= CFG.WORLD_W - 300; x += CFG.ROAD_GAP) roadsV.push(x);
  for (let y = 300; y <= CFG.WORLD_H - 300; y += CFG.ROAD_GAP) roadsH.push(y);

  const buildings = [];
  const parks = [];
  const palms = [];
  for (let i = 0; i < roadsV.length - 1; i++) {
    for (let j = 0; j < roadsH.length - 1; j++) {
      const bx = roadsV[i] + CFG.ROAD_W / 2 + 24;
      const by = roadsH[j] + CFG.ROAD_W / 2 + 24;
      const bw = roadsV[i + 1] - roadsV[i] - CFG.ROAD_W - 48;
      const bh = roadsH[j + 1] - roadsH[j] - CFG.ROAD_W - 48;
      if (rng.chance(0.22)) {
        parks.push({ x: bx, y: by, w: bw, h: bh });
        const trees = rng.int(3, 7);
        for (let t = 0; t < trees; t++) {
          palms.push({
            x: rng.range(bx + 20, bx + bw - 20),
            y: rng.range(by + 20, by + bh - 20),
          });
        }
        continue;
      }
      const count = rng.int(1, 3);
      for (let k = 0; k < count; k++) {
        const w = rng.range(90, Math.max(100, bw - 30));
        const h = rng.range(80, Math.max(90, bh - 30));
        const x = rng.range(bx, bx + bw - w);
        const y = rng.range(by, by + bh - h);
        buildings.push({
          x,
          y,
          w,
          h,
          roof: rng.pick(PALETTE.buildingRoofs),
          floors: rng.int(1, 4),
        });
      }
    }
  }
  // Palms along the sand ring.
  for (let i = 0; i < 46; i++) {
    const side = rng.int(0, 3);
    if (side === 0) palms.push({ x: rng.range(60, CFG.WORLD_W - 60), y: rng.range(50, 110) });
    else if (side === 1) palms.push({ x: rng.range(60, CFG.WORLD_W - 60), y: rng.range(CFG.WORLD_H - 110, CFG.WORLD_H - 50) });
    else if (side === 2) palms.push({ x: rng.range(50, 110), y: rng.range(60, CFG.WORLD_H - 60) });
    else palms.push({ x: rng.range(CFG.WORLD_W - 110, CFG.WORLD_W - 50), y: rng.range(60, CFG.WORLD_H - 60) });
  }

  // Named places the missions point at. All sit on or beside a road.
  const landmarks = {
    garage: { x: 700, y: 760 },
    plaza: { x: 1500, y: 640 },
    plazaCar: { x: 1540, y: 700 },
    dock: { x: 360, y: 1900 },
    market: { x: 2700, y: 1560 },
    bank: { x: 1900, y: 1160 },
    marina: { x: 2900, y: 360 },
    drop: { x: 700, y: 1960 },
    ferry: { x: 2700, y: 1960 },
    coastA: { x: 500, y: 300 },
    coastB: { x: 1300, y: 300 },
    coastC: { x: 2100, y: 300 },
    coastD: { x: 2900, y: 300 },
    hideoutA: { x: 1500, y: 1500 },
    hideoutB: { x: 2300, y: 700 },
  };

  return { roadsV, roadsH, buildings, parks, palms, landmarks, rng };
}

export function onRoad(city, x, y) {
  const half = CFG.ROAD_W / 2;
  for (const rx of city.roadsV) if (Math.abs(x - rx) <= half) return true;
  for (const ry of city.roadsH) if (Math.abs(y - ry) <= half) return true;
  return false;
}

// Snap a point to the nearest road centreline (used for traffic and fares).
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of city.roadsV) {
    const d = Math.abs(x - rx);
    if (d < bestD) {
      bestD = d;
      best = { x: rx, y };
    }
  }
  for (const ry of city.roadsH) {
    const d = Math.abs(y - ry);
    if (d < bestD) {
      bestD = d;
      best = { x, y: ry };
    }
  }
  return best;
}

export function resolveLandmark(city, target) {
  if (target.landmark) {
    const p = city.landmarks[target.landmark];
    return { x: p.x, y: p.y };
  }
  return { x: target.x, y: target.y };
}

// A brand-new run: the player, the traffic, the pedestrians and the mission.
export function createGame(city) {
  const rng = makeRng(CFG.SEED + 7);
  const g = city.landmarks.garage;

  const cars = [];
  for (let i = 0; i < 14; i++) {
    const vertical = rng.chance(0.5);
    const road = vertical
      ? rng.pick(city.roadsV)
      : rng.pick(city.roadsH);
    cars.push({
      kind: 'traffic',
      x: vertical ? road : rng.range(200, CFG.WORLD_W - 200),
      y: vertical ? rng.range(200, CFG.WORLD_H - 200) : road,
      angle: vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
      speed: rng.range(CFG.TRAFFIC_MIN, CFG.TRAFFIC_MAX),
      color: rng.pick(PALETTE.carColors),
      axis: vertical ? 'v' : 'h',
      dir: rng.chance(0.5) ? 1 : -1,
      hp: 100,
      lastTurn: 0,
    });
  }
  // Parked cars, including the red sedan mission 1 wants stolen.
  const parked = [
    { x: 1540, y: 700, color: '#d94f3d', target: true },
    { x: 660, y: 800, color: '#3d7ad9' },
    { x: 1140, y: 1140, color: '#e8c53a' },
    { x: 2340, y: 1140, color: '#5b8c5a' },
    { x: 1940, y: 1560, color: '#e8e8e8' },
    { x: 2740, y: 760, color: '#8a5fb0' },
  ];
  for (const p of parked) {
    cars.push({
      kind: p.target ? 'target' : 'parked',
      x: p.x,
      y: p.y,
      angle: rng.range(0, Math.PI * 2),
      speed: 0,
      color: p.color,
      axis: 'h',
      dir: 1,
      hp: 100,
      lastTurn: 0,
    });
  }

  const peds = [];
  for (let i = 0; i < 22; i++) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(city.roadsV) : rng.pick(city.roadsH);
    const px = vertical ? road + (rng.chance(0.5) ? 58 : -58) : rng.range(200, CFG.WORLD_W - 200);
    const py = vertical ? rng.range(200, CFG.WORLD_H - 200) : road + (rng.chance(0.5) ? 58 : -58);
    peds.push({
      x: clamp(px, 160, CFG.WORLD_W - 160),
      y: clamp(py, 160, CFG.WORLD_H - 160),
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(CFG.PED_MIN, CFG.PED_MAX),
      color: rng.pick(['#e8e8e8', '#d9a05b', '#7fa8c9', '#c96f4a', '#8a9a5b', '#b06a8a']),
      waiting: false,
      flee: 0,
      tx: 0,
      ty: 0,
    });
  }
  for (const p of peds) {
    const t = nearestRoadPoint(city, p.x + rng.range(-300, 300), p.y + rng.range(-300, 300));
    p.tx = t.x;
    p.ty = t.y;
  }

  return {
    city,
    mode: 'title',
    time: 0,
    cash: CFG.START_CASH,
    health: 100,
    heat: 0,
    wanted: 0,
    player: {
      x: g.x,
      y: g.y + 60,
      angle: -Math.PI / 2,
      speed: 0,
      onFoot: true,
      car: null,
      hp: 100,
    },
    cars,
    peds,
    police: [],
    roadblocks: [],
    particles: [],
    floaters: [],
    missionIdx: 0,
    stepIdx: 0,
    step: { t: 0, progress: 0, cp: 0, done: false },
    missionTimer: null,
    fare: null,
    fareCooldown: 0,
    banner: null,
    message: null,
    camera: { x: g.x, y: g.y, zoom: 0.9 },
    hasGun: false,
    muted: false,
    shotMode: null,
    stats: { shots: 0, faresDone: 0, missionsDone: 0, stolen: 0 },
    over: null,
  };
}

// Serialize the progress worth keeping between sessions.
export function saveGame(state) {
  try {
    localStorage.setItem(
      CFG.SAVE_KEY,
      JSON.stringify({ cash: state.cash, missionIdx: state.missionIdx }),
    );
  } catch {
    // Private mode or no storage: the run just does not persist.
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(CFG.SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIdx !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}
