import { describe, expect, it } from 'vitest';
import { cameraRulesFor, DIMENSIONS, isLocked, type DimensionId } from './dimensions';

const ALL = Object.keys(DIMENSIONS) as DimensionId[];

describe('camera rules', () => {
  it('never constrains the Spectator', () => {
    for (const id of ALL) {
      expect(cameraRulesFor(id, 'spectator')).toEqual({ rotate: true, pan: true, zoom: true });
    }
  });

  it('fully locks a 0D Inhabitant', () => {
    expect(isLocked(cameraRulesFor('0d', 'inhabitant'))).toBe(true);
  });

  it('lets a 3D Inhabitant move freely around the source shape', () => {
    expect(isLocked(cameraRulesFor('source', 'inhabitant'))).toBe(false);
  });
});

describe('dimension specs', () => {
  it('collapses the shape completely only in 0D', () => {
    expect(DIMENSIONS['0d'].collapse).toBe(0);
    expect(DIMENSIONS.source.collapse).toBe(1);
  });
});
