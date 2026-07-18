import { clamp, log } from "./commands.ts";
import { OFFICER_DEFS } from "./data/officers.ts";
import { Rng } from "./rng.ts";
import type { CmdResult } from "./commands.ts";
import type { GameState } from "./types.ts";

// Plot commands (§5): Bribe and Forged Letter. Hide Infiltrator / Rival /
// Rebel are deferred — they need an ongoing "planted agent" state this MVP
// doesn't track yet.

function withRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const rng = new Rng(state.rngSeed);
  const out = fn(rng);
  state.rngSeed = rng.seed;
  return out;
}

const BRIBE_COST = 300;

/** Bribe an enemy officer directly, trying to turn them to your cause. */
export function bribe(state: GameState, officerId: number, targetOfficerId: number): CmdResult {
  const off = state.officers[officerId];
  const target = state.officers[targetOfficerId];
  const city = state.cities[off.cityId];
  if (target.rulerId === null || target.rulerId === off.rulerId)
    return { ok: false, message: "That officer is not a rival's." };
  if (city.gold < BRIBE_COST) return { ok: false, message: `Not enough gold (need ${BRIBE_COST}).` };
  const def = OFFICER_DEFS[officerId];
  const tDef = OFFICER_DEFS[targetOfficerId];
  city.gold -= BRIBE_COST;
  return withRng(state, (rng) => {
    state.officers[officerId].status = "done";
    const chance = clamp(
      0.08 + (100 - target.loyalty) / 200 + def.chr / 400 - tDef.chr / 500,
      0.03,
      0.6,
    );
    if (!rng.chance(chance)) {
      target.loyalty = clamp(target.loyalty - 5, 0, 100);
      return { ok: true, message: `${tDef.name} refused the bribe (but grew wary of their lord).` };
    }
    target.rulerId = off.rulerId;
    target.cityId = off.cityId;
    target.loyalty = 65;
    target.status = "done";
    log(state, "event", `${tDef.name} has defected to ${OFFICER_DEFS[off.rulerId!].name}!`);
    return { ok: true, message: `${tDef.name} defects to your cause!` };
  });
}

const FORGE_COST = 150;

/** Sow discord: a forged letter makes the target's lord suspect them. */
export function forgeLetter(state: GameState, officerId: number, targetOfficerId: number): CmdResult {
  const off = state.officers[officerId];
  const target = state.officers[targetOfficerId];
  const city = state.cities[off.cityId];
  if (target.rulerId === null || target.rulerId === off.rulerId)
    return { ok: false, message: "That officer is not a rival's." };
  if (city.gold < FORGE_COST) return { ok: false, message: `Not enough gold (need ${FORGE_COST}).` };
  const def = OFFICER_DEFS[officerId];
  const tDef = OFFICER_DEFS[targetOfficerId];
  city.gold -= FORGE_COST;
  return withRng(state, (rng) => {
    state.officers[officerId].status = "done";
    const chance = clamp(0.3 + def.int / 300, 0.15, 0.75);
    if (!rng.chance(chance)) {
      return { ok: true, message: `The forged letter fooled no one.` };
    }
    const drop = 8 + rng.i(0, 12);
    target.loyalty = clamp(target.loyalty - drop, 0, 100);
    log(state, "event", `A forged letter sows suspicion of ${tDef.name} (loyalty -${drop}).`);
    return { ok: true, message: `${tDef.name}'s lord grows suspicious (loyalty -${drop}).` };
  });
}
