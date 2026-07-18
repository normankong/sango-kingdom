import { develop, draft, search, train, war } from "./commands.ts";
import { CITY_DEFS } from "./data/cities.ts";
import { OFFICER_DEFS } from "./data/officers.ts";
import { SCENARIOS } from "./data/scenario190.ts";
import { getRelation, proposeAlliance } from "./diplomacy.ts";
import { Rng } from "./rng.ts";
import type { CityState, GameState, OfficerState } from "./types.ts";

// Strategic-layer AI (§8): each ruler budgets its officers across
// development, recruitment, drafting, training, and invasion, weighted by
// persona. Tactical battles are auto-resolved in the MVP.

const ATTACK_THRESHOLD = { aggressive: 1.25, balanced: 1.6, builder: 2.0 } as const;

function persona(state: GameState, rulerId: number) {
  const sc = SCENARIOS[state.scenarioId];
  return sc?.forces.find((f) => f.rulerId === rulerId)?.persona ?? "balanced";
}

function cityPower(c: CityState): number {
  return c.soldiers * (0.5 + c.training / 200);
}

function totalSoldiers(state: GameState, rulerId: number): number {
  return Object.values(state.cities)
    .filter((c) => c.rulerId === rulerId)
    .reduce((sum, c) => sum + c.soldiers, 0);
}

/** Builder-minded rulers occasionally seek an alliance with a much stronger neighbor. */
function considerAlliance(state: GameState, rulerId: number, rng: Rng, p: ReturnType<typeof persona>) {
  if (p === "aggressive" || !rng.chance(0.08)) return;
  const myStrength = totalSoldiers(state, rulerId);
  const myCities = Object.values(state.cities).filter((c) => c.rulerId === rulerId);
  const neighborIds = new Set<number>();
  for (const c of myCities) {
    for (const n of CITY_DEFS[c.id].adjacency) {
      const nr = state.cities[n].rulerId;
      if (nr !== null && nr !== rulerId && getRelation(state, rulerId, nr) === "neutral") {
        neighborIds.add(nr);
      }
    }
  }
  for (const targetId of neighborIds) {
    if (totalSoldiers(state, targetId) < myStrength * 1.8) continue;
    const envoy = Object.values(state.officers)
      .filter((o) => o.rulerId === rulerId && o.status === "available")
      .sort((a, b) => OFFICER_DEFS[b.id].chr - OFFICER_DEFS[a.id].chr)[0];
    if (!envoy) return;
    state.rngSeed = rng.seed;
    proposeAlliance(state, envoy.id, targetId);
    rng.seed = state.rngSeed;
    return;
  }
}

export function aiTakeTurn(state: GameState, rulerId: number) {
  const rng = new Rng(state.rngSeed);
  const p = persona(state, rulerId);
  const threshold = ATTACK_THRESHOLD[p];

  considerAlliance(state, rulerId, rng, p);

  const myCities = () =>
    Object.values(state.cities).filter((c) => c.rulerId === rulerId);

  for (const city of myCities()) {
    if (state.gameOver) break;
    const stationed = Object.values(state.officers).filter(
      (o) => o.cityId === city.id && o.rulerId === rulerId && o.status === "available",
    );
    if (stationed.length === 0) continue;

    // 1) Consider invading the weakest adjacent non-friendly, non-allied city.
    const targets = CITY_DEFS[city.id].adjacency
      .map((id) => state.cities[id])
      .filter(
        (c) =>
          c.rulerId !== rulerId &&
          (c.rulerId === null || getRelation(state, rulerId, c.rulerId) === "neutral"),
      );
    if (targets.length > 0 && city.soldiers > 3000) {
      const weakest = targets.reduce((a, b) => (cityPower(a) < cityPower(b) ? a : b));
      const myPower = cityPower(city);
      const wantWar =
        weakest.rulerId === null
          ? city.soldiers > 2000 && rng.chance(0.5)
          : myPower > cityPower(weakest) * threshold * 1.25 && rng.chance(p === "aggressive" ? 0.6 : 0.35);
      if (wantWar) {
        const leaders = stationed
          .sort((a, b) => OFFICER_DEFS[b.id].armyCmd - OFFICER_DEFS[a.id].armyCmd)
          .slice(0, Math.min(3, Math.max(1, stationed.length - 1)))
          .map((o) => o.id);
        const commit = Math.max(1000, city.soldiers - 1500);
        state.rngSeed = rng.seed;
        war(state, city.id, weakest.id, leaders, commit);
        rng.seed = state.rngSeed;
        continue;
      }
    }

    // 2) Give every remaining available officer a domestic job.
    for (const off of stationed) {
      if (state.officers[off.id].status !== "available") continue;
      if (state.officers[off.id].cityId !== city.id) continue;
      aiDomestic(state, city, off, rng);
    }
  }

  state.rngSeed = rng.seed;
}

/** Used by turn.ts to run domestic orders for Delegated (auto-governed) player cities. */
export function autoGovernCity(state: GameState, cityId: number) {
  const rng = new Rng(state.rngSeed);
  const city = state.cities[cityId];
  const stationed = Object.values(state.officers).filter(
    (o) => o.cityId === cityId && o.rulerId === city.rulerId && o.status === "available",
  );
  for (const off of stationed) {
    if (state.officers[off.id].status !== "available") continue;
    aiDomestic(state, city, off, rng);
  }
  state.rngSeed = rng.seed;
}

function aiDomestic(state: GameState, city: CityState, off: OfficerState, rng: Rng) {
  const def = OFFICER_DEFS[off.id];
  const hasFree = Object.values(state.officers).some(
    (o) => o.cityId === city.id && o.rulerId === null,
  );

  state.rngSeed = rng.seed;
  if (hasFree && def.chr >= 60 && rng.chance(0.5)) {
    search(state, city.id, off.id);
  } else if (city.gold > 400 && city.soldiers < 12_000 && city.food > 40_000 && def.war >= 60) {
    draft(state, city.id, off.id, Math.min(30, Math.floor(city.gold / 20)));
  } else if (city.soldiers > 0 && city.training < 70 && def.war >= 55) {
    train(state, city.id, off.id);
  } else if (city.gold < 150) {
    // Can't afford development; idle this month.
    state.officers[off.id].status = "done";
  } else if (city.food < 60_000 || city.cultivation < 50) {
    develop(state, city.id, off.id, rng.chance(0.5) ? "cultivate" : "land");
  } else if (city.economy < 800) {
    develop(state, city.id, off.id, "economy");
  } else if (city.floodControl < 60) {
    develop(state, city.id, off.id, "flood");
  } else {
    develop(state, city.id, off.id, "economy");
  }
  rng.seed = state.rngSeed;
}
