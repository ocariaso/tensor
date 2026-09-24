import { describe, expect, it } from 'vitest';
import { mulberry32, RandomWalk } from '../randomWalk';
import { MotionLearner } from './forecast';
import {
  exportFileName,
  forgetLearning,
  loadLearning,
  restoreLearning,
  saveLearning,
  serializeLearning,
  type KeyValueStore,
} from './modelStore';
import { LinearMotionModel } from './motionModel';
import { PredictionCheck } from './predictionCheck';

const INTERVAL = 1 / 60;

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function trained(): { model: LinearMotionModel; check: PredictionCheck } {
  const learner = new MotionLearner(new LinearMotionModel(), INTERVAL);
  const walk = new RandomWalk(mulberry32(3));
  let next = INTERVAL;
  walk.advance(30, 0, (t) => {
    if (t + 1e-9 < next) return;
    next += INTERVAL;
    learner.observe(walk.position.x, walk.position.z);
  });
  const check = new PredictionCheck(1, 0.5);
  check.noiseScale = 1.4;
  check.claimed = 0.7;
  return { model: learner.model as LinearMotionModel, check };
}

const STATE = { x: 0.3, z: -0.2, vx: 0.5, vz: 0.1 };

describe('model store', () => {
  it('resumes a saved model exactly where it left off', () => {
    const store = memoryStore();
    const saved = trained();
    expect(saveLearning(store, saved.model, { one: saved.check })).toBe(true);

    const model = new LinearMotionModel();
    const check = new PredictionCheck(1, 0.5);
    expect(loadLearning(store, model, { one: check })).toBe(true);
    expect(model.lessons).toBe(saved.model.lessons);
    expect(model.predictVelocity(STATE)).toEqual(saved.model.predictVelocity(STATE));
    expect(model.noise()).toEqual(saved.model.noise());
    expect(check.noiseScale).toBe(1.4);
  });

  it('keeps learning normally after resuming', () => {
    const store = memoryStore();
    const saved = trained();
    saveLearning(store, saved.model, { one: saved.check });
    const model = new LinearMotionModel();
    loadLearning(store, model, { one: new PredictionCheck(1, 0.5) });
    model.observe(STATE, 0.4, 0.1);
    expect(model.lessons).toBe(saved.model.lessons + 1);
  });

  it('ignores a damaged save and leaves the current model untouched', () => {
    const store = memoryStore();
    const saved = trained();
    saveLearning(store, saved.model, { one: saved.check });
    const text = store.data.get('tensor.model.v1')!;
    store.data.set('tensor.model.v1', text.replace('"weightsX": [', '"weightsX": ["oops", '));

    const current = trained();
    const before = current.model.predictVelocity(STATE);
    expect(loadLearning(store, current.model, { one: current.check })).toBe(false);
    expect(current.model.predictVelocity(STATE)).toEqual(before);
    store.data.set('tensor.model.v1', 'not json');
    expect(loadLearning(store, current.model, { one: current.check })).toBe(false);
  });

  it('finds nothing to resume after the save is forgotten', () => {
    const store = memoryStore();
    const saved = trained();
    saveLearning(store, saved.model, { one: saved.check });
    forgetLearning(store);
    expect(loadLearning(store, new LinearMotionModel(), { one: new PredictionCheck(1, 0.5) })).toBe(false);
  });

  it('round-trips through an exported file into a fresh model', () => {
    const saved = trained();
    const text = serializeLearning(saved.model, { one: saved.check });
    const model = new LinearMotionModel();
    const check = new PredictionCheck(1, 0.5);
    expect(restoreLearning(text, model, { one: check })).toBe(true);
    expect(model.predictVelocity(STATE)).toEqual(saved.model.predictVelocity(STATE));
    expect(check.noiseScale).toBe(1.4);
  });

  it('rejects files that are not TENSOR models', () => {
    const model = new LinearMotionModel();
    const check = new PredictionCheck(1, 0.5);
    expect(restoreLearning('{"hello":"world"}', model, { one: check })).toBe(false);
    expect(restoreLearning('<html></html>', model, { one: check })).toBe(false);
    const saved = trained();
    const other = serializeLearning(saved.model, { one: saved.check }).replace('"version": 1', '"version": 99');
    expect(restoreLearning(other, model, { one: check })).toBe(false);
    expect(model.lessons).toBe(0);
  });

  it('names exports by date and time', () => {
    expect(exportFileName(new Date(2026, 8, 24, 9, 5))).toBe('tensor-model-2026-09-24-0905.json');
  });

  it('keeps working when storage is blocked', () => {
    const blocked: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const saved = trained();
    expect(saveLearning(blocked, saved.model, { one: saved.check })).toBe(false);
    expect(loadLearning(blocked, saved.model, { one: saved.check })).toBe(false);
    expect(() => forgetLearning(blocked)).not.toThrow();
  });
});
