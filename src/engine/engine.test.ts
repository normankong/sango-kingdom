import { describe, expect, it } from "vitest";
import { develop, draft, train, war } from "./commands.ts";
import { CITY_COUNT, CITY_DEFS } from "./data/cities.ts";
import { OFFICER_DEFS } from "./data/officers.ts";
import { SCENARIO_190 } from "./data/scenario190.ts";
import { newGame } from "./newGame.ts";
import { endTurn } from "./turn.ts";

describe("map data", () => {
  it("has exactly 46 cities", () => {
    expect(CITY_COUNT).toBe(46);
    expect(Object.keys(CITY_DEFS)).toHaveLength(46);
  });

  it("adjacency is symmetric and non-empty", () => {
    for (const c of Object.values(CITY_DEFS)) {
      expect(c.adjacency.length).toBeGreaterThan(0);
      for (const n of c.adjacency) {
        expect(CITY_DEFS[n].adjacency).toContain(c.id);
      }
    }
  });

  it("the map graph is fully connected", () => {
    const seen = new Set<number>([1]);
    const queue = [1];
    while (queue.length) {
      const id = queue.pop()!;
      for (const n of CITY_DEFS[id].adjacency) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    expect(seen.size).toBe(46);
  });
});

describe("scenario 190", () => {
  it("every force city and officer exists, no overlaps", () => {
    const cityOwners = new Map<number, number>();
    const officerOwners = new Map<number, number>();
    for (const f of SCENARIO_190.forces) {
      expect(OFFICER_DEFS[f.rulerId]).toBeDefined();
      for (const c of f.cities) {
        expect(CITY_DEFS[c]).toBeDefined();
        expect(cityOwners.has(c)).toBe(false);
        cityOwners.set(c, f.rulerId);
      }
      for (const o of f.officerIds) {
        expect(OFFICER_DEFS[o]).toBeDefined();
        expect(officerOwners.has(o)).toBe(false);
        officerOwners.set(o, f.rulerId);
      }
      expect(f.officerIds).toContain(f.rulerId);
    }
    for (const [oid] of Object.entries(SCENARIO_190.freeOfficers)) {
      expect(officerOwners.has(Number(oid))).toBe(false);
    }
  });
});

describe("game flow", () => {
  it("starts a game where every owned city has a governor", () => {
    const gs = newGame(SCENARIO_190, 10, 42);
    for (const c of Object.values(gs.cities)) {
      if (c.rulerId !== null) expect(c.governorId).not.toBeNull();
    }
    expect(gs.date).toEqual({ year: 190, month: 1 });
  });

  it("develop/draft/train consume the officer's action and resources", () => {
    const gs = newGame(SCENARIO_190, 10, 42);
    const city = gs.cities[10]; // Cao Cao's Chenliu
    city.gold = 1000;
    city.food = 100_000;
    const before = { gold: city.gold, land: city.landDev, soldiers: city.soldiers };

    expect(develop(gs, 10, 11, "land").ok).toBe(true);
    expect(city.gold).toBe(before.gold - 50);
    expect(city.landDev).toBeGreaterThan(before.land);
    expect(gs.officers[11].status).toBe("done");
    // Same officer cannot be reused by UI, and draft with another works:
    expect(draft(gs, 10, 12, 10).ok).toBe(true);
    expect(city.soldiers).toBe(before.soldiers + 1000);
    expect(train(gs, 10, 13).ok).toBe(true);
  });

  it("a month advances and refreshes officers", () => {
    const gs = newGame(SCENARIO_190, 10, 42);
    develop(gs, 10, 11, "land");
    endTurn(gs);
    expect(gs.date.month).toBe(2);
    expect(gs.officers[11].status).toBe("available");
  });

  it("war against an empty city captures it", () => {
    const gs = newGame(SCENARIO_190, 10, 42);
    gs.cities[10].soldiers = 10_000;
    const r = war(gs, 10, 9, [11, 12], 8000); // Puyang starts empty
    expect(r.ok).toBe(true);
    expect(r.battle?.attackerWon).toBe(true);
    expect(gs.cities[9].rulerId).toBe(10);
    expect(gs.officers[11].cityId).toBe(9);
  });

  it("simulates 24 AI months without corruption", () => {
    const gs = newGame(SCENARIO_190, 10, 7);
    for (let i = 0; i < 24 && !gs.gameOver; i++) endTurn(gs);
    for (const c of Object.values(gs.cities)) {
      expect(c.soldiers).toBeGreaterThanOrEqual(0);
      expect(c.gold).toBeGreaterThanOrEqual(0);
      expect(c.food).toBeGreaterThanOrEqual(0);
      expect(c.support).toBeGreaterThanOrEqual(0);
      expect(c.support).toBeLessThanOrEqual(100);
      if (c.rulerId !== null) expect(gs.rulers[c.rulerId].alive).toBe(true);
    }
    for (const o of Object.values(gs.officers)) {
      if (o.rulerId !== null) {
        expect(gs.rulers[o.rulerId].alive).toBe(true);
        expect(gs.cities[o.cityId]).toBeDefined();
      }
    }
  });
});
