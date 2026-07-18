// Deterministic seeded RNG (mulberry32). The seed lives in GameState so
// replays/saves stay consistent.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws from the state seed and advances it. */
export class Rng {
  private next: () => number;
  constructor(public seed: number) {
    this.next = mulberry32(seed);
  }
  /** float in [0,1) */
  f(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.next();
  }
  /** int in [min,max] inclusive */
  i(min: number, max: number): number {
    return min + Math.floor(this.f() * (max - min + 1));
  }
  chance(p: number): boolean {
    return this.f() < p;
  }
}
