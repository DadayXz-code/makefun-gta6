// Rendering for Puerto Luna: top-down camera, the island, traffic, the
// player, the HUD and the minimap. No assets are loaded from anywhere —
// every pixel is drawn procedurally from the world state.
import { TILE, WORLD, ROADS_X, ROADS_Y, ROAD_HALF, PLACES, PALETTE, VIEW_W, VIEW_H } from './config.js';
import { MISSIONS, onRoad, districtAt, missionStep, missionTarget } from './world.js';
import { hideoutFactor } from './wanted.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-20, -11, 44, 26);
  // Body
  ctx.fillStyle = car.color;
  roundRect(ctx, -21, -11, 42, 22, 6);
  ctx.fill();
  // Roof + windshield
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, -6, -9, 16, 18, 4);
  ctx.fill();
  ctx.fillStyle = '#1a2233';
  ctx.fillRect(8, -8, 4, 16);
  // Headlights
  ctx.fillStyle = '#fff8c8';
  ctx.fillRect(19, -9, 3, 4);
  ctx.fillRect(19, 5, 3, 4);
  if (car.police) {
    const t = performance.now() / 300;
    ctx.fillStyle = Math.floor(t) % 2 === 0 ? '#ff2d2d' : '#2d5cff';
    ctx.fillRect(-4, -11, 8, 5);
    ctx.fillStyle = Math.floor(t) % 2 === 0 ? '#2d5cff' : '#ff2d2d';
    ctx.fillRect(-4, 6, 8, 5);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
  }
  if (car.smoke > 0) {
    ctx.fillStyle = 'rgba(80,80,80,0.55)';
    ctx.beginPath();
    ctx.arc(-16, 0, 6 + Math.random() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPed(ctx, ped) {
  const bob = Math.sin(ped.walkPhase) * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(ped.x, ped.y + 6, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y + bob * 0.3, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c49a';
  ctx.beginPath();
  ctx.arc(ped.x + Math.cos(ped.angle) * 2, ped.y - 7 + bob * 0.3, 4.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(ctx, p) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 7, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rico Salas: red jacket, dark jeans.
  ctx.fillStyle = '#c22e2e';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0c08a';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.angle) * 3, p.y - 8, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222831';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.angle) * 3, p.y - 9.5, 5, Math.PI, Math.PI * 2);
  ctx.fill();
  // Direction tick
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.angle) * 15, p.y + Math.sin(p.angle) * 15);
  ctx.stroke();
}

function drawGround(ctx, cam) {
  const x0 = cam.x, y0 = cam.y, x1 = cam.x + VIEW_W, y1 = cam.y + VIEW_H;
  // Grass base
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, VIEW_W, VIEW_H);
  // Beach + water (south edge)
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(x0, 0), Math.max(y0, 58 * TILE), Math.min(x1, WORLD) - Math.max(x0, 0), 2 * TILE);
  const wob = Math.sin(performance.now() / 900) * 3;
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(Math.max(x0, 0), Math.max(y0, 60 * TILE) + wob, Math.min(x1, WORLD) - Math.max(x0, 0), WORLD - 60 * TILE);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let i = 0; i < 6; i += 1) {
    const wx = ((i * 317 + Math.floor(performance.now() / 40)) % WORLD);
    ctx.fillRect(wx, 61.4 * TILE, 90, 3);
  }
  // Plaza
  ctx.fillStyle = PALETTE.plaza;
  ctx.fillRect(28 * TILE, 28 * TILE, 8 * TILE, 8 * TILE);
  ctx.fillStyle = '#2f7fb8';
  ctx.beginPath();
  ctx.arc(32 * TILE, 32 * TILE, 1.6 * TILE, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8e4c8';
  ctx.beginPath();
  ctx.arc(32 * TILE, 32 * TILE, 1.1 * TILE, 0, Math.PI * 2);
  ctx.fill();
  // Roads
  ctx.fillStyle = PALETTE.road;
  for (const rx of ROADS_X) ctx.fillRect(rx * TILE - ROAD_HALF, 0, ROAD_HALF * 2, WORLD);
  for (const ry of ROADS_Y) ctx.fillRect(0, ry * TILE - ROAD_HALF, WORLD, ROAD_HALF * 2);
  // Sidewalks
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of ROADS_X) {
    ctx.fillRect(rx * TILE - ROAD_HALF - 10, 0, 10, WORLD);
    ctx.fillRect(rx * TILE + ROAD_HALF, 0, 10, WORLD);
  }
  for (const ry of ROADS_Y) {
    ctx.fillRect(0, ry * TILE - ROAD_HALF - 10, WORLD, 10);
    ctx.fillRect(0, ry * TILE + ROAD_HALF, WORLD, 10);
  }
  // Centre dashes
  ctx.fillStyle = PALETTE.roadLine;
  for (const rx of ROADS_X) {
    for (let y = 0; y < WORLD; y += 64) {
      if (onRoad(rx * TILE, y)) continue;
      ctx.fillRect(rx * TILE - 2, y, 4, 30);
    }
  }
  for (const ry of ROADS_Y) {
    for (let x = 0; x < WORLD; x += 64) {
      if (onRoad(x, ry * TILE)) continue;
      ctx.fillRect(x, ry * TILE - 2, 30, 4);
    }
  }
  // District labels
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OLD TOWN', 10 * TILE, 4 * TILE);
  ctx.fillText('MARINA DISTRICT', 54 * TILE, 4 * TILE);
  ctx.fillText('DOWNTOWN', 54 * TILE, 26 * TILE);
  ctx.fillText('BEACHFRONT', 10 * TILE, 50 * TILE);
}

function drawBuildings(ctx, world, cam) {
  for (const b of world.buildings) {
    if (b.x > cam.x + VIEW_W || b.x + b.w < cam.x || b.y > cam.y + VIEW_H || b.y + b.h < cam.y) continue;
    if (b.tall) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x + 14, b.y + 16, b.w, b.h);
    }
    ctx.fillStyle = b.hue;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    // Windows
    ctx.fillStyle = 'rgba(255,240,180,0.8)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        if (((i * 7 + j * 13 + (b.x | 0)) % 3) === 0) continue;
        ctx.fillRect(b.x + 10 + i * 34, b.y + 10 + j * 34, 14, 12);
      }
    }
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HOTEL LUNA', b.x + b.w / 2, b.y + 18);
    }
  }
}

function drawTrees(ctx, world, cam) {
  for (const t of world.trees) {
    if (t.x < cam.x - 30 || t.x > cam.x + VIEW_W + 30 || t.y < cam.y - 30 || t.y > cam.y + VIEW_H + 30) continue;
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(t.x - 2, t.y - 2, 4, 8);
    ctx.fillStyle = t.palm ? '#5da24a' : '#3f7d33';
    ctx.beginPath();
    ctx.arc(t.x, t.y - 6, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(t.x - 4, t.y - 10, t.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRoadblocks(ctx, world) {
  for (const block of world.roadblocks || []) {
    if (block.hit) continue;
    ctx.save();
    ctx.translate(block.x, block.y);
    ctx.rotate(block.angle);
    // A striped spike barrier across the road, blinking as it ages.
    const blink = block.ttl < 5 ? (Math.floor(performance.now() / 200) % 2 === 0 ? 1 : 0.45) : 1;
    ctx.globalAlpha = blink;
    ctx.fillStyle = '#20242e';
    ctx.fillRect(-34, -8, 68, 16);
    for (let i = -30; i < 30; i += 12) {
      ctx.fillStyle = (i / 12) % 2 === 0 ? '#ffd23d' : '#f5f5f5';
      ctx.fillRect(i, -8, 12, 16);
    }
    ctx.fillStyle = '#ff2d2d';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    ctx.restore();
  }
}

function drawMarker(ctx, world) {
  const target = missionTarget(world);
  if (!target) return;
  const pulse = 1 + Math.sin(performance.now() / 250) * 0.18;
  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.strokeStyle = '#ffd23d';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 46 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,210,61,0.25)';
  ctx.beginPath();
  ctx.arc(0, 0, 46 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath();
  ctx.moveTo(0, -66 * pulse);
  ctx.lineTo(10, -48 * pulse);
  ctx.lineTo(-10, -48 * pulse);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText(target.name, 0, -76);
  ctx.restore();
}

function drawMinimap(ctx, world) {
  const S = 168;
  const x = VIEW_W - S - 14;
  const y = 14;
  const k = S / WORLD;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,22,0.82)';
  roundRect(ctx, x - 6, y - 6, S + 12, S + 12, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x, y, S, S);
  ctx.clip();
  ctx.fillStyle = '#5f8f4a';
  ctx.fillRect(x, y, S, S);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(x, y + 60 * TILE * k, S, S - 60 * TILE * k);
  ctx.fillStyle = '#3a3f4a';
  for (const rx of ROADS_X) ctx.fillRect(x + rx * TILE * k - 1.5, y, 3, S);
  for (const ry of ROADS_Y) ctx.fillRect(x, y + ry * TILE * k - 1.5, S, 3);
  const target = missionTarget(world);
  if (target) {
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.arc(x + target.x * k, y + target.y * k, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd23d';
    ctx.beginPath();
    ctx.arc(x + target.x * k, y + target.y * k, 8 + Math.sin(performance.now() / 250) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const cop of world.police) {
    ctx.fillStyle = '#ff2d2d';
    ctx.beginPath();
    ctx.arc(x + cop.x * k, y + cop.y * k, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const block of world.roadblocks || []) {
    if (block.hit) continue;
    ctx.fillStyle = '#ff8c1a';
    ctx.beginPath();
    ctx.arc(x + block.x * k, y + block.y * k, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = world.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  ctx.save();
  ctx.translate(x + px * k, y + py * k);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PUERTO LUNA', x, y + S + 18);
}

function drawHud(ctx, world) {
  const p = world.player;
  ctx.save();
  // Cash + health
  ctx.fillStyle = 'rgba(10,14,22,0.75)';
  roundRect(ctx, 14, 14, 250, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#7dd93d';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.cash}`, 28, 44);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px sans-serif';
  ctx.fillText('RICO SALAS', 28, 62);
  // Health bar
  ctx.fillStyle = '#333';
  roundRect(ctx, 130, 30, 110, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.hp > 40 ? '#7dd93d' : '#d94f3d';
  roundRect(ctx, 130, 30, 110 * (p.hp / 100), 12, 6);
  ctx.fill();
  // Wanted stars
  ctx.fillStyle = 'rgba(10,14,22,0.75)';
  roundRect(ctx, 14, 88, 34 * 5 + 20, 40, 10);
  ctx.fill();
  for (let i = 0; i < 5; i += 1) {
    ctx.font = '26px sans-serif';
    ctx.fillStyle = i < Math.floor(p.wanted) ? '#ffd23d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 24 + i * 34, 117);
  }
  // Hiding in a hideout cools the heat twice as fast — say so.
  if (p.wanted > 0 && hideoutFactor(world) > 1) {
    ctx.fillStyle = '#7dd93d';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('HIDDEN — heat cooling fast', 28, 144);
  }
  // Mission panel
  const step = missionStep(world);
  if (world.mission && step) {
    ctx.fillStyle = 'rgba(10,14,22,0.75)';
    const lines = [world.mission.title, step.text];
    roundRect(ctx, 14, VIEW_H - 92, 460, 78, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`MISSION ${world.missionIndex + 1}/${MISSIONS.length}: ${lines[0]}`, 28, VIEW_H - 62);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.fillText(lines[1], 28, VIEW_H - 38);
    if (step.time && world.missionTimer > 0) {
      ctx.fillStyle = world.missionTimer < 15 ? '#ff5d5d' : '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`${Math.ceil(world.missionTimer)}s`, 28, VIEW_H - 20);
    }
  }
  // Controls hint
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('WASD drive / walk · E enter car · P pause · M mute', VIEW_W - 14, VIEW_H - 14);
  ctx.textAlign = 'left';
  // Banner
  if (world.banner && world.bannerT > 0) {
    const a = Math.min(1, world.bannerT);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(10,14,22,0.8)';
    roundRect(ctx, VIEW_W / 2 - 260, 150, 520, 76, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.banner.title, VIEW_W / 2, 182);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    ctx.fillText(world.banner.sub, VIEW_W / 2, 208);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
  drawMinimap(ctx, world);
  ctx.restore();
}

function drawTitle(ctx, world) {
  ctx.fillStyle = 'rgba(8,10,18,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('PUERTO LUNA', VIEW_W / 2, 200);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('An open-world crime story on a sun-soaked island', VIEW_W / 2, 240);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Rico Salas is back in Puerto Luna. Mama Luz has seven jobs for him —', VIEW_W / 2, 300);
  ctx.fillText('and the Luna PD has other plans.', VIEW_W / 2, 324);
  ctx.fillStyle = '#7dd93d';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press ENTER to start', VIEW_W / 2, 400);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '14px sans-serif';
  ctx.fillText('WASD move / drive · E enter or steal a car · P pause · M mute', VIEW_W / 2, 440);
  ctx.fillText('An original game. Puerto Luna, Rico Salas and Mama Luz are invented characters.', VIEW_W / 2, 470);
  ctx.textAlign = 'left';
}

function drawEnd(ctx, world) {
  const p = world.player;
  ctx.fillStyle = 'rgba(8,10,18,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = p.busted ? '#2d5cff' : '#d94f3d';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(p.busted ? 'BUSTED' : 'WASTED', VIEW_W / 2, 300);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  ctx.fillText(p.busted ? 'The Luna PD took you in. $150 bail.' : 'You woke up at Hospital Santa Fe. -$200.', VIEW_W / 2, 340);
  ctx.fillStyle = '#7dd93d';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press ENTER to keep playing', VIEW_W / 2, 400);
  ctx.textAlign = 'left';
}

export function render(ctx, world, screen) {
  const p = world.player;
  const fx = p.car ? p.car.x : p.x;
  const fy = p.car ? p.car.y : p.y;
  const shake = world.shake > 0 ? (Math.random() - 0.5) * 8 : 0;
  const cam = {
    x: Math.max(0, Math.min(WORLD - VIEW_W, fx - VIEW_W / 2 + shake)),
    y: Math.max(0, Math.min(WORLD - VIEW_H, fy - VIEW_H / 2 + shake)),
  };
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawGround(ctx, cam);
  drawBuildings(ctx, world, cam);
  drawTrees(ctx, world, cam);
  drawMarker(ctx, world);
  drawRoadblocks(ctx, world);
  const allCars = world.cars.concat(world.police);
  for (const car of allCars) {
    if (car.dead) continue;
    drawCar(ctx, car);
  }
  for (const ped of world.peds) drawPed(ctx, ped);
  if (p.onFoot) drawPlayer(ctx, p);
  ctx.restore();
  if (screen === 'title') drawTitle(ctx, world);
  else if (screen === 'end') drawEnd(ctx, world);
  else drawHud(ctx, world);
  if (screen === 'paused') {
    ctx.fillStyle = 'rgba(8,10,18,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2);
    ctx.font = '16px sans-serif';
    ctx.fillText('Press P to resume', VIEW_W / 2, VIEW_H / 2 + 40);
    ctx.textAlign = 'left';
  }
  if (screen === 'done') {
    ctx.fillStyle = 'rgba(8,10,18,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('PUERTO LUNA IS YOURS', VIEW_W / 2, 300);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Final cash: $${p.cash} · Cars stolen: ${world.stats.carsStolen} · Cops lost: ${world.stats.copsLost} · Spike strips hit: ${world.stats.spikesHit}`, VIEW_W / 2, 340);
    ctx.textAlign = 'left';
  }
}
