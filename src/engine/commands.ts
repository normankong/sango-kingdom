import { CITY_DEFS, CITY_COUNT } from "./data/cities.ts";
import { OFFICER_DEFS } from "./data/officers.ts";
import { Rng } from "./rng.ts";
import type { BattleReport, GameState, LogKind } from "./types.ts";

export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export function log(state: GameState, kind: LogKind, text: string) {
  state.log.push({ date: { ...state.date }, kind, text });
}

function withRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const rng = new Rng(state.rngSeed);
  const out = fn(rng);
  state.rngSeed = rng.seed;
  return out;
}

export type DevelopKind = "land" | "flood" | "economy" | "cultivate";

export const DEVELOP_COST: Record<DevelopKind, number> = {
  land: 50,
  flood: 50,
  economy: 50,
  cultivate: 20,
};

export interface CmdResult {
  ok: boolean;
  message: string;
  battle?: BattleReport;
}

function useOfficer(state: GameState, officerId: number) {
  state.officers[officerId].status = "done";
}

export function setTaxRate(state: GameState, cityId: number, rate: number): CmdResult {
  state.cities[cityId].taxRate = clamp(Math.round(rate), 0, 100);
  return { ok: true, message: `Tax rate set to ${state.cities[cityId].taxRate}%.` };
}

export function develop(
  state: GameState,
  cityId: number,
  officerId: number,
  kind: DevelopKind,
): CmdResult {
  const city = state.cities[cityId];
  const def = OFFICER_DEFS[officerId];
  const cost = DEVELOP_COST[kind];
  if (city.gold < cost) return { ok: false, message: `Not enough gold (need ${cost}).` };
  city.gold -= cost;
  return withRng(state, (rng) => {
    const gain = 3 + Math.floor(def.pol / 12) + rng.i(0, 3);
    let msg: string;
    if (kind === "economy") {
      const eGain = def.pol * 2 + rng.i(0, 60);
      city.economy = clamp(city.economy + eGain, 0, 9999);
      msg = `${def.name} developed commerce (+${eGain} economy).`;
    } else if (kind === "land") {
      city.landDev = clamp(city.landDev + gain, 0, 100);
      msg = `${def.name} developed land (+${gain}).`;
    } else if (kind === "flood") {
      city.floodControl = clamp(city.floodControl + gain, 0, 100);
      msg = `${def.name} improved flood control (+${gain}).`;
    } else {
      city.cultivation = clamp(city.cultivation + gain + 2, 0, 100);
      msg = `${def.name} cultivated the fields (+${gain + 2}).`;
    }
    city.support = clamp(city.support + 1, 0, 100);
    useOfficer(state, officerId);
    return { ok: true, message: msg };
  });
}

/** Draft: 10 gold + 100 food per 100 soldiers (per the original manual). */
export function draft(
  state: GameState,
  cityId: number,
  officerId: number,
  hundreds: number,
): CmdResult {
  const city = state.cities[cityId];
  const def = OFFICER_DEFS[officerId];
  hundreds = Math.floor(hundreds);
  if (hundreds <= 0) return { ok: false, message: "Nothing to draft." };
  const gold = hundreds * 10;
  const food = hundreds * 100;
  const men = hundreds * 100;
  if (city.gold < gold) return { ok: false, message: `Not enough gold (need ${gold}).` };
  if (city.food < food) return { ok: false, message: `Not enough food (need ${food}).` };
  if (city.population < men * 4)
    return { ok: false, message: "The population cannot support that draft." };
  city.gold -= gold;
  city.food -= food;
  city.population -= men;
  // Raw recruits dilute the garrison's training level.
  city.training = Math.round(
    (city.training * city.soldiers + 10 * men) / (city.soldiers + men),
  );
  city.soldiers += men;
  city.support = clamp(city.support - Math.ceil(hundreds / 20), 0, 100);
  useOfficer(state, officerId);
  return { ok: true, message: `${def.name} drafted ${men} soldiers.` };
}

export function train(state: GameState, cityId: number, officerId: number): CmdResult {
  const city = state.cities[cityId];
  const def = OFFICER_DEFS[officerId];
  if (city.soldiers <= 0) return { ok: false, message: "No soldiers to train." };
  const gain = 8 + Math.floor(def.war / 10) + Math.floor(def.armyCmd / 20);
  city.training = clamp(city.training + gain, 0, 100);
  useOfficer(state, officerId);
  return { ok: true, message: `${def.name} trained the troops (+${gain} training).` };
}

/** Move an officer (optionally with soldiers) to an adjacent friendly city. */
export function move(
  state: GameState,
  officerId: number,
  toCityId: number,
  soldiers: number,
): CmdResult {
  const off = state.officers[officerId];
  const from = state.cities[off.cityId];
  const to = state.cities[toCityId];
  if (!CITY_DEFS[from.id].adjacency.includes(toCityId))
    return { ok: false, message: "Target city is not adjacent." };
  if (to.rulerId !== off.rulerId)
    return { ok: false, message: "Target city is not yours (use War to invade)." };
  soldiers = clamp(Math.floor(soldiers), 0, from.soldiers);
  from.soldiers -= soldiers;
  to.soldiers += soldiers;
  const fromId = off.cityId;
  off.cityId = toCityId;
  if (from.governorId === officerId) {
    const remaining = Object.values(state.officers).find(
      (o) => o.cityId === fromId && o.rulerId === off.rulerId && o.id !== officerId,
    );
    from.governorId = remaining?.id ?? null;
  }
  if (to.governorId === null) to.governorId = officerId;
  useOfficer(state, officerId);
  return {
    ok: true,
    message: `${OFFICER_DEFS[officerId].name} moved to ${CITY_DEFS[toCityId].name}${soldiers ? ` with ${soldiers} soldiers` : ""}.`,
  };
}

/** Search the city for hidden (free) officers and try to recruit one. */
export function search(state: GameState, cityId: number, officerId: number): CmdResult {
  const def = OFFICER_DEFS[officerId];
  return withRng(state, (rng) => {
    useOfficer(state, officerId);
    const hidden = Object.values(state.officers).filter(
      (o) => o.cityId === cityId && o.rulerId === null,
    );
    if (hidden.length === 0 || !rng.chance(0.35 + def.chr / 200)) {
      const found = rng.i(10, 60);
      state.cities[cityId].gold = clamp(state.cities[cityId].gold + found, 0, 50000);
      return { ok: true, message: `${def.name} found no one, but recovered ${found} gold.` };
    }
    const target = hidden[rng.i(0, hidden.length - 1)];
    const tDef = OFFICER_DEFS[target.id];
    const rulerChr = OFFICER_DEFS[state.cities[cityId].rulerId ?? officerId].chr;
    if (rng.chance(0.25 + def.chr / 250 + rulerChr / 250)) {
      target.rulerId = state.cities[cityId].rulerId;
      target.loyalty = 70;
      target.status = "available";
      return { ok: true, message: `${def.name} found ${tDef.name}, who joins your cause!` };
    }
    return { ok: true, message: `${def.name} found ${tDef.name}, but was rebuffed.` };
  });
}

/** Reward an officer with gold from the city treasury to raise loyalty. */
export function reward(state: GameState, officerId: number, gold = 100): CmdResult {
  const off = state.officers[officerId];
  const city = state.cities[off.cityId];
  if (city.gold < gold) return { ok: false, message: `Not enough gold (need ${gold}).` };
  return withRng(state, (rng) => {
    city.gold -= gold;
    const gain = 3 + Math.floor(gold / 50) + rng.i(0, 3);
    off.loyalty = clamp(off.loyalty + gain, 0, 100);
    return { ok: true, message: `${OFFICER_DEFS[officerId].name}'s loyalty rose to ${off.loyalty}.` };
  });
}

function armyPower(
  soldiers: number,
  training: number,
  bestCmd: number,
  luck: number,
): number {
  return soldiers * (0.8 + bestCmd / 100) * (0.5 + training / 200) * luck;
}

/** War: invade an adjacent city. Auto-resolved for the MVP (§11). */
export function war(
  state: GameState,
  fromCityId: number,
  toCityId: number,
  officerIds: number[],
  soldiers: number,
): CmdResult {
  const from = state.cities[fromCityId];
  const to = state.cities[toCityId];
  if (!CITY_DEFS[fromCityId].adjacency.includes(toCityId))
    return { ok: false, message: "Target city is not adjacent." };
  if (to.rulerId === from.rulerId) return { ok: false, message: "That city is already yours." };
  if (officerIds.length === 0) return { ok: false, message: "Select at least one officer to lead." };
  soldiers = clamp(Math.floor(soldiers), 0, from.soldiers);
  if (soldiers <= 0) return { ok: false, message: "No soldiers committed." };
  const attackerRulerId = from.rulerId!;

  return withRng(state, (rng) => {
    from.soldiers -= soldiers;
    const atkCmd = Math.max(...officerIds.map((o) => OFFICER_DEFS[o].armyCmd));
    const defOfficers = Object.values(state.officers).filter(
      (o) => o.cityId === toCityId && o.rulerId === to.rulerId && to.rulerId !== null,
    );
    const defCmd = defOfficers.length
      ? Math.max(...defOfficers.map((o) => OFFICER_DEFS[o.id].armyCmd))
      : 30;

    const atkPower = armyPower(soldiers, from.training, atkCmd, 0.9 + rng.f() * 0.2);
    // Defenders fight behind walls: 25% bonus.
    const defPower =
      to.soldiers > 0
        ? armyPower(to.soldiers, to.training, defCmd, 0.9 + rng.f() * 0.2) * 1.25
        : 0;

    const attackerWon = atkPower > defPower;
    const total = atkPower + defPower || 1;
    const atkLosses = Math.min(
      soldiers,
      Math.round(soldiers * (defPower / total) * (attackerWon ? 0.7 : 1.1)),
    );
    const defLosses = Math.min(
      to.soldiers,
      Math.round(to.soldiers * (atkPower / total) * (attackerWon ? 1.1 : 0.7)),
    );

    const report: BattleReport = {
      attackerRulerId,
      defenderRulerId: to.rulerId,
      cityId: toCityId,
      fromCityId,
      attackerPower: Math.round(atkPower),
      defenderPower: Math.round(defPower),
      attackerWon,
      attackerLosses: atkLosses,
      defenderLosses: defLosses,
    };

    for (const oid of officerIds) useOfficer(state, oid);

    if (attackerWon) {
      const oldRuler = to.rulerId;
      // Defending officers flee to another city of their ruler, or go free.
      for (const o of defOfficers) {
        const fallback = Object.values(state.cities).find(
          (c) => c.rulerId === oldRuler && c.id !== toCityId,
        );
        if (fallback) {
          o.cityId = fallback.id;
        } else {
          o.rulerId = null;
          o.loyalty = 40;
        }
      }
      to.rulerId = attackerRulerId;
      to.soldiers = soldiers - atkLosses;
      to.training = from.training;
      to.support = clamp(to.support - 10, 0, 100);
      for (const oid of officerIds) {
        state.officers[oid].cityId = toCityId;
        const wasGov = state.cities[fromCityId].governorId === oid;
        if (wasGov) {
          const remaining = Object.values(state.officers).find(
            (o) => o.cityId === fromCityId && o.rulerId === attackerRulerId,
          );
          state.cities[fromCityId].governorId = remaining?.id ?? null;
        }
      }
      to.governorId = officerIds[0];

      const atkName = OFFICER_DEFS[attackerRulerId].name;
      log(state, "battle", `${atkName} captured ${CITY_DEFS[toCityId].name}! (lost ${atkLosses}, slew ${defLosses})`);

      // Ruler elimination check.
      if (oldRuler !== null && !Object.values(state.cities).some((c) => c.rulerId === oldRuler)) {
        state.rulers[oldRuler].alive = false;
        for (const o of Object.values(state.officers)) {
          if (o.rulerId === oldRuler) {
            o.rulerId = null;
            o.loyalty = 40;
          }
        }
        log(state, "event", `The force of ${OFFICER_DEFS[oldRuler].name} has been destroyed!`);
        if (oldRuler === state.playerRulerId) {
          state.gameOver = "defeat";
          log(state, "defeat", "You have lost your last city. The dream is over.");
        }
      }
      const playerCities = Object.values(state.cities).filter(
        (c) => c.rulerId === state.playerRulerId,
      ).length;
      if (playerCities === CITY_COUNT) {
        state.gameOver = "victory";
        log(state, "victory", "All 46 cities are yours. China is unified!");
      }
      return { ok: true, message: `Victory! ${CITY_DEFS[toCityId].name} is taken.`, battle: report };
    } else {
      // Attackers retreat with survivors.
      from.soldiers += soldiers - atkLosses;
      to.soldiers -= defLosses;
      log(state, "battle", `Attack on ${CITY_DEFS[toCityId].name} was repelled (lost ${atkLosses}).`);
      return { ok: true, message: `Defeat... the assault on ${CITY_DEFS[toCityId].name} failed.`, battle: report };
    }
  });
}
