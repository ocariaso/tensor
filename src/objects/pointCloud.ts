import * as THREE from 'three';
import type { PointCloudData } from '../geometry/uvSphere';
import vertexShader from '../shaders/cloud.vert.glsl?raw';
import fragmentShader from '../shaders/cloud.frag.glsl?raw';

export type PointCloud = THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

export function createPointCloud(data: PointCloudData, lonSegments: number, pixelRatio: number): PointCloud {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uLevel: { value: 0 },
      uExtent: { value: 1.7 },
      uLonSegments: { value: lonSegments },
      uPointSize: { value: 3 },
      uOpacity: { value: 0.35 },
      uPixelRatio: { value: pixelRatio },
      uTime: { value: 0 },
      uOmega: { value: 2 },
      uAmplitude: { value: 0.35 },
      uWaveNumber: { value: 4 },
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
