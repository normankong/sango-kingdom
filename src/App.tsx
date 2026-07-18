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

const MONTHS = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

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
        ? `本月已結束——共 ${newEntries} 則戰報。`
        : "本月風平浪靜。",
    );
    setState({ ...state });
  }

  async function handleSave() {
    if (!state) return;
    try {
      await provider.save("slot1", state);
      setSaves(await provider.list());
      showToast(`遊戲已儲存（${provider.name}）。`);
    } catch (e) {
      showToast(`儲存失敗：${String(e)}`);
    }
  }

  async function handleLoad(slot: string) {
    try {
      const loaded = await provider.load(slot);
      if (loaded) {
        setState(loaded);
        setSelectedCityId(null);
      } else {
        showToast("找不到存檔。");
      }
    } catch (e) {
      showToast(`讀取失敗：${String(e)}`);
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
          西元 {state.date.year} 年 · {MONTHS[state.date.month - 1]}
        </span>
        <span>
          {OFFICER_DEFS[state.playerRulerId].han} — {playerCityCount}/46 州郡
        </span>
        <span className="spacer" />
        <button onClick={handleSave}>儲存</button>
        <button onClick={() => setState(null)}>標題畫面</button>
        <button className="primary" onClick={handleEndTurn} disabled={!!state.gameOver}>
          結束本月 ▶
        </button>
      </div>
      <div className="main">
        <div className="map-wrap">
          <MapView state={state} selectedCityId={selectedCityId} onSelect={setSelectedCityId} />
          {state.gameOver && (
            <div className="banner">
              {state.gameOver === "victory"
                ? "🐉 天下已歸掌中——中原一統！"
                : "麾下勢力已然覆滅，霸業夢碎於此。"}
            </div>
          )}
          {toast && <div className="msg-toast">{toast}</div>}
        </div>
        <div className="sidebar">
          {selectedCityId !== null ? (
            <CityPanel state={state} cityId={selectedCityId} onCommand={runCommand} />
          ) : (
            <div className="city-panel">
              <h2>請選擇城池</h2>
              <div className="subtitle">點擊地圖上的城池以檢視並下達指令。</div>
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
      {entries.length === 0 && <div className="entry">史書尚未落筆，下達指令並結束本月即可留下記載。</div>}
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
        三國志 網頁重製版 ·{" "}
        {props.cloud ? "☁ Firebase 雲端存檔" : "存檔於瀏覽器（未設定 Firebase）"}
      </div>
      <div className="cmd-row">
        <label>劇本：</label>
        <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="sub">{scenario.name} — 請選擇君主：</div>
      <div className="force-grid">
        {scenario.forces.map((f) => {
          const d = OFFICER_DEFS[f.rulerId];
          return (
            <button key={f.rulerId} className="force-card" onClick={() => props.onNewGame(scenario, f.rulerId)}>
              <div className="name">
                <span className="dot" style={{ background: f.color }} />
                {d.han}
              </div>
              <div className="info">
                {f.cities.length} 城 · {f.officerIds.length} 名武將 · {PERSONA_LABELS[f.persona]}
              </div>
            </button>
          );
        })}
      </div>
      {props.saves.length > 0 && (
        <div>
          {props.saves.map((s) => (
            <button key={s.slot} onClick={() => props.onLoad(s.slot)}>
              讀取：{OFFICER_DEFS[s.playerRulerId]?.han ?? "？"} — 西元 {s.year} 年（{new Date(s.updatedAt).toLocaleString()}）
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PERSONA_LABELS: Record<string, string> = {
  aggressive: "好戰",
  builder: "內政",
  balanced: "均衡",
};
