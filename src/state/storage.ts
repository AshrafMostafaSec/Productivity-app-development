import type { AppState } from '../types';
import { createInitialState } from './initialState';

const STORAGE_KEY = 'anchoros:v1'; // key kept stable; the payload carries its own version

/** Load persisted state, filling any fields added since it was saved. */
export function loadState(): AppState {
  const fresh = createInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Omit<Partial<AppState>, 'version'> & { version?: number; focus?: unknown };
    if (!parsed || (parsed.version !== 1 && parsed.version !== 2)) return fresh;
    // v1 → v2: drop the old single focus session; new fields come from `fresh`.
    const { focus: _legacy, ...rest } = parsed;
    return { ...fresh, ...rest, version: 2 };
  } catch {
    return fresh;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be full or disabled (private mode); the app keeps working in memory.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
