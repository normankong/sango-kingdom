import { CITY_DEFS, CITY_EDGES } from "../engine/data/cities.ts";
import { SCENARIOS } from "../engine/data/scenario190.ts";
import type { GameState } from "../engine/types.ts";

const NAVAL = new Set(["23-25", "24-25", "28-34", "33-34", "33-35"]);

export function rulerColor(state: GameState, rulerId: number | null): string {
  if (rulerId === null) return "#3d3629";
  const sc = SCENARIOS[state.scenarioId];
  return sc?.forces.find((f) => f.rulerId === rulerId)?.color ?? "#666";
}

export function MapView(props: {
  state: GameState;
  selectedCityId: number | null;
  onSelect: (cityId: number) => void;
}) {
  const { state, selectedCityId, onSelect } = props;
  return (
    <svg viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid meet">
      <rect x="0" y="0" width="1000" height="800" fill="#1a1712" />
      {CITY_EDGES.map(([a, b]) => {
        const ca = CITY_DEFS[a];
        const cb = CITY_DEFS[b];
        const naval = NAVAL.has(`${Math.min(a, b)}-${Math.max(a, b)}`);
        return (
          <line
            key={`${a}-${b}`}
            x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y}
            stroke={naval ? "#3a5a78" : "#4a4232"}
            strokeWidth={naval ? 2 : 1.5}
            strokeDasharray={naval ? "6 4" : undefined}
          />
        );
      })}
      {Object.values(CITY_DEFS).map((def) => {
        const cs = state.cities[def.id];
        const color = cs.rulerId === null ? "#3d3629" : rulerColor(state, cs.rulerId);
        const isPlayer = cs.rulerId === state.playerRulerId;
        const selected = selectedCityId === def.id;
        return (
          <g key={def.id} onClick={() => onSelect(def.id)} style={{ cursor: "pointer" }}>
            {selected && (
              <circle cx={def.x} cy={def.y} r={17} fill="none" stroke="#d4a843" strokeWidth={2.5} />
            )}
            <circle
              cx={def.x} cy={def.y} r={11}
              fill={color}
              stroke={isPlayer ? "#f0d070" : "#141210"}
              strokeWidth={isPlayer ? 2.5 : 1.5}
            />
            <text
              x={def.x} y={def.y - 16}
              textAnchor="middle"
              fill="#e8ddc6"
              fontSize={13}
              style={{ userSelect: "none", paintOrder: "stroke", stroke: "#141210", strokeWidth: 3 }}
            >
              {def.han}
            </text>
            <text
              x={def.x} y={def.y + 27}
              textAnchor="middle"
              fill="#8a7d66"
              fontSize={9}
              style={{ userSelect: "none" }}
            >
              {def.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
