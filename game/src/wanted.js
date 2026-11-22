// Puerto Luna — the heat: wanted stars, the police who answer them,
// roadblocks with spike strips, and the hideouts where the heat dies.

import { CFG, wantedFromHeat } from './config.js';
import { clamp, dist, nearestRoadPoint } from './world.js';

export function addHeat(state, amount) {
  state.heat = clamp(state.heat + amount, 0, CFG.HEAT_MAX);
  const level = wantedFromHeat(state.heat);
  if (level !== state.wanted) {
    state.wanted = level;
    if (level >= 3 && state.roadblocks.length === 0) {
      layRoadblocks(state);
    }
    if (level === 0) {
      state.roadblocks = [];
    }
  }
}

// Two spike-strip roadblocks ahead of the player, on the road they are on.
export function layRoadblocks(state) {
  const p = state.player;
  const ahead = { x: p.x + Math.cos(p.angle) * 420, y: p.y + Math.sin(p.angle) * 420 };
  const snap = nearestRoadPoint(state.city, ahead.x, ahead.y);
  const spots = [
    { x: snap.x, y: snap.y },
    { x: clamp(snap.x + 260, 200, CFG.WORLD_W - 200), y: snap.y },
  ];
  for (const s of spots) {
    state.roadblocks.push({ x: s.x, y: s.y, angle: p.angle + Math.PI / 2, hit: false });
  }
  state.message = { text: 'Roadblock ahead — spike strips on the road!', t: 3 };
}

function spawnCop(state) {
  const p = state.player;
  const angle = Math.random() * Math.PI * 2;
  const r = 520 + Math.random() * 260;
  const x = clamp(p.x + Math.cos(angle) * r, 160, CFG.WORLD_W - 160);
  const y = clamp(p.y + Math.sin(angle) * r, 160, CFG.WORLD_H - 160);
  state.police.push({
    x,
    y,
    angle: Math.atan2(p.y - y, p.x - x),
    speed: 0,
    hp: 100,
    cool: 0, // earliest time this cop may ram again
  });
}

function steerToward(car, tx, ty, dt, maxTurn) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = clamp(diff, -maxTurn * dt, maxTurn * dt);
  car.angle += turn;
}

// The police brain, run every frame: spawn to match the wanted level,
// chase and ram, cool off when the heat dies.
export function updateWanted(state, dt) {
  const quiet = state.time - (state.lastCrimeAt || 0) > 5;
  const inHideout =
    dist(state.player.x, state.player.y, state.city.landmarks.hideoutA.x, state.city.landmarks.hideoutA.y) < 150 ||
    dist(state.player.x, state.player.y, state.city.landmarks.hideoutB.x, state.city.landmarks.hideoutB.y) < 150;
  if (state.heat > 0 && (quiet || inHideout)) {
    addHeat(state, -(inHideout ? CFG.HEAT_HIDEOUT : CFG.HEAT_DECAY) * dt);
  }

  const want = state.wanted;
  while (state.police.length < want) spawnCop(state);
  while (state.police.length > want) state.police.pop();

  const p = state.player;
  const top = 430 + want * 26;
  for (const cop of state.police) {
    steerToward(cop, p.x, p.y, dt, 3.1);
    cop.speed = Math.min(cop.speed + 420 * dt, top);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.x = clamp(cop.x, 120, CFG.WORLD_W - 120);
    cop.y = clamp(cop.y, 120, CFG.WORLD_H - 120);
    // Ramming the player: a bump, damage and sparks. On foot, a close
    // police car arrests Rico instead of just hurting him. Each cop may
    // ram at most once every 1.6 s and bounces back after a hit, so a
    // parked car is not shredded in seconds.
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (p.onFoot && d < 30) {
      bustPlayer(state);
      return;
    }
    if (d < 46 && state.time >= (cop.cool || 0)) {
      cop.cool = state.time + 1.6;
      cop.speed *= -0.4;
      const push = 46 - d;
      const nx = (p.x - cop.x) / (d || 1);
      const ny = (p.y - cop.y) / (d || 1);
      if (p.onFoot) {
        p.x += nx * push;
        p.y += ny * push;
        hurtPlayer(state, 6, 'rammed');
      } else if (p.car) {
        p.car.x += nx * push * 0.6;
        p.car.y += ny * push * 0.6;
        p.car.hp -= 4;
        hurtPlayer(state, 2, 'rammed');
        burst(state, cop.x, cop.y, '#ffd34d', 6);
      }
      cop.speed *= 0.55;
    }
  }

  // Spike strips: shred the tyres of any car that crosses one.
  if (!p.onFoot && p.car) {
    for (const rb of state.roadblocks) {
      if (rb.hit) continue;
      if (dist(p.car.x, p.car.y, rb.x, rb.y) < 44) {
        rb.hit = true;
        p.car.hp -= 35;
        p.car.speed *= 0.35;
        state.message = { text: 'Spike strip! Tyres shredded.', t: 3 };
        burst(state, rb.x, rb.y, '#ff5a3c', 10);
      }
    }
  }
}

export function hurtPlayer(state, amount, cause) {
  if (state.mode !== 'play') return;
  state.health = clamp(state.health - amount, 0, 100);
  state.player.hp = state.health;
  if (state.health <= 0) {
    state.mode = 'wasted';
    state.over = { kind: 'wasted', cause };
    saveAftermath(state);
  }
}

export function bustPlayer(state) {
  if (state.mode !== 'play') return;
  state.mode = 'busted';
  state.cash = Math.max(0, state.cash - CFG.BUST_FINE);
  state.over = { kind: 'busted', cause: 'caught' };
  saveAftermath(state);
}

function saveAftermath(state) {
  try {
    localStorage.setItem(
      CFG.SAVE_KEY,
      JSON.stringify({ cash: state.cash, missionIdx: state.missionIdx }),
    );
  } catch {
    // Storage unavailable; ignore.
  }
}

// A short burst of sparks or smoke at a point.
export function burst(state, x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 40 + Math.random() * 160;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.4,
      max: 0.8,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

export function updateParticles(state, dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92;
    pt.vy *= 0.92;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  for (const f of state.floaters) {
    f.y -= 34 * dt;
    f.life -= dt;
  }
  state.floaters = state.floaters.filter((f) => f.life > 0);
  if (state.banner && state.banner.t !== Infinity) {
    state.banner.t -= dt;
    if (state.banner.t <= 0) state.banner = null;
  }
  if (state.message) {
    state.message.t -= dt;
    if (state.message.t <= 0) state.message = null;
  }
}
