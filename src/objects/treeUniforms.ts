import * as THREE from 'three';
import type { TreeSeed } from '../forest';

export type TreeUniforms = Record<string, THREE.IUniform>;

// Shaders can't take Infinity, so a seed beyond the visible past is placed far enough back to never show.
const UNSEEN_SEED_AGE = 1e6;

/** One tree's starting conditions as uniforms, merged into each of that tree's materials. */
export function createTreeUniforms(seed: TreeSeed): TreeUniforms {
  const isOurs = seed.age === Infinity;
  return {
    uTreeOffset: { value: new THREE.Vector3() },
    uTreeScale: { value: seed.scale },
    uTreePhase: { value: seed.phase },
    uTreeTempo: { value: seed.tempo },
    uTreeSway: { value: seed.sway },
    uTreeSpin: { value: seed.spin },
    uTreeAge: { value: isOurs ? UNSEEN_SEED_AGE : seed.age },
    uTreeTint: { value: new THREE.Color().setStyle(seed.tint, THREE.LinearSRGBColorSpace) },
    uTreeTintAmount: { value: isOurs ? 0 : 0.3 },
    uTreePresence: { value: isOurs ? 1 : 0 },
  };
}
