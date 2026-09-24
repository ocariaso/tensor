import { describe, expect, it } from 'vitest';
import {
  clampUniverseCount,
  MAX_UNIVERSES,
  UNIVERSE_AMPS,
  UNIVERSE_PHASES,
  UNIVERSE_SHIFTS,
  UNIVERSE_SPLITS,
  UNIVERSE_TINTS,
  universeLabel,
} from './universes';

describe('universe layout', () => {
  it('defines every table for each universe slot', () => {
    for (const table of [UNIVERSE_SHIFTS, UNIVERSE_PHASES, UNIVERSE_AMPS, UNIVERSE_TINTS, UNIVERSE_SPLITS]) {
      expect(table).toHaveLength(MAX_UNIVERSES);
    }
  });

  it('keeps our universe unshifted and unaltered', () => {
    expect(UNIVERSE_SHIFTS[0]).toBe(0);
    expect(UNIVERSE_PHASES[0]).toBe(0);
    expect(UNIVERSE_AMPS[0]).toBe(1);
  });

  it('splits farther universes from ours earlier in the past', () => {
    expect(UNIVERSE_SPLITS[0]).toBe(0);
    for (let i = 1; i < UNIVERSE_SPLITS.length; i++) {
      for (let j = 1; j < UNIVERSE_SPLITS.length; j++) {
        if (Math.abs(UNIVERSE_SHIFTS[i]) < Math.abs(UNIVERSE_SHIFTS[j])) {
          expect(UNIVERSE_SPLITS[i]).toBeLessThan(UNIVERSE_SPLITS[j]);
        }
      }
    }
  });

  it('keeps every split inside the visible past', () => {
    for (const split of UNIVERSE_SPLITS) {
      expect(split).toBeGreaterThanOrEqual(0);
      expect(split).toBeLessThan(1);
    }
  });

  it('never stacks two universes on the same spot', () => {
    expect(new Set(UNIVERSE_SHIFTS).size).toBe(MAX_UNIVERSES);
  });

  it('clamps the count to the 2 to 5 range', () => {
    expect(clampUniverseCount(0)).toBe(2);
    expect(clampUniverseCount(3.4)).toBe(3);
    expect(clampUniverseCount(9)).toBe(5);
  });

  it('labels universes by their side and distance', () => {
    expect(universeLabel(0)).toBe('Ours');
    expect(universeLabel(1)).toBe('U−1');
    expect(universeLabel(4)).toBe('U+2');
  });
});
