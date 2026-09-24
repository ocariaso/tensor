import { describe, expect, it } from 'vitest';
import {
  clockRate,
  effectiveConstants,
  GRAVITY_OURS,
  LAW_WORLDS,
  LIGHT_SPEED_OURS,
  pinchTowardMass,
  UNCERTAINTY_OURS,
} from './physics';

describe('clockRate', () => {
  it('ticks at essentially the normal rate in our universe', () => {
    expect(clockRate(1, LIGHT_SPEED_OURS, GRAVITY_OURS, 0.5)).toBeGreaterThan(0.999);
  });

  it('slows a fast clock by the relativistic factor', () => {
    expect(clockRate(0.8, 1, 0, 1)).toBeCloseTo(0.6);
  });

  it('slows a clock more the closer it sits to a strong mass', () => {
    const near = clockRate(0, LIGHT_SPEED_OURS, 0.3, 0.1);
    const far = clockRate(0, LIGHT_SPEED_OURS, 0.3, 2);
    expect(near).toBeLessThan(far);
    expect(far).toBeLessThan(1);
  });

  it('never stops a clock completely', () => {
    expect(clockRate(100, 1, 0, 1)).toBeGreaterThan(0);
  });
});

describe('pinchTowardMass', () => {
  it('leaves points alone without gravity', () => {
    expect(pinchTowardMass({ x: 1, z: 0 }, 0)).toEqual({ x: 1, z: 0 });
  });

  it('pulls points inward but never past the mass', () => {
    const p = pinchTowardMass({ x: 0.6, z: 0.8 }, 10);
    const d = Math.hypot(p.x, p.z);
    expect(d).toBeLessThan(1);
    expect(d).toBeGreaterThan(0);
    expect(p.x / p.z).toBeCloseTo(0.75);
  });
});

describe('LAW_WORLDS', () => {
  it('changes exactly one law per world so each effect can be read on its own', () => {
    for (const world of LAW_WORLDS) {
      const changed = Object.values(world.dials).filter((v) => v !== 0);
      expect(changed).toHaveLength(1);
    }
  });

  it('never places a law-world on our slot', () => {
    for (const world of LAW_WORLDS) expect(world.slot).not.toBe(0);
  });
});

const DIALS = { lightSpeedExp: -2.5, uncertaintyExp: 2.5, gravityExp: 3 };

describe('effectiveConstants', () => {
  it('is exactly our universe before 7D begins', () => {
    expect(effectiveConstants(DIALS, 0)).toEqual({
      lightSpeed: LIGHT_SPEED_OURS,
      uncertainty: UNCERTAINTY_OURS,
      gravity: GRAVITY_OURS,
    });
  });

  it('reaches the dialed powers of ten at full weight', () => {
    const c = effectiveConstants(DIALS, 1);
    expect(c.lightSpeed).toBeCloseTo(LIGHT_SPEED_OURS * 10 ** -2.5);
    expect(c.uncertainty).toBeCloseTo(UNCERTAINTY_OURS * 10 ** 2.5);
    expect(c.gravity).toBeCloseTo(GRAVITY_OURS * 10 ** 3);
  });

  it('moves steadily between the two universes', () => {
    const quarter = effectiveConstants(DIALS, 0.25);
    const half = effectiveConstants(DIALS, 0.5);
    expect(half.lightSpeed).toBeLessThan(quarter.lightSpeed);
    expect(half.uncertainty).toBeGreaterThan(quarter.uncertainty);
    expect(half.gravity).toBeGreaterThan(quarter.gravity);
  });

  it('keeps our light speed far above the subject speed of about one unit per second', () => {
    expect(LIGHT_SPEED_OURS).toBeGreaterThan(100);
  });
});
