import { clamp, log } from "./commands.ts";
import { OFFICER_DEFS } from "./data/officers.ts";
import { Rng } from "./rng.ts";
import type { CmdResult } from "./commands.ts";
import type { CityState, GameState, TurnDate } from "./types.ts";

// Diplomacy (§5, "home city only" in the original): Ally, Truce, Threat,
// Revoke. Relations are stored per ruler-pair and consulted by the AI's war
// decisions so allied/truced rulers leave each other alone.

export function relKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function getRelation(state: GameState, a: number, b: number) {
  return state.diplomacy[relKey(a, b)]?.status ?? "neutral";
}

function afterDate(a: TurnDate, b: TurnDate): boolean {
  return a.year > b.year || (a.year === b.year && a.month > b.month);
}

/** Truces expire automatically; call once per month from turn.ts. */
export function expireTruces(state: GameState) {
  for (const [key, rel] of Object.entries(state.diplomacy)) {
    if (rel.status === "truce" && rel.truceUntil && afterDate(state.date, rel.truceUntil)) {
      delete state.diplomacy[key];
    }
  }
}

function withRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const rng = new Rng(state.rngSeed);
  const out = fn(rng);
  state.rngSeed = rng.seed;
  return out;
}

function relativeStrength(state: GameState, rulerId: number): number {
  return Object.values(state.cities)
    .filter((c) => c.rulerId === rulerId)
    .reduce((sum, c: CityState) => sum + c.soldiers, 0);
}

// The original restricts Diplomacy to the ruler's capital; here any city the
// officer's ruler still holds qualifies, which is close enough for the AI
// and UI to treat consistently.
function requireOwnCity(state: GameState, officerId: number): CmdResult | null {
  const off = state.officers[officerId];
  const city = state.cities[off.cityId];
  if (city.rulerId !== off.rulerId)
    return { ok: false, message: "外交事務須在我方城池內進行。" };
  return null;
}

export function proposeAlliance(state: GameState, officerId: number, targetRulerId: number): CmdResult {
  const off = state.officers[officerId];
  const err = requireOwnCity(state, officerId);
  if (err) return err;
  if (off.rulerId === targetRulerId) return { ok: false, message: "不能與自己締結同盟。" };
  const key = relKey(off.rulerId!, targetRulerId);
  const def = OFFICER_DEFS[officerId];
  return withRng(state, (rng) => {
    const chance = 0.25 + def.chr / 300;
    if (!rng.chance(chance)) {
      state.officers[officerId].status = "done";
      return { ok: true, message: `${OFFICER_DEFS[targetRulerId].han}婉拒了同盟的提議。` };
    }
    state.diplomacy[key] = { status: "allied" };
    state.officers[officerId].status = "done";
    return { ok: true, message: `${OFFICER_DEFS[targetRulerId].han}同意締結同盟！` };
  });
}

export function proposeTruce(
  state: GameState,
  officerId: number,
  targetRulerId: number,
  months = 12,
): CmdResult {
  const off = state.officers[officerId];
  const err = requireOwnCity(state, officerId);
  if (err) return err;
  if (off.rulerId === targetRulerId) return { ok: false, message: "不能與自己締結停戰。" };
  const key = relKey(off.rulerId!, targetRulerId);
  const def = OFFICER_DEFS[officerId];
  return withRng(state, (rng) => {
    const chance = 0.4 + def.chr / 250;
    state.officers[officerId].status = "done";
    if (!rng.chance(chance)) {
      return { ok: true, message: `${OFFICER_DEFS[targetRulerId].han}拒絕了停戰的提議。` };
    }
    let until = { year: state.date.year, month: state.date.month + months };
    while (until.month > 12) {
      until = { year: until.year + 1, month: until.month - 12 };
    }
    state.diplomacy[key] = { status: "truce", truceUntil: until };
    return {
      ok: true,
      message: `${OFFICER_DEFS[targetRulerId].han}接受停戰，直到 ${until.year} 年 ${until.month} 月。`,
    };
  });
}

export function revokeAgreement(state: GameState, officerId: number, targetRulerId: number): CmdResult {
  const off = state.officers[officerId];
  const err = requireOwnCity(state, officerId);
  if (err) return err;
  const key = relKey(off.rulerId!, targetRulerId);
  delete state.diplomacy[key];
  state.officers[officerId].status = "done";
  return { ok: true, message: `與${OFFICER_DEFS[targetRulerId].han}的協議已經破棄。` };
}

/** Demand tribute from a weaker rival; success depends on relative strength + charm. */
export function threaten(state: GameState, officerId: number, targetRulerId: number): CmdResult {
  const off = state.officers[officerId];
  const err = requireOwnCity(state, officerId);
  if (err) return err;
  if (off.rulerId === targetRulerId) return { ok: false, message: "不能威嚇自己。" };
  const def = OFFICER_DEFS[officerId];
  const myStrength = relativeStrength(state, off.rulerId!);
  const targetStrength = relativeStrength(state, targetRulerId);
  return withRng(state, (rng) => {
    state.officers[officerId].status = "done";
    const ratio = myStrength / Math.max(1, targetStrength);
    const chance = clamp(0.15 + (ratio - 1) * 0.25 + def.chr / 400, 0.05, 0.85);
    if (!rng.chance(chance)) {
      return { ok: true, message: `${OFFICER_DEFS[targetRulerId].han}不為所懼，拒絕屈服。` };
    }
    const targetCities = Object.values(state.cities).filter((c) => c.rulerId === targetRulerId);
    if (targetCities.length === 0) return { ok: true, message: "已無可威嚇的對象。" };
    const richest = targetCities.reduce((a, b) => (a.gold > b.gold ? a : b));
    const tribute = Math.round(richest.gold * 0.3);
    richest.gold -= tribute;
    const myCity = state.cities[off.cityId];
    myCity.gold = clamp(myCity.gold + tribute, 0, 50_000);
    log(state, "event", `${OFFICER_DEFS[targetRulerId].han}懾於威嚇，獻上 ${tribute} 金。`);
    return { ok: true, message: `${OFFICER_DEFS[targetRulerId].han}獻上貢金 ${tribute} 兩。` };
  });
}
