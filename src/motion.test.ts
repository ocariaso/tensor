import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TREES } from './forest';
import { branchOffset, subjectOffset, treeMotion } from './motion';

const v = new THREE.Vector3();
const w = new THREE.Vector3();

describe('subjectOffset', () => {
  it('sways sideways within its limits and never moves vertically', () => {
    for (let t = 0; t < 60; t += 0.37) {
      subjectOffset(t, v);
      expect(Math.abs(v.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(v.z)).toBeLessThanOrEqual(0.35);
      expect(v.y).toBe(0);
    }
  });
});

describe('treeMotion', () => {
  it('matches the plain sway for our own tree', () => {
    for (const t of [0, 1.3, 7.9]) {
      expect(treeMotion(TREES[0], t, v).distanceTo(subjectOffset(t, w))).toBeCloseTo(0);
    }
  });

  it('scales the sway by a tree’s sway strength', () => {
    const seed = { tempo: 1, phase: 0, sway: 2 };
    expect(treeMotion(seed, 2, v).x).toBeCloseTo(subjectOffset(2, w).x * 2);
  });
});

describe('branchOffset', () => {
  it('keeps the scripted branch on its path', () => {
    expect(branchOffset(0, 0, 1.2, 1.5, 1, v).length()).toBe(0);
  });

  it('starts every branch at the present moment', () => {
    expect(branchOffset(2, 0.5, 1.2, 0, 1, v).length()).toBe(0);
  });

  it('only drifts once 5D branching has begun', () => {
    expect(branchOffset(1, -0.5, 1.2, 1.5, 0, v).length()).toBe(0);
    expect(branchOffset(1, -0.5, 1.2, 1.5, 1, v).length()).toBeGreaterThan(0);
  });
});
