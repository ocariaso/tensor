import { describe, expect, it } from 'vitest';
import { cameraRulesFor, DIMENSIONS, type DimensionId } from './dimensions';

const ALL = Object.keys(DIMENSIONS) as DimensionId[];

describe('camera rules', () => {
  it('never constrains the Spectator', () => {
    for (const id of ALL) {
      expect(cameraRulesFor(id, 'spectator')).toEqual({ rotate: true, pan: 'free', zoom: true });
    }
  });

  it('fully locks a 0D Inhabitant', () => {
    expect(cameraRulesFor('0d', 'inhabitant')).toEqual({ rotate: false, pan: 'none', zoom: false });
  });

  it('lets a 1D Inhabitant only pan along X', () => {
    expect(cameraRulesFor('1d', 'inhabitant')).toEqual({ rotate: false, pan: 'x', zoom: false });
  });
});

describe('dimension ladder', () => {
  it('orders levels by dimension count', () => {
    expect(DIMENSIONS['0d'].level).toBe(0);
    expect(DIMENSIONS['1d'].level).toBe(1);
  });
});
