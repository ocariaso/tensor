import { describe, expect, it } from 'vitest';
import { easeInOutCubic, Transition } from './transition';

describe('easeInOutCubic', () => {
  it('maps the endpoints and midpoint exactly', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
  });
});

describe('Transition', () => {
  it('holds its value until retargeted', () => {
    const t = new Transition(1, 2);
    expect(t.update(0.5)).toBe(1);
    expect(t.done).toBe(true);
  });

  it('reaches the target exactly after the duration', () => {
    const t = new Transition(1, 2);
    t.retarget(0);
    t.update(1);
    expect(t.value).toBeCloseTo(0.5, 5);
    t.update(1.5);
    expect(t.value).toBe(0);
    expect(t.done).toBe(true);
  });

  it('restarts from the current value when retargeted mid-flight', () => {
    const t = new Transition(1, 2);
    t.retarget(0);
    t.update(1);
    const mid = t.value;
    t.retarget(1);
    t.update(0.001);
    expect(t.value).toBeCloseTo(mid, 3);
  });

  it('jumps straight to the target when duration is zero', () => {
    const t = new Transition(0, 0);
    t.retarget(1);
    expect(t.update(0.016)).toBe(1);
  });
});
