// Puerto Luna — screenshot staging. When the page opens with ?shot=...,
// the game sets up one fixed scene instead of the title screen, so the
// screenshots are real renders of the game in a known state.

import { CFG } from './config.js';
import { addHeat, layRoadblocks } from './wanted.js';

function givePlayerCar(state, x, y, angle, speed, color) {
  const car = {
    kind: 'player',
    x,
    y,
    angle,
    speed,
    color: color || '#d94f3d',
    axis: 'h',
    dir: 1,
    hp: 100,
    lastTurn: 0,
  };
  state.player.car = car;
  state.player.onFoot = false;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  state.camera.x = x;
  state.camera.y = y;
  return car;
}

function addTrafficNear(state, x, y) {
  const spots = [
    { x: x - 260, y: y - 46, angle: 0, color: '#3d7ad9' },
    { x: x + 320, y: y + 46, angle: Math.PI, color: '#e8c53a' },
    { x: x - 120, y: y + 200, angle: Math.PI / 2, color: '#5b8c5a' },
  ];
  for (const s of spots) {
    state.cars.push({
      kind: 'traffic',
      x: s.x,
      y: s.y,
      angle: s.angle,
      speed: 130,
      color: s.color,
      axis: 'h',
      dir: 1,
      hp: 100,
      lastTurn: 0,
    });
  }
}

export function setupShot(state) {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return;
  state.shotMode = shot;
  state.time = 6;
  const lm = state.city.landmarks;

  if (shot === 'start') {
    // Title screen over the island, camera drifting over the centre.
    state.mode = 'title';
    state.camera.x = CFG.WORLD_W / 2;
    state.camera.y = CFG.WORLD_H / 2;
    return;
  }

  if (shot === 'play') {
    // Rico driving through town on the Parcel Run, buyer waiting at the market.
    state.mode = 'play';
    state.cash = 850;
    state.hasGun = true;
    state.missionIdx = 1;
    state.stepIdx = 1;
    state.missionTimer = 58;
    givePlayerCar(state, 1500, 1100, 0, 280, '#d94f3d');
    addTrafficNear(state, 1500, 1100);
    state.marker = { x: lm.market.x, y: lm.market.y };
    state.objective = 'Deliver to the market buyer';
    state.objectiveTimer = 58;
    return;
  }

  if (shot === 'chase') {
    // Three stars, three police cars closing in, a roadblock ahead.
    state.mode = 'play';
    state.cash = 1420;
    state.hasGun = true;
    state.missionIdx = 2;
    state.stepIdx = 0;
    givePlayerCar(state, 1500, 1100, 0, 320, '#e8e8e8');
    addTrafficNear(state, 1500, 1100);
    state.player.x = 1500;
    state.player.y = 1100;
    addHeat(state, 45);
    state.lastCrimeAt = state.time;
    layRoadblocks(state);
    const spots = [
      { x: 1150, y: 1010, angle: 0.3 },
      { x: 1180, y: 1240, angle: -0.2 },
      { x: 1850, y: 980, angle: Math.PI - 0.4 },
    ];
    for (const s of spots) {
      state.police.push({ x: s.x, y: s.y, angle: s.angle, speed: 300, hp: 100 });
    }
    state.objective = 'Lose the heat — hideout or lay low';
    return;
  }

  if (shot === 'mission') {
    // The island is Rico's: all seven missions done, the Big Score banked.
    state.mode = 'play';
    state.cash = 3200;
    state.hasGun = true;
    state.missionIdx = 7;
    state.stepIdx = 0;
    state.stats.missionsDone = 7;
    state.stats.faresDone = 3;
    givePlayerCar(state, 2800, 420, -Math.PI / 2, 0, '#d94f3d');
    state.banner = { title: 'MISSION COMPLETE', sub: 'The Big Score  +$2,500', t: Infinity };
    state.objective = 'Puerto Luna is yours — free roam';
    return;
  }
}
