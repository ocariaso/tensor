import type { MotionModel } from './motionModel';
import { TRUSTED_CHECKS, type PredictionCheck } from './predictionCheck';

// Bump the version whenever the saved shape changes, so an old save is ignored instead of misread.
const STORAGE_KEY = 'tensor.model.v1';
const FORMAT = 'tensor-model';
const VERSION = 1;

/** Where the learned state is kept; the browser's localStorage in the app, a stand-in in tests. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type Scorekeepers = Record<string, PredictionCheck>;

interface SavedLearning {
  format: typeof FORMAT;
  version: typeof VERSION;
  savedAt: string;
  model: unknown;
  checks: Record<string, unknown>;
}

/** Everything learned, as text that can go into browser storage or a downloadable file. */
export function serializeLearning(model: MotionModel, checks: Scorekeepers, savedAt = new Date()): string {
  const saved: SavedLearning = {
    format: FORMAT,
    version: VERSION,
    savedAt: savedAt.toISOString(),
    model: model.save(),
    // A horizon graded too few times is left out, so after a reload it simply starts fresh.
    checks: Object.fromEntries(Object.entries(checks).filter(([, c]) => c.checks >= TRUSTED_CHECKS).map(([k, c]) => [k, c.save()])),
  };
  return JSON.stringify(saved, null, 2);
}

/** Restores learning from text, leaving the model and scorekeepers untouched unless every part of it is valid. */
export function restoreLearning(text: string, model: MotionModel, checks: Scorekeepers): boolean {
  let saved: Partial<SavedLearning>;
  try {
    saved = JSON.parse(text) as Partial<SavedLearning>;
  } catch {
    return false;
  }
  if (!saved || saved.format !== FORMAT || saved.version !== VERSION) return false;
  if (typeof saved.checks !== 'object' || saved.checks === null) return false;

  const backup = { model: model.save(), checks: Object.fromEntries(Object.entries(checks).map(([k, c]) => [k, c.save()])) };
  // A scorekeeper missing from an older save simply starts fresh; one that is present must be valid.
  const ok =
    model.load(saved.model) && Object.entries(checks).every(([k, c]) => saved.checks![k] === undefined || c.load(saved.checks![k]));
  if (!ok) {
    model.load(backup.model);
    for (const [k, c] of Object.entries(checks)) c.load(backup.checks[k]);
  }
  return ok;
}

/** Saves to browser storage; storage can be full or blocked, and the app keeps working without it. */
export function saveLearning(store: KeyValueStore, model: MotionModel, checks: Scorekeepers): boolean {
  try {
    store.setItem(STORAGE_KEY, serializeLearning(model, checks));
    return true;
  } catch {
    return false;
  }
}

export function loadLearning(store: KeyValueStore, model: MotionModel, checks: Scorekeepers): boolean {
  try {
    const text = store.getItem(STORAGE_KEY);
    return text !== null && restoreLearning(text, model, checks);
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

/** A dated file name, so several exported models can sit side by side. */
export function exportFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `tensor-model-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.json`;
}
