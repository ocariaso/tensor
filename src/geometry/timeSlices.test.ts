import { describe, expect, it } from 'vitest';
import { createSliceInstances } from './timeSlices';

describe('createSliceInstances', () => {
  it('allocates the shared past plus one future run per branch', () => {
    const { slices, branches } = createSliceInstances(60, 24, 5);
    expect(slices.length).toBe(60 + 24 * 5);
    expect(branches.length).toBe(slices.length);
  });

  it('spreads past slices evenly down to exactly -1 on branch 0', () => {
    const { slices, branches } = createSliceInstances(4, 0, 1);
    expect(Array.from(slices)).toEqual([-0.25, -0.5, -0.75, -1]);
    expect(Array.from(branches)).toEqual([0, 0, 0, 0]);
  });

  it('gives every branch the same future spacing up to exactly 1', () => {
    const { slices, branches } = createSliceInstances(0, 2, 3);
    expect(Array.from(slices)).toEqual([0.5, 1, 0.5, 1, 0.5, 1]);
    expect(Array.from(branches)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('never duplicates the present moment', () => {
    for (const value of createSliceInstances(60, 24, 5).slices) expect(value).not.toBe(0);
  });
});
