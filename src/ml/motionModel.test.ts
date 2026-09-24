import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { mulberry32, RandomWalk } from '../randomWalk';
import { forecast, MotionLearner } from './forecast';
import { LinearMotionModel } from './motionModel';

const INTERVAL = 1 / 60;

/** Runs a random walk for some seconds, recording a position every interval and teaching the learner with it. */
function record(walk: RandomWalk, seconds: number, learner?: MotionLearner): THREE.Vector3[] {
  const path: THREE.Vector3[] = [];
  let next = INTERVAL;
  walk.advance(seconds, 0, (time) => {
    if (time + 1e-9 < next) return;
    next += INTERVAL;
    path.push(walk.position.clone());
    learner?.observe(walk.position.x, walk.position.z);
  });
  return path;
}

function stateAt(path: THREE.Vector3[], i: number) {
  return {
    x: path[i].x,
    z: path[i].z,
    vx: (path[i].x - path[i - 1].x) / INTERVAL,
    vz: (path[i].z - path[i - 1].z) / INTERVAL,
  };
}

describe('LinearMotionModel', () => {
  it('starts knowing nothing and reports wide uncertainty', () => {
    const model = new LinearMotionModel();
    expect(model.lessons).toBe(0);
    expect(model.predictVelocity({ x: 1, z: 0, vx: 1, vz: 0 })).toEqual({ vx: 0, vz: 0 });
    expect(model.noise().x).toBeGreaterThan(0.5);
  });

  it('learns momentum and the pull toward the centre from a random walk', () => {
    const learner = new MotionLearner(new LinearMotionModel(), INTERVAL);
    record(new RandomWalk(mulberry32(5)), 120, learner);
    const w = (learner.model as LinearMotionModel).weights().x;
    // Velocity mostly carries over, and position pulls it back toward zero.
    expect(w[2]).toBeGreaterThan(0.9);
    expect(w[2]).toBeLessThan(1.01);
    expect(w[0]).toBeLessThan(0);
  });

  it('forgets everything on reset', () => {
    const learner = new MotionLearner(new LinearMotionModel(), INTERVAL);
    record(new RandomWalk(mulberry32(5)), 10, learner);
    learner.reset();
    expect(learner.model.lessons).toBe(0);
  });
});

describe('forecast', () => {
  // Trains on one run, then scores one-second predictions on a fresh run the model has never seen.
  const learner = new MotionLearner(new LinearMotionModel(), INTERVAL);
  record(new RandomWalk(mulberry32(11)), 180, learner);
  const test = record(new RandomWalk(mulberry32(99)), 120);
  const steps = 60;
  const scores = { model: 0, still: 0, coast: 0, claimed: 0, hits: 0, trials: 0 };
  for (let i = 1; i + steps < test.length; i += 30) {
    const s = stateAt(test, i);
    const f = forecast(learner.model, s, steps, INTERVAL);
    const actual = test[i + steps];
    const predicted = new THREE.Vector3(f.x[steps - 1], 0, f.z[steps - 1]);
    const error = actual.distanceTo(predicted);
    scores.model += error;
    scores.still += actual.distanceTo(test[i]);
    scores.coast += actual.distanceTo(new THREE.Vector3(s.x + s.vx, 0, s.z + s.vz));
    scores.claimed += f.confidence[steps - 1];
    if (error <= 0.5) scores.hits++;
    scores.trials++;
  }

  it('predicts a second ahead better than assuming the subject stands still or keeps its speed', () => {
    expect(scores.model).toBeLessThan(scores.still);
    expect(scores.model).toBeLessThan(scores.coast);
  });

  it('claims a confidence close to how often its predictions actually come true', () => {
    const claimed = scores.claimed / scores.trials;
    const actual = scores.hits / scores.trials;
    expect(Math.abs(claimed - actual)).toBeLessThan(0.15);
  });

  it('grows less certain the further ahead it looks', () => {
    const f = forecast(learner.model, stateAt(test, 5), steps, INTERVAL);
    expect(f.spread[steps - 1]).toBeGreaterThan(f.spread[5]);
    expect(f.confidence[steps - 1]).toBeLessThanOrEqual(f.confidence[5]);
  });

  it('imagines the same futures for the same seed, so the drawing stays steady', () => {
    const s = stateAt(test, 5);
    expect(Array.from(forecast(learner.model, s, 10, INTERVAL).spread)).toEqual(Array.from(forecast(learner.model, s, 10, INTERVAL).spread));
  });
});
