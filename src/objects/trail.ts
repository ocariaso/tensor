import * as THREE from 'three';
import { createTimeSlices } from '../geometry/timeSlices';
import type { PointCloudData } from '../geometry/uvSphere';
import subjectChunk from '../shaders/subject.glsl?raw';
import trailVertex from '../shaders/trail.vert.glsl?raw';
import fragmentShader from '../shaders/cloud.frag.glsl?raw';

export type Trail = THREE.Points<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;

/** Draws every past and future moment as an instance of one coarse sphere, allocated once up front. */
export function createTrail(slice: PointCloudData, pastCount: number, futureCount: number, pixelRatio: number): Trail {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(slice.positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(slice.uvs, 2));
  geometry.setAttribute('aSlice', new THREE.InstancedBufferAttribute(createTimeSlices(pastCount, futureCount), 1));
  geometry.instanceCount = pastCount + futureCount;

  const material = new THREE.ShaderMaterial({
    vertexShader: `${subjectChunk}\n${trailVertex}`,
    fragmentShader,
    uniforms: {
      uTemporal: { value: 0 },
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
