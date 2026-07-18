import { useEffect, useMemo, useRef, useState } from "react";
import type { CmdResult } from "./engine/commands.ts";
import { OFFICER_DEFS } from "./engine/data/officers.ts";
import { SCENARIO_190, SCENARIOS } from "./engine/data/scenario190.ts";
import type { ScenarioDef } from "./engine/data/scenario190.ts";
import { newGame } from "./engine/newGame.ts";
import { endTurn } from "./engine/turn.ts";
import type { GameState } from "./engine/types.ts";
import { firebaseAvailable, makeSaveProvider } from "./save/firebaseSave.ts";
import type { SaveMeta } from "./save/saveProvider.ts";
import { CityPanel } from "./ui/CityPanel.tsx";
import { MapView } from "./ui/MapView.tsx";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function App() {
  const provider = useMemo(() => makeSaveProvider(), []);
  const [state, setState] = useState<GameState | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const toastTimer = useRef<number>(0);

  useEffect(() => {
    provider.list().then(setSaves).catch(() => setSaves([]));
  }, [provider]);

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }

  function runCommand(fn: (s: GameState) => CmdResult) {
    if (!state) return;
    const result = fn(state);
    showToast(result.message);
    setState({ ...state });
  }

  function handleEndTurn() {
    if (!state) return;
    const before = state.log.length;
    endTurn(state);
    const newEntries = state.log.length - before;
    showToast(
      newEntries > 0
        ? `Month ended — ${newEntries} report${newEntries > 1 ? "s" : ""} in the log.`
        : "Month ended quietly.",
    );
    setState({ ...state });
  }

  async function handleSave() {
    if (!state) return;
    try {
      await provider.save("slot1", state);
      setSaves(await provider.list());
      showToast(`Game saved (${provider.name}).`);
    } catch (e) {
      showToast(`Save failed: ${String(e)}`);
    }
  }

  async function handleLoad(slot: string) {
    try {
      const loaded = await provider.load(slot);
      if (loaded) {
        setState(loaded);
        setSelectedCityId(null);
      } else {
        showToast("No save found.");
      }
    } catch (e) {
      showToast(`Load failed: ${String(e)}`);
    }
  }

  if (!state) {
    return (
      <TitleScreen
        saves={saves}
        backend={provider.name}
        cloud={firebaseAvailable()}
        onNewGame={(scenario, rulerId) => {
          const gs = newGame(scenario, rulerId);
          setState(gs);
          setSelectedCityId(
            Object.values(gs.cities).find((c) => c.rulerId === rulerId)?.id ?? null,
          );
        }}
        onLoad={handleLoad}
      />
    );
  }

  const playerCityCount = Object.values(state.cities).filter(
    (c) => c.rulerId === state.playerRulerId,
  ).length;

  return (
    <div className="app">
      <div className="topbar">
        <span className="date">
          {state.date.year} AD · {MONTHS[state.date.month - 1]}
        </span>
        <span>
          {OFFICER_DEFS[state.playerRulerId].han} {OFFICER_DEFS[state.playerRulerId].name} — {playerCityCount}/46 cities
        </span>
        <span className="spacer" />
        <button onClick={handleSave}>Save</button>
        <button onClick={() => setState(null)}>Title</button>
        <button className="primary" onClick={handleEndTurn} disabled={!!state.gameOver}>
          End Month ▶
        </button>
      </div>
      <div className="main">
        <div className="map-wrap">
          <MapView state={state} selectedCityId={selectedCityId} onSelect={setSelectedCityId} />
          {state.gameOver && (
            <div className="banner">
              {state.gameOver === "victory"
                ? "🐉 All under heaven is yours — China is unified!"
                : "Your force has been destroyed. The dream ends here."}
            </div>
          )}
          {toast && <div className="msg-toast">{toast}</div>}
        </div>
        <div className="sidebar">
          {selectedCityId !== null ? (
            <CityPanel state={state} cityId={selectedCityId} onCommand={runCommand} />
          ) : (
            <div className="city-panel">
              <h2>Select a city</h2>
              <div className="subtitle">Click a city on the map to inspect and command it.</div>
            </div>
          )}
          <LogPanel state={state} />
        </div>
      </div>
    </div>
  );
}

function LogPanel({ state }: { state: GameState }) {
  const entries = state.log.slice(-40).reverse();
  return (
    <div className="log-panel">
      {entries.length === 0 && <div className="entry">The chronicle is empty. Issue commands and end the month.</div>}
      {entries.map((e, i) => (
        <div key={state.log.length - i} className={`entry ${e.kind}`}>
          <span className="d">{e.date.year}.{e.date.month}</span>
          {e.text}
        </div>
      ))}
    </div>
  );
}

function TitleScreen(props: {
  saves: SaveMeta[];
  backend: string;
  cloud: boolean;
  onNewGame: (scenario: ScenarioDef, rulerId: number) => void;
  onLoad: (slot: string) => void;
}) {
  const scenarios = Object.values(SCENARIOS);
  const [scenarioId, setScenarioId] = useState(SCENARIO_190.id);
  const scenario = SCENARIOS[scenarioId];

  return (
    <div className="title-screen">
      <h1>三國志</h1>
      <div className="sub">
        Sango Kingdom — a web remake of Romance of the Three Kingdoms III ·{" "}
        {props.cloud ? "☁ Firebase cloud saves" : "saves in browser storage (Firebase not configured)"}
      </div>
      <div className="cmd-row">
        <label>Scenario:</label>
        <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="sub">{scenario.name} — choose your ruler:</div>
      <div className="force-grid">
        {scenario.forces.map((f) => {
          const d = OFFICER_DEFS[f.rulerId];
          return (
            <button key={f.rulerId} className="force-card" onClick={() => props.onNewGame(scenario, f.rulerId)}>
              <div className="name">
                <span className="dot" style={{ background: f.color }} />
                {d.han} {d.name}
              </div>
              <div className="info">
                {f.cities.length} {f.cities.length === 1 ? "city" : "cities"} · {f.officerIds.length} officers · {f.persona}
              </div>
            </button>
          );
        })}
      </div>
      {props.saves.length > 0 && (
        <div>
          {props.saves.map((s) => (
            <button key={s.slot} onClick={() => props.onLoad(s.slot)}>
              Load: {OFFICER_DEFS[s.playerRulerId]?.name ?? "?"} — {s.year} AD ({new Date(s.updatedAt).toLocaleString()})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
