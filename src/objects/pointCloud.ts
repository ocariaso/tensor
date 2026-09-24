import * as THREE from 'three';
import type { PointCloudData } from '../geometry/uvSphere';
import { GRAVITY_OURS, LIGHT_SPEED_OURS, UNCERTAINTY_OURS } from '../physics';
import physicsChunk from '../shaders/physics.glsl?raw';
import subjectChunk from '../shaders/subject.glsl?raw';
import cloudVertex from '../shaders/cloud.vert.glsl?raw';
import fragmentShader from '../shaders/cloud.frag.glsl?raw';

export type PointCloud = THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
export type CloudUniforms = Record<string, THREE.IUniform>;

/** One uniform set shared by every tree's present sphere so a single per-frame update drives them all. */
export function createCloudUniforms(latSegments: number, lonSegments: number, pixelRatio: number): CloudUniforms {
  return {
    uLevel: { value: 0 },
    uExtent: { value: 1.7 },
    uSphereRadius: { value: 1.2 },
    uSubjectScale: { value: 1 },
    uSpin: { value: 0 },
    uLatSegments: { value: latSegments },
    uLonSegments: { value: lonSegments },
    uSpriteWorld: { value: 0.04 },
    uDensity: { value: 2 },
    uPointSize: { value: 3 },
    uOpacity: { value: 0.35 },
    uPixelRatio: { value: pixelRatio },
    uTime: { value: 0 },
    uMotionTime: { value: 0 },
    uLightSpeed: { value: LIGHT_SPEED_OURS },
    uUncertainty: { value: UNCERTAINTY_OURS },
    uGravity: { value: GRAVITY_OURS },
    uOmega: { value: 2 },
    uAmplitude: { value: 0.35 },
    uWaveNumber: { value: 4 },
  };
}

export function createPointCloud(data: PointCloudData, uniforms: CloudUniforms): PointCloud {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));

  const material = new THREE.ShaderMaterial({
    vertexShader: `${subjectChunk}\n${physicsChunk}\n${cloudVertex}`,
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
