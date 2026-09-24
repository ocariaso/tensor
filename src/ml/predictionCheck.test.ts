import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MotionTrack } from '../motionTrack';
import { MotionHistory, mulberry32, RandomWalk } from '../randomWalk';
import { CONFIDENCE_RADIUS, forecast, MotionLearner, VELOCITY_WINDOW } from './forecast';
import { LinearMotionModel } from './motionModel';
import { PredictionCheck } from './predictionCheck';

const INTERVAL = 1 / 60;

describe('PredictionCheck', () => {
  it('scores a prediction only once its moment arrives', () => {
    const check = new PredictionCheck(1, 0.5);
    check.record(0, 1, 0, 0.8);
    expect(check.settle(0.5, 1, 0)).toBeNull();
    const result = check.settle(1, 1.3, 0);
    expect(result?.ghostX).toBe(1);
    expect(result?.error).toBeCloseTo(0.3);
    expect(check.cameTrue).toBe(1);
  });

  it('widens its uncertainty when it claims more confidence than comes true', () => {
    const check = new PredictionCheck(1, 0.5);
    for (let i = 0; i < 50; i++) {
      check.record(i, 0, 0, 0.9);
      check.settle(i + 1, 2, 0);
    }
    expect(check.noiseScale).toBeGreaterThan(1);
  });

  it('recovers quickly after a stretch of wildly wrong predictions', () => {
    const check = new PredictionCheck(1, 0.5);
    const random = mulberry32(8);
    // A toy model whose claimed confidence falls as its uncertainty scale grows; truly, 60% of predictions land.
    const claim = () => Math.min(0.99, 0.9 / check.noiseScale);
    let t = 0;
    for (let i = 0; i < 300; i++, t++) {
      check.record(t, 0, 0, claim());
      check.settle(t + 1, 1715, 0);
    }
    expect(check.noiseScale).toBeLessThanOrEqual(2.5);
    expect(check.averageError).toBeLessThanOrEqual(5);
    let recovered = -1;
    for (let i = 0; i < 2000 && recovered < 0; i++, t++) {
      check.record(t, 0, 0, claim());
      check.settle(t + 1, random() < 0.6 ? 0.1 : 2, 0);
      if (Math.abs(check.noiseScale - 1.5) < 0.3 && Math.abs(check.claimed - check.cameTrue) < 0.1) recovered = i;
    }
    expect(recovered).toBeGreaterThan(0);
    expect(recovered).toBeLessThan(600);
  });

  it('keeps a restored calibration within its limits', () => {
    const check = new PredictionCheck(1, 0.5);
    expect(check.load({ averageError: 1, claimed: 0.5, cameTrue: 0.5, checks: 400, noiseScale: 4 })).toBe(true);
    expect(check.noiseScale).toBe(2.5);
  });

  it('runs honestly end to end: after learning, the confidence it claims matches how often it is right', () => {
    const walk = new RandomWalk(mulberry32(21));
    const learner = new MotionLearner(new LinearMotionModel(), INTERVAL);
    const history = new MotionHistory(120, INTERVAL);
    history.reset(walk.position, 0);
    const check = new PredictionCheck(1, CONFIDENCE_RADIUS);
    let next = INTERVAL;
    let frames = 0;
    const late = { claimed: 0, hits: 0, n: 0 };
    walk.advance(600, 0, (time) => {
      if (time + 1e-9 < next) return;
      next += INTERVAL;
      history.push(walk.position);
      learner.observe(walk.position.x, walk.position.z);
      const now = history.newestTime;
      const settled = check.settle(now, walk.position.x, walk.position.z);
      if (settled && now > 300) {
        late.hits += settled.error <= CONFIDENCE_RADIUS ? 1 : 0;
        late.n++;
      }
      if (++frames % 6) return;
      const recent = Array.from({ length: VELOCITY_WINDOW }, (_, i) => {
        const p = history.sample(now - (VELOCITY_WINDOW - 1 - i) * INTERVAL, new THREE.Vector3());
        return { x: p.x, z: p.z };
      });
      const f = forecast(learner.model, recent, 60, INTERVAL, check.noiseScale);
      check.record(now, f.x[59], f.z[59], f.confidence[59]);
      if (now > 300) late.claimed += f.confidence[59];
    });
    const claimed = late.claimed / (late.n || 1);
    const actual = late.hits / (late.n || 1);
    expect(Math.abs(claimed - actual)).toBeLessThan(0.08);
    // Ten simulated minutes take a few seconds to run.
  }, 30_000);
});

describe('MotionTrack', () => {
  it('joins the recorded past to the forecast after it', () => {
    const history = new MotionHistory(4, 1);
    history.reset(new THREE.Vector3(0, 0, 0), 3);
    history.push(new THREE.Vector3(1, 0, 0));
    const track = new MotionTrack(4, 2, 1);
    const f = { x: new Float32Array([2, 3]), z: new Float32Array([0, 0]), spread: new Float32Array([0.1, 0.2]), confidence: new Float32Array([0.9, 0.7]), deviation: new Float32Array(0) };
    track.update(history, f);
    expect(track.presentTime).toBeCloseTo(4);
    expect(track.sample(4, new THREE.Vector3()).x).toBeCloseTo(1);
    expect(track.sample(6, new THREE.Vector3()).x).toBeCloseTo(3);
    expect(track.spreadAt(5.5)).toBeCloseTo(0.15);
    expect(track.confidenceAt(6)).toBeCloseTo(0.7);
    expect(track.spreadAt(3)).toBe(0);
  });

  it('holds the present position ahead of it when there is no forecast', () => {
    const history = new MotionHistory(3, 1);
    history.reset(new THREE.Vector3(2, 0, 1), 5);
    const track = new MotionTrack(3, 2, 1);
    track.update(history, null);
    expect(track.sample(7, new THREE.Vector3()).toArray()).toEqual([2, 0, 1]);
    expect(track.predicted).toBe(0);
  });
});
