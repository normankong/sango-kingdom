import type { GameState } from "../engine/types.ts";

// Save-slot abstraction (§7 of the design doc): the authoritative simulation
// runs client-side; a provider just persists the serialized GameState.
// LocalStorageProvider always works; FirebaseProvider activates when a
// Firebase web config is supplied via VITE_FIREBASE_* env vars.

export interface SaveMeta {
  slot: string;
  scenarioId: string;
  playerRulerId: number;
  year: number;
  month: number;
  updatedAt: number;
}

export interface SaveProvider {
  readonly name: string;
  list(): Promise<SaveMeta[]>;
  save(slot: string, state: GameState): Promise<void>;
  load(slot: string): Promise<GameState | null>;
  remove(slot: string): Promise<void>;
}

export function metaOf(slot: string, state: GameState): SaveMeta {
  return {
    slot,
    scenarioId: state.scenarioId,
    playerRulerId: state.playerRulerId,
    year: state.date.year,
    month: state.date.month,
    updatedAt: Date.now(),
  };
}
