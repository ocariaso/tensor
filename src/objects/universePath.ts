import * as THREE from 'three';

export type UniversePath = THREE.Line<THREE.BufferGeometry, THREE.ShaderMaterial>;

const vertexShader = /* glsl */ `
attribute float aProgress;
varying float vProgress;

void main() {
  vProgress = aProgress;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
varying float vProgress;

void main() {
  // A pulse travels from our universe to the far one, over a faint guide line.
  float head = fract(uTime * 0.2);
  float pulse = exp(-pow((vProgress - head) * 10.0, 2.0));
  gl_FragColor = vec4(vec3(1.0, 0.82, 0.48), (0.5 + pulse) * uOpacity);
}
`;

/** A line through the given number of stops, whose positions are set each frame. */
export function createUniversePath(stops: number): UniversePath {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(stops * 3), 3));
  const progress = Float32Array.from({ length: stops }, (_, i) => i / (stops - 1));
  geometry.setAttribute('aProgress', new THREE.BufferAttribute(progress, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;
  return line;
}
