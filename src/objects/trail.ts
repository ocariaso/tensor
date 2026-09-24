import * as THREE from 'three';
import { BRANCH_COLORS, layoutBranches, MAX_BRANCHES } from '../branches';
import { createSliceInstances } from '../geometry/timeSlices';
import type { PointCloudData } from '../geometry/uvSphere';
import subjectChunk from '../shaders/subject.glsl?raw';
import trailVertex from '../shaders/trail.vert.glsl?raw';
import fragmentShader from '../shaders/cloud.frag.glsl?raw';

export type Trail = THREE.Points<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;

/** Draws every past moment and every branch's future moments as instances of one coarse sphere, allocated once. */
export function createTrail(slice: PointCloudData, pastCount: number, futureCount: number, pixelRatio: number): Trail {
  const instances = createSliceInstances(pastCount, futureCount, MAX_BRANCHES);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(slice.positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(slice.uvs, 2));
  geometry.setAttribute('aSlice', new THREE.InstancedBufferAttribute(instances.slices, 1));
  geometry.setAttribute('aBranch', new THREE.InstancedBufferAttribute(instances.branches, 1));
  geometry.instanceCount = instances.slices.length;

  const layout = layoutBranches(MAX_BRANCHES);
  const material = new THREE.ShaderMaterial({
    vertexShader: `${subjectChunk}\n${trailVertex}`,
    fragmentShader,
    uniforms: {
      uTemporal: { value: 0 },
      uBranching: { value: 0 },
      uVisibility: { value: 1 },
      uMotionTime: { value: 0 },
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
      // Raw hex values so the shader colors match the legend swatches exactly.
      uBranchColors: { value: BRANCH_COLORS.map((hex) => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace)) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  // The shader moves the points, so the CPU-side bounds can't be trusted for culling.
  points.frustumCulled = false;
  return points;
}
