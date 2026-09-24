import * as THREE from 'three';
import { BRANCH_COLORS, BRANCH_MOTIONS, layoutBranches, MAX_BRANCHES } from '../branches';
import type { SliceInstances } from '../geometry/timeSlices';
import type { PointCloudData } from '../geometry/uvSphere';
import { GRAVITY_OURS, LIGHT_SPEED_OURS, UNCERTAINTY_OURS } from '../physics';
import physicsChunk from '../shaders/physics.glsl?raw';
import subjectChunk from '../shaders/subject.glsl?raw';
import trailVertex from '../shaders/trail.vert.glsl?raw';
import fragmentShader from '../shaders/cloud.frag.glsl?raw';
import {
  MAX_UNIVERSES,
  UNIVERSE_AMPS,
  UNIVERSE_PHASES,
  UNIVERSE_SHIFTS,
  UNIVERSE_SPLITS,
  UNIVERSE_TINTS,
} from '../universes';

export type Trail = THREE.Points<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
export type TrailUniforms = Record<string, THREE.IUniform>;

// Raw hex values so the shader colors match the legend swatches exactly.
function rawColors(hexes: string[]): THREE.Color[] {
  return hexes.map((hex) => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace));
}

/** One uniform set shared by every trail object so a single per-frame update drives them all. */
export function createTrailUniforms(pixelRatio: number): TrailUniforms {
  const layout = layoutBranches(MAX_BRANCHES);
  return {
    uTemporal: { value: 0 },
    uBranching: { value: 0 },
    uParallel: { value: 0 },
    uVisibility: { value: 1 },
    uTime: { value: 0 },
    uMotionTime: { value: 0 },
    uLightSpeed: { value: LIGHT_SPEED_OURS },
    uUncertainty: { value: UNCERTAINTY_OURS },
    uGravity: { value: GRAVITY_OURS },
    uPast: { value: 2 },
    uFuture: { value: 1 },
    uTimeScale: { value: 0.8 },
    uSphereRadius: { value: 1.2 },
    uSubjectScale: { value: 1 },
    uSpin: { value: 0 },
    uSpinRate: { value: 0 },
    uPointSize: { value: 2.5 },
    uPixelRatio: { value: pixelRatio },
    uOpacity: { value: 0.18 },
    uBranchCount: { value: MAX_BRANCHES },
    uBranchSpread: { value: 1.2 },
    uBranchW: { value: layout.offsets },
    uBranchP: { value: layout.probabilities },
    uBranchColors: { value: rawColors(BRANCH_COLORS) },
    uBranchTempo: { value: BRANCH_MOTIONS.map((m) => m.tempo) },
    uBranchSway: { value: BRANCH_MOTIONS.map((m) => m.sway) },
    uBranchSpinRate: { value: BRANCH_MOTIONS.map((m) => m.spin) },
    uFocusBranch: { value: -1 },
    uOthersAlpha: { value: 1 },
    uUniverseCount: { value: MAX_UNIVERSES },
    uUniverseSpacing: { value: 2.6 },
    uUniverseShift: { value: UNIVERSE_SHIFTS },
    uUniversePhase: { value: UNIVERSE_PHASES },
    uUniverseAmp: { value: UNIVERSE_AMPS },
    uUniverseSplit: { value: UNIVERSE_SPLITS },
    uUniverseTints: { value: rawColors(UNIVERSE_TINTS) },
  };
}

/** Draws each time slice as an instance of one coarse sphere, allocated once up front. */
export function createTrail(slice: PointCloudData, instances: SliceInstances, uniforms: TrailUniforms): Trail {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(slice.positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(slice.uvs, 2));
  geometry.setAttribute('aSlice', new THREE.InstancedBufferAttribute(instances.slices, 1));
  geometry.setAttribute('aBranch', new THREE.InstancedBufferAttribute(instances.branches, 1));
  geometry.setAttribute('aUniverse', new THREE.InstancedBufferAttribute(instances.universes, 1));
  geometry.instanceCount = instances.slices.length;

  const material = new THREE.ShaderMaterial({
    vertexShader: `${subjectChunk}\n${physicsChunk}\n${trailVertex}`,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  // The shader moves the points, so the CPU-side bounds can't be trusted for culling.
  points.frustumCulled = false;
  return points;
}
