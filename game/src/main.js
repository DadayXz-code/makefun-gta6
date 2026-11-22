// Puerto Luna — the entry point: the frame loop, the screens, saving and
// loading, and shooting. The world simulation lives in world.js and every
// pixel lives in render.js; this file only drives them.
import { TILE, WORLD, VIEW_W, VIEW_H } from './config.js';
import { MISSIONS, createWorld, update, STEP, respawn, showBanner, startMission } from './world.js';
import { render } from './render.js';
import { initInput, keys, mouse, pressed, anyPressed } from './input.js';
import { Sound } from './audio.js';
import { stageShot } from './shots.js';

const SAVE_KEY = 'puertoluna-save-v1';
const SAVE_EVERY_SECONDS = 10;

const canvas = document.getElementById('game');
const context = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
initInput(canvas);
const sound = new Sound();

// A staged screenshot (`?shot=play&seed=1`) freezes a scripted frame;
// normal play builds a fresh world from the seed and restores the save.
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
  restoreSave(world);
}

function restoreSave(w) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved.cash === 'number') w.player.cash = saved.cash;
    if (
      typeof saved.missionIndex === 'number' &&
      saved.missionIndex >= 0 &&
      saved.missionIndex < MISSIONS.length
    ) {
      startMission(w, saved.missionIndex);
    }
    if (Array.isArray(saved.missionDone)) w.missionDone = saved.missionDone;
  } catch {
    // A corrupt save starts fresh; the game still runs.
  }
}

function storeSave(w) {
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

// The previous frame's held keys, for edge detection.
const previousKeys = {};
function justPressed(code) {
  const now = !!keys[code];
  const was = !!previousKeys[code];
  previousKeys[code] = now;
  return now && !was;
}

function gatherInput() {
  return {
    up: pressed('KeyW') || pressed('ArrowUp'),
    down: pressed('KeyS') || pressed('ArrowDown'),
    left: pressed('KeyA') || pressed('ArrowLeft'),
    right: pressed('KeyD') || pressed('ArrowRight'),
    handbrake: pressed('Space'),
    enterPressed: false,
  };
}

// The camera's top-left corner in world pixels, centred on the player
// (or their car) and clamped inside the island.
function cameraFocus() {
  const p = world.player;
  const focusX = p.car ? p.car.x : p.x;
  const focusY = p.car ? p.car.y : p.y;
  return {
    x: Math.max(0, Math.min(WORLD - VIEW_W, focusX - VIEW_W / 2)),
    y: Math.max(0, Math.min(WORLD - VIEW_H, focusY - VIEW_H / 2)),
  };
}

function firePistol() {
  const p = world.player;
  if (!p.gun || p.firing > 0) return;
  p.firing = 0.22;
  world.stats.shotsFired += 1;
  sound.shot();
  const cam = cameraFocus();
  const aimX = cam.x + mouse.x;
  const aimY = cam.y + mouse.y;
  const angle = Math.atan2(aimY - p.y, aimX - p.x);
  p.angle = angle;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // The nearest thing near the firing line, within 460px.
  const candidates = [];
  for (const ped of world.peds) candidates.push({ kind: 'ped', ref: ped, x: ped.x, y: ped.y });
  for (const cop of world.police) candidates.push({ kind: 'cop', ref: cop, x: cop.x, y: cop.y });
  for (const car of world.cars) {
    if (!car.player) candidates.push({ kind: 'car', ref: car, x: car.x, y: car.y });
  }
  let hit = null;
  let hitDistance = 460;
  for (const target of candidates) {
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const along = dx * cos + dy * sin;
    const across = Math.abs(-dx * sin + dy * cos);
    if (along > 20 && along < hitDistance && across < 26) {
      hitDistance = along;
      hit = target;
    }
  }
  if (!hit) return;
  if (hit.kind === 'ped') {
    hit.ref.panic = 3;
    hit.ref.fallen = 2;
    world.player.wanted = Math.min(5, world.player.wanted + 1);
  } else if (hit.kind === 'cop') {
    hit.ref.hp -= 25;
    hit.ref.smoke = 1;
  } else {
    hit.ref.hp -= 20;
    hit.ref.smoke = 1;
  }
}

let lastSpikesHit = 0;
let lastFrameAt = performance.now();
let accumulator = 0;
let saveTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  if (shotName) {
    // Staged screenshot mode: the world is already staged, render it frozen.
    render(context, world, screen);
    return;
  }
  let dt = (now - lastFrameAt) / 1000;
  lastFrameAt = now;
  if (dt > 0.25) dt = 0.25;
  accumulator += dt;

  const p = world.player;
  if (justPressed('KeyM')) {
    world.muted = !world.muted;
    sound.setMuted(world.muted);
  }
  if (justPressed('KeyH') && p.car) sound.horn();
  // The browser tab shows the run at a glance: cash and the current job.
  document.title = world.mission
    ? `Puerto Luna — $${p.cash} · ${world.mission.title}`
    : `Puerto Luna — $${p.cash}`;

  if (screen === 'title') {
    if (justPressed('Enter') || justPressed('NumpadEnter')) {
      sound.ensure();
      screen = 'play';
      showBanner(world, 'PUERTO LUNA', 'Welcome back, Rico. See Mama Luz at the cantina.');
    }
  } else if (screen === 'play') {
    if (justPressed('KeyP') || justPressed('Escape')) {
      screen = 'paused';
    } else {
      while (accumulator >= STEP) {
        accumulator -= STEP;
        const input = gatherInput();
        input.enterPressed = justPressed('KeyE');
        update(world, input, STEP);
        if (p.firing > 0) p.firing -= STEP;
        if (mouse.down && p.onFoot) firePistol();
        if (p.busted || p.wasted) {
          screen = 'end';
          break;
        }
        if (!world.mission) screen = 'done';
      }
      // A spike strip hit plays its crash once, when the count moves.
      if (world.stats.spikesHit > lastSpikesHit) {
        lastSpikesHit = world.stats.spikesHit;
        sound.crash();
      }
      // Rico gets a pistol after the first job.
      if (!p.gun && world.missionDone.includes('first-wheels')) {
        p.gun = true;
        showBanner(world, 'PISTOL ACQUIRED', 'Mama Luz gave you a pistol. Click to shoot.');
      }
      sound.engine(p.car ? p.car.speed : 0, !!p.car);
      sound.siren(p.wanted > 0);
      saveTimer += dt;
      if (saveTimer > SAVE_EVERY_SECONDS) {
        saveTimer = 0;
        storeSave(world);
      }
    }
  } else if (screen === 'paused') {
    if (justPressed('KeyP') || justPressed('Escape') || justPressed('Enter')) screen = 'play';
  } else if (screen === 'end') {
    sound.engine(0, false);
    sound.siren(false);
    if (justPressed('Enter')) {
      respawn(world);
      storeSave(world);
      screen = 'play';
    }
  } else if (screen === 'done') {
    if (justPressed('Enter')) {
      world = createWorld(seed);
      screen = 'title';
    }
  }

  render(context, world, screen);
}

requestAnimationFrame(frame);
