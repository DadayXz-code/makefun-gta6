// Staged, deterministic scenes for screenshots. Each shot seeds the RNG,
// places the player and traffic, then runs the simulation forward a fixed
// number of steps with scripted inputs so the frame is identical every time.
// `?shot=start|play|chase|mission&seed=1` in the URL selects a scene.
import { TILE, PLACES, ROADS_X, ROADS_Y } from './config.js';
import { createWorld, startMission, update, STEP, makeCar, nearestRoad } from './world.js';

function placePlayerInCar(world, x, y, angle) {
  const p = world.player;
  const car = makeCar(world.rng, x, y, angle, { color: '#d94f3d', name: 'Cometa' });
  car.speed = 0;
  world.cars.push(car);
  p.onFoot = false;
  p.car = car;
  car.player = true;
  car.ai = false;
  return car;
}

// Road-following autopilot: steer toward a lookahead point on the road
// centreline, 180px ahead of the car in the direction of the target, so
// the car stays on the road instead of cutting across blocks.
function driveToward(world, tx, ty, steps) {
  for (let i = 0; i < steps; i += 1) {
    const p = world.player;
    const car = p.car;
    if (Math.hypot(tx - car.x, ty - car.y) < 50) break; // arrived
    if (!world.mission) break; // mission complete — stop
    const road = nearestRoad(car.x, car.y);
    const dx = tx - car.x;
    const dy = ty - car.y;
    let lx;
    let ly;
    if (Math.abs(dx) > Math.abs(dy)) {
      // Travelling along a horizontal road.
      ly = road.axis === 'h' ? road.at : car.y;
      lx = car.x + Math.sign(dx) * 180;
    } else {
      lx = road.axis === 'v' ? road.at : car.x;
      ly = car.y + Math.sign(dy) * 180;
    }
    const want = Math.atan2(ly - car.y, lx - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    update(world, {
      up: true, down: false,
      left: diff < -0.08, right: diff > 0.08,
      handbrake: false, enterPressed: false,
    }, STEP);
  }
}

export function stageShot(name, seed = 1) {
  const world = createWorld(seed);
  const p = world.player;
  if (name === 'start') {
    // Title screen: player parked by the plaza fountain at dusk, traffic passing.
    placePlayerInCar(world, 30 * TILE, 32 * TILE, -Math.PI / 2);
    p.cash = 120;
    for (let i = 0; i < 90; i += 1) {
      update(world, { up: false, down: false, left: false, right: false, handbrake: false, enterPressed: false }, STEP);
    }
    return { world, screen: 'title' };
  }
  if (name === 'play') {
    // Driving down a downtown avenue with traffic and peds, mission 2 active.
    startMission(world, 1);
    placePlayerInCar(world, 44 * TILE + 20, 20 * TILE + 60, Math.PI / 2);
    p.cash = 420;
    driveToward(world, 44 * TILE + 20, 30 * TILE, 150);
    return { world, screen: 'play' };
  }
  if (name === 'chase') {
    // Wanted 3, police cars closing in on a downtown avenue.
    startMission(world, 2);
    placePlayerInCar(world, 32 * TILE + 20, 32 * TILE + 40, 0);
    p.cash = 760;
    p.wanted = 3;
    p.heat = 1;
    driveToward(world, 44 * TILE, 32 * TILE + 40, 170);
    // Let the police catch up a little.
    for (let i = 0; i < 120; i += 1) {
      update(world, { up: true, down: false, left: false, right: false, handbrake: false, enterPressed: false }, STEP);
    }
    return { world, screen: 'play' };
  }
  if (name === 'mission') {
    // Final job, played honestly through the mission engine: meet the crew
    // at the beach (step 1), then deliver the score to the yacht (step 2).
    startMission(world, 5);
    p.cash = 400;
    // Step 1: stand on the beach marker.
    p.x = PLACES.beach.x;
    p.y = PLACES.beach.y - 40;
    for (let i = 0; i < 30; i += 1) {
      update(world, { up: false, down: false, left: false, right: false, handbrake: false, enterPressed: false }, STEP);
    }
    // Step 2: drive to the marina yacht and deliver.
    const car = placePlayerInCar(world, 56 * TILE - 20, 20 * TILE + 60, -Math.PI / 2);
    car.speed = 0;
    driveToward(world, PLACES.marina.x, PLACES.marina.y, 400);
    // The mission completes inside update(); the banner is real.
    return { world, screen: 'play' };
  }
  // Default: plain gameplay frame.
  placePlayerInCar(world, 32 * TILE, 32 * TILE, -Math.PI / 2);
  return { world, screen: 'play' };
}
