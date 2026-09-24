import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TREES } from './forest';
import { BRANCH_MOTIONS } from './branches';
import { branchMotion, branchOffset, properTimeTicks, subjectOffset, treeMotion, treeVelocity } from './motion';

describe('branchMotion', () => {
  const now = 4.2;
  const at = (b: number, dt: number) => branchMotion(TREES[0], BRANCH_MOTIONS[b], now, dt, 1, new THREE.Vector3());

  it('shares the past and the present with the main motion', () => {
    for (let b = 0; b < BRANCH_MOTIONS.length; b++) {
      for (const dt of [-1, -0.2, 0]) expect(at(b, dt).distanceTo(treeMotion(TREES[0], now + dt, v))).toBeCloseTo(0);
    }
  });

  it('leaves the present at the same speed, so nothing jumps at the split', () => {
    const base = treeVelocity(TREES[0], now, new THREE.Vector3());
    for (let b = 1; b < BRANCH_MOTIONS.length; b++) {
      const speed = at(b, 0.001).sub(at(b, 0)).divideScalar(0.001);
      expect(speed.distanceTo(base)).toBeLessThan(0.01);
    }
  });

  it('keeps branch A on the main motion and moves every other branch its own way', () => {
    expect(at(0, 1.2).distanceTo(treeMotion(TREES[0], now + 1.2, v))).toBeCloseTo(0);
    for (let b = 1; b < BRANCH_MOTIONS.length; b++) {
      expect(at(b, 1.2).distanceTo(treeMotion(TREES[0], now + 1.2, v))).toBeGreaterThan(0.02);
    }
  });
});

describe('treeVelocity', () => {
  it('matches the slope of the motion', () => {
    const t = 3.2;
    const slope = treeMotion(TREES[0], t + 1e-4, new THREE.Vector3()).sub(treeMotion(TREES[0], t, new THREE.Vector3())).divideScalar(1e-4);
    expect(treeVelocity(TREES[0], t, new THREE.Vector3()).distanceTo(slope)).toBeLessThan(1e-3);
  });
});

describe('properTimeTicks', () => {
  it('spaces ticks evenly when the clock runs normally', () => {
    const ticks = properTimeTicks(() => 1, 2, 1, 0.5);
    expect(ticks.map((t) => Math.round(t * 100) / 100)).toEqual([-2, -1.5, -1, -0.5, 0, 0.5, 1]);
  });

  it('spreads ticks twice as far apart when the clock runs at half speed', () => {
    const ticks = properTimeTicks(() => 0.5, 2, 2, 0.5);
    expect(ticks.map((t) => Math.round(t * 100) / 100)).toEqual([-2, -1, 0, 1, 2]);
  });
});

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
