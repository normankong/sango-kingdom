import type { GameState } from "../engine/types.ts";
import { metaOf, type SaveMeta, type SaveProvider } from "./saveProvider.ts";

const PREFIX = "sango-save:";
const META_KEY = "sango-save-index";

export class LocalStorageProvider implements SaveProvider {
  readonly name = "Browser storage";

  async list(): Promise<SaveMeta[]> {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as SaveMeta[]) : [];
  }

  async save(slot: string, state: GameState): Promise<void> {
    localStorage.setItem(PREFIX + slot, JSON.stringify(state));
    const metas = (await this.list()).filter((m) => m.slot !== slot);
    metas.push(metaOf(slot, state));
    localStorage.setItem(META_KEY, JSON.stringify(metas));
  }

  async load(slot: string): Promise<GameState | null> {
    const raw = localStorage.getItem(PREFIX + slot);
    return raw ? (JSON.parse(raw) as GameState) : null;
  }

  async remove(slot: string): Promise<void> {
    localStorage.removeItem(PREFIX + slot);
    const metas = (await this.list()).filter((m) => m.slot !== slot);
    localStorage.setItem(META_KEY, JSON.stringify(metas));
  }
}
