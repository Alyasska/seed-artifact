// Deterministic, seedable RNG (mulberry32).
// Determinism matters: a balance tool you can't reproduce is an anecdote, not a
// measurement. Every Monte Carlo run is keyed by a seed so a result can be
// replayed exactly.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick a random element, biased to the front by `sharpness` (1 = uniform).
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
