// Seeded randomness for Puerto Luna.
//
// The island is generated from one seed, so the same seed always builds
// the same city: the same buildings, the same traffic, the same
// pedestrians. That is what makes the staged screenshots reproducible —
// every run of the game with seed 1 is the same island.
//
// The generator is mulberry32, a small fast seeded PRNG. `makeRng` returns
// the generator itself, a function of no arguments that yields the next
// number in [0, 1). The helpers below draw from it.
export function makeRng(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

// One element of a list, chosen uniformly.
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// A real number in [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// A whole number in [min, max], both ends included.
export function rangeInt(rng, min, max) {
  return Math.floor(min + rng() * (max - min + 1));
}

// A shuffled copy of a list (Fisher-Yates), the original untouched.
export function shuffle(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
