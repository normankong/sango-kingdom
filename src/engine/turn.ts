import { clamp, log } from "./commands.ts";
import { CITY_DEFS } from "./data/cities.ts";
import { OFFICER_DEFS } from "./data/officers.ts";
import { expireTruces } from "./diplomacy.ts";
import { Rng } from "./rng.ts";
import type { GameState } from "./types.ts";
import { aiTakeTurn, autoGovernCity } from "./ai.ts";

// Monthly settlement per §10 of the design doc:
// January — gold tax + gold salaries. July — harvest + food salaries,
// cultivation resets. Every month — consumption, drift, random events.

function monthlySettlement(state: GameState, rng: Rng) {
  const { month } = state.date;
  const officersByRuler: Record<number, number> = {};
  for (const o of Object.values(state.officers)) {
    if (o.rulerId !== null) officersByRuler[o.rulerId] = (officersByRuler[o.rulerId] ?? 0) + 1;
  }

  for (const city of Object.values(state.cities)) {
    if (city.rulerId === null) continue;
    const isPlayer = city.rulerId === state.playerRulerId;

    // Soldiers eat.
    city.food -= Math.round(city.soldiers * 0.8);
    if (city.food < 0) {
      const deserters = Math.round(city.soldiers * 0.1);
      city.soldiers -= deserters;
      city.food = 0;
      city.support = clamp(city.support - 3, 0, 100);
      if (isPlayer && deserters > 0)
        log(state, "economy", `Food ran out in ${cityName(state, city.id)} — ${deserters} soldiers deserted.`);
    }

    // Support drifts with tax policy.
    if (city.taxRate <= 30) city.support = clamp(city.support + 1, 0, 100);
    else if (city.taxRate >= 60) city.support = clamp(city.support - 1, 0, 100);

    // Population follows support.
    city.population = clamp(
      Math.round(city.population * (1 + (city.support - 40) / 8000)),
      10_000,
      3_000_000,
    );

    // January: gold tax + salaries.
    if (month === 1) {
      const tax = Math.round(city.economy * (city.taxRate / 100) * (0.5 + city.support / 200) * 2);
      city.gold = clamp(city.gold + tax, 0, 50_000);
      if (isPlayer) log(state, "economy", `${cityName(state, city.id)}: collected ${tax} gold in taxes.`);
    }

    // July: harvest + cultivation reset.
    if (month === 7) {
      const harvest = Math.round(
        ((city.landDev + city.cultivation) * city.population / 100) *
          (city.taxRate / 100) *
          (0.5 + city.support / 200),
      );
      city.food = clamp(city.food + harvest, 0, 3_000_000);
      city.cultivation = 0;
      city.support = clamp(city.support - Math.max(0, Math.floor(city.taxRate / 20) - 1), 0, 100);
      if (isPlayer) log(state, "economy", `${cityName(state, city.id)}: harvest brought in ${harvest} food.`);
    }

    // Random events.
    if (rng.chance(0.02) && month >= 4 && month <= 6 && city.floodControl < 50) {
      city.landDev = clamp(city.landDev - 10, 0, 100);
      city.economy = clamp(city.economy - 150, 0, 9999);
      city.population = Math.round(city.population * 0.97);
      log(state, "event", `Flood in ${cityName(state, city.id)}!`);
    }
    if (rng.chance(0.015) && month >= 7 && month <= 9) {
      city.cultivation = Math.round(city.cultivation / 2);
      log(state, "event", `Locust swarm devastates ${cityName(state, city.id)}!`);
    }
    if (rng.chance(0.008)) {
      city.population = Math.round(city.population * 0.95);
      city.support = clamp(city.support - 5, 0, 100);
      log(state, "event", `Epidemic strikes ${cityName(state, city.id)}.`);
    }
  }

  // Salaries: 20 gold per officer, from the ruler's richest city each January.
  if (month === 1) {
    for (const ruler of Object.values(state.rulers)) {
      if (!ruler.alive) continue;
      const owned = Object.values(state.cities).filter((c) => c.rulerId === ruler.id);
      if (owned.length === 0) continue;
      const richest = owned.reduce((a, b) => (a.gold > b.gold ? a : b));
      const bill = (officersByRuler[ruler.id] ?? 0) * 20;
      if (richest.gold >= bill) {
        richest.gold -= bill;
      } else {
        richest.gold = 0;
        for (const o of Object.values(state.officers)) {
          if (o.rulerId === ruler.id) o.loyalty = clamp(o.loyalty - 5, 0, 100);
        }
        if (ruler.id === state.playerRulerId)
          log(state, "economy", "You could not pay salaries — loyalty suffers across your force.");
      }
    }
  }

  // Loyalty drift and defection.
  for (const o of Object.values(state.officers)) {
    if (o.rulerId === null || o.id === o.rulerId) continue;
    if (o.loyalty < 100 && rng.chance(0.25)) o.loyalty = clamp(o.loyalty - 1, 0, 100);
    if (o.loyalty < 40 && rng.chance(0.08)) {
      const name = OFFICER_DEFS[o.id].name;
      const wasPlayer = o.rulerId === state.playerRulerId;
      o.rulerId = null;
      o.loyalty = 50;
      if (wasPlayer) log(state, "event", `${name} has abandoned your cause!`);
    }
  }
}

function cityName(_state: GameState, id: number): string {
  return CITY_DEFS[id].name;
}

/** Ends the player's month: AI rulers act, then the month settles and advances. */
export function endTurn(state: GameState) {
  if (state.gameOver) return;

  // Delegated player cities: run domestic orders for any officer the player
  // left idle there this month.
  for (const city of Object.values(state.cities)) {
    if (city.autoGovern && city.rulerId === state.playerRulerId) {
      autoGovernCity(state, city.id);
    }
  }

  for (const ruler of Object.values(state.rulers)) {
    if (!ruler.alive || ruler.id === state.playerRulerId) continue;
    aiTakeTurn(state, ruler.id);
    if (state.gameOver) return;
  }

  const rng = new Rng(state.rngSeed);
  monthlySettlement(state, rng);
  state.rngSeed = rng.seed;

  // Advance the calendar and refresh officers.
  state.date.month += 1;
  if (state.date.month > 12) {
    state.date.month = 1;
    state.date.year += 1;
  }
  expireTruces(state);
  for (const o of Object.values(state.officers)) {
    if (o.status === "done") o.status = "available";
  }
}
