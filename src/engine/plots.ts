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
    return { ok: false, message: "該武將並非敵方所屬。" };
  if (city.gold < BRIBE_COST) return { ok: false, message: `資金不足（需要 ${BRIBE_COST} 金）。` };
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
      return { ok: true, message: `${tDef.han}拒絕了收買（但對其主更生戒心）。` };
    }
    target.rulerId = off.rulerId;
    target.cityId = off.cityId;
    target.loyalty = 65;
    target.status = "done";
    log(state, "event", `${tDef.han}已倒戈投向${OFFICER_DEFS[off.rulerId!].han}！`);
    return { ok: true, message: `${tDef.han}歸順我方！` };
  });
}

const FORGE_COST = 150;

/** Sow discord: a forged letter makes the target's lord suspect them. */
export function forgeLetter(state: GameState, officerId: number, targetOfficerId: number): CmdResult {
  const off = state.officers[officerId];
  const target = state.officers[targetOfficerId];
  const city = state.cities[off.cityId];
  if (target.rulerId === null || target.rulerId === off.rulerId)
    return { ok: false, message: "該武將並非敵方所屬。" };
  if (city.gold < FORGE_COST) return { ok: false, message: `資金不足（需要 ${FORGE_COST} 金）。` };
  const def = OFFICER_DEFS[officerId];
  const tDef = OFFICER_DEFS[targetOfficerId];
  city.gold -= FORGE_COST;
  return withRng(state, (rng) => {
    state.officers[officerId].status = "done";
    const chance = clamp(0.3 + def.int / 300, 0.15, 0.75);
    if (!rng.chance(chance)) {
      return { ok: true, message: `偽書並未瞞過任何人。` };
    }
    const drop = 8 + rng.i(0, 12);
    target.loyalty = clamp(target.loyalty - drop, 0, 100);
    log(state, "event", `一封偽書令${tDef.han}遭主公猜忌（忠誠 -${drop}）。`);
    return { ok: true, message: `${tDef.han}的主公起了疑心（忠誠 -${drop}）。` };
  });
}
