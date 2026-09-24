import { describe, expect, it } from 'vitest';
import { createUvSphere, MAX_POINTS } from './uvSphere';

describe('createUvSphere', () => {
  it('produces lat x lon points with matching buffer sizes', () => {
    const sphere = createUvSphere(8, 16);
    expect(sphere.count).toBe(128);
    expect(sphere.positions.length).toBe(128 * 3);
    expect(sphere.uvs.length).toBe(128 * 2);
  });

  it('places every point on the requested radius', () => {
    const radius = 2.5;
    const { positions, count } = createUvSphere(16, 32, radius);
    for (let i = 0; i < count; i++) {
      const r = Math.hypot(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      expect(r).toBeCloseTo(radius, 5);
    }
  });

  it('keeps uvs inside [0, 1]', () => {
    const { uvs } = createUvSphere(16, 32);
    for (const value of uvs) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('never samples exactly on a pole', () => {
    const { positions, count } = createUvSphere(16, 32);
    for (let i = 0; i < count; i++) {
      expect(Math.abs(positions[i * 3 + 1])).toBeLessThan(1);
    }
  });

  it('enforces the point budget', () => {
    expect(() => createUvSphere(256, 256)).not.toThrow();
    expect(256 * 256).toBe(MAX_POINTS);
    expect(() => createUvSphere(256, 257)).toThrow(/budget/);
  });
});
