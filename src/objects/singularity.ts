import * as THREE from 'three';
import vertexShader from '../shaders/singularity.vert.glsl?raw';
import fragmentShader from '../shaders/singularity.frag.glsl?raw';

export type Singularity = THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

/** Draws 0D as one vertex instead of thousands of overlapping points. */
export function createSingularity(pixelRatio: number): Singularity {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uOmega: { value: 2 },
      uAmplitude: { value: 0.35 },
      uBaseSize: { value: 64 },
      uPixelRatio: { value: pixelRatio },
      uPresence: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const point = new THREE.Points(geometry, material);
  point.frustumCulled = false;
  return point;
}
