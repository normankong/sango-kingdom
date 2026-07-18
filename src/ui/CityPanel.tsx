import { useMemo, useState } from "react";
import {
  appointGovernor,
  buyEquipment,
  buyFood,
  develop,
  draft,
  fireOfficer,
  move,
  reward,
  search,
  sellFood,
  setAutoGovern,
  setTaxRate,
  specialTax,
  train,
  war,
  type CmdResult,
  type DevelopKind,
} from "../engine/commands.ts";
import { CITY_DEFS } from "../engine/data/cities.ts";
import { OFFICER_DEFS } from "../engine/data/officers.ts";
import { proposeAlliance, proposeTruce, revokeAgreement, threaten } from "../engine/diplomacy.ts";
import { bribe, forgeLetter } from "../engine/plots.ts";
import type { GameState } from "../engine/types.ts";

type Action =
  | "land" | "cultivate" | "flood" | "economy"
  | "draft" | "train" | "move" | "war"
  | "search" | "reward" | "delegate" | "fire" | "appoint"
  | "ally" | "truce" | "threat" | "revoke"
  | "bribe" | "forge"
  | "buyFood" | "sellFood" | "buyEquipment"
  | "tax" | "specialTax";

const ACTION_GROUPS: Array<[string, Action[]]> = [
  ["內政", ["land", "cultivate", "flood", "economy"]],
  ["軍事", ["draft", "train", "move", "war"]],
  ["人事", ["search", "reward", "delegate", "fire", "appoint"]],
  ["外交", ["ally", "truce", "threat", "revoke"]],
  ["計略", ["bribe", "forge"]],
  ["商業", ["buyFood", "sellFood", "buyEquipment"]],
  ["緊急", ["tax", "specialTax"]],
];

const ACTION_LABELS: Record<Action, string> = {
  land: "開墾土地（50金）",
  cultivate: "勸課農桑（20金）",
  flood: "興修堤防（50金）",
  economy: "振興商業（50金）",
  draft: "徵兵",
  train: "操練士兵",
  move: "移動武將",
  war: "出兵——進攻",
  search: "搜索賢才",
  reward: "恩賞武將",
  delegate: "委任內政（切換自動治理）",
  fire: "罷免武將",
  appoint: "任命太守",
  ally: "提議同盟",
  truce: "提議停戰",
  threat: "威嚇（索取貢金）",
  revoke: "破棄協議",
  bribe: "收買敵將（300金）",
  forge: "偽書離間（150金）",
  buyFood: "購買糧草",
  sellFood: "出售糧草",
  buyEquipment: "購買軍備",
  tax: "調整稅率",
  specialTax: "臨時徵稅（一次性）",
};

const NO_OFFICER_ACTIONS = new Set<Action>(["tax", "delegate", "appoint", "fire"]);

export function CityPanel(props: {
  state: GameState;
  cityId: number;
  onCommand: (fn: (s: GameState) => CmdResult) => void;
}) {
  const { state, cityId, onCommand } = props;
  const def = CITY_DEFS[cityId];
  const city = state.cities[cityId];
  const isPlayerCity = city.rulerId === state.playerRulerId;

  const stationed = useMemo(
    () =>
      Object.values(state.officers).filter(
        (o) => o.cityId === cityId && o.rulerId === city.rulerId && city.rulerId !== null,
      ),
    [state, cityId, city.rulerId],
  );
  const available = stationed.filter((o) => o.status === "available");

  const rivalOfficers = useMemo(
    () => Object.values(state.officers).filter((o) => o.rulerId !== null && o.rulerId !== city.rulerId),
    [state, city.rulerId],
  );
  const rivalRulers = useMemo(
    () =>
      Object.values(state.rulers).filter((r) => r.alive && r.id !== city.rulerId),
    [state, city.rulerId],
  );

  const [action, setAction] = useState<Action>("land");
  const [officerId, setOfficerId] = useState<number | null>(null);
  const [amount, setAmount] = useState(10);
  const [marketAmount, setMarketAmount] = useState(1000);
  const [target, setTarget] = useState<number | null>(null);
  const [rulerTarget, setRulerTarget] = useState<number | null>(null);
  const [officerTarget, setOfficerTarget] = useState<number | null>(null);
  const [soldiers, setSoldiers] = useState(1000);
  const [tax, setTax] = useState(city.taxRate);
  const [warOfficers, setWarOfficers] = useState<number[]>([]);

  const actor = officerId ?? available[0]?.id ?? null;

  const adjacent = def.adjacency.map((id) => state.cities[id]);
  const friendlyAdj = adjacent.filter((c) => c.rulerId === city.rulerId);
  const hostileAdj = adjacent.filter((c) => c.rulerId !== city.rulerId);

  const rulerName = city.rulerId !== null ? OFFICER_DEFS[city.rulerId].han : "—（無主）";
  const governorName = city.governorId !== null ? OFFICER_DEFS[city.governorId].han : "—";

  function run() {
    if (action === "tax") return onCommand((s) => setTaxRate(s, cityId, tax));
    if (action === "delegate") return onCommand((s) => setAutoGovern(s, cityId, !city.autoGovern));
    if (action === "fire") {
      if (target === null) return;
      return onCommand((s) => fireOfficer(s, target));
    }
    if (action === "appoint") {
      if (target === null) return;
      return onCommand((s) => appointGovernor(s, cityId, target));
    }
    if (actor === null) return;
    switch (action) {
      case "land": case "cultivate": case "flood": case "economy": {
        const kind: DevelopKind = action === "land" ? "land" : action === "cultivate" ? "cultivate" : action === "flood" ? "flood" : "economy";
        return onCommand((s) => develop(s, cityId, actor, kind));
      }
      case "draft":
        return onCommand((s) => draft(s, cityId, actor, amount));
      case "train":
        return onCommand((s) => train(s, cityId, actor));
      case "search":
        return onCommand((s) => search(s, cityId, actor));
      case "reward":
        return onCommand((s) => reward(s, actor, 100));
      case "move":
        if (target === null) return;
        return onCommand((s) => move(s, actor, target, soldiers));
      case "war": {
        if (target === null || warOfficers.length === 0) return;
        const leaders = warOfficers;
        return onCommand((s) => war(s, cityId, target, leaders, soldiers));
      }
      case "ally":
        if (rulerTarget === null) return;
        return onCommand((s) => proposeAlliance(s, actor, rulerTarget));
      case "truce":
        if (rulerTarget === null) return;
        return onCommand((s) => proposeTruce(s, actor, rulerTarget));
      case "threat":
        if (rulerTarget === null) return;
        return onCommand((s) => threaten(s, actor, rulerTarget));
      case "revoke":
        if (rulerTarget === null) return;
        return onCommand((s) => revokeAgreement(s, actor, rulerTarget));
      case "bribe":
        if (officerTarget === null) return;
        return onCommand((s) => bribe(s, actor, officerTarget));
      case "forge":
        if (officerTarget === null) return;
        return onCommand((s) => forgeLetter(s, actor, officerTarget));
      case "buyFood":
        return onCommand((s) => buyFood(s, cityId, actor, marketAmount));
      case "sellFood":
        return onCommand((s) => sellFood(s, cityId, actor, marketAmount));
      case "buyEquipment":
        return onCommand((s) => buyEquipment(s, cityId, actor, marketAmount));
      case "specialTax":
        return onCommand((s) => specialTax(s, cityId, actor));
    }
  }

  const needsOfficer = !NO_OFFICER_ACTIONS.has(action);
  const disabled = action === "fire" || action === "appoint"
    ? target === null
    : action === "tax" || action === "delegate"
      ? false
      : actor === null;

  return (
    <div className="city-panel">
      <h2>{def.han}</h2>
      <div className="subtitle">
        領主：{rulerName} · 太守：{governorName}
        {city.autoGovern && " · 🤝 委任治理"}
      </div>

      <div className="stat-grid">
        <div><span className="k">人口</span><span>{city.population.toLocaleString()}</span></div>
        <div><span className="k">兵力</span><span>{city.soldiers.toLocaleString()}</span></div>
        <div><span className="k">資金</span><span>{city.gold.toLocaleString()}</span></div>
        <div><span className="k">糧草</span><span>{city.food.toLocaleString()}</span></div>
        <div><span className="k">商業</span><span>{city.economy}</span></div>
        <div><span className="k">開發度</span><span>{city.landDev}</span></div>
        <div><span className="k">農業</span><span>{city.cultivation}</span></div>
        <div><span className="k">治水</span><span>{city.floodControl}</span></div>
        <div><span className="k">訓練度</span><span>{city.training}</span></div>
        <div><span className="k">民心</span><span>{city.support}</span></div>
        <div><span className="k">稅率</span><span>{city.taxRate}%</span></div>
        <div><span className="k">軍備</span><span>{city.equipment}</span></div>
      </div>

      {stationed.length > 0 && (
        <table className="officer-table">
          <thead>
            <tr><th>武將</th><th>武力</th><th>智力</th><th>政治</th><th>魅力</th><th>統率</th><th>忠誠</th><th>狀態</th></tr>
          </thead>
          <tbody>
            {stationed.map((o) => {
              const d = OFFICER_DEFS[o.id];
              return (
                <tr key={o.id} className={o.status !== "available" ? "done" : ""}>
                  <td>{d.han}</td>
                  <td>{d.war}</td><td>{d.int}</td><td>{d.pol}</td><td>{d.chr}</td>
                  <td>{d.armyCmd}</td>
                  <td>{o.loyalty}</td>
                  <td>{o.status === "available" ? "✓" : "…"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {isPlayerCity && !state.gameOver && (
        <div className="cmd-form">
          <h3>指令</h3>
          <div className="cmd-row">
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value as Action);
                setTarget(null);
                setRulerTarget(null);
                setOfficerTarget(null);
                setWarOfficers([]);
              }}
            >
              {ACTION_GROUPS.map(([group, actions]) => (
                <optgroup key={group} label={group}>
                  {actions.map((a) => (
                    <option key={a} value={a}>{ACTION_LABELS[a]}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {needsOfficer && (
              <select value={actor ?? ""} onChange={(e) => setOfficerId(Number(e.target.value))}>
                {available.length === 0 && <option value="">無可用武將</option>}
                {available.map((o) => (
                  <option key={o.id} value={o.id}>{OFFICER_DEFS[o.id].han}</option>
                ))}
              </select>
            )}
          </div>

          {action === "draft" && (
            <div className="cmd-row">
              <label>×100 人（每百人 10 金 + 100 糧）：</label>
              <input type="number" min={1} max={99} value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={{ width: 70 }} />
            </div>
          )}

          {(action === "tax") && (
            <div className="cmd-row">
              <label>稅率：{tax}%</label>
              <input type="range" min={0} max={100} value={tax} onChange={(e) => setTax(Number(e.target.value))} />
            </div>
          )}

          {action === "delegate" && (
            <div className="cmd-row">
              <label>目前{city.autoGovern ? "已開啟——由內政官代為處理本城政務" : "已關閉——由主公親自治理本城"}。執行以切換。</label>
            </div>
          )}

          {(action === "buyFood" || action === "sellFood" || action === "buyEquipment") && (
            <div className="cmd-row">
              <label>數量：</label>
              <input type="number" min={1} value={marketAmount} onChange={(e) => setMarketAmount(Number(e.target.value))} style={{ width: 100 }} />
              <span className="subtitle" style={{ marginBottom: 0 }}>
                {action === "buyFood" && "0.12金/石"}
                {action === "sellFood" && "0.06金/石"}
                {action === "buyEquipment" && "4金/件"}
              </span>
            </div>
          )}

          {action === "move" && (
            <div className="cmd-row">
              <label>目的地：</label>
              <select value={target ?? ""} onChange={(e) => setTarget(Number(e.target.value))}>
                <option value="">— 選擇我方城池 —</option>
                {friendlyAdj.map((c) => (
                  <option key={c.id} value={c.id}>{CITY_DEFS[c.id].han}</option>
                ))}
              </select>
              <label>兵力：</label>
              <input type="number" min={0} max={city.soldiers} value={soldiers} onChange={(e) => setSoldiers(Number(e.target.value))} style={{ width: 90 }} />
            </div>
          )}

          {action === "war" && (
            <>
              <div className="cmd-row">
                <label>目標：</label>
                <select value={target ?? ""} onChange={(e) => setTarget(Number(e.target.value))}>
                  <option value="">— 選擇敵方城池 —</option>
                  {hostileAdj.map((c) => (
                    <option key={c.id} value={c.id}>
                      {CITY_DEFS[c.id].han}（{c.rulerId === null ? "無主" : OFFICER_DEFS[c.rulerId].han}，兵力 {c.soldiers.toLocaleString()}）
                    </option>
                  ))}
                </select>
                <label>兵力：</label>
                <input type="number" min={100} max={city.soldiers} value={soldiers} onChange={(e) => setSoldiers(Number(e.target.value))} style={{ width: 90 }} />
              </div>
              <div className="cmd-row">
                <div className="check-list">
                  {available.map((o) => (
                    <label key={o.id}>
                      <input
                        type="checkbox"
                        checked={warOfficers.includes(o.id)}
                        onChange={(e) =>
                          setWarOfficers((prev) =>
                            e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id),
                          )
                        }
                      />
                      {OFFICER_DEFS[o.id].han}（統率 {OFFICER_DEFS[o.id].armyCmd}）
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {(action === "ally" || action === "truce" || action === "threat" || action === "revoke") && (
            <div className="cmd-row">
              <label>對象：</label>
              <select value={rulerTarget ?? ""} onChange={(e) => setRulerTarget(Number(e.target.value))}>
                <option value="">— 選擇敵對君主 —</option>
                {rivalRulers.map((r) => (
                  <option key={r.id} value={r.id}>{OFFICER_DEFS[r.id].han}</option>
                ))}
              </select>
            </div>
          )}

          {(action === "bribe" || action === "forge") && (
            <div className="cmd-row">
              <label>目標武將：</label>
              <select value={officerTarget ?? ""} onChange={(e) => setOfficerTarget(Number(e.target.value))}>
                <option value="">— 選擇敵方武將 —</option>
                {rivalOfficers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {OFFICER_DEFS[o.id].han}（{OFFICER_DEFS[o.rulerId!].han}，忠誠 {o.loyalty}）
                  </option>
                ))}
              </select>
            </div>
          )}

          {(action === "fire" || action === "appoint") && (
            <div className="cmd-row">
              <label>武將：</label>
              <select value={target ?? ""} onChange={(e) => setTarget(Number(e.target.value))}>
                <option value="">— 選擇駐守武將 —</option>
                {stationed
                  .filter((o) => action !== "fire" || o.id !== o.rulerId)
                  .map((o) => (
                    <option key={o.id} value={o.id}>{OFFICER_DEFS[o.id].han}</option>
                  ))}
              </select>
            </div>
          )}

          <button className="primary" onClick={run} disabled={disabled}>
            執行
          </button>
        </div>
      )}
    </div>
  );
}
