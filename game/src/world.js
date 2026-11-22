// World state for Puerto Luna: the city, its traffic, pedestrians, police,
// the player, and the story missions. Everything the game simulates lives
// here; rendering lives in render.js.
import { TILE, WORLD, ROADS_X, ROADS_Y, ROAD_HALF, DISTRICTS, PLACES, CAR_COLORS, CAR_NAMES, PALETTE, HOLDOUT_STARS, HOLDOUT_SECONDS, POLICE_RAM_DPS } from './config.js';
import { makeRng, pick, range, rangeInt } from './random.js';
import { updateRoadblocks, hideoutFactor } from './wanted.js';
import { setupFares, updateFares } from './fares.js';

export const STEP = 1 / 60;

export const MISSIONS = [
  {
    id: 'first-wheels', title: 'First Wheels', giver: 'Mama Luz',
    brief: 'Steal a car and bring it to the cantina. In Puerto Luna, nobody walks to a meeting.',
    steps: [
      { kind: 'steal', text: 'Steal any car (walk up to it and press E)' },
      { kind: 'goto', at: 'mamas', text: "Drive to Mama Luz's Cantina" },
    ],
    reward: 150,
  },
  {
    id: 'package-run', title: 'Package Run', giver: 'Mama Luz',
    brief: 'A package is waiting at the marina. Pick it up and deliver it to the garage — fast.',
    steps: [
      { kind: 'goto', at: 'marina', text: 'Pick up the package at the Marina Yacht Club' },
      { kind: 'deliver', at: 'garage', time: 75, text: 'Deliver the package to the garage (75s)' },
    ],
    reward: 300,
  },
  {
    id: 'lose-the-heat', title: 'Lose the Heat', giver: 'El Faro',
    brief: 'The Luna PD is watching. Get their attention, then disappear.',
    steps: [
      { kind: 'heat', stars: 2, text: 'Raise your wanted level to 2 stars' },
      { kind: 'cool', text: 'Lose the cops — get back to 0 stars' },
    ],
    reward: 250,
  },
  {
    id: 'hot-wheels', title: 'Hot Wheels', giver: 'Rico',
    brief: 'A street race across the island. Four checkpoints, one winner, no rules.',
    steps: [
      { kind: 'race', points: ['marina', 'bank', 'beach', 'lighthouse'], time: 150, text: 'Race through 4 checkpoints (150s)' },
    ],
    reward: 500,
  },
  {
    id: 'bank-job', title: 'Bank Job', giver: 'Mama Luz',
    brief: 'Banco del Sol keeps its cash in the back. Take it, and be ready to run.',
    steps: [
      { kind: 'goto', at: 'bank', text: 'Reach Banco del Sol' },
      { kind: 'grab', text: 'Grab the cash (stay in the marker 3s)' },
      { kind: 'escape', at: 'garage', text: 'Escape to the garage with the cash' },
    ],
    reward: 1200,
  },
  {
    id: 'the-big-score', title: 'The Big Score', giver: 'Mama Luz',
    brief: 'One last job: deliver the score to the yacht at the marina. The whole island will be watching.',
    steps: [
      { kind: 'goto', at: 'beach', text: 'Meet the crew at Playa del Faro' },
      { kind: 'deliver', at: 'marina', time: 100, text: 'Deliver the score to the yacht (100s)' },
    ],
    reward: 2500,
  },
  {
    id: 'last-ferry', title: 'The Last Ferry', giver: 'Mama Luz',
    brief: 'The crew leaves on the last ferry tonight — but the Luna PD has the terminal surrounded. Hold it, then run.',
    steps: [
      { kind: 'goto', at: 'ferry', text: 'Reach the Ferry Terminal' },
      { kind: 'holdout', at: 'ferry', stars: HOLDOUT_STARS, holdFor: HOLDOUT_SECONDS, text: 'Hold the terminal at 3+ stars for 18s' },
      { kind: 'escape', at: 'mamas', text: "Escape to Mama Luz's Cantina" },
    ],
    reward: 3500,
  },
];

function roadX(i) { return ROADS_X[i] * TILE; }
function roadY(i) { return ROADS_Y[i] * TILE; }

export function nearestRoad(x, y) {
  let best = null;
  let bd = 1e9;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx * TILE);
    if (d < bd) { bd = d; best = { axis: 'v', at: rx * TILE, d }; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry * TILE);
    if (d < bd) { bd = d; best = { axis: 'h', at: ry * TILE, d }; }
  }
  return best;
}

export function onRoad(x, y) {
  return nearestRoad(x, y).d < ROAD_HALF;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 * TILE && x < d.x1 * TILE && y >= d.y0 * TILE && y < d.y1 * TILE) return d;
  }
  return DISTRICTS[2];
}

function makeBuildings(rng) {
  const list = [];
  // Buildings fill the blocks between roads (blocks are 12 tiles wide).
  for (let bx = 0; bx < 5; bx += 1) {
    for (let by = 0; by < 5; by += 1) {
      const x0 = (ROADS_X[bx] + 2) * TILE;
      const y0 = (ROADS_Y[by] + 2) * TILE;
      const w = 10 * TILE;
      const h = 10 * TILE;
      if (by === 4 && bx < 3) continue; // beachfront stays open
      const n = rangeInt(rng, 1, 3);
      for (let i = 0; i < n; i += 1) {
        const bw = range(rng, 2.2, 4.2) * TILE;
        const bh = range(rng, 2.2, 4.2) * TILE;
        const x = x0 + range(rng, 0, Math.max(0.5, w - bw));
        const y = y0 + range(rng, 0, Math.max(0.5, h - bh));
        const downtown = bx >= 3 && by >= 1 && by <= 2;
        list.push({
          x, y, w: bw, h: bh,
          tall: downtown && rng() < 0.6,
          hue: pick(rng, ['#c9a06a', '#b08968', '#a87f5f', '#d9b48a', '#8fa3b8', '#c98a7a']),
          roof: pick(rng, ['#7a5c42', '#5c6e7a', '#8a6a4a']),
        });
      }
    }
  }
  return list;
}

function makeTrees(rng) {
  const list = [];
  for (let i = 0; i < 90; i += 1) {
    const x = range(rng, TILE, WORLD - TILE);
    const y = range(rng, TILE, WORLD - TILE);
    if (onRoad(x, y)) continue;
    if (y > 58 * TILE) continue; // beach has palms of its own
    list.push({ x, y, r: range(rng, 10, 16) });
  }
  for (let i = 0; i < 24; i += 1) {
    list.push({ x: range(rng, 2, 62) * TILE, y: range(rng, 58.5, 60) * TILE, r: 14, palm: true });
  }
  return list;
}

export function makeCar(rng, x, y, angle, opts = {}) {
  return {
    x, y, angle, speed: 0,
    color: opts.color || pick(rng, CAR_COLORS),
    name: opts.name || pick(rng, CAR_NAMES),
    police: !!opts.police,
    player: !!opts.player,
    ai: opts.ai !== false,
    hp: 100,
    target: null,
    stuck: 0,
    smoke: 0,
  };
}

function spawnTrafficCar(rng, world) {
  // On a random road, heading along it.
  const vertical = rng() < 0.5;
  const road = pick(rng, vertical ? ROADS_X : ROADS_Y) * TILE;
  const along = range(rng, 2, 62) * TILE;
  const dir = rng() < 0.5 ? 0 : Math.PI;
  const lane = (rng() < 0.5 ? -1 : 1) * TILE * 0.45;
  const car = makeCar(rng, vertical ? road + lane : along, vertical ? along : road + lane, vertical ? (dir === 0 ? Math.PI / 2 : -Math.PI / 2) : dir);
  car.speed = range(rng, 60, 110);
  return car;
}

function makePed(rng) {
  const vertical = rng() < 0.5;
  const road = pick(rng, vertical ? ROADS_X : ROADS_Y) * TILE;
  const along = range(rng, 2, 62) * TILE;
  const side = (rng() < 0.5 ? -1 : 1) * (ROAD_HALF + 14);
  return {
    x: vertical ? road + side : along,
    y: vertical ? along : road + side,
    angle: rng() * Math.PI * 2,
    speed: range(rng, 22, 42),
    color: pick(rng, ['#e8e8e8', '#d94f3d', '#3d7dd9', '#e8c832', '#7dd93d', '#222831']),
    panic: 0,
    walkPhase: rng() * 6,
  };
}

export function createWorld(seed = 1) {
  const rng = makeRng(seed);
  const world = {
    seed,
    rng,
    time: 0,
    buildings: makeBuildings(rng),
    trees: makeTrees(rng),
    cars: [],
    peds: [],
    police: [],
    player: {
      x: 32 * TILE, y: 24 * TILE, angle: -Math.PI / 2,
      onFoot: true, car: null,
      hp: 100, cash: 120, wanted: 0, heat: 0,
      gun: false, ammo: 0, firing: 0,
      busted: 0, bustedTimer: 0, wasted: false,
      speed: 0,
    },
    missionIndex: 0,
    mission: null,
    missionStep: 0,
    missionTimer: 0,
    missionDone: [],
    banner: null,
    bannerT: 0,
    save: null,
    stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0, copsLost: 0, spikesHit: 0 },
    muted: false,
    roadblocks: [],
    roadblockT: 0,
    holdoutT: null,
  };
  setupFares(world);
  for (let i = 0; i < 14; i += 1) world.cars.push(spawnTrafficCar(rng, world));
  for (let i = 0; i < 26; i += 1) world.peds.push(makePed(rng));
  startMission(world, 0);
  return world;
}

export function startMission(world, index) {
  world.missionIndex = index;
  world.mission = MISSIONS[index] || null;
  world.missionStep = 0;
  world.missionTimer = 0;
  world.holdoutT = null;
  if (world.mission) {
    const step = world.mission.steps[0];
    if (step.time) world.missionTimer = step.time;
    if (step.kind === 'race') world.racePoint = 0;
  }
}

export function missionStep(world) {
  return world.mission ? world.mission.steps[world.missionStep] : null;
}

export function missionTarget(world) {
  const step = missionStep(world);
  if (!step) return null;
  if (step.at) return PLACES[step.at];
  if (step.kind === 'race') return PLACES[step.points[world.racePoint || 0]];
  return null;
}

export function showBanner(world, title, sub) {
  world.banner = { title, sub };
  world.bannerT = 3.2;
}

export function addHeat(world, n, reason) {
  const p = world.player;
  p.wanted = Math.min(5, p.wanted + n);
  p.heat = 1;
  if (reason) world.lastCrime = reason;
}

function circleHitsRect(x, y, r, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

function collideBuildings(world, ent, r) {
  for (const b of world.buildings) {
    if (circleHitsRect(ent.x, ent.y, r, b)) {
      // Push out along the smallest penetration axis.
      const cx = Math.max(b.x, Math.min(ent.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(ent.y, b.y + b.h));
      let dx = ent.x - cx;
      let dy = ent.y - cy;
      if (dx === 0 && dy === 0) {
        dx = ent.x < b.x + b.w / 2 ? -1 : 1;
        dy = 0;
      }
      const len = Math.hypot(dx, dy) || 1;
      ent.x = cx + (dx / len) * (r + 0.5);
      ent.y = cy + (dy / len) * (r + 0.5);
      return true;
    }
  }
  return false;
}

function steerToward(car, tx, ty, dt, maxSpeed) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-2.4, Math.min(2.4, diff * 2.2));
  car.angle += turn * dt * Math.min(1, Math.abs(car.speed) / 40 + 0.25);
  const target = Math.max(0, Math.min(maxSpeed, maxSpeed * (1 - Math.min(1, Math.abs(diff) / 1.6))));
  car.speed += (target - car.speed) * Math.min(1, dt * 1.4);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

function drivePlayerCar(world, car, input, dt) {
  const accel = input.up ? 260 : input.down ? -190 : 0;
  const maxF = 340;
  const maxR = 150;
  car.speed += accel * dt;
  if (!input.up && !input.down) car.speed *= Math.pow(0.4, dt);
  if (input.handbrake) car.speed *= Math.pow(0.02, dt);
  car.speed = Math.max(-maxR, Math.min(maxF, car.speed));
  const steer = input.left ? -1 : input.right ? 1 : 0;
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * 2.1 * dt * dir * Math.min(1, Math.abs(car.speed) / 90);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (collideBuildings(world, car, 16)) {
    if (Math.abs(car.speed) > 180) {
      car.hp -= 8;
      world.shake = 0.25;
      if (car.hp <= 0) explodeCar(world, car);
    }
    car.speed *= 0.4;
  }
  car.x = Math.max(20, Math.min(WORLD - 20, car.x));
  car.y = Math.max(20, Math.min(WORLD - 20, car.y));
  if (car.hp < 55) car.smoke = Math.min(1, car.smoke + dt * 0.3);
}

function explodeCar(world, car) {
  car.hp = 0;
  car.dead = true;
  car.explodeT = 0.8;
  const p = world.player;
  if (p.car === car) {
    p.car = null;
    p.onFoot = true;
    p.x = car.x + 30;
    p.y = car.y + 30;
    p.hp = Math.max(5, p.hp - 25);
    addHeat(world, 1, 'car explosion');
  }
}

function updateTrafficCar(world, car, dt) {
  // Follow the road grid: head for the next intersection, then turn.
  if (!car.target || Math.hypot(car.target.x - car.x, car.target.y - car.y) < 40) {
    const road = nearestRoad(car.x, car.y);
    const along = road.axis === 'v' ? car.y : car.x;
    const next = Math.round(along / (12 * TILE)) * 12 * TILE;
    const dir = world.rng() < 0.5 ? 1 : -1;
    const targetAlong = Math.max(2 * TILE, Math.min(62 * TILE, next + dir * 12 * TILE));
    const turn = world.rng() < 0.3;
    if (turn) {
      // Turn onto the crossing road.
      const cross = road.axis === 'v' ? roadY(Math.floor(car.y / (12 * TILE))) : roadX(Math.floor(car.x / (12 * TILE)));
      car.target = road.axis === 'v' ? { x: car.x, y: cross } : { x: cross, y: car.y };
      car.turnAt = car.target;
    } else {
      car.target = road.axis === 'v' ? { x: road.at, y: targetAlong } : { x: targetAlong, y: road.at };
    }
  }
  if (car.turnAt && Math.hypot(car.turnAt.x - car.x, car.turnAt.y - car.y) < 46) {
    car.turnAt = null;
    const road = nearestRoad(car.x, car.y);
    const vertical = world.rng() < 0.5;
    const r = (vertical ? ROADS_X : ROADS_Y)[Math.floor(world.rng() * 5)] * TILE;
    const along = Math.max(2 * TILE, Math.min(62 * TILE, (vertical ? car.y : car.x) + (world.rng() < 0.5 ? -1 : 1) * 12 * TILE));
    car.target = vertical ? { x: r, y: along } : { x: along, y: r };
  }
  steerToward(car, car.target.x, car.target.y, dt, 95);
  collideBuildings(world, car, 15);
}

function updatePed(world, ped, dt) {
  // A customer waiting for a taxi stands still — they are not wandering
  // off while Rico drives over to pick them up.
  if (world.activeFare && world.activeFare.state === 'waiting' && world.activeFare.ped === ped) return;
  if (ped.panic > 0) {
    ped.panic -= dt;
    ped.speed = 95;
  } else {
    ped.speed = 30;
  }
  ped.walkPhase += dt * 7;
  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
  const road = nearestRoad(ped.x, ped.y);
  if (road.d > ROAD_HALF + 26 || world.rng() < dt * 0.12) {
    // Wander back toward a sidewalk or turn.
    ped.angle = Math.atan2((road.axis === 'v' ? ped.y : road.at) - ped.y, (road.axis === 'v' ? road.at : ped.x) - ped.x) + (world.rng() - 0.5) * 1.2;
  }
  if (ped.x < TILE || ped.x > WORLD - TILE || ped.y < TILE || ped.y > WORLD - TILE) {
    ped.angle += Math.PI;
    ped.x = Math.max(TILE, Math.min(WORLD - TILE, ped.x));
    ped.y = Math.max(TILE, Math.min(WORLD - TILE, ped.y));
  }
  collideBuildings(world, ped, 8);
}

function updatePolice(world, dt) {
  const p = world.player;
  const want = Math.min(5, Math.ceil(p.wanted));
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  while (world.police.length < want) {
    const a = world.rng() * Math.PI * 2;
    const d = 620;
    const car = makeCar(world.rng, px + Math.cos(a) * d, py + Math.sin(a) * d, 0, { police: true, color: '#20242e', name: 'Luna PD' });
    car.x = Math.max(40, Math.min(WORLD - 40, car.x));
    car.y = Math.max(40, Math.min(WORLD - 40, car.y));
    car.speed = 200;
    world.police.push(car);
  }
  while (world.police.length > want) world.police.pop();
  for (const cop of world.police) {
    steerToward(cop, px, py, dt, 250 + want * 22);
    collideBuildings(world, cop, 15);
    const d = Math.hypot(cop.x - px, cop.y - py);
    if (d < 46) {
      // Ram: damage the player's car or bust the player on foot.
      if (p.car) {
        p.car.hp -= POLICE_RAM_DPS * dt;
        p.car.speed *= 0.98;
        if (p.car.hp <= 0) explodeCar(world, p.car);
      } else {
        p.bustedTimer += dt;
        if (p.bustedTimer > 1.4) {
          p.busted = 1;
          p.wanted = 0;
          p.cash = Math.max(0, p.cash - 150);
          showBanner(world, 'BUSTED', 'The Luna PD took you in. $150 bail.');
        }
      }
    } else {
      p.bustedTimer = Math.max(0, p.bustedTimer - dt * 2);
    }
    if (d > 1400) {
      const a = world.rng() * Math.PI * 2;
      cop.x = px + Math.cos(a) * 600;
      cop.y = py + Math.sin(a) * 600;
    }
  }
  // Wanted decays when no police can see the player.
  if (p.wanted > 0) {
    const nearest = world.police.reduce((m, c) => Math.min(m, Math.hypot(c.x - px, c.y - py)), 1e9);
    if (nearest > 520) {
      // Hiding in a hideout cools the heat twice as fast.
      p.heat -= (dt / 24) * hideoutFactor(world);
      if (p.heat <= 0) {
        p.wanted = Math.max(0, p.wanted - 1);
        p.heat = 1;
        if (p.wanted === 0) {
          world.stats.copsLost += 1;
          showBanner(world, 'HEAT LOST', 'You slipped away. The island forgets — for now.');
        }
      }
    } else {
      p.heat = 1;
    }
  }
}

function updatePlayerOnFoot(world, input, dt) {
  const p = world.player;
  const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my) || 1;
  const sp = 165;
  p.x += (mx / len) * sp * dt * (mx || my ? 1 : 0);
  p.y += (my / len) * sp * dt * (mx || my ? 1 : 0);
  if (mx || my) p.angle = Math.atan2(my, mx);
  p.speed = (mx || my) ? sp : 0;
  collideBuildings(world, p, 12);
  p.x = Math.max(20, Math.min(WORLD - 20, p.x));
  p.y = Math.max(20, Math.min(WORLD - 20, p.y));
  // Bump into pedestrians: they panic, and a hard shove is a crime.
  for (const ped of world.peds) {
    if (Math.hypot(ped.x - p.x, ped.y - p.y) < 22) {
      ped.panic = 2.5;
      ped.angle = Math.atan2(ped.y - p.y, ped.x - p.x);
      if (p.speed > 100 && world.rng() < dt * 2) {
        world.stats.pedsHit += 1;
        addHeat(world, 1, 'hit a pedestrian');
      }
    }
  }
}

function nearestCar(world, x, y, maxD) {
  let best = null;
  let bd = maxD;
  const all = world.cars.concat(world.police);
  for (const c of all) {
    if (c.dead) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function tryEnterCar(world) {
  const p = world.player;
  if (!p.onFoot) return;
  const car = nearestCar(world, p.x, p.y, 64);
  if (!car) return;
  p.onFoot = false;
  p.car = car;
  car.player = true;
  car.ai = false;
  if (!car.police && !car.stolen) {
    car.stolen = true;
    world.stats.carsStolen += 1;
    addHeat(world, 1, 'stole a car');
    showBanner(world, 'CAR JACKED', `You took a ${car.name}. The owner will not be pleased.`);
  }
}

export function exitCar(world) {
  const p = world.player;
  if (p.onFoot || !p.car) return;
  const car = p.car;
  car.player = false;
  car.ai = true;
  car.speed = 0;
  p.car = null;
  p.onFoot = true;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.angle = car.angle;
}

function updateMission(world, dt) {
  const step = missionStep(world);
  if (!step) return;
  const p = world.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  if (step.time) {
    world.missionTimer -= dt;
    if (world.missionTimer <= 0) {
      showBanner(world, 'MISSION FAILED', 'Out of time. Talk to Mama Luz to try again.');
      startMission(world, world.missionIndex);
      return;
    }
  }
  const target = missionTarget(world);
  if (step.kind === 'steal') {
    if (!p.onFoot) advanceStep(world);
  } else if (step.kind === 'goto' || step.kind === 'deliver' || step.kind === 'escape') {
    if (target && Math.hypot(target.x - px, target.y - py) < 90) advanceStep(world);
  } else if (step.kind === 'grab') {
    if (target && Math.hypot(target.x - px, target.y - py) < 90) {
      world.grabT = (world.grabT || 0) + dt;
      if (world.grabT > 3) {
        world.grabT = 0;
        p.cash += 400;
        addHeat(world, 2, 'robbed the bank');
        showBanner(world, 'CASH GRABBED', '+$400 — now run!');
        advanceStep(world);
      }
    } else {
      world.grabT = 0;
    }
  } else if (step.kind === 'heat') {
    if (p.wanted >= step.stars) advanceStep(world);
  } else if (step.kind === 'cool') {
    if (p.wanted === 0) advanceStep(world);
  } else if (step.kind === 'holdout') {
    // Holding the terminal: the heat is raised to the step's stars when
    // the step starts, and the timer only runs while Rico stays hot and
    // on the marker. Leaving the marker drains the timer; losing the
    // heat freezes it.
    if (world.holdoutT === null || world.holdoutT === undefined) {
      world.holdoutT = 0;
      if (p.wanted < step.stars) addHeat(world, step.stars - p.wanted, 'the ferry job');
      showBanner(world, 'THE HEAT IS ON', `Hold the terminal at ${step.stars}+ stars — ${step.holdFor}s.`);
    }
    const near = target && Math.hypot(target.x - px, target.y - py) < 200;
    if (near && p.wanted >= step.stars) {
      world.holdoutT += dt;
      if (world.holdoutT >= step.holdFor) {
        world.holdoutT = null;
        // The crew has your back: they patch the car up, the PD abandons
        // its roadblocks and loses the player in the confusion, and the
        // heat eases a notch, so the escape across the island is winnable.
        if (p.car) {
          p.car.hp = Math.max(p.car.hp, 70);
          p.car.smoke = 0;
        }
        world.roadblocks = [];
        world.police = [];
        p.wanted = Math.max(0, p.wanted - 1);
        showBanner(world, 'CREW HAS YOUR BACK', 'The PD lost you in the confusion. Now run!');
        advanceStep(world);
      }
    } else if (!near) {
      world.holdoutT = Math.max(0, world.holdoutT - dt);
    }
  } else if (step.kind === 'race') {
    if (target && Math.hypot(target.x - px, target.y - py) < 90) {
      world.racePoint += 1;
      showBanner(world, `CHECKPOINT ${world.racePoint}/${step.points.length}`, 'Keep going!');
      if (world.racePoint >= step.points.length) advanceStep(world);
    }
  }
}

function advanceStep(world) {
  world.missionStep += 1;
  world.missionTimer = 0;
  const step = missionStep(world);
  if (!step) {
    const m = world.mission;
    world.player.cash += m.reward;
    world.missionDone.push(m.id);
    showBanner(world, 'MISSION COMPLETE', `${m.title} — +$${m.reward}`);
    const next = world.missionIndex + 1;
    if (next < MISSIONS.length) startMission(world, next);
    else {
      world.mission = null;
      showBanner(world, 'PUERTO LUNA IS YOURS', 'Every job done. The island is yours, Rico.');
    }
    return;
  }
  if (step.time) world.missionTimer = step.time;
  if (step.kind === 'race') world.racePoint = 0;
}

export function respawn(world) {
  const p = world.player;
  p.hp = 100;
  p.wanted = 0;
  p.busted = 0;
  p.wasted = false;
  p.onFoot = true;
  p.car = null;
  const spot = p.busted ? PLACES.station : PLACES.hospital;
  p.x = spot.x + 40;
  p.y = spot.y + 40;
  world.police = [];
  startMission(world, world.missionIndex);
}

export function update(world, input, dt) {
  world.time += dt;
  if (world.bannerT > 0) world.bannerT -= dt;
  if (world.shake > 0) world.shake -= dt;
  const p = world.player;
  if (p.busted || p.wasted) return;
  if (input.enterPressed) {
    if (p.onFoot) tryEnterCar(world);
    else exitCar(world);
  }
  if (p.onFoot) updatePlayerOnFoot(world, input, dt);
  else if (p.car) drivePlayerCar(world, p.car, input, dt);
  for (const car of world.cars) {
    if (car.dead) continue;
    if (car.player) continue;
    updateTrafficCar(world, car, dt);
  }
  for (const ped of world.peds) updatePed(world, ped, dt);
  updatePolice(world, dt);
  updateRoadblocks(world, dt);
  updateFares(world, dt);
  updateMission(world, dt);
  if (p.hp <= 0 && !p.wasted) {
    p.wasted = true;
    p.cash = Math.max(0, p.cash - 200);
    showBanner(world, 'WASTED', 'You woke up at Hospital Santa Fe. -$200.');
  }
  // Clean up wrecks and top up traffic.
  world.cars = world.cars.filter((c) => !c.dead || c.explodeT > 0);
  for (const c of world.cars) if (c.dead) c.explodeT -= dt;
  while (world.cars.filter((c) => !c.dead).length < 14) {
    world.cars.push(spawnTrafficCar(world.rng, world));
  }
  world.save = null;
}
