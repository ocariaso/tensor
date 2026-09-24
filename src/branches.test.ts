import { describe, expect, it } from 'vitest';
import { layoutBranches, MAX_BRANCHES } from './branches';

describe('layoutBranches', () => {
  it('always pads to the maximum branch count', () => {
    const { offsets, probabilities } = layoutBranches(3);
    expect(offsets).toHaveLength(MAX_BRANCHES);
    expect(probabilities).toHaveLength(MAX_BRANCHES);
  });

  it('normalizes probabilities to 1 and zeroes unused slots', () => {
    for (const count of [3, 4, 5]) {
      const { probabilities } = layoutBranches(count);
      expect(probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
      expect(probabilities.slice(count).every((p) => p === 0)).toBe(true);
    }
  });

  it('makes the scripted path the most likely branch', () => {
    const { probabilities } = layoutBranches(5);
    expect(Math.max(...probabilities)).toBe(probabilities[0]);
  });

  it('keeps the scripted path at W = 0', () => {
    expect(layoutBranches(4).offsets[0]).toBe(0);
  });

  it('clamps the count to the 3 to 5 range', () => {
    expect(layoutBranches(1).probabilities.filter((p) => p > 0)).toHaveLength(3);
    expect(layoutBranches(9).probabilities.filter((p) => p > 0)).toHaveLength(5);
  });
});
