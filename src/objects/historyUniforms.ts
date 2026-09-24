import * as THREE from 'three';
import type { MotionTrack } from '../motionTrack';

export type HistoryUniforms = Record<string, THREE.IUniform>;

/** Hands the recorded past and predicted future to the shaders as a one-row float texture they can look any instant up in. */
export function createHistoryUniforms(track: MotionTrack): HistoryUniforms {
  const texture = new THREE.DataTexture(track.buffer, track.size, 1, THREE.RGBAFormat, THREE.FloatType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return {
    uRandomMotion: { value: 0 },
    uHistory: { value: texture },
    uHistoryStart: { value: track.start },
    uHistoryStep: { value: track.interval },
    uHistorySize: { value: track.size },
  };
}

/** Uploads the newest track and its time window. */
export function syncHistoryUniforms(uniforms: HistoryUniforms, track: MotionTrack, random: boolean): void {
  uniforms.uRandomMotion.value = random ? 1 : 0;
  uniforms.uHistoryStart.value = track.start;
  (uniforms.uHistory.value as THREE.DataTexture).needsUpdate = true;
}
