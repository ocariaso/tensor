import { describe, expect, it } from 'vitest';
import { wrapAngle } from './angle';

describe('wrapAngle', () => {
  it('leaves angles already in range untouched', () => {
    expect(wrapAngle(0)).toBeCloseTo(0);
    expect(wrapAngle(1)).toBeCloseTo(1);
    expect(wrapAngle(-3)).toBeCloseTo(-3);
  });

  it('folds whole turns away', () => {
    expect(wrapAngle(Math.PI * 2 + 0.5)).toBeCloseTo(0.5);
    expect(wrapAngle(-Math.PI * 6 - 0.5)).toBeCloseTo(-0.5);
  });

  it('maps just past PI to just past -PI', () => {
    expect(wrapAngle(Math.PI + 0.1)).toBeCloseTo(-Math.PI + 0.1);
  });
});
