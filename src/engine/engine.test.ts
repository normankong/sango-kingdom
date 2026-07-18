import { describe, expect, it } from "vitest";
import {
  appointGovernor,
  buyEquipment,
  buyFood,
  develop,
  draft,
  fireOfficer,
  sellFood,
  setAutoGovern,
  specialTax,
  train,
  war,
} from "./commands.ts";
import { CITY_COUNT, CITY_DEFS } from "./data/cities.ts";
import { OFFICER_DEFS } from "./data/officers.ts";
import { SCENARIO_190 } from "./data/scenario190.ts";
import { autoGovernCity } from "./ai.ts";
import { getRelation, proposeAlliance, proposeTruce, relKey, revokeAgreement, threaten } from "./diplomacy.ts";
import { newGame } from "./newGame.ts";
import { bribe, forgeLetter } from "./plots.ts";
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

describe("diplomacy", () => {
  it("relations can be set, read symmetrically, and revoked", () => {
    const gs = newGame(SCENARIO_190, 10, 1);
    gs.diplomacy[relKey(10, 17)] = { status: "allied" };
    expect(getRelation(gs, 10, 17)).toBe("allied");
    expect(getRelation(gs, 17, 10)).toBe("allied");
    const r = revokeAgreement(gs, 11, 17);
    expect(r.ok).toBe(true);
    expect(getRelation(gs, 10, 17)).toBe("neutral");
  });

  it("proposeAlliance and proposeTruce consume the envoy's turn regardless of outcome", () => {
    const gs = newGame(SCENARIO_190, 10, 1);
    expect(gs.officers[11].status).toBe("available");
    proposeAlliance(gs, 11, 17);
    expect(gs.officers[11].status).toBe("done");

    const gs2 = newGame(SCENARIO_190, 10, 2);
    proposeTruce(gs2, 12, 17, 6);
    expect(gs2.officers[12].status).toBe("done");
  });

  it("a successful alliance eventually forms across seeds", () => {
    let allied = false;
    for (let seed = 1; seed <= 40 && !allied; seed++) {
      const gs = newGame(SCENARIO_190, 10, seed);
      proposeAlliance(gs, 11, 17);
      allied = getRelation(gs, 10, 17) === "allied";
    }
    expect(allied).toBe(true);
  });

  it("threaten refuses to target your own ruler", () => {
    const gs = newGame(SCENARIO_190, 10, 1);
    expect(threaten(gs, 11, 10).ok).toBe(false);
  });
});

describe("plots", () => {
  it("bribe requires the target to be a rival's officer and enough gold", () => {
    const gs = newGame(SCENARIO_190, 10, 1);
    gs.cities[10].gold = 5000;
    expect(bribe(gs, 11, 12).ok).toBe(false); // 12 is already Cao Cao's own officer

    gs.cities[10].gold = 0;
    expect(bribe(gs, 11, 18).ok).toBe(false); // 18 (Yan Liang) is a rival, but no gold
  });

  it("bribe can turn a rival officer given enough attempts", () => {
    let defected = false;
    for (let seed = 1; seed <= 60 && !defected; seed++) {
      const gs = newGame(SCENARIO_190, 10, seed);
      gs.cities[10].gold = 50_000;
      const target = gs.officers[18]; // Yan Liang, Yuan Shao's officer
      bribe(gs, 11, 18);
      defected = target.rulerId === 10;
    }
    expect(defected).toBe(true);
  });

  it("forgeLetter can lower a rival officer's loyalty", () => {
    let dropped = false;
    for (let seed = 1; seed <= 60 && !dropped; seed++) {
      const gs = newGame(SCENARIO_190, 10, seed);
      gs.cities[10].gold = 5000;
      const before = gs.officers[18].loyalty;
      forgeLetter(gs, 11, 18);
      dropped = gs.officers[18].loyalty < before;
    }
    expect(dropped).toBe(true);
  });
});

describe("market, emergency & personnel", () => {
  it("buyFood/sellFood/buyEquipment move gold and resources correctly", () => {
    const gs = newGame(SCENARIO_190, 10, 1);
    const city = gs.cities[10];
    city.gold = 1000;
    city.food = 1000;
    city.equipment = 0;

    expect(buyFood(gs, 10, 11, 500).ok).toBe(true);
    expect(city.food).toBe(1500);
    expect(city.gold).toBe(1000 - Math.round(500 * 0.12));

    const goldAfterBuy = city.gold;
    expect(sellFood(gs, 10, 12, 200).ok).toBe(true);
    expect(city.food).toBe(1300);
    expect(city.gold).toBe(goldAfterBuy + Math.round(200 * 0.06));

    const goldAfterSell = city.gold;
    expect(buyEquipment(gs, 10, 13, 50).ok).toBe(true);
    expect(city.equipment).toBe(50);
    expect(city.gold).toBe(goldAfterSell - 50 * 4);
  });

  it("specialTax raises gold and lowers support, consuming the officer", () => {
    const gs = newGame(SCENARIO_190, 10, 1);
    const city = gs.cities[10];
    const goldBefore = city.gold;
    const supportBefore = city.support;
    const r = specialTax(gs, 10, 11);
    expect(r.ok).toBe(true);
    expect(city.gold).toBeGreaterThan(goldBefore);
    expect(city.support).toBeLessThan(supportBefore);
    expect(gs.officers[11].status).toBe("done");
  });

  it("setAutoGovern toggles delegation without consuming an officer", () => {
    const gs = newGame(SCENARIO_190, 10, 1);
    expect(gs.cities[10].autoGovern).toBe(false);
    setAutoGovern(gs, 10, true);
    expect(gs.cities[10].autoGovern).toBe(true);
  });

  it("fireOfficer frees an officer but refuses to fire the ruler", () => {
    const gs = newGame(SCENARIO_190, 10, 1);
    expect(fireOfficer(gs, 10).ok).toBe(false);
    expect(fireOfficer(gs, 12).ok).toBe(true);
    expect(gs.officers[12].rulerId).toBeNull();
  });

  it("appointGovernor requires the target be stationed in that city", () => {
    const gs = newGame(SCENARIO_190, 10, 1);
    expect(appointGovernor(gs, 10, 12).ok).toBe(true);
    expect(gs.cities[10].governorId).toBe(12);
    expect(appointGovernor(gs, 10, 18).ok).toBe(false); // 18 belongs to Yuan Shao
  });
});

describe("delegation", () => {
  it("autoGovernCity spends idle officers' turns on domestic orders", () => {
    const gs = newGame(SCENARIO_190, 10, 5);
    const before = Object.values(gs.officers).filter(
      (o) => o.cityId === 10 && o.rulerId === 10 && o.status === "available",
    ).length;
    expect(before).toBeGreaterThan(0);
    autoGovernCity(gs, 10);
    const after = Object.values(gs.officers).filter(
      (o) => o.cityId === 10 && o.rulerId === 10 && o.status === "available",
    ).length;
    expect(after).toBeLessThan(before);
  });
});
