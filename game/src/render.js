// Puerto Luna — everything the player sees: the island from above, the
// cars and crowds on it, the HUD, the minimap and the menu screens.

import { CFG, MISSIONS, PALETTE } from './config.js';
import { clamp } from './world.js';

function viewBounds(state) {
  const cam = state.camera;
  const hw = CFG.VIEW_W / 2 / cam.zoom;
  const hh = CFG.VIEW_H / 2 / cam.zoom;
  return { x0: cam.x - hw - 60, y0: cam.y - hh - 60, x1: cam.x + hw + 60, y1: cam.y + hh + 60 };
}

function toScreen(state, wx, wy) {
  const cam = state.camera;
  return {
    x: (wx - cam.x) * cam.zoom + CFG.VIEW_W / 2,
    y: (wy - cam.y) * cam.zoom + CFG.VIEW_H / 2,
  };
}

function inView(vb, x, y, r) {
  return x + r > vb.x0 && x - r < vb.x1 && y + r > vb.y0 && y - r < vb.y1;
}

function drawCarBody(ctx, x, y, angle, color, police, zoom) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const w = 40 * zoom;
  const h = 20 * zoom;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 6 * zoom);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.beginPath();
  ctx.roundRect(-w * 0.18, -h / 2 + 3 * zoom, w * 0.36, h - 6 * zoom, 3 * zoom);
  ctx.fill();
  ctx.fillStyle = '#1c1f26';
  ctx.fillRect(w * 0.28, -h / 2 + 1, 5 * zoom, 4 * zoom);
  ctx.fillRect(w * 0.28, h / 2 - 5 * zoom, 5 * zoom, 4 * zoom);
  ctx.fillRect(-w / 2 - 1, -h / 2 + 1, 5 * zoom, 4 * zoom);
  ctx.fillRect(-w / 2 - 1, h / 2 - 5 * zoom, 5 * zoom, 4 * zoom);
  if (police) {
    const t = Math.floor(performance.now() / 180) % 2;
    ctx.fillStyle = t === 0 ? '#ff3b30' : '#2f7bff';
    ctx.beginPath();
    ctx.arc(-w * 0.05, 0, 4.5 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-w * 0.32, -h / 2 + 2, w * 0.2, h - 4);
  }
  ctx.restore();
}

function drawWorld(state, ctx) {
  const { city } = state;
  const vb = viewBounds(state);
  const cam = state.camera;
  const z = cam.zoom;

  // Ocean, sand ring, then the grass the city sits on.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
  const sand = toScreen(state, 0, 0);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(
    sand.x - 0,
    sand.y - 0,
    CFG.WORLD_W * z,
    CFG.WORLD_H * z,
  );
  ctx.fillStyle = PALETTE.grass;
  const inner = toScreen(state, CFG.BEACH, CFG.BEACH);
  ctx.fillRect(
    inner.x,
    inner.y,
    (CFG.WORLD_W - CFG.BEACH * 2) * z,
    (CFG.WORLD_H - CFG.BEACH * 2) * z,
  );
  // Wave lines, clipped to the sand ring so they only ever read as water.
  ctx.save();
  ctx.beginPath();
  const band = (x, y, w, h) => {
    const s = toScreen(state, x, y);
    ctx.rect(s.x, s.y, w * z, h * z);
  };
  band(0, 0, CFG.WORLD_W, CFG.BEACH);
  band(0, CFG.WORLD_H - CFG.BEACH, CFG.WORLD_W, CFG.BEACH);
  band(0, 0, CFG.BEACH, CFG.WORLD_H);
  band(CFG.WORLD_W - CFG.BEACH, 0, CFG.BEACH, CFG.WORLD_H);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const wy = 40 + i * 46;
    ctx.beginPath();
    for (let x = 0; x <= CFG.VIEW_W; x += 40) {
      const y = wy + Math.sin(x * 0.02 + state.time * 1.4 + i) * 5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Roads: asphalt with a centre line, then sidewalks.
  ctx.fillStyle = PALETTE.road;
  for (const rx of city.roadsV) {
    const s = toScreen(state, rx - CFG.ROAD_W / 2, 0);
    ctx.fillRect(s.x, toScreen(state, 0, CFG.BEACH).y, CFG.ROAD_W * z, (CFG.WORLD_H - CFG.BEACH * 2) * z);
  }
  for (const ry of city.roadsH) {
    const s = toScreen(state, 0, ry - CFG.ROAD_W / 2);
    ctx.fillRect(toScreen(state, CFG.BEACH, 0).x, s.y, (CFG.WORLD_W - CFG.BEACH * 2) * z, CFG.ROAD_W * z);
  }
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 2.5 * z;
  ctx.setLineDash([16 * z, 18 * z]);
  for (const rx of city.roadsV) {
    const s = toScreen(state, rx, CFG.BEACH);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x, s.y + (CFG.WORLD_H - CFG.BEACH * 2) * z);
    ctx.stroke();
  }
  for (const ry of city.roadsH) {
    const s = toScreen(state, CFG.BEACH, ry);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + (CFG.WORLD_W - CFG.BEACH * 2) * z, s.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Parks and their palms.
  for (const park of city.parks) {
    if (!inView(vb, park.x + park.w / 2, park.y + park.h / 2, park.w)) continue;
    const s = toScreen(state, park.x, park.y);
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(s.x, s.y, park.w * z, park.h * z);
  }
  for (const b of city.buildings) {
    if (!inView(vb, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    const s = toScreen(state, b.x, b.y);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(s.x + 4 * z, s.y + 5 * z, b.w * z, b.h * z);
    ctx.fillStyle = b.roof;
    ctx.fillRect(s.x, s.y, b.w * z, b.h * z);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const cols = Math.max(1, Math.floor(b.w / 46));
    const rows = Math.max(1, Math.floor(b.h / 40));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(s.x + (8 + i * 46) * z, s.y + (8 + j * 40) * z, 14 * z, 10 * z);
      }
    }
  }
  ctx.fillStyle = '#4d8a3f';
  for (const palm of city.palms) {
    if (!inView(vb, palm.x, palm.y, 20)) continue;
    const s = toScreen(state, palm.x, palm.y);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 7 * z, 0, Math.PI * 2);
    ctx.fill();
  }

  // Named places: garage, bank, marina, ferry, hideouts.
  const lm = city.landmarks;
  drawLandmark(state, ctx, lm.garage, 'GARAGE', '#e8c53a');
  drawLandmark(state, ctx, lm.bank, 'LUNA BANK', '#e8e8e8');
  drawLandmark(state, ctx, lm.marina, 'MARINA', '#7fd4e8');
  drawLandmark(state, ctx, lm.ferry, 'FERRY', '#7fd4e8');
  drawLandmark(state, ctx, lm.dock, 'DOCKS', '#c9a06a');
  drawLandmark(state, ctx, lm.hideoutA, 'HIDEOUT', '#7be382');
  drawLandmark(state, ctx, lm.hideoutB, 'HIDEOUT', '#7be382');

  // Spike-strip roadblocks.
  for (const rb of state.roadblocks) {
    const s = toScreen(state, rb.x, rb.y);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(rb.angle);
    ctx.fillStyle = rb.hit ? '#5a5f68' : '#ff5a3c';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 9 * z, -8 * z);
      ctx.lineTo(i * 9 * z + 5 * z, 0);
      ctx.lineTo(i * 9 * z, 8 * z);
      ctx.lineTo(i * 9 * z - 5 * z, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Objective marker: a pulsing ring and a beacon of light.
  if (state.marker) {
    const m = state.marker;
    const s = toScreen(state, m.x, m.y);
    const pulse = 1 + Math.sin(state.time * 5) * 0.15;
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 26 * z * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,211,77,0.25)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 26 * z * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 5 * z, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.fare) {
    const s = toScreen(state, state.fare.dest.x, state.fare.dest.y);
    ctx.strokeStyle = '#7be382';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 22 * z, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#7be382';
    ctx.font = `bold ${Math.round(15 * z)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('$', s.x, s.y + 5 * z);
  }

  // Parked and traffic cars.
  for (const car of state.cars) {
    if (!inView(vb, car.x, car.y, 60)) continue;
    const s = toScreen(state, car.x, car.y);
    drawCarBody(ctx, s.x, s.y, car.angle, car.color, false, z);
    if (car.kind === 'target') {
      ctx.strokeStyle = '#ff5a3c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 30 * z, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Police cars.
  for (const cop of state.police) {
    if (!inView(vb, cop.x, cop.y, 60)) continue;
    const s = toScreen(state, cop.x, cop.y);
    drawCarBody(ctx, s.x, s.y, cop.angle, PALETTE.police, true, z);
  }
  // The player's car, drawn under the player only when on foot.
  const p = state.player;
  if (!p.onFoot && p.car) {
    const s = toScreen(state, p.car.x, p.car.y);
    const smoke = p.car.hp < 45;
    if (smoke && Math.random() < 0.4) {
      state.particles.push({
        x: p.car.x,
        y: p.car.y,
        vx: (Math.random() - 0.5) * 30,
        vy: -40 - Math.random() * 30,
        life: 0.7,
        max: 0.7,
        color: 'rgba(90,90,90,0.7)',
        size: 5,
      });
    }
    drawCarBody(ctx, s.x, s.y, p.car.angle, p.car.color, false, z);
  }
  // Pedestrians: waiting customers wear a green ring and a $ sign.
  for (const ped of state.peds) {
    if (!inView(vb, ped.x, ped.y, 30)) continue;
    const s = toScreen(state, ped.x, ped.y);
    if (ped.waiting) {
      ctx.strokeStyle = '#7be382';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 16 * z, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#7be382';
      ctx.font = `bold ${Math.round(13 * z)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('$', s.x, s.y - 20 * z);
    }
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 7 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(s.x + Math.cos(ped.angle) * 4 * z, s.y + Math.sin(ped.angle) * 4 * z, 2.5 * z, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player on foot.
  if (p.onFoot) {
    const s = toScreen(state, p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 8 * z, 9 * z, 4 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(s.x, s.y, CFG.PLAYER_RADIUS * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d94f3d';
    ctx.lineWidth = 3 * z;
    ctx.beginPath();
    ctx.arc(s.x, s.y, CFG.PLAYER_RADIUS * z, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(s.x + Math.cos(p.angle) * 6 * z, s.y + Math.sin(p.angle) * 6 * z, 3 * z, 0, Math.PI * 2);
    ctx.fill();
  }
  // Sparks, smoke and floating payouts.
  for (const pt of state.particles) {
    const s = toScreen(state, pt.x, pt.y);
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, pt.size * z, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const f of state.floaters) {
    const s = toScreen(state, f.x, f.y);
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.fillStyle = f.color;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(f.text, s.x, s.y);
  }
  ctx.globalAlpha = 1;

  // Off-screen objective arrow.
  if (state.marker) {
    const s = toScreen(state, state.marker.x, state.marker.y);
    if (s.x < 40 || s.x > CFG.VIEW_W - 40 || s.y < 40 || s.y > CFG.VIEW_H - 40) {
      const cx = clamp(s.x, 60, CFG.VIEW_W - 60);
      const cy = clamp(s.y, 60, CFG.VIEW_H - 60);
      const ang = Math.atan2(s.y - cy, s.x - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -11);
      ctx.lineTo(-10, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawLandmark(state, ctx, pos, label, color) {
  const s = toScreen(state, pos.x, pos.y);
  if (s.x < -80 || s.x > CFG.VIEW_W + 80 || s.y < -40 || s.y > CFG.VIEW_H + 40) return;
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(11 * state.camera.zoom)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, s.x, s.y - 14 * state.camera.zoom);
}

function drawHud(state, ctx) {
  ctx.textAlign = 'left';
  // Cash and health, top left.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(14, 12, 220, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#7be382';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`$${Math.floor(state.cash)}`, 26, 42);
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.roundRect(26, 50, 150, 12, 6);
  ctx.fill();
  ctx.fillStyle = state.health > 30 ? '#7be382' : '#ff5a3c';
  ctx.beginPath();
  ctx.roundRect(26, 50, 150 * clamp(state.health / 100, 0, 1), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.fillText('HEALTH', 182, 61);

  // Wanted stars, top right.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(CFG.VIEW_W - 214, 12, 200, 44, 10);
  ctx.fill();
  ctx.font = '24px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < state.wanted ? '#ffd34d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', CFG.VIEW_W - 30 - i * 32, 44);
  }

  // Objective, top centre.
  if (state.objective) {
    ctx.textAlign = 'center';
    const w = Math.min(640, ctx.measureText(state.objective).width + 40);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(CFG.VIEW_W / 2 - w / 2, 12, w, 34, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(state.objective, CFG.VIEW_W / 2, 34);
    if (state.objectiveTimer !== null && state.objectiveTimer !== undefined) {
      ctx.fillStyle = state.objectiveTimer < 10 ? '#ff5a3c' : '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${Math.ceil(state.objectiveTimer)}s`, CFG.VIEW_W / 2, 58);
    }
  }

  // Mission counter and fare panel, bottom left.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(14, CFG.VIEW_H - 58, 250, 44, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  const done = Math.min(state.missionIdx, MISSIONS.length);
  ctx.fillText(`MISSIONS  ${done}/${MISSIONS.length}`, 26, CFG.VIEW_H - 31);
  if (state.fare) {
    ctx.fillStyle = '#7be382';
    ctx.fillText(`FARE  $${state.fare.base}  —  ${Math.ceil(state.fare.tLeft)}s`, 26, CFG.VIEW_H - 31 + 0);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText('Drive to the green $ marker', 26, CFG.VIEW_H - 14);
  } else {
    ctx.fillStyle = '#ccc';
    ctx.font = '13px sans-serif';
    const hint = state.player.onFoot
      ? 'WASD walk · E enter car / pick up fare · M mute'
      : 'WASD drive · E get out · Click shoot' + (state.hasGun ? '' : ' (gun after mission 1)');
    ctx.fillText(hint, 26, CFG.VIEW_H - 14);
  }

  // Step progress bar (holdout / robbery).
  if (state.stepProgress > 0 && state.stepProgress < 1) {
    const bw = 340;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(CFG.VIEW_W / 2 - bw / 2, CFG.VIEW_H - 84, bw, 20, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.roundRect(CFG.VIEW_W / 2 - bw / 2 + 3, CFG.VIEW_H - 81, (bw - 6) * state.stepProgress, 14, 7);
    ctx.fill();
  }

  // Banner and toast.
  if (state.banner) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px sans-serif';
    const bw = Math.min(720, ctx.measureText(state.banner.title).width + 80);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(CFG.VIEW_W / 2 - bw / 2, 150, bw, 76, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.fillText(state.banner.title, CFG.VIEW_W / 2, 182);
    if (state.banner.sub) {
      ctx.fillStyle = '#fff';
      ctx.font = '18px sans-serif';
      ctx.fillText(state.banner.sub, CFG.VIEW_W / 2, 210);
    }
  }
  if (state.message) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.fillText(state.message.text, CFG.VIEW_W / 2, CFG.VIEW_H - 100);
  }

  drawMinimap(state, ctx);
}

function drawMinimap(state, ctx) {
  const mw = 190;
  const mh = 142;
  const mx = CFG.VIEW_W - mw - 14;
  const my = CFG.VIEW_H - mh - 14;
  const sx = mw / CFG.WORLD_W;
  const sy = mh / CFG.WORLD_H;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(mx - 5, my - 5, mw + 10, mh + 10, 8);
  ctx.fill();
  ctx.fillStyle = '#14607f';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#7fae62';
  ctx.fillRect(mx + CFG.BEACH * sx, my + CFG.BEACH * sy, (CFG.WORLD_W - CFG.BEACH * 2) * sx, (CFG.WORLD_H - CFG.BEACH * 2) * sy);
  ctx.strokeStyle = '#3a3f47';
  ctx.lineWidth = 3;
  for (const rx of state.city.roadsV) {
    ctx.beginPath();
    ctx.moveTo(mx + rx * sx, my + CFG.BEACH * sy);
    ctx.lineTo(mx + rx * sx, my + (CFG.WORLD_H - CFG.BEACH) * sy);
    ctx.stroke();
  }
  for (const ry of state.city.roadsH) {
    ctx.beginPath();
    ctx.moveTo(mx + CFG.BEACH * sx, my + ry * sy);
    ctx.lineTo(mx + (CFG.WORLD_W - CFG.BEACH) * sx, my + ry * sy);
    ctx.stroke();
  }
  if (state.marker) {
    const pulse = 3 + Math.sin(state.time * 5) * 1.5;
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(mx + state.marker.x * sx, my + state.marker.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.fare) {
    ctx.fillStyle = '#7be382';
    ctx.beginPath();
    ctx.arc(mx + state.fare.dest.x * sx, my + state.fare.dest.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of state.police) {
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath();
    ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 4, 0, Math.PI * 2);
  ctx.stroke();
}

function drawTitle(state, ctx) {
  ctx.fillStyle = 'rgba(8,20,32,0.45)';
  ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('PUERTO LUNA', CFG.VIEW_W / 2, 240);
  ctx.fillStyle = '#fff';
  ctx.font = '22px sans-serif';
  ctx.fillText('An open-world crime story on a sun-soaked island', CFG.VIEW_W / 2, 282);
  ctx.fillStyle = '#e8d29a';
  ctx.font = 'italic 17px sans-serif';
  ctx.fillText('“Rico, the island is yours. Take it.” — Mama Luz', CFG.VIEW_W / 2, 320);
  const blink = Math.floor(state.time * 2) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Press ENTER to play', CFG.VIEW_W / 2, 420);
  }
  ctx.fillStyle = '#ddd';
  ctx.font = '15px sans-serif';
  ctx.fillText('WASD move / drive · E enter & exit cars · Mouse click to shoot · ESC pause · M mute', CFG.VIEW_W / 2, 470);
  ctx.fillText('7 story missions · taxi fares · wanted levels · roadblocks · hideouts', CFG.VIEW_W / 2, 496);
  if (state.saveInfo) {
    ctx.fillStyle = '#7be382';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`Continue: mission ${state.saveInfo.missionIdx + 1} of ${MISSIONS.length} — $${state.saveInfo.cash} saved`, CFG.VIEW_W / 2, 540);
  }
}

function drawEndCard(state, ctx, title, color, lines) {
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText(title, CFG.VIEW_W / 2, 300);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, CFG.VIEW_W / 2, 350 + i * 32);
  });
  const blink = Math.floor(state.time * 2) % 2 === 0;
  if (blink) {
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Press ENTER to continue', CFG.VIEW_W / 2, 350 + lines.length * 32 + 30);
  }
}

export function draw(state, ctx) {
  ctx.clearRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
  if (state.mode === 'title') {
    drawWorld(state, ctx);
    drawTitle(state, ctx);
    return;
  }
  drawWorld(state, ctx);
  drawHud(state, ctx);
  if (state.mode === 'pause') {
    drawEndCard(state, ctx, 'PAUSED', '#fff', [
      `Cash $${Math.floor(state.cash)} · Mission ${Math.min(state.missionIdx + 1, MISSIONS.length)} of ${MISSIONS.length}`,
      'ESC resume · R restart the mission',
    ]);
  } else if (state.mode === 'busted') {
    drawEndCard(state, ctx, 'BUSTED', '#7fb7ff', [
      `The Luna Bay police caught Rico. Fine: $${CFG.BUST_FINE}.`,
      `Cash now $${Math.floor(state.cash)}.`,
    ]);
  } else if (state.mode === 'wasted') {
    drawEndCard(state, ctx, 'WASTED', '#ff5a3c', [
      'Rico went down in the streets of Puerto Luna.',
      `Cash kept: $${Math.floor(state.cash)}.`,
    ]);
  } else if (state.mode === 'done') {
    drawEndCard(state, ctx, 'PUERTO LUNA IS YOURS', '#ffd34d', [
      'All seven missions complete. Mama Luz is proud of you, Rico.',
      `Final cash: $${Math.floor(state.cash)} · Fares driven: ${state.stats.faresDone}`,
    ]);
  }
}
