import { useMemo, useState } from "react";
import {
  develop,
  draft,
  move,
  reward,
  search,
  setTaxRate,
  train,
  war,
  type CmdResult,
  type DevelopKind,
} from "../engine/commands.ts";
import { CITY_DEFS } from "../engine/data/cities.ts";
import { OFFICER_DEFS } from "../engine/data/officers.ts";
import type { GameState } from "../engine/types.ts";

type Action =
  | "land" | "cultivate" | "flood" | "economy"
  | "draft" | "train" | "move" | "war" | "search" | "reward" | "tax";

const ACTION_LABELS: Record<Action, string> = {
  land: "Develop Land (50g)",
  cultivate: "Cultivate (20g)",
  flood: "Flood Control (50g)",
  economy: "Economy (50g)",
  draft: "Draft Soldiers",
  train: "Train Troops",
  move: "Move Officer",
  war: "War — Invade",
  search: "Search for Officers",
  reward: "Reward Officer",
  tax: "Set Tax Rate",
};

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

  const [action, setAction] = useState<Action>("land");
  const [officerId, setOfficerId] = useState<number | null>(null);
  const [amount, setAmount] = useState(10);
  const [target, setTarget] = useState<number | null>(null);
  const [soldiers, setSoldiers] = useState(1000);
  const [tax, setTax] = useState(city.taxRate);
  const [warOfficers, setWarOfficers] = useState<number[]>([]);

  const actor = officerId ?? available[0]?.id ?? null;

  const adjacent = def.adjacency.map((id) => state.cities[id]);
  const friendlyAdj = adjacent.filter((c) => c.rulerId === city.rulerId);
  const hostileAdj = adjacent.filter((c) => c.rulerId !== city.rulerId);

  const rulerName = city.rulerId !== null ? OFFICER_DEFS[city.rulerId].name : "— (unclaimed)";
  const governorName = city.governorId !== null ? OFFICER_DEFS[city.governorId].name : "—";

  function run() {
    if (action === "tax") return onCommand((s) => setTaxRate(s, cityId, tax));
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
    }
  }

  return (
    <div className="city-panel">
      <h2>{def.han} — {def.name}</h2>
      <div className="subtitle">Ruler: {rulerName} · Governor: {governorName}</div>

      <div className="stat-grid">
        <div><span className="k">Population</span><span>{city.population.toLocaleString()}</span></div>
        <div><span className="k">Soldiers</span><span>{city.soldiers.toLocaleString()}</span></div>
        <div><span className="k">Gold</span><span>{city.gold.toLocaleString()}</span></div>
        <div><span className="k">Food</span><span>{city.food.toLocaleString()}</span></div>
        <div><span className="k">Economy</span><span>{city.economy}</span></div>
        <div><span className="k">Land Dev.</span><span>{city.landDev}</span></div>
        <div><span className="k">Cultivation</span><span>{city.cultivation}</span></div>
        <div><span className="k">Flood Ctrl</span><span>{city.floodControl}</span></div>
        <div><span className="k">Training</span><span>{city.training}</span></div>
        <div><span className="k">Support</span><span>{city.support}</span></div>
        <div><span className="k">Tax Rate</span><span>{city.taxRate}%</span></div>
      </div>

      {stationed.length > 0 && (
        <table className="officer-table">
          <thead>
            <tr><th>Officer</th><th>War</th><th>Int</th><th>Pol</th><th>Chr</th><th>Cmd</th><th>Loy</th><th>St.</th></tr>
          </thead>
          <tbody>
            {stationed.map((o) => {
              const d = OFFICER_DEFS[o.id];
              return (
                <tr key={o.id} className={o.status !== "available" ? "done" : ""}>
                  <td>{d.name}</td>
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
          <h3>Command</h3>
          <div className="cmd-row">
            <select value={action} onChange={(e) => { setAction(e.target.value as Action); setTarget(null); setWarOfficers([]); }}>
              {(Object.keys(ACTION_LABELS) as Action[]).map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a]}</option>
              ))}
            </select>
            {action !== "tax" && (
              <select value={actor ?? ""} onChange={(e) => setOfficerId(Number(e.target.value))}>
                {available.length === 0 && <option value="">no officers free</option>}
                {available.map((o) => (
                  <option key={o.id} value={o.id}>{OFFICER_DEFS[o.id].name}</option>
                ))}
              </select>
            )}
          </div>

          {action === "draft" && (
            <div className="cmd-row">
              <label>×100 men (10g+100f each):</label>
              <input type="number" min={1} max={99} value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={{ width: 70 }} />
            </div>
          )}

          {action === "tax" && (
            <div className="cmd-row">
              <label>Rate: {tax}%</label>
              <input type="range" min={0} max={100} value={tax} onChange={(e) => setTax(Number(e.target.value))} />
            </div>
          )}

          {action === "move" && (
            <div className="cmd-row">
              <label>To:</label>
              <select value={target ?? ""} onChange={(e) => setTarget(Number(e.target.value))}>
                <option value="">— friendly city —</option>
                {friendlyAdj.map((c) => (
                  <option key={c.id} value={c.id}>{CITY_DEFS[c.id].name}</option>
                ))}
              </select>
              <label>Soldiers:</label>
              <input type="number" min={0} max={city.soldiers} value={soldiers} onChange={(e) => setSoldiers(Number(e.target.value))} style={{ width: 90 }} />
            </div>
          )}

          {action === "war" && (
            <>
              <div className="cmd-row">
                <label>Target:</label>
                <select value={target ?? ""} onChange={(e) => setTarget(Number(e.target.value))}>
                  <option value="">— enemy city —</option>
                  {hostileAdj.map((c) => (
                    <option key={c.id} value={c.id}>
                      {CITY_DEFS[c.id].name} ({c.rulerId === null ? "empty" : OFFICER_DEFS[c.rulerId].name}, {c.soldiers.toLocaleString()} men)
                    </option>
                  ))}
                </select>
                <label>Soldiers:</label>
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
                      {OFFICER_DEFS[o.id].name} (Cmd {OFFICER_DEFS[o.id].armyCmd})
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <button className="primary" onClick={run} disabled={action !== "tax" && actor === null}>
            Execute
          </button>
        </div>
      )}
    </div>
  );
}
