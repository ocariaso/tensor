import * as THREE from 'three';

export type GuideLines = THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;

/** Straight guide segments, such as axes and grids, whose ends are set each frame. */
export function createGuideLines(maxSegments: number, color: number): GuideLines {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxSegments * 6), 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  return lines;
}

export function setSegments(lines: GuideLines, segments: Array<[THREE.Vector3, THREE.Vector3]>, opacity: number): void {
  const positions = lines.geometry.getAttribute('position') as THREE.BufferAttribute;
  segments.forEach(([a, b], i) => {
    positions.setXYZ(i * 2, a.x, a.y, a.z);
    positions.setXYZ(i * 2 + 1, b.x, b.y, b.z);
  });
  positions.needsUpdate = true;
  lines.geometry.setDrawRange(0, segments.length * 2);
  lines.material.opacity = opacity;
  lines.visible = opacity > 0.01;
}
