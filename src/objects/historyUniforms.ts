import * as THREE from 'three';
import type { MotionHistory } from '../randomWalk';

export type HistoryUniforms = Record<string, THREE.IUniform>;

/** Hands the recorded path to the shaders as a one-row float texture they can look any past instant up in. */
export function createHistoryUniforms(history: MotionHistory): HistoryUniforms {
  const texture = new THREE.DataTexture(history.samples, history.size, 1, THREE.RGBAFormat, THREE.FloatType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return {
    uRandomMotion: { value: 0 },
    uHistory: { value: texture },
    uHistoryStart: { value: history.start },
    uHistoryStep: { value: history.interval },
    uHistorySize: { value: history.size },
  };
}

/** Uploads the newest recording and its time window. */
export function syncHistoryUniforms(uniforms: HistoryUniforms, history: MotionHistory, random: boolean): void {
  uniforms.uRandomMotion.value = random ? 1 : 0;
  uniforms.uHistoryStart.value = history.start;
  (uniforms.uHistory.value as THREE.DataTexture).needsUpdate = true;
}
