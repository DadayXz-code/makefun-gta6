// Puerto Luna — the orchestrator: the frame loop, the player on foot and
// behind the wheel, the traffic and the crowds, and the mission engine
// that walks Rico through all seven story jobs.

import { CFG, MISSIONS, FARE, wantedFromHeat } from './config.js';
import { makeRng } from './random.js';
import {
  genCity,
  createGame,
  dist,
  clamp,
  pushOutOfRect,
  nearestRoadPoint,
  resolveLandmark,
  saveGame,
  loadSave,
} from './world.js';
import {
  addHeat,
  updateWanted,
  hurtPlayer,
  bustPlayer,
  burst,
  updateParticles,
} from './wanted.js';
import { spawnCustomers, pickupFare, updateFare, nearestCustomer } from './fares.js';
import { draw } from './render.js';
import { createInput, isDown, wasPressed, endFrame } from './input.js';
import { createAudio } from './audio.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CFG.VIEW_W;
canvas.height = CFG.VIEW_H;

const city = genCity(CFG.SEED);
const state = createGame(city);
const rng = makeRng(CFG.SEED + 99);
spawnCustomers(state, rng);
const input = createInput(canvas);
const audio = createAudio();
state.audio = audio;

const saved = loadSave();
if (saved) {
  state.cash = saved.cash;
  state.missionIdx = Math.min(saved.missionIdx, MISSIONS.length);
  state.saveInfo = saved;
}

window.addEventListener('keydown', () => audio.ensure());
canvas.addEventListener('mousedown', () => audio.ensure());

// Debug hooks for the headless playtest (never used by the game itself).
window.PuertoLuna = {
  state,
  warp(x, y) {
    state.player.x = x;
    state.player.y = y;
    if (state.player.car) {
      state.player.car.x = x;
      state.player.car.y = y;
    }
    state.camera.x = x;
    state.camera.y = y;
  },
  setWanted(n) {
    const target = [0, 8, 25, 45, 65, 85][Math.max(0, Math.min(5, n))] || 0;
    // Go through addHeat so the level-change effects (roadblocks at 3
    // stars, clearing them at 0) fire exactly as they do in real play.
    addHeat(state, target - state.heat);
  },
  skipTo(i) {
    state.missionIdx = Math.max(0, Math.min(MISSIONS.length, i));
    state.stepIdx = 0;
    state.step = { t: 0, progress: 0, cp: 0, done: false };
    state.missionTimer = null;
  },
  giveCash(n) {
    state.cash += n;
  },
};

function currentMission() {
  return state.missionIdx < MISSIONS.length ? MISSIONS[state.missionIdx] : null;
}

function currentStep() {
  const m = currentMission();
  return m ? m.steps[state.stepIdx] : null;
}

function resetStep() {
  state.step = { t: 0, progress: 0, cp: 0, done: false, alarmed: false };
  state.missionTimer = null;
  state.stepProgress = 0;
}

function advanceStep() {
  const m = currentMission();
  state.stepIdx += 1;
  resetStep();
  if (state.stepIdx >= m.steps.length) {
    completeMission(m);
  }
}

function completeMission(m) {
  state.cash += m.reward;
  state.stats.missionsDone += 1;
  state.banner = { title: 'MISSION COMPLETE', sub: `${m.name}  +$${m.reward}`, t: 4 };
  audio.jingle();
  if (m.id === 1) state.hasGun = true;
  saveGame(state);
  state.missionIdx += 1;
  state.stepIdx = 0;
  resetStep();
  if (state.missionIdx >= MISSIONS.length) {
    state.mode = 'done';
  }
}

function failMission(reason) {
  state.banner = { title: 'MISSION FAILED', sub: reason, t: 3.5 };
  audio.fail();
  state.stepIdx = 0;
  resetStep();
}

function stepTarget(step) {
  if (!step) return null;
  if (step.kind === 'checkpoints') {
    const point = step.points[state.step.cp];
    return point ? resolveLandmark(state.city, point) : null;
  }
  if (step.target) return resolveLandmark(state.city, step.target);
  return null;
}

function updateMission(dt) {
  const m = currentMission();
  if (!m) {
    state.objective = 'Puerto Luna is yours — free roam';
    state.objectiveTimer = null;
    state.marker = null;
    state.stepProgress = 0;
    return;
  }
  const step = currentStep();
  const p = state.player;

  if (step.kind === 'goto' || step.kind === 'rob' || step.kind === 'holdout') {
    const target = stepTarget(step);
    state.marker = target;
    state.objective = step.label;
    // Only a 'goto' step has a deadline: for 'rob' and 'holdout' the
    // seconds field is the duration to survive, not a countdown to fail.
    if (step.kind === 'goto' && step.seconds) {
      if (state.missionTimer === null) state.missionTimer = step.seconds;
      state.missionTimer -= dt;
      state.objectiveTimer = state.missionTimer;
      if (state.missionTimer <= 0) {
        failMission('Out of time — Mama Luz is not pleased.');
        return;
      }
    } else {
      state.objectiveTimer = null;
    }
    const d = dist(p.x, p.y, target.x, target.y);
    if (step.kind === 'goto') {
      if (d < 70) advanceStep();
    } else if (step.kind === 'rob') {
      if (!state.step.alarmed) {
        state.step.alarmed = true;
        addHeat(state, CFG.HEAT_ROB_ALARM);
        state.message = { text: 'Alarm! The vault is open — stay inside!', t: 3 };
      }
      if (d < 130) {
        state.step.t += dt;
        state.stepProgress = Math.min(1, state.step.t / step.seconds);
        if (state.step.t >= step.seconds) advanceStep();
      } else {
        state.stepProgress = Math.min(1, state.step.t / step.seconds);
      }
    } else if (step.kind === 'holdout') {
      if (state.wanted < 2) addHeat(state, 12 * dt);
      if (d < 170) {
        state.step.t += dt;
        state.stepProgress = Math.min(1, state.step.t / step.seconds);
        if (state.step.t >= step.seconds) advanceStep();
      } else {
        state.stepProgress = Math.min(1, state.step.t / step.seconds);
      }
    }
  } else if (step.kind === 'steal') {
    const target = stepTarget(step);
    state.marker = target;
    state.objective = step.label;
    state.objectiveTimer = null;
    state.stepProgress = 0;
  } else if (step.kind === 'heat') {
    state.objective = step.label;
    state.objectiveTimer = null;
    state.marker = null;
    state.stepProgress = 0;
    if (state.wanted >= step.level) advanceStep();
  } else if (step.kind === 'escape') {
    const a = state.city.landmarks.hideoutA;
    const b = state.city.landmarks.hideoutB;
    const near = dist(p.x, p.y, a.x, a.y) < dist(p.x, p.y, b.x, b.y) ? a : b;
    state.marker = near;
    state.objective = step.label;
    state.objectiveTimer = null;
    state.stepProgress = 0;
    if (state.wanted === 0) advanceStep();
  } else if (step.kind === 'checkpoints') {
    const target = stepTarget(step);
    state.marker = target;
    state.objective = `${step.label} — ${state.step.cp}/${step.points.length}`;
    if (state.missionTimer === null) state.missionTimer = step.seconds;
    state.missionTimer -= dt;
    state.objectiveTimer = state.missionTimer;
    if (state.missionTimer <= 0) {
      failMission('Out of time — the sprint is lost.');
      return;
    }
    if (target && dist(p.x, p.y, target.x, target.y) < 80) {
      state.step.cp += 1;
      audio.pickup();
      if (state.step.cp >= step.points.length) advanceStep();
    }
    state.stepProgress = 0;
  }
}

function nearestCar(maxD) {
  const p = state.player;
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    const d = dist(car.x, car.y, p.x, p.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return bestD <= maxD ? best : null;
}

function enterCar(car) {
  const p = state.player;
  const idx = state.cars.indexOf(car);
  if (idx !== -1) state.cars.splice(idx, 1);
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  car.speed = 0;
  if (car.kind === 'traffic') {
    addHeat(state, CFG.HEAT_STEAL);
    state.stats.stolen += 1;
    state.message = { text: 'Car stolen — the heat is on!', t: 2.5 };
  }
  const step = currentStep();
  if (step && step.kind === 'steal' && car.kind === 'target') {
    advanceStep();
  }
}

function exitCar() {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  const side = { x: p.x + Math.cos(p.angle + Math.PI / 2) * 34, y: p.y + Math.sin(p.angle + Math.PI / 2) * 34 };
  car.speed = 0;
  car.angle = p.angle;
  state.cars.push(car);
  p.car = null;
  p.onFoot = true;
  p.x = clamp(side.x, 140, CFG.WORLD_W - 140);
  p.y = clamp(side.y, 140, CFG.WORLD_H - 140);
  p.angle = car.angle;
}

function shoot() {
  if (!state.hasGun || state.mode !== 'play') return;
  const p = state.player;
  audio.shot();
  state.stats.shots += 1;
  addHeat(state, CFG.HEAT_SHOT);
  state.lastCrimeAt = state.time;
  const worldAim = Math.atan2(
    (input.mouse.y - CFG.VIEW_H / 2) / state.camera.zoom + state.camera.y - p.y,
    (input.mouse.x - CFG.VIEW_W / 2) / state.camera.zoom + state.camera.x - p.x,
  );
  const mx = p.x + Math.cos(worldAim) * 26;
  const my = p.y + Math.sin(worldAim) * 26;
  burst(state, mx, my, '#ffd34d', 5);
  // Hit the nearest thing roughly in the line of fire.
  let best = null;
  let bestScore = Infinity;
  const consider = (x, y, obj) => {
    const d = dist(p.x, p.y, x, y);
    if (d > 320) return;
    let diff = Math.atan2(y - p.y, x - p.x) - worldAim;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const score = d + Math.abs(diff) * 400;
    if (Math.abs(diff) < 0.35 && score < bestScore) {
      bestScore = score;
      best = obj;
    }
  };
  for (const cop of state.police) consider(cop.x, cop.y, { type: 'cop', ref: cop });
  for (const ped of state.peds) consider(ped.x, ped.y, { type: 'ped', ref: ped });
  for (const car of state.cars) consider(car.x, car.y, { type: 'car', ref: car });
  if (best) {
    if (best.type === 'cop') {
      best.ref.hp -= 30;
      burst(state, best.ref.x, best.ref.y, '#ff5a3c', 8);
      if (best.ref.hp <= 0) {
        state.police.splice(state.police.indexOf(best.ref), 1);
        addHeat(state, 20);
        burst(state, best.ref.x, best.ref.y, '#ff5a3c', 16);
      }
    } else if (best.type === 'ped') {
      const ped = best.ref;
      ped.flee = 3;
      state.peds.splice(state.peds.indexOf(ped), 1);
      addHeat(state, CFG.HEAT_HIT_PED);
      burst(state, ped.x, ped.y, '#ff5a3c', 8);
    } else {
      best.ref.hp -= 25;
      burst(state, best.ref.x, best.ref.y, '#ffd34d', 8);
    }
  }
}

function updatePlayer(dt) {
  const p = state.player;
  const up = isDown(input, 'w', 'ArrowUp');
  const down = isDown(input, 's', 'ArrowDown');
  const left = isDown(input, 'a', 'ArrowLeft');
  const right = isDown(input, 'd', 'ArrowRight');

  if (p.onFoot) {
    let mx = (right ? 1 : 0) - (left ? 1 : 0);
    let my = (down ? 1 : 0) - (up ? 1 : 0);
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      p.angle = Math.atan2(my, mx);
      p.x += mx * CFG.WALK_SPEED * dt;
      p.y += my * CFG.WALK_SPEED * dt;
    }
    p.x = clamp(p.x, 140, CFG.WORLD_W - 140);
    p.y = clamp(p.y, 140, CFG.WORLD_H - 140);
    for (const b of state.city.buildings) {
      const fix = pushOutOfRect(p.x, p.y, CFG.PLAYER_RADIUS, b);
      if (fix) {
        p.x = fix.x;
        p.y = fix.y;
      }
    }
    if (wasPressed(input, 'e')) {
      const car = nearestCar(56);
      if (car) {
        enterCar(car);
      } else {
        pickupFare(state, rng);
      }
    }
    if (input.mouse.clicked) shoot();
  } else if (p.car) {
    const car = p.car;
    if (up) car.speed += CFG.CAR_ACCEL * dt;
    if (down) car.speed -= CFG.CAR_ACCEL * 0.8 * dt;
    if (!up && !down) car.speed *= Math.pow(0.4, dt);
    car.speed = clamp(car.speed, -CFG.CAR_REVERSE, CFG.CAR_MAX);
    const steer = (left ? 1 : 0) - (right ? 1 : 0);
    const grip = Math.min(1, Math.abs(car.speed) / 120);
    car.angle += steer * CFG.CAR_TURN * grip * dt * (car.speed < 0 ? -1 : 1);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 120, CFG.WORLD_W - 120);
    car.y = clamp(car.y, 120, CFG.WORLD_H - 120);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    // Buildings: bounce off, hard hits cost health.
    for (const b of state.city.buildings) {
      const fix = pushOutOfRect(car.x, car.y, CFG.CAR_RADIUS, b);
      if (fix) {
        if (Math.abs(car.speed) > 220) {
          car.hp -= 8;
          audio.crash();
          burst(state, car.x, car.y, '#ffd34d', 6);
        }
        car.x = fix.x;
        car.y = fix.y;
        car.speed *= 0.45;
      }
    }
    // Traffic and parked cars: shove apart, both take damage.
    for (const other of state.cars) {
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 44 && d > 0.01) {
        const nx = (car.x - other.x) / d;
        const ny = (car.y - other.y) / d;
        const push = (44 - d) / 2;
        car.x += nx * push;
        car.y += ny * push;
        other.x -= nx * push;
        other.y -= ny * push;
        if (Math.abs(car.speed) > 140) {
          car.hp -= 3;
          other.hp -= 5;
          audio.crash();
          burst(state, car.x, car.y, '#ffd34d', 5);
        }
        car.speed *= 0.8;
      }
    }
    // Pedestrians in the way.
    for (let i = state.peds.length - 1; i >= 0; i--) {
      const ped = state.peds[i];
      if (ped.waiting) continue;
      if (dist(car.x, car.y, ped.x, ped.y) < 26 && Math.abs(car.speed) > 60) {
        state.peds.splice(i, 1);
        addHeat(state, CFG.HEAT_HIT_PED);
        state.lastCrimeAt = state.time;
        audio.crash();
        burst(state, ped.x, ped.y, '#ff5a3c', 8);
      }
    }
    if (car.hp <= 0) {
      burst(state, car.x, car.y, '#ff5a3c', 22);
      burst(state, car.x, car.y, '#333', 14);
      audio.crash();
      state.message = { text: 'Your car is wrecked!', t: 3 };
      state.cars.push(car);
      p.car = null;
      p.onFoot = true;
      p.x = clamp(car.x + 40, 140, CFG.WORLD_W - 140);
      p.y = clamp(car.y, 140, CFG.WORLD_H - 140);
      hurtPlayer(state, 15, 'wreck');
    }
    if (wasPressed(input, 'e')) exitCar();
  }
}

function updateTraffic(dt) {
  for (const car of state.cars) {
    if (car.kind !== 'traffic') continue;
    if (car.axis === 'h') {
      car.x += car.dir * car.speed * dt;
      car.angle = car.dir > 0 ? 0 : Math.PI;
      if (car.x < 200 || car.x > CFG.WORLD_W - 200) car.dir *= -1;
      // At a crossing with a vertical road, sometimes turn onto it.
      for (const rx of state.city.roadsV) {
        if (Math.abs(car.x - rx) < 26 && state.time - car.lastTurn > 2 && Math.random() < 0.006) {
          car.axis = 'v';
          car.dir = Math.random() < 0.5 ? 1 : -1;
          car.x = rx;
          car.lastTurn = state.time;
        }
      }
    } else {
      car.y += car.dir * car.speed * dt;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (car.y < 200 || car.y > CFG.WORLD_H - 200) car.dir *= -1;
      // At a crossing with a horizontal road, sometimes turn onto it.
      for (const ry of state.city.roadsH) {
        if (Math.abs(car.y - ry) < 26 && state.time - car.lastTurn > 2 && Math.random() < 0.006) {
          car.axis = 'h';
          car.dir = Math.random() < 0.5 ? 1 : -1;
          car.y = ry;
          car.lastTurn = state.time;
        }
      }
    }
  }
}

function updatePeds(dt) {
  const p = state.player;
  for (const ped of state.peds) {
    // Waiting fare customers never walk away — the guard that makes the
    // taxi job work: a customer stays exactly where the player found them.
    if (ped.waiting) continue;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.x += Math.cos(away) * 190 * dt;
      ped.y += Math.sin(away) * 190 * dt;
      ped.angle = away;
      continue;
    }
    const d = dist(ped.x, ped.y, ped.tx, ped.ty);
    if (d < 12) {
      const t = nearestRoadPoint(state.city, ped.x + (Math.random() - 0.5) * 700, ped.y + (Math.random() - 0.5) * 700);
      ped.tx = t.x;
      ped.ty = t.y;
      continue;
    }
    const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
    ped.angle = a;
    ped.x += Math.cos(a) * ped.speed * dt;
    ped.y += Math.sin(a) * ped.speed * dt;
    ped.x = clamp(ped.x, 150, CFG.WORLD_W - 150);
    ped.y = clamp(ped.y, 150, CFG.WORLD_H - 150);
  }
  // Top the pedestrians back up over time.
  if (state.peds.length < 20 && Math.random() < dt * 0.2) {
    const vertical = Math.random() < 0.5;
    const road = vertical
      ? state.city.roadsV[Math.floor(Math.random() * state.city.roadsV.length)]
      : state.city.roadsH[Math.floor(Math.random() * state.city.roadsH.length)];
    const px = vertical ? road + (Math.random() < 0.5 ? 58 : -58) : 200 + Math.random() * (CFG.WORLD_W - 400);
    const py = vertical ? 200 + Math.random() * (CFG.WORLD_H - 400) : road + (Math.random() < 0.5 ? 58 : -58);
    const t = nearestRoadPoint(state.city, px, py);
    state.peds.push({
      x: clamp(px, 160, CFG.WORLD_W - 160),
      y: clamp(py, 160, CFG.WORLD_H - 160),
      angle: Math.random() * Math.PI * 2,
      speed: CFG.PED_MIN + Math.random() * (CFG.PED_MAX - CFG.PED_MIN),
      color: ['#e8e8e8', '#d9a05b', '#7fa8c9', '#c96f4a'][Math.floor(Math.random() * 4)],
      waiting: false,
      flee: 0,
      tx: t.x,
      ty: t.y,
    });
  }
  // Keep three fare customers waiting on the map.
  state.fareCooldown -= dt;
  const waiting = state.peds.filter((ped) => ped.waiting).length;
  if (waiting < FARE.CUSTOMERS && state.fareCooldown <= 0) {
    spawnCustomers(state, rng);
    state.fareCooldown = 20;
  }
}

function updateCamera(dt) {
  const cam = state.camera;
  const tx = clamp(state.player.x, CFG.VIEW_W / 2 / cam.zoom, CFG.WORLD_W - CFG.VIEW_W / 2 / cam.zoom);
  const ty = clamp(state.player.y, CFG.VIEW_H / 2 / cam.zoom, CFG.WORLD_H - CFG.VIEW_H / 2 / cam.zoom);
  cam.x += (tx - cam.x) * Math.min(1, 5 * dt);
  cam.y += (ty - cam.y) * Math.min(1, 5 * dt);
}

function respawn() {
  const g = state.city.landmarks.garage;
  state.health = 100;
  state.player.hp = 100;
  state.heat = 0;
  state.wanted = 0;
  state.police = [];
  state.roadblocks = [];
  if (state.player.car) {
    state.cars.push(state.player.car);
    state.player.car = null;
  }
  state.player.onFoot = true;
  state.player.x = g.x;
  state.player.y = g.y + 60;
  state.player.angle = -Math.PI / 2;
  state.camera.x = g.x;
  state.camera.y = g.y;
  state.stepIdx = 0;
  resetStep();
  state.fare = null;
  state.mode = 'play';
  saveGame(state);
}

function update(dt) {
  if (state.mode === 'title') {
    state.time += dt;
    // Slow pan over the island behind the title.
    state.camera.x = CFG.WORLD_W / 2 + Math.sin(state.time * 0.06) * 500;
    state.camera.y = CFG.WORLD_H / 2 + Math.cos(state.time * 0.045) * 320;
    if (wasPressed(input, 'Enter')) {
      state.mode = 'play';
      audio.ensure();
    }
    return;
  }
  if (state.mode === 'pause') {
    if (wasPressed(input, 'Escape') || wasPressed(input, 'Enter')) state.mode = 'play';
    if (wasPressed(input, 'r')) {
      state.stepIdx = 0;
      resetStep();
      state.mode = 'play';
    }
    return;
  }
  if (state.mode === 'busted' || state.mode === 'wasted') {
    if (wasPressed(input, 'Enter')) respawn();
    return;
  }
  if (state.mode === 'done') {
    state.time += dt;
    if (wasPressed(input, 'Enter')) state.mode = 'play';
    return;
  }

  // Playing.
  state.time += dt;
  if (wasPressed(input, 'Escape')) {
    state.mode = 'pause';
    return;
  }
  if (wasPressed(input, 'm')) {
    state.muted = audio.toggleMute();
  }

  updatePlayer(dt);
  if (state.mode !== 'play') return; // busted / wasted during the frame
  updateTraffic(dt);
  updatePeds(dt);
  updateWanted(state, dt);
  if (state.mode !== 'play') return; // busted during the police update
  updateFare(state, dt);
  updateMission(dt);
  updateParticles(state, dt);
  updateCamera(dt);

  // Slow health recovery while the heat is off.
  if (state.wanted === 0 && state.health < 100) {
    state.health = Math.min(100, state.health + 2 * dt);
    state.player.hp = state.health;
  }

  // Sound follows the drive.
  const driving = !state.player.onFoot && state.player.car;
  audio.engine(driving ? Math.abs(state.player.car.speed) / CFG.CAR_MAX : 0, !!driving);
  audio.siren(state.wanted > 0);
}

// Stage a screenshot scene if the page was opened with ?shot=...
setupShot(state);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw(state, ctx);
  endFrame(input);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
