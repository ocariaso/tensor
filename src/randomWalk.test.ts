import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MotionHistory, mulberry32, RandomWalk } from './randomWalk';

describe('RandomWalk', () => {
  it('moves only sideways and never changes height', () => {
    const walk = new RandomWalk(mulberry32(1));
    walk.advance(20, 0, () => {});
    expect(walk.position.y).toBe(0);
    expect(walk.position.length()).toBeGreaterThan(0);
  });

  it('stays near the centre over a long run', () => {
    const walk = new RandomWalk(mulberry32(7));
    let furthest = 0;
    walk.advance(600, 0, () => (furthest = Math.max(furthest, Math.abs(walk.position.x))));
    expect(furthest).toBeLessThan(4);
  });

  it('takes different paths with different random draws', () => {
    const a = new RandomWalk(mulberry32(1));
    const b = new RandomWalk(mulberry32(2));
    a.advance(5, 0, () => {});
    b.advance(5, 0, () => {});
    expect(a.position.distanceTo(b.position)).toBeGreaterThan(1e-3);
  });

  it('steps a fixed amount of simulated time however the frames are sliced', () => {
    const steps: number[] = [];
    const walk = new RandomWalk(mulberry32(3));
    for (let i = 0; i < 30; i++) walk.advance(1 / 30, i / 30, (t) => steps.push(t));
    expect(steps.length).toBeGreaterThanOrEqual(119);
    expect(steps.length).toBeLessThanOrEqual(120);
  });
});

describe('MotionHistory', () => {
  it('holds a resting position across the whole window after a reset', () => {
    const history = new MotionHistory(10, 0.1);
    history.reset(new THREE.Vector3(1, 0, 2), 5);
    expect(history.newestTime).toBeCloseTo(5);
    expect(history.sample(4.3, new THREE.Vector3()).toArray()).toEqual([1, 0, 2]);
  });

  it('returns exactly what was recorded, interpolating between samples', () => {
    const history = new MotionHistory(4, 1);
    history.reset(new THREE.Vector3(0, 0, 0), 0);
    history.push(new THREE.Vector3(2, 0, 0));
    expect(history.newestTime).toBeCloseTo(1);
    expect(history.sample(1, new THREE.Vector3()).x).toBeCloseTo(2);
    expect(history.sample(0.5, new THREE.Vector3()).x).toBeCloseTo(1);
  });

  it('holds the newest position for times after it and the oldest for times before it', () => {
    const history = new MotionHistory(4, 1);
    history.reset(new THREE.Vector3(0, 0, 0), 0);
    history.push(new THREE.Vector3(3, 0, 0));
    expect(history.sample(9, new THREE.Vector3()).x).toBeCloseTo(3);
    expect(history.sample(-9, new THREE.Vector3()).x).toBeCloseTo(0);
  });
});

describe('RandomWalk habits', () => {
  it('moves exactly as before while habits are off', () => {
    const plain = new RandomWalk(mulberry32(4));
    const off = new RandomWalk(mulberry32(4));
    off.habits = false;
    plain.advance(10, 0, () => {});
    off.advance(10, 0, () => {});
    expect(off.position.toArray()).toEqual(plain.position.toArray());
  });

  it('stays within reach of the centre, turning back near the edge', () => {
    const walk = new RandomWalk(mulberry32(9));
    walk.habits = true;
    let furthest = 0;
    walk.advance(600, 0, () => (furthest = Math.max(furthest, Math.hypot(walk.position.x, walk.position.z))));
    expect(furthest).toBeLessThan(2);
  });

  it('travels around the centre while circling', () => {
    const walk = new RandomWalk(mulberry32(12));
    walk.habits = true;
    walk.habitTuning = { ...walk.habitTuning, circleStopRate: 0, circleStartRate: 0 };
    walk.circling = 1;
    walk.position.set(0.6, 0, 0);
    let turned = 0;
    let last = Math.atan2(walk.position.z, walk.position.x);
    walk.advance(8, 0, () => {
      const angle = Math.atan2(walk.position.z, walk.position.x);
      turned += Math.atan2(Math.sin(angle - last), Math.cos(angle - last));
      last = angle;
    });
    // Circling one way winds up well over a full turn; the random pushes alone would not.
    expect(Math.abs(turned)).toBeGreaterThan(2 * Math.PI);
  });

  it('moves more while restless than while calm', () => {
    const speed = (mood: 'calm' | 'restless') => {
      const walk = new RandomWalk(mulberry32(6));
      walk.habits = true;
      walk.habitTuning = { ...walk.habitTuning, moodSwitchRate: 0, circleStartRate: 0 };
      walk.mood = mood;
      let total = 0;
      walk.advance(60, 0, () => (total += walk.velocity.length()));
      return total;
    };
    expect(speed('restless')).toBeGreaterThan(speed('calm') * 1.5);
  });

  it('copies its full state, hidden habits included', () => {
    const walk = new RandomWalk(mulberry32(2));
    walk.habits = true;
    walk.advance(5, 0, () => {});
    const a = walk.clone(mulberry32(77));
    const b = walk.clone(mulberry32(77));
    expect([a.mood, a.circling]).toEqual([walk.mood, walk.circling]);
    a.advance(2, 0, () => {});
    b.advance(2, 0, () => {});
    expect(a.position.toArray()).toEqual(b.position.toArray());
  });
});
