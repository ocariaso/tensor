import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MotionHistory, mulberry32, RandomWalk } from '../randomWalk';
import { forecast, MotionLearner, rescaled, VELOCITY_WINDOW } from './forecast';
import { CHECK_HORIZONS, HorizonCalibration } from './horizonCalibration';
import { restoreLearning } from './modelStore';
import { LinearMotionModel } from './motionModel';

const INTERVAL = 1 / 60;

describe('rescaled', () => {
  it('matches the forecast itself when the randomness is unchanged', () => {
    const model = new LinearMotionModel();
    const f = forecast(model, [{ x: 0, z: 0 }, { x: 0.01, z: 0 }], 30, INTERVAL);
    for (const k of [0, 10, 29]) {
      expect(rescaled(f, k, 1).confidence).toBeCloseTo(f.confidence[k]);
      expect(rescaled(f, k, 1).spread).toBeCloseTo(f.spread[k]);
    }
  });

  it('matches imagining the futures again with stronger randomness, for a linear model', () => {
    const model = new LinearMotionModel();
    const recent = [{ x: 0, z: 0 }, { x: 0.01, z: 0 }];
    const base = forecast(model, recent, 30, INTERVAL, 1);
    const doubled = forecast(model, recent, 30, INTERVAL, 0.2);
    expect(rescaled(base, 29, 0.2).confidence).toBeCloseTo(doubled.confidence[29]);
    expect(rescaled(base, 29, 0.2).spread).toBeCloseTo(doubled.spread[29], 5);
  });
});

describe('HorizonCalibration', () => {
  it('blends the correction between graded horizons and holds it beyond them', () => {
    const cal = new HorizonCalibration();
    cal.check('one').noiseScale = 1;
    cal.check('two').noiseScale = 2;
    cal.check('five').noiseScale = 3;
    cal.check('half').noiseScale = 0.5;
    expect(cal.scaleAt(1.5)).toBeCloseTo(1.5);
    expect(cal.scaleAt(0.1)).toBeCloseTo(0.5);
    expect(cal.scaleAt(9)).toBeCloseTo(3);
  });

  it('keeps every graded horizon honest: claimed confidence matches how often it came true', () => {
    const walk = new RandomWalk(mulberry32(21));
    const learner = new MotionLearner(new LinearMotionModel(), INTERVAL);
    const history = new MotionHistory(200, INTERVAL);
    history.reset(walk.position, 0);
    const cal = new HorizonCalibration();
    let next = INTERVAL;
    let frames = 0;
    walk.advance(400, 0, (time) => {
      if (time + 1e-9 < next) return;
      next += INTERVAL;
      history.push(walk.position);
      learner.observe(walk.position.x, walk.position.z);
      const now = history.newestTime;
      cal.settle(now, walk.position.x, walk.position.z);
      if (++frames % 12) return;
      const recent = Array.from({ length: VELOCITY_WINDOW }, (_, i) => {
        const p = history.sample(now - (VELOCITY_WINDOW - 1 - i) * INTERVAL, new THREE.Vector3());
        return { x: p.x, z: p.z };
      });
      const f = cal.calibrate(forecast(learner.model, recent, 301, INTERVAL), INTERVAL);
      cal.record(now, f, INTERVAL);
    });
    for (const { key } of CHECK_HORIZONS) {
      const c = cal.check(key);
      expect(c.checks).toBeGreaterThan(1000);
      expect(Math.abs(c.claimed - c.cameTrue)).toBeLessThan(0.1);
    }
    // Several simulated minutes are needed for every horizon to settle.
  }, 30_000);

  it('resumes an older save that only graded half a second and one second', () => {
    const cal = new HorizonCalibration();
    const old = JSON.stringify({
      format: 'tensor-model',
      version: 1,
      savedAt: '2026-09-24T00:00:00Z',
      model: new LinearMotionModel().save(),
      checks: { one: { averageError: 0.3, claimed: 0.6, cameTrue: 0.6, checks: 500, noiseScale: 1.3 }, half: cal.check('half').save() },
    });
    expect(restoreLearning(old, new LinearMotionModel(), cal.checks)).toBe(true);
    expect(cal.check('one').noiseScale).toBe(1.3);
    expect(cal.check('three').checks).toBe(0);
  });

  it('lists each horizon in its summary', () => {
    expect(new HorizonCalibration().summary().split('\n')).toHaveLength(CHECK_HORIZONS.length);
  });
});
