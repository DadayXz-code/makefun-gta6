// Taxi fares — Puerto Luna's islanders flag Rico down for a ride.
//
// A fare starts when an islander on the sidewalk gets tired of waiting
// for the bus: they stand by the road with a gold dollar bubble, and if
// Rico pulls up in a car they climb in and name a place across the
// island. Get them there before the meter runs out and the fare pays
// out; keep them waiting, leave the car, or run out of time and they
// walk off, and the island remembers a rude driver. A fast delivery
// pays a tip.
//
// This file only reads the island's constants. The world loop calls
// updateFares every step, the renderer asks drawFares to show the
// waiting customer and the destination, and createWorld calls
// setupFares once so the fare state always exists.
import {
  PLACES,
  FARE_FIRST_DELAY,
  FARE_SPAWN_INTERVAL,
  FARE_WAIT_TIMEOUT,
  FARE_TIME_LIMIT,
  FARE_BASE,
  FARE_PER_PX,
  FARE_TIP_MULT,
  FARE_PICKUP_RADIUS,
  FARE_DROPOFF_RADIUS,
} from './config.js';

// A banner is two fields on the world; the renderer shows it while its
// timer runs. Fares announce themselves the same way missions do.
function announce(world, title, sub) {
  world.banner = { title, sub };
  world.bannerT = 3.2;
}

function resetOfferTimer(world) {
  world.fareT = FARE_SPAWN_INTERVAL;
}

// The places worth a trip: a fare's destination must be a real drive
// away, not the corner the customer already stands on.
function farDestinations(fromX, fromY) {
  const keys = [];
  for (const key of Object.keys(PLACES)) {
    const place = PLACES[key];
    if (Math.hypot(place.x - fromX, place.y - fromY) > 600) keys.push(key);
  }
  return keys;
}

function offerFare(world) {
  const peds = world.peds;
  if (peds.length === 0) return;
  const ped = peds[Math.floor(world.rng() * peds.length)];
  const destKeys = farDestinations(ped.x, ped.y);
  if (destKeys.length === 0) return;
  const destKey = destKeys[Math.floor(world.rng() * destKeys.length)];
  const dest = PLACES[destKey];
  const trip = Math.hypot(dest.x - ped.x, dest.y - ped.y);
  world.activeFare = {
    ped,
    destKey,
    dest,
    payout: FARE_BASE + Math.round(trip * FARE_PER_PX),
    state: 'waiting',
    waitT: 0,
    timeLeft: 0,
  };
}

function boardFare(world, fare) {
  fare.state = 'riding';
  fare.timeLeft = FARE_TIME_LIMIT;
  const i = world.peds.indexOf(fare.ped);
  if (i !== -1) world.peds.splice(i, 1);
  announce(world, 'FARE PICKED UP', `To ${fare.dest.name} — ${FARE_TIME_LIMIT}s on the meter.`);
}

function dropFare(world, fare, reason) {
  world.activeFare = null;
  resetOfferTimer(world);
  announce(world, 'FARE LOST', reason);
}

function completeFare(world, fare) {
  const p = world.player;
  let pay = fare.payout;
  const quick = fare.timeLeft > FARE_TIME_LIMIT / 2;
  if (quick) pay = Math.round(pay * FARE_TIP_MULT);
  p.cash += pay;
  world.stats.faresDone += 1;
  world.activeFare = null;
  resetOfferTimer(world);
  announce(world, 'FARE COMPLETE', `+$${pay}${quick ? ' — fast ride, big tip' : ''}`);
}

export function setupFares(world) {
  world.activeFare = null;
  world.fareT = FARE_FIRST_DELAY;
  world.stats.faresDone = 0;
}

export function updateFares(world, dt) {
  const p = world.player;
  if (p.busted || p.wasted) {
    if (world.activeFare) {
      world.activeFare = null;
      resetOfferTimer(world);
    }
    return;
  }
  const fare = world.activeFare;
  if (!fare) {
    world.fareT -= dt;
    if (world.fareT <= 0) {
      offerFare(world);
      resetOfferTimer(world);
    }
    return;
  }
  const car = p.car;
  if (fare.state === 'waiting') {
    fare.waitT += dt;
    if (fare.waitT > FARE_WAIT_TIMEOUT) {
      world.activeFare = null;
      resetOfferTimer(world);
      announce(world, 'CUSTOMER LEFT', 'You kept them waiting too long.');
      return;
    }
    if (car && Math.hypot(car.x - fare.ped.x, car.y - fare.ped.y) < FARE_PICKUP_RADIUS) {
      boardFare(world, fare);
    }
    return;
  }
  // Riding: the meter is running.
  fare.timeLeft -= dt;
  if (p.onFoot) {
    dropFare(world, fare, 'The customer walked off when you left the car.');
    return;
  }
  if (fare.timeLeft <= 0) {
    dropFare(world, fare, 'Out of time — the customer walked off.');
    return;
  }
  if (car && Math.hypot(car.x - fare.dest.x, car.y - fare.dest.y) < FARE_DROPOFF_RADIUS) {
    completeFare(world, fare);
  }
}

export function drawFares(ctx, world) {
  const fare = world.activeFare;
  if (!fare) return;
  const pulse = 1 + Math.sin(performance.now() / 260) * 0.15;
  ctx.save();
  ctx.textAlign = 'center';
  if (fare.state === 'waiting') {
    const ped = fare.ped;
    ctx.strokeStyle = '#ffd23d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 34, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('$', ped.x, ped.y - 29);
  } else {
    const dest = fare.dest;
    ctx.strokeStyle = '#7dd93d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(dest.x, dest.y, 40 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(125,217,61,0.22)';
    ctx.beginPath();
    ctx.arc(dest.x, dest.y, 40 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7dd93d';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${Math.ceil(fare.timeLeft)}s`, dest.x, dest.y - 52);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(dest.name, dest.x, dest.y - 68);
  }
  ctx.restore();
}
