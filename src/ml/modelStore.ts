import type { MotionModel } from './motionModel';
import type { PredictionCheck } from './predictionCheck';

// Bump the version whenever the saved shape changes, so an old save is ignored instead of misread.
const STORAGE_KEY = 'tensor.model.v1';

/** Where the learned state is kept; the browser's localStorage in the app, a stand-in in tests. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface SavedState {
  model: unknown;
  checks: Record<string, unknown>;
}

/** Saves the model and its scorekeepers; storage can be full or blocked, and the app keeps working without it. */
export function saveLearning(store: KeyValueStore, model: MotionModel, checks: Record<string, PredictionCheck>): boolean {
  try {
    const state: SavedState = { model: model.save(), checks: Object.fromEntries(Object.entries(checks).map(([k, c]) => [k, c.save()])) };
    store.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Restores a saved model and scorekeepers, leaving them untouched unless every part of the save is valid. */
export function loadLearning(store: KeyValueStore, model: MotionModel, checks: Record<string, PredictionCheck>): boolean {
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return false;
    const state = JSON.parse(raw) as Partial<SavedState>;
    if (!state || typeof state.checks !== 'object' || state.checks === null) return false;
    const backup = { model: model.save(), checks: Object.fromEntries(Object.entries(checks).map(([k, c]) => [k, c.save()])) };
    const ok = model.load(state.model) && Object.entries(checks).every(([k, c]) => c.load(state.checks![k]));
    if (!ok) {
      model.load(backup.model);
      for (const [k, c] of Object.entries(checks)) c.load(backup.checks[k]);
    }
    return ok;
  } catch {
    return false;
  }
}

export function forgetLearning(store: KeyValueStore): void {
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
