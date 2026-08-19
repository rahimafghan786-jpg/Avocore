// Deterministic pseudo-random generator seeded from a string. Used so that mock provider
// output is stable per candidate product (same product => same "evidence" every run),
// rather than re-rolling randomly on every request, which would make the demo feel fake
// and non-reproducible.

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRandom(seed: string): () => number {
  let state = hashString(seed) || 1;
  return function next() {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967295;
  };
}

export function randInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export function randFloat(rand: () => number, min: number, max: number, decimals = 2): number {
  const v = rand() * (max - min) + min;
  const p = Math.pow(10, decimals);
  return Math.round(v * p) / p;
}

export function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
