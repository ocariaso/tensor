import * as THREE from 'three';

export type CentralMass = THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;

/** The world-line of the mass that 7D gravity pulls toward, running along the time axis. */
export function createCentralMass(): CentralMass {
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -4, 0), new THREE.Vector3(0, 4, 0)]);
  const material = new THREE.LineBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;
  return line;
}
