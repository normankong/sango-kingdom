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
  return { ok: true, message: `稅率已調整為 ${state.cities[cityId].taxRate}%。` };
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
  if (city.gold < cost) return { ok: false, message: `資金不足（需要 ${cost} 金）。` };
  city.gold -= cost;
  return withRng(state, (rng) => {
    const gain = 3 + Math.floor(def.pol / 12) + rng.i(0, 3);
    let msg: string;
    if (kind === "economy") {
      const eGain = def.pol * 2 + rng.i(0, 60);
      city.economy = clamp(city.economy + eGain, 0, 9999);
      msg = `${def.han}振興商業（商業 +${eGain}）。`;
    } else if (kind === "land") {
      city.landDev = clamp(city.landDev + gain, 0, 100);
      msg = `${def.han}開墾土地（開發度 +${gain}）。`;
    } else if (kind === "flood") {
      city.floodControl = clamp(city.floodControl + gain, 0, 100);
      msg = `${def.han}興修堤防（治水 +${gain}）。`;
    } else {
      city.cultivation = clamp(city.cultivation + gain + 2, 0, 100);
      msg = `${def.han}勸課農桑（農業 +${gain + 2}）。`;
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
  if (hundreds <= 0) return { ok: false, message: "沒有可徵募的兵員。" };
  const gold = hundreds * 10;
  const food = hundreds * 100;
  const men = hundreds * 100;
  if (city.gold < gold) return { ok: false, message: `資金不足（需要 ${gold} 金）。` };
  if (city.food < food) return { ok: false, message: `糧草不足（需要 ${food} 石）。` };
  if (city.population < men * 4)
    return { ok: false, message: "人口不足，無法承受此次徵兵。" };
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
  return { ok: true, message: `${def.han}徵募了 ${men} 名士兵。` };
}

export function train(state: GameState, cityId: number, officerId: number): CmdResult {
  const city = state.cities[cityId];
  const def = OFFICER_DEFS[officerId];
  if (city.soldiers <= 0) return { ok: false, message: "沒有士兵可供訓練。" };
  const gain = 8 + Math.floor(def.war / 10) + Math.floor(def.armyCmd / 20);
  city.training = clamp(city.training + gain, 0, 100);
  useOfficer(state, officerId);
  return { ok: true, message: `${def.han}操練士兵（訓練度 +${gain}）。` };
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
    return { ok: false, message: "目標城市並不相鄰。" };
  if (to.rulerId !== off.rulerId)
    return { ok: false, message: "目標城市並非我方所有（請使用「進攻」以攻取）。" };
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
    message: `${OFFICER_DEFS[officerId].han}移駐${CITY_DEFS[toCityId].han}${soldiers ? `，率兵 ${soldiers} 人` : ""}。`,
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
      return { ok: true, message: `${def.han}遍尋不獲賢才，卻拾得 ${found} 金。` };
    }
    const target = hidden[rng.i(0, hidden.length - 1)];
    const tDef = OFFICER_DEFS[target.id];
    const rulerChr = OFFICER_DEFS[state.cities[cityId].rulerId ?? officerId].chr;
    if (rng.chance(0.25 + def.chr / 250 + rulerChr / 250)) {
      target.rulerId = state.cities[cityId].rulerId;
      target.loyalty = 70;
      target.status = "available";
      return { ok: true, message: `${def.han}尋得${tDef.han}，並說服其歸順！` };
    }
    return { ok: true, message: `${def.han}尋得${tDef.han}，卻遭婉拒。` };
  });
}

/** Reward an officer with gold from the city treasury to raise loyalty. */
export function reward(state: GameState, officerId: number, gold = 100): CmdResult {
  const off = state.officers[officerId];
  const city = state.cities[off.cityId];
  if (city.gold < gold) return { ok: false, message: `資金不足（需要 ${gold} 金）。` };
  return withRng(state, (rng) => {
    city.gold -= gold;
    const gain = 3 + Math.floor(gold / 50) + rng.i(0, 3);
    off.loyalty = clamp(off.loyalty + gain, 0, 100);
    return { ok: true, message: `${OFFICER_DEFS[officerId].han}的忠誠度提升至 ${off.loyalty}。` };
  });
}

function armyPower(
  soldiers: number,
  training: number,
  bestCmd: number,
  equipment: number,
  luck: number,
): number {
  return (
    soldiers * (0.8 + bestCmd / 100) * (0.5 + training / 200) * (1 + equipment / 20_000) * luck
  );
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
    return { ok: false, message: "目標城市並不相鄰。" };
  if (to.rulerId === from.rulerId) return { ok: false, message: "該城已是我方所有。" };
  if (officerIds.length === 0) return { ok: false, message: "請至少選擇一名將領統兵出征。" };
  soldiers = clamp(Math.floor(soldiers), 0, from.soldiers);
  if (soldiers <= 0) return { ok: false, message: "未派遣任何士兵。" };
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

    const atkPower = armyPower(soldiers, from.training, atkCmd, from.equipment, 0.9 + rng.f() * 0.2);
    // Defenders fight behind walls: 25% bonus.
    const defPower =
      to.soldiers > 0
        ? armyPower(to.soldiers, to.training, defCmd, to.equipment, 0.9 + rng.f() * 0.2) * 1.25
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

      const atkName = OFFICER_DEFS[attackerRulerId].han;
      log(state, "battle", `${atkName}攻陷${CITY_DEFS[toCityId].han}！（我軍損失 ${atkLosses}，敵軍損失 ${defLosses}）`);

      // Ruler elimination check.
      if (oldRuler !== null && !Object.values(state.cities).some((c) => c.rulerId === oldRuler)) {
        state.rulers[oldRuler].alive = false;
        for (const o of Object.values(state.officers)) {
          if (o.rulerId === oldRuler) {
            o.rulerId = null;
            o.loyalty = 40;
          }
        }
        log(state, "event", `${OFFICER_DEFS[oldRuler].han}的勢力已被消滅！`);
        if (oldRuler === state.playerRulerId) {
          state.gameOver = "defeat";
          log(state, "defeat", "最後一座城池已失守，霸業夢碎於此。");
        }
      }
      const playerCities = Object.values(state.cities).filter(
        (c) => c.rulerId === state.playerRulerId,
      ).length;
      if (playerCities === CITY_COUNT) {
        state.gameOver = "victory";
        log(state, "victory", "全 46 州郡已盡歸掌中，天下歸於一統！");
      }
      return { ok: true, message: `勝利！${CITY_DEFS[toCityId].han}已被攻取。`, battle: report };
    } else {
      // Attackers retreat with survivors.
      from.soldiers += soldiers - atkLosses;
      to.soldiers -= defLosses;
      log(state, "battle", `進攻${CITY_DEFS[toCityId].han}遭擊退（損失 ${atkLosses} 人）。`);
      return { ok: true, message: `敗北……進攻${CITY_DEFS[toCityId].han}的行動失敗了。`, battle: report };
    }
  });
}

// --- Market (§5): Buy/Sell Food, Buy Arms. Prices are a flat spread rather
// than a fluctuating market, which the original models more richly. ---

const FOOD_BUY_PRICE = 0.12; // gold per unit of food
const FOOD_SELL_PRICE = 0.06; // gold per unit of food (spread discourages arbitrage)
const EQUIPMENT_PRICE = 4; // gold per unit of equipment

export function buyFood(state: GameState, cityId: number, officerId: number, amount: number): CmdResult {
  const city = state.cities[cityId];
  amount = Math.max(0, Math.floor(amount));
  const cost = Math.round(amount * FOOD_BUY_PRICE);
  if (amount <= 0) return { ok: false, message: "沒有可購買的數量。" };
  if (city.gold < cost) return { ok: false, message: `資金不足（需要 ${cost} 金）。` };
  city.gold -= cost;
  city.food = clamp(city.food + amount, 0, 3_000_000);
  useOfficer(state, officerId);
  return { ok: true, message: `以 ${cost} 金購入 ${amount.toLocaleString()} 石糧草。` };
}

export function sellFood(state: GameState, cityId: number, officerId: number, amount: number): CmdResult {
  const city = state.cities[cityId];
  amount = clamp(Math.floor(amount), 0, city.food);
  if (amount <= 0) return { ok: false, message: "沒有可出售的數量。" };
  const gain = Math.round(amount * FOOD_SELL_PRICE);
  city.food -= amount;
  city.gold = clamp(city.gold + gain, 0, 50_000);
  useOfficer(state, officerId);
  return { ok: true, message: `售出 ${amount.toLocaleString()} 石糧草，得 ${gain} 金。` };
}

export function buyEquipment(state: GameState, cityId: number, officerId: number, amount: number): CmdResult {
  const city = state.cities[cityId];
  amount = Math.max(0, Math.floor(amount));
  const cost = Math.round(amount * EQUIPMENT_PRICE);
  if (amount <= 0) return { ok: false, message: "沒有可購買的數量。" };
  if (city.gold < cost) return { ok: false, message: `資金不足（需要 ${cost} 金）。` };
  if (city.equipment >= 9999) return { ok: false, message: "軍械庫已滿。" };
  city.gold -= cost;
  city.equipment = clamp(city.equipment + amount, 0, 9999);
  useOfficer(state, officerId);
  return { ok: true, message: `以 ${cost} 金購入 ${amount.toLocaleString()} 件軍備。` };
}

// --- Emergency (§5): Special Tax. An immediate levy outside the normal
// January collection, at the cost of popular support. ---

export function specialTax(state: GameState, cityId: number, officerId: number): CmdResult {
  const city = state.cities[cityId];
  return withRng(state, (rng) => {
    const amount = Math.round(city.economy * 0.15 + rng.i(0, 50));
    city.gold = clamp(city.gold + amount, 0, 50_000);
    city.support = clamp(city.support - (8 + rng.i(0, 6)), 0, 100);
    useOfficer(state, officerId);
    return { ok: true, message: `徵收臨時稅賦：+${amount} 金（民心下降）。` };
  });
}

// --- Personnel (§5): Delegate, Fire, Appoint. These are administrative and
// don't consume an officer's monthly action, matching setTaxRate. ---

export function setAutoGovern(state: GameState, cityId: number, enabled: boolean): CmdResult {
  state.cities[cityId].autoGovern = enabled;
  return {
    ok: true,
    message: enabled
      ? `${CITY_DEFS[cityId].han}將交由內政官自動處理。`
      : `${CITY_DEFS[cityId].han}恢復由主公親自治理。`,
  };
}

/** Dismiss one of your own officers back into the free pool. */
export function fireOfficer(state: GameState, targetOfficerId: number): CmdResult {
  const target = state.officers[targetOfficerId];
  if (target.rulerId === null) return { ok: false, message: "該武將已是在野之身。" };
  if (target.id === target.rulerId)
    return { ok: false, message: "主公不能罷免自己。" };
  const name = OFFICER_DEFS[targetOfficerId].han;
  target.rulerId = null;
  target.loyalty = 50;
  target.status = "available";
  return { ok: true, message: `${name}已被罷免，退隱在野。` };
}

/** Appoint a stationed officer as the city's governor. */
export function appointGovernor(state: GameState, cityId: number, targetOfficerId: number): CmdResult {
  const city = state.cities[cityId];
  const target = state.officers[targetOfficerId];
  if (target.cityId !== cityId || target.rulerId !== city.rulerId)
    return { ok: false, message: "該武將並未駐守於此城。" };
  city.governorId = targetOfficerId;
  return { ok: true, message: `${OFFICER_DEFS[targetOfficerId].han}已被任命為${CITY_DEFS[cityId].han}太守。` };
}
