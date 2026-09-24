import * as THREE from 'three';
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
