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

  it('lets a 2D Inhabitant pan and zoom but never tilt', () => {
    expect(cameraRulesFor('2d', 'inhabitant')).toEqual({ rotate: false, pan: 'xy', zoom: true });
  });

  it('gives 3D and 4D Inhabitants full orbit', () => {
    expect(cameraRulesFor('3d', 'inhabitant')).toEqual({ rotate: true, pan: 'free', zoom: true });
    expect(cameraRulesFor('4d', 'inhabitant')).toEqual({ rotate: true, pan: 'free', zoom: true });
  });
});

describe('dimension ladder', () => {
  it('sets each level to its dimension count', () => {
    for (const id of ALL) {
      expect(DIMENSIONS[id].level).toBe(Number.parseInt(id, 10));
    }
  });
});
