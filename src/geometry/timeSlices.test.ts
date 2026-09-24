import { describe, expect, it } from 'vitest';
import { createTimeSlices } from './timeSlices';

describe('createTimeSlices', () => {
  it('allocates one entry per slice', () => {
    expect(createTimeSlices(60, 30).length).toBe(90);
  });

  it('spreads past slices evenly down to exactly -1', () => {
    const slices = createTimeSlices(4, 0);
    expect(Array.from(slices)).toEqual([-0.25, -0.5, -0.75, -1]);
  });

  it('spreads future slices evenly up to exactly 1', () => {
    const slices = createTimeSlices(0, 4);
    expect(Array.from(slices)).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('never duplicates the present moment', () => {
    for (const value of createTimeSlices(60, 30)) expect(value).not.toBe(0);
  });
});
