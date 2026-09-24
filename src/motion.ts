import * as THREE from 'three';
import { branchBlend, type BranchMotion } from './branches';
import type { TreeSeed } from './forest';

/** Mirrors subjectOffset in subject.glsl so labels can follow what the shader draws. */
export function subjectOffset(t: number, target: THREE.Vector3): THREE.Vector3 {
  const period = 6;
  const warped = t - ((0.8 * period) / (2 * Math.PI)) * Math.sin((2 * Math.PI * t) / period);
  return target.set(
    0.8 * Math.sin(0.45 * warped) + 0.2 * Math.sin(1.1 * warped + 1),
    0,
    0.35 * Math.sin(0.3 * warped + 2),
  );
}

/** Mirrors treeMotion in subject.glsl for one tree's starting conditions. */
export function treeMotion(seed: Pick<TreeSeed, 'tempo' | 'phase' | 'sway'>, t: number, target: THREE.Vector3): THREE.Vector3 {
  return subjectOffset(t * seed.tempo + seed.phase, target).multiplyScalar(seed.sway);
}

/** Mirrors treeVelocity in subject.glsl. */
export function treeVelocity(seed: Pick<TreeSeed, 'tempo' | 'phase' | 'sway'>, t: number, target: THREE.Vector3): THREE.Vector3 {
  const ahead = treeMotion(seed, t + 0.01, new THREE.Vector3());
  return treeMotion(seed, t - 0.01, target).sub(ahead).multiplyScalar(-1 / 0.02);
}

/**
 * Coordinate-time offsets where the subject's own clock reads each multiple of the tick interval,
 * found by stepping through time and adding up its clock rate.
 */
export function properTimeTicks(
  rateAt: (dt: number) => number,
  past: number,
  future: number,
  interval: number,
  step = 0.01,
): number[] {
  const ticks: number[] = [0];
  for (const direction of [-1, 1]) {
    const limit = direction < 0 ? past : future;
    let clock = 0;
    let next = interval;
    for (let t = 0; t < limit; t += step) {
      clock += rateAt(direction * (t + step / 2)) * step;
      if (clock >= next) {
        ticks.push(direction * (t + step));
        next += interval;
      }
    }
  }
  return ticks.sort((a, b) => a - b);
}

/** Mirrors branchPath in trail.vert.glsl for our own universe: shared motion until now, then the branch's own. */
export function branchMotion(
  seed: Pick<TreeSeed, 'tempo' | 'phase' | 'sway'>,
  motion: BranchMotion,
  now: number,
  dt: number,
  branching: number,
  target: THREE.Vector3,
): THREE.Vector3 {
  treeMotion(seed, now + dt, target);
  const blend = branchBlend(dt, branching);
  if (blend === 0) return target;
  const variant = treeMotion(seed, now + dt * motion.tempo, new THREE.Vector3()).multiplyScalar(motion.sway);
  return target.lerp(variant, blend);
}

/** Mirrors the branch drift and wobble in trail.vert.glsl. */
export function branchOffset(
  branch: number,
  w: number,
  spread: number,
  dt: number,
  branching: number,
  target: THREE.Vector3,
): THREE.Vector3 {
  if (branch === 0 || dt <= 0) return target.set(0, 0, 0);
  return target.set(
    (w * spread * dt * dt + Math.sin(dt * (2 + branch * 1.3) + branch) * 0.15 * dt) * branching,
    0,
    Math.sin(dt * (1.5 + branch * 0.9) + 2 * branch) * 0.15 * dt * branching,
  );
}
