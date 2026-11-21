// Puerto Luna — entry point: game loop, screens, save/load, shooting.
// All game rules live in world.js; all pixels live in render.js.
import { TILE, WORLD, VIEW_W, VIEW_H } from './config.js';
import { createWorld, update, STEP, exitCar, tryEnterCar, respawn, showBanner, startMission } from './world.js';
import { render } from './render.js';
import { initInput, keys, mouse, pressed } from './input.js';
import { Sound } from './audio.js';
import { stageShot } from './shots.js';

const SAVE_KEY = 'puertoluna-save-v1';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
initInput(canvas);
const sound = new Sound();

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = parseInt(params.get('seed') || '1', 10);

let world;
let screen;
if (shotName) {
  const staged = stageShot(shotName, seed);
  world = staged.world;
  screen = staged.screen;
} else {
  world = createWorld(seed);
  screen = 'title';
  loadSave(world);
}

function loadSave(w) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.cash === 'number') w.player.cash = s.cash;
    if (typeof s.missionIndex === 'number' && s.missionIndex >= 0 && s.missionIndex < 6) {
      startMission(w, s.missionIndex);
    }
    if (Array.isArray(s.missionDone)) w.missionDone = s.missionDone;
  } catch {
    // Corrupt save: start fresh.
  }
}

function saveGame(w) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: w.player.cash,
      missionIndex: w.missionIndex,
      missionDone: w.missionDone,
    }));
  } catch {
    // Storage unavailable (private mode): the game still runs.
  }
}

function readInput() {
  return {
    up: pressed('KeyW') || pressed('ArrowUp'),
    down: pressed('KeyS') || pressed('ArrowDown'),
    left: pressed('KeyA') || pressed('ArrowLeft'),
    right: pressed('KeyD') || pressed('ArrowRight'),
    handbrake: pressed('Space'),
    enterPressed: false,
  };
}

function camToWorld() {
  const p = world.player;
  const fx = p.car ? p.car.x : p.x;
  const fy = p.car ? p.car.y : p.y;
  return {
    x: Math.max(0, Math.min(WORLD - VIEW_W, fx - VIEW_W / 2)),
    y: Math.max(0, Math.min(WORLD - VIEW_H, fy - VIEW_H / 2)),
  };
}

function shoot() {
  const p = world.player;
  if (!p.gun || p.firing > 0) return;
  p.firing = 0.22;
  world.stats.shotsFired += 1;
  sound.shot();
  const cam = camToWorld();
  const tx = cam.x + mouse.x;
  const ty = cam.y + mouse.y;
  const ang = Math.atan2(ty - p.y, tx - p.x);
  p.angle = ang;
  // Hit the nearest thing near the firing line, within 460px.
  let best = null;
  let bestD = 460;
  const consider = (x, y, ref) => {
    const dx = x - p.x;
    const dy = y - p.y;
    const along = dx * Math.cos(ang) + dy * Math.sin(ang);
    const perp = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang));
    if (along > 20 && along < bestD && perp < 26) {
      bestD = along;
      best = ref;
    }
  };
  for (const ped of world.peds) consider(ped.x, ped.y, { kind: 'ped', ref: ped });
  for (const cop of world.police) consider(cop.x, cop.y, { kind: 'cop', ref: cop });
  for (const car of world.cars) {
    if (car.player) continue;
    consider(car.x, car.y, { kind: 'car', ref: car });
  }
  if (best) {
    if (best.kind === 'ped') {
      best.ref.panic = 3;
      best.ref.fallen = 2;
      world.player.wanted = Math.min(5, world.player.wanted + 1);
    } else if (best.kind === 'cop') {
      best.ref.hp -= 25;
      best.ref.smoke = 1;
    } else if (best.kind === 'car') {
      best.ref.hp -= 20;
      best.ref.smoke = 1;
    }
  }
}

let prev = {};
function edge(code) {
  const now = !!keys[code];
  const was = !!prev[code];
  prev[code] = now;
  return now && !was;
}

let last = performance.now();
let acc = 0;
let saveT = 0;

function frame(now) {
  requestAnimationFrame(frame);
  if (shotName) {
    // Staged screenshot mode: the world is already staged, render it frozen.
    render(ctx, world, screen);
    return;
  }
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;

  const p = world.player;
  if (edge('KeyM')) {
    world.muted = !world.muted;
    sound.setMuted(world.muted);
  }

  if (screen === 'title') {
    if (edge('Enter') || edge('NumpadEnter')) {
      sound.ensure();
      screen = 'play';
      showBanner(world, 'PUERTO LUNA', 'Welcome back, Rico. See Mama Luz at the cantina.');
    }
  } else if (screen === 'play') {
    if (edge('KeyP') || edge('Escape')) {
      screen = 'paused';
    } else {
      while (acc >= STEP) {
        acc -= STEP;
        const input = readInput();
        input.enterPressed = edge('KeyE');
        update(world, input, STEP);
        if (p.firing > 0) p.firing -= STEP;
        if (mouse.down && p.onFoot) shoot();
        if (p.busted || p.wasted) {
          screen = 'end';
          break;
        }
        if (!world.mission) screen = 'done';
      }
      // Give Rico a pistol after the first job.
      if (!p.gun && world.missionDone.includes('first-wheels')) {
        p.gun = true;
        showBanner(world, 'PISTOL ACQUIRED', 'Mama Luz gave you a pistol. Click to shoot.');
      }
      sound.engine(p.car ? p.car.speed : 0, !!p.car);
      sound.siren(p.wanted > 0);
      saveT += dt;
      if (saveT > 10) {
        saveT = 0;
        saveGame(world);
      }
    }
  } else if (screen === 'paused') {
    if (edge('KeyP') || edge('Escape') || edge('Enter')) screen = 'play';
  } else if (screen === 'end') {
    sound.engine(0, false);
    sound.siren(false);
    if (edge('Enter')) {
      respawn(world);
      saveGame(world);
      screen = 'play';
    }
  } else if (screen === 'done') {
    if (edge('Enter')) {
      world = createWorld(seed);
      screen = 'title';
    }
  }

  render(ctx, world, screen);
}

requestAnimationFrame(frame);
