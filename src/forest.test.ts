import { describe, expect, it } from 'vitest';
import { clampTreeCount, MAX_TREES, TREES } from './forest';

describe('forest seeds', () => {
  it('defines a seed for every tree slot', () => {
    expect(TREES).toHaveLength(MAX_TREES);
  });

  it('keeps our tree exactly as the lower dimensions show it', () => {
    const ours = TREES[0];
    expect([ours.scale, ours.phase, ours.tempo, ours.sway, ours.spin]).toEqual([1, 0, 1, 1, 1]);
    expect(ours.age).toBe(Infinity);
  });

  it('starts every other tree from a different seed that is visible in the past', () => {
    const others = TREES.slice(1);
    expect(new Set(others.map((t) => t.age)).size).toBe(others.length);
    for (const tree of others) expect(Number.isFinite(tree.age)).toBe(true);
  });

  it('clamps the count to the 2 to 4 range', () => {
    expect(clampTreeCount(1)).toBe(2);
    expect(clampTreeCount(3)).toBe(3);
    expect(clampTreeCount(7)).toBe(4);
  });
});
