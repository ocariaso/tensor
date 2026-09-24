/** Hard point-cloud budget from the spec (section 6). */
export const MAX_POINTS = 65_536;

export interface PointCloudData {
  positions: Float32Array;
  uvs: Float32Array;
  count: number;
}

/** Builds a lat/lon point grid whose 1:2 layout matches a panorama frame. */
export function createUvSphere(latSegments: number, lonSegments: number, radius = 1): PointCloudData {
  const count = latSegments * lonSegments;
  if (count > MAX_POINTS) {
    throw new Error(`UV sphere of ${count} points exceeds the ${MAX_POINTS}-point budget`);
  }

  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);

  let i = 0;
  for (let lat = 0; lat < latSegments; lat++) {
    const v = (lat + 0.5) / latSegments;
    const theta = v * Math.PI; // 0 at north pole, PI at south pole
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon < lonSegments; lon++) {
      const u = lon / lonSegments;
      const phi = u * Math.PI * 2;

      positions[i * 3] = radius * sinTheta * Math.cos(phi);
      positions[i * 3 + 1] = radius * cosTheta;
      positions[i * 3 + 2] = radius * sinTheta * Math.sin(phi);
      uvs[i * 2] = u;
      uvs[i * 2 + 1] = 1 - v;
      i++;
    }
  }

  return { positions, uvs, count };
}
