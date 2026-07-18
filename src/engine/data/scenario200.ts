import { OFFICER_DEFS } from "./officers.ts";
import type { ScenarioDef, ScenarioForce } from "./scenario190.ts";

// Scenario: 200 AD — "Prelude to Guandu". A decade on from the coalition:
// the north has consolidated into a handful of great powers. Approximate
// borders ([Verify] §9) — reuses the 190 AD officer roster wherever the
// historical figure was still active, plus one addition (Liu Zhang).

const FORCES: ScenarioForce[] = [
  {
    rulerId: 10,
    cities: [9, 10, 11, 18, 20, 21, 22, 30],
    officerIds: [10, 11, 12, 13, 14, 15, 16, 78, 79, 80, 88, 89],
    persona: "aggressive",
    color: "#2b5db8",
  },
  {
    rulerId: 17,
    cities: [2, 3, 4, 5, 6, 7, 8],
    officerIds: [17, 18, 19, 20, 21, 22, 23],
    persona: "aggressive",
    color: "#7a3fa8",
  },
  {
    rulerId: 64,
    cities: [19],
    officerIds: [64, 65, 66, 67, 68, 27],
    persona: "balanced",
    color: "#3ca86e",
  },
  {
    rulerId: 29,
    cities: [1],
    officerIds: [29, 30],
    persona: "builder",
    color: "#5e716a",
  },
  {
    rulerId: 58,
    cities: [14, 15, 16, 17],
    officerIds: [58, 59, 60, 61],
    persona: "aggressive",
    color: "#a85a2e",
  },
  {
    rulerId: 62,
    cities: [39],
    officerIds: [62, 63],
    persona: "builder",
    color: "#c8b23c",
  },
  {
    rulerId: 91,
    cities: [40, 41, 42, 43],
    officerIds: [91, 55, 56, 57],
    persona: "builder",
    color: "#4a7a4a",
  },
  {
    rulerId: 41,
    cities: [31, 32, 33, 34, 35, 36, 37, 38],
    officerIds: [41, 42, 43, 44, 45, 46, 47],
    persona: "builder",
    color: "#2e8a68",
  },
  {
    rulerId: 49,
    cities: [23, 24, 25, 26, 27, 28, 29],
    officerIds: [49, 50, 51, 52, 53, 82, 83, 84, 85, 86],
    persona: "balanced",
    color: "#c23a3a",
  },
  {
    rulerId: 76,
    cities: [46],
    officerIds: [76, 77],
    persona: "builder",
    color: "#5a8a8a",
  },
];

// Everyone not claimed by a force is a hidden free officer, scattered across
// the scenario's neutral cities (12 Hongnong, 13 Chang'an, 44 Jianning, 45
// Yunnan — reflecting Guanzhong's post-Dong-Zhuo chaos and the unclaimed far
// southwest).
const NEUTRAL_CITIES = [12, 13, 44, 45];

function buildFreeOfficers(): Record<number, number> {
  const claimed = new Set(FORCES.flatMap((f) => f.officerIds));
  const free: Record<number, number> = {};
  const unclaimedIds = Object.keys(OFFICER_DEFS)
    .map(Number)
    .filter((id) => !claimed.has(id));
  unclaimedIds.forEach((id, idx) => {
    free[id] = NEUTRAL_CITIES[idx % NEUTRAL_CITIES.length];
  });
  return free;
}

export const SCENARIO_200: ScenarioDef = {
  id: "s200",
  name: "200 AD — Prelude to Guandu",
  startYear: 200,
  startMonth: 1,
  forces: FORCES,
  freeOfficers: buildFreeOfficers(),
};
