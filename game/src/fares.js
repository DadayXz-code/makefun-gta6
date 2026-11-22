// Puerto Luna — the taxi side-job: islanders waiting on the sidewalk,
// a 90-second meter, and a tip for a fast drop-off.

import { CFG, FARE } from './config.js';
import { clamp, dist, nearestRoadPoint } from './world.js';

// A waiting islander stands on the sidewalk and never walks away: the
// pedestrian update skips anyone with waiting set, so the customer is
// exactly where the player left them.
export function spawnCustomers(state, rng) {
  const spots = [];
  for (let i = 0; i < FARE.CUSTOMERS; i++) {
    const vertical = rng.chance(0.5);
    const road = vertical
      ? rng.pick(state.city.roadsV)
      : rng.pick(state.city.roadsH);
    const x = vertical ? road + (rng.chance(0.5) ? 64 : -64) : rng.range(240, CFG.WORLD_W - 240);
    const y = vertical ? rng.range(240, CFG.WORLD_H - 240) : road + (rng.chance(0.5) ? 64 : -64);
    spots.push({
      x: clamp(x, 180, CFG.WORLD_W - 180),
      y: clamp(y, 180, CFG.WORLD_H - 180),
      angle: rng.range(0, Math.PI * 2),
      speed: 0,
      color: rng.pick(['#e8e8e8', '#d9a05b', '#7fa8c9', '#c96f4a', '#8a9a5b']),
      waiting: true,
      flee: 0,
      tx: 0,
      ty: 0,
    });
  }
  for (const s of spots) state.peds.push(s);
}

export function nearestCustomer(state) {
  const p = state.player;
  let best = null;
  let bestD = Infinity;
  for (const ped of state.peds) {
    if (!ped.waiting) continue;
    const d = dist(ped.x, ped.y, p.x, p.y);
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return bestD <= FARE.PICKUP_R ? best : null;
}

// The player picks a customer up on foot. The customer names a destination
// across town and the meter starts.
export function pickupFare(state, rng) {
  if (state.fare) return false;
  const customer = nearestCustomer(state);
  if (!customer) return false;
  customer.waiting = false;
  customer.flee = 0;
  const dest = nearestRoadPoint(
    state.city,
    rng.range(240, CFG.WORLD_W - 240),
    rng.range(240, CFG.WORLD_H - 240),
  );
  const trip = dist(customer.x, customer.y, dest.x, dest.y);
  state.fare = {
    customer,
    dest,
    tLeft: FARE.METER_S,
    trip,
    base: FARE.BASE + Math.round(trip * FARE.PER_PX),
  };
  state.message = { text: 'Fare picked up — drive to the marker!', t: 3 };
  return true;
}

export function farePayout(state) {
  const f = state.fare;
  if (!f) return 0;
  const tip = f.tLeft > FARE.TIP_WINDOW ? Math.round(f.base * (FARE.TIP_MULT - 1)) : 0;
  return f.base + tip;
}

// Meter ticks down while a fare is active; drop the customer off at the
// marker and get paid. The meter only runs while the player is in a car.
export function updateFare(state, dt) {
  const f = state.fare;
  if (!f) return;
  const p = state.player;
  if (!p.onFoot && p.car) {
    f.tLeft -= dt;
    const d = dist(p.x, p.y, f.dest.x, f.dest.y);
    if (d < 70) {
      const pay = farePayout(state);
      state.cash += pay;
      state.stats.faresDone += 1;
      state.floaters.push({ x: p.x, y: p.y - 30, text: `+$${pay} FARE`, life: 1.6, color: '#7be382' });
      state.message = { text: `Fare complete — $${pay} in your pocket.`, t: 3 };
      state.fare = null;
      return;
    }
    if (f.tLeft <= 0) {
      state.message = { text: 'Fare expired — the customer walked away.', t: 3 };
      state.fare = null;
    }
  }
}
