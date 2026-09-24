import { describe, expect, it } from 'vitest';
import { effectiveConstants, GRAVITY_OURS, LIGHT_SPEED_OURS, UNCERTAINTY_OURS } from './physics';

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
