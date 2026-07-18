// Core domain types for the Sangokushi III Web simulation.
// The engine is pure TypeScript with no DOM/Firebase dependencies so it can be
// unit-tested and (later) reused server-side.

export interface CityDef {
  id: number;
  name: string; // English/romanized
  han: string; // Chinese name
  x: number; // map coordinates in a 1000x800 viewBox
  y: number;
  adjacency: number[]; // city ids reachable by land/water
  naval: number[]; // subset of adjacency requiring a river/sea crossing
}

export interface CityState {
  id: number;
  rulerId: number | null; // null = empty / neutral city
  governorId: number | null;
  population: number; // ≤ 3,000,000
  gold: number; // ≤ 50,000
  food: number; // ≤ 3,000,000
  soldiers: number;
  economy: number; // 0–9999, drives January gold tax
  landDev: number; // 0–100
  cultivation: number; // 0–100, resets after July harvest
  floodControl: number; // 0–100
  taxRate: number; // 0–100
  support: number; // 0–100 popular support
  training: number; // 0–100 garrison training level
}

export type OfficerStatus = "available" | "done" | "busy" | "sick";

export interface OfficerDef {
  id: number;
  name: string;
  han: string;
  war: number;
  int: number;
  pol: number;
  chr: number;
  armyCmd: number;
  navyCmd: number;
  birthYear: number;
}

export interface OfficerState {
  id: number;
  rulerId: number | null; // null = free officer
  cityId: number;
  loyalty: number; // 0–100
  status: OfficerStatus;
}

export interface RulerDef {
  id: number; // officer id of the ruler
  color: string;
  aiPersona: "aggressive" | "builder" | "balanced";
}

export interface RulerState {
  id: number;
  alive: boolean;
}

export interface TurnDate {
  year: number;
  month: number; // 1–12
}

export type LogKind =
  | "info"
  | "battle"
  | "economy"
  | "event"
  | "victory"
  | "defeat";

export interface LogEntry {
  date: TurnDate;
  kind: LogKind;
  text: string;
}

export interface GameState {
  scenarioId: string;
  date: TurnDate;
  playerRulerId: number;
  cities: Record<number, CityState>;
  officers: Record<number, OfficerState>;
  rulers: Record<number, RulerState>;
  rngSeed: number;
  log: LogEntry[];
  gameOver: "victory" | "defeat" | null;
}

export interface BattleReport {
  attackerRulerId: number;
  defenderRulerId: number | null;
  cityId: number;
  fromCityId: number;
  attackerPower: number;
  defenderPower: number;
  attackerWon: boolean;
  attackerLosses: number;
  defenderLosses: number;
}
