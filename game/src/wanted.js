// Roadblocks and hideouts — the Luna PD's answer to a three-star wanted
// level, and the places Rico can disappear into.
//
// Once the heat reaches ROADBLOCK_MIN_STARS the PD starts dropping
// spike-strip roadblocks on the roads ahead of the player: striped
// barriers that shred a car's tyres. Hit one and the car takes a hard hit
// and slows to a crawl. A roadblock lives ROADBLOCK_TTL seconds, then the
// PD pulls it back; while the heat is on, a new one drops every
// ROADBLOCK_INTERVAL seconds, up to one per wanted star.
//
// Hideouts are the two places the island forgets a face: the palm shade
// along the beach, and the narrow alleys of Old Town. While the player
// hides in one — off the road, with no police car close — the heat cools
// HIDEOUT_COOL_MULT times as fast.
//
// This file only reads the island's constants. The world loop calls
// updateRoadblocks every step and asks hideoutFactor when the heat decays.
import {
  TILE,
  WORLD,
  ROADS_X,
  ROADS_Y,
  ROADBLOCK_MIN_STARS,
  ROADBLOCK_TTL,
  ROADBLOCK_INTERVAL,
  SPIKE_DAMAGE,
  HIDEOUT_COOL_MULT,
} from './config.js';

function nearestRoadLine(x, y) {
  let best = null;
  let bestD = 1e9;
  for (const tile of ROADS_X) {
    const d = Math.abs(x - tile * TILE);
    if (d < bestD) {
      bestD = d;
      best = { vertical: true, at: tile * TILE };
    }
  }
  for (const tile of ROADS_Y) {
    const d = Math.abs(y - tile * TILE);
    if (d < bestD) {
      bestD = d;
      best = { vertical: false, at: tile * TILE };
    }
  }
  return best;
}

function playerPosition(world) {
  const p = world.player;
  return p.car ? { x: p.car.x, y: p.car.y } : { x: p.x, y: p.y };
}

function dropRoadblock(world) {
  const p = world.player;
  const at = playerPosition(world);
  const heading = p.car ? p.car.angle : p.angle;
  const ahead = 520;
  const rawX = at.x + Math.cos(heading) * ahead;
  const rawY = at.y + Math.sin(heading) * ahead;
  const line = nearestRoadLine(rawX, rawY);
  const spot = line.vertical
    ? { x: line.at, y: Math.max(60, Math.min(WORLD - 60, rawY)) }
    : { x: Math.max(60, Math.min(WORLD - 60, rawX)), y: line.at };
  world.roadblocks.push({
    x: spot.x,
    y: spot.y,
    angle: line.vertical ? 0 : Math.PI / 2,
    ttl: ROADBLOCK_TTL,
    hit: false,
  });
}

// How much faster the heat cools right now: double while the player hides
// in a hideout with no police car close enough to see them, normal else.
export function hideoutFactor(world) {
  const p = world.player;
  if (p.wanted <= 0) return 1;
  const at = playerPosition(world);
  const onBeach = at.y > 58 * TILE;
  const inOldTown = at.x < 20 * TILE && at.y < 20 * TILE;
  if (!onBeach && !inOldTown) return 1;
  const line = nearestRoadLine(at.x, at.y);
  const offRoad = Math.abs(line.vertical ? at.x - line.at : at.y - line.at) > 1.5 * TILE + 20;
  if (!offRoad) return 1;
  let nearestCop = 1e9;
  for (const cop of world.police) {
    nearestCop = Math.min(nearestCop, Math.hypot(cop.x - at.x, cop.y - at.y));
  }
  return nearestCop > 420 ? HIDEOUT_COOL_MULT : 1;
}

export function updateRoadblocks(world, dt) {
  const p = world.player;
  if (p.busted || p.wasted) return;
  world.roadblockT -= dt;
  if (p.wanted >= ROADBLOCK_MIN_STARS && world.roadblockT <= 0) {
    const cap = Math.min(5, Math.floor(p.wanted));
    if (world.roadblocks.filter((r) => !r.hit).length < cap) dropRoadblock(world);
    world.roadblockT = ROADBLOCK_INTERVAL;
  }
  const at = playerPosition(world);
  for (const block of world.roadblocks) {
    block.ttl -= dt;
    if (block.hit || block.ttl <= 0) continue;
    if (p.car && Math.hypot(block.x - at.x, block.y - at.y) < 36) {
      block.hit = true;
      p.car.hp -= SPIKE_DAMAGE;
      p.car.speed *= 0.3;
      p.car.smoke = 1;
      world.stats.spikesHit += 1;
      if (p.car.hp <= 0) p.car.hp = 1;
    }
    // A spike strip does not care whose tyres it meets: traffic that
    // drives over one takes the same hit, and the strip is spent.
    if (block.hit) continue;
    for (const car of world.cars) {
      if (car.dead || car.player) continue;
      if (Math.hypot(block.x - car.x, block.y - car.y) < 30) {
        block.hit = true;
        car.hp -= SPIKE_DAMAGE;
        car.speed *= 0.3;
        car.smoke = 1;
        break;
      }
    }
  }
  world.roadblocks = world.roadblocks.filter((r) => !r.hit && r.ttl > 0);
}
