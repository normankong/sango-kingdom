import type { RulerDef } from "../types.ts";

// Scenario: 190 AD — "The Coalition Against Dong Zhuo".
// Force layouts approximate the original scenario ([Verify] §9).

export interface ScenarioForce {
  rulerId: number; // officer id of the ruler
  cities: number[]; // first entry = home city
  officerIds: number[]; // includes the ruler
  persona: RulerDef["aiPersona"];
  color: string;
}

export interface ScenarioDef {
  id: string;
  name: string;
  startYear: number;
  startMonth: number;
  forces: ScenarioForce[];
  /** free officers: officerId -> cityId where they hide */
  freeOfficers: Record<number, number>;
}

export const SCENARIO_190: ScenarioDef = {
  id: "s190",
  name: "190 AD — The Coalition Against Dong Zhuo",
  startYear: 190,
  startMonth: 1,
  forces: [
    { rulerId: 1, cities: [11, 12, 13, 14, 15], officerIds: [1, 2, 3, 4, 5, 6, 7, 8, 9], persona: "aggressive", color: "#8b1e1e" },
    { rulerId: 10, cities: [10], officerIds: [10, 11, 12, 13, 14, 15, 16], persona: "balanced", color: "#2b5db8" },
    { rulerId: 17, cities: [5], officerIds: [17, 18, 19, 20, 21, 22, 23], persona: "balanced", color: "#7a3fa8" },
    { rulerId: 24, cities: [6], officerIds: [24, 25], persona: "builder", color: "#996c2e" },
    { rulerId: 26, cities: [2, 3], officerIds: [26, 27, 28], persona: "aggressive", color: "#b8b8b8" },
    { rulerId: 29, cities: [1], officerIds: [29, 30], persona: "builder", color: "#5e716a" },
    { rulerId: 31, cities: [8], officerIds: [31, 32, 33], persona: "builder", color: "#3f8ba8" },
    { rulerId: 34, cities: [21, 22], officerIds: [34, 35, 36, 37], persona: "builder", color: "#a86e3f" },
    { rulerId: 38, cities: [30], officerIds: [38, 39, 40], persona: "aggressive", color: "#5a8a3c" },
    { rulerId: 41, cities: [32, 33, 34], officerIds: [41, 42, 43, 44, 45, 46, 47], persona: "builder", color: "#2e8a68" },
    { rulerId: 48, cities: [35], officerIds: [48, 49, 50, 51, 52, 53], persona: "aggressive", color: "#c23a3a" },
    { rulerId: 54, cities: [40, 41, 42], officerIds: [54, 55, 56, 57], persona: "builder", color: "#4a7a4a" },
    { rulerId: 58, cities: [16, 17], officerIds: [58, 59, 60, 61], persona: "aggressive", color: "#a85a2e" },
    { rulerId: 62, cities: [39], officerIds: [62, 63], persona: "builder", color: "#c8b23c" },
    { rulerId: 64, cities: [7], officerIds: [64, 65, 66, 67, 68], persona: "balanced", color: "#3ca86e" },
    { rulerId: 69, cities: [26], officerIds: [69, 70], persona: "builder", color: "#777777" },
    { rulerId: 71, cities: [27], officerIds: [71, 72], persona: "builder", color: "#6a5acd" },
    { rulerId: 73, cities: [25], officerIds: [73, 74, 75], persona: "builder", color: "#8a7a5a" },
    { rulerId: 76, cities: [46], officerIds: [76, 77], persona: "builder", color: "#5a8a8a" },
  ],
  freeOfficers: {
    78: 6, // Xun Yu — Ye
    79: 6, // Guo Jia — Ye
    80: 9, // Cheng Yu — Puyang
    81: 9, // Chen Gong — Puyang
    82: 24, // Zhou Yu — Lujiang
    83: 23, // Lu Su — Shouchun
    84: 25, // Zhang Zhao — Jianye
    85: 26, // Zhang Hong — Wu
    86: 42, // Gan Ning — Jiangzhou
    87: 32, // Wei Yan — Xiangyang
    88: 12, // Xu Huang — Hongnong
    89: 18, // Man Chong — Xuchang
    90: 23, // Liu Ye — Shouchun
  },
};

export const SCENARIOS: Record<string, ScenarioDef> = {
  [SCENARIO_190.id]: SCENARIO_190,
};
