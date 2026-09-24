import { describe, expect, it } from 'vitest';
import { createSliceInstances, createUniverseInstances } from './timeSlices';

describe('createSliceInstances', () => {
  it('allocates the shared past plus one future run per branch', () => {
    const { slices, branches, universes } = createSliceInstances(60, 24, 5);
    expect(slices.length).toBe(60 + 24 * 5);
    expect(branches.length).toBe(slices.length);
    expect(universes.length).toBe(slices.length);
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

  it('belongs entirely to our universe', () => {
    expect(createSliceInstances(3, 2, 2).universes.every((u) => u === 0)).toBe(true);
  });

  it('never duplicates the present moment', () => {
    for (const value of createSliceInstances(60, 24, 5).slices) expect(value).not.toBe(0);
  });
});

describe('createUniverseInstances', () => {
  it('skips our universe and gives each other one a present, past and future', () => {
    const { slices, universes } = createUniverseInstances(2, 1, 3, 1);
    expect(Array.from(slices)).toEqual([0, -0.5, -1, 1, 0, -0.5, -1, 1]);
    expect(Array.from(universes)).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
  });

  it('gives every parallel universe its own branching future', () => {
    const { slices, branches } = createUniverseInstances(1, 2, 2, 2);
    expect(Array.from(slices)).toEqual([0, -1, 0.5, 1, 0.5, 1]);
    expect(Array.from(branches)).toEqual([0, 0, 0, 0, 1, 1]);
  });

  it('orders by universe so a prefix draws only the first few', () => {
    const { universes } = createUniverseInstances(60, 24, 5, 5);
    const perUniverse = 1 + 60 + 24 * 5;
    expect(universes[perUniverse - 1]).toBe(1);
    expect(universes[perUniverse]).toBe(2);
  });
});
