import type { GameState } from "./types";

const KEY = "hitster-kr-host-state:v2";

export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function saveState(state: GameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function clearState() {
  try { localStorage.removeItem(KEY); } catch {}
}
