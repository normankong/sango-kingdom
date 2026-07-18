import { CITY_DEFS } from "./data/cities.ts";
import { OFFICER_DEFS } from "./data/officers.ts";
import type { ScenarioDef } from "./data/scenario190.ts";
import { Rng } from "./rng.ts";
import type { CityState, GameState, OfficerState, RulerState } from "./types.ts";

export function newGame(
  scenario: ScenarioDef,
  playerRulerId: number,
  seed = Date.now() >>> 0,
): GameState {
  const rng = new Rng(seed);
  const cities: Record<number, CityState> = {};
  const officers: Record<number, OfficerState> = {};
  const rulers: Record<number, RulerState> = {};

  const cityRuler: Record<number, number> = {};
  for (const f of scenario.forces) {
    for (const cid of f.cities) cityRuler[cid] = f.rulerId;
  }

  for (const def of Object.values(CITY_DEFS)) {
    const owned = cityRuler[def.id] !== undefined;
    cities[def.id] = {
      id: def.id,
      rulerId: owned ? cityRuler[def.id] : null,
      governorId: null,
      population: owned ? 250_000 + rng.i(0, 250_000) : 100_000 + rng.i(0, 150_000),
      gold: owned ? 600 + rng.i(0, 600) : 200 + rng.i(0, 200),
      food: owned ? 120_000 + rng.i(0, 120_000) : 50_000 + rng.i(0, 50_000),
      soldiers: owned ? 8_000 + rng.i(0, 8_000) : 0,
      economy: owned ? 400 + rng.i(0, 500) : 200 + rng.i(0, 300),
      landDev: 25 + rng.i(0, 30),
      cultivation: 10 + rng.i(0, 20),
      floodControl: 20 + rng.i(0, 30),
      taxRate: 50,
      support: owned ? 50 + rng.i(0, 20) : 40 + rng.i(0, 20),
      training: owned ? 40 + rng.i(0, 25) : 0,
      equipment: owned ? 200 + rng.i(0, 300) : 0,
      autoGovern: false,
    };
  }

  for (const f of scenario.forces) {
    rulers[f.rulerId] = { id: f.rulerId, alive: true };
    // Ruler sits in the home city; the rest spread round-robin so every
    // owned city has at least one officer to govern it.
    f.officerIds.forEach((oid, idx) => {
      const cid =
        oid === f.rulerId ? f.cities[0] : f.cities[idx % f.cities.length];
      officers[oid] = {
        id: oid,
        rulerId: f.rulerId,
        cityId: cid,
        loyalty: oid === f.rulerId ? 100 : 75 + rng.i(0, 20),
        status: "available",
      };
    });
    for (const cid of f.cities) {
      const stationed = f.officerIds.filter((o) => officers[o].cityId === cid);
      cities[cid].governorId = stationed.includes(f.rulerId)
        ? f.rulerId
        : stationed[0] ?? null;
    }
  }

  for (const [oidStr, cid] of Object.entries(scenario.freeOfficers)) {
    const oid = Number(oidStr);
    if (!OFFICER_DEFS[oid]) continue;
    officers[oid] = { id: oid, rulerId: null, cityId: cid, loyalty: 50, status: "available" };
  }

  return {
    scenarioId: scenario.id,
    date: { year: scenario.startYear, month: scenario.startMonth },
    playerRulerId,
    cities,
    officers,
    rulers,
    diplomacy: {},
    rngSeed: rng.seed,
    log: [],
    gameOver: null,
  };
}
