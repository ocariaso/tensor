export interface SliceInstances {
  /** Offset as a share of each horizon: past in [-1, 0), future in (0, 1]. */
  slices: Float32Array;
  /** Branch index, which is always 0 for the single shared past. */
  branches: Float32Array;
}

/** Lays out one past and one future run per branch, allocated once at the maximum branch count. */
export function createSliceInstances(pastCount: number, futureCount: number, branchCount: number): SliceInstances {
  const total = pastCount + futureCount * branchCount;
  const slices = new Float32Array(total);
  const branches = new Float32Array(total);

  for (let i = 0; i < pastCount; i++) slices[i] = -(i + 1) / pastCount;

  let k = pastCount;
  for (let b = 0; b < branchCount; b++) {
    for (let j = 0; j < futureCount; j++) {
      slices[k] = (j + 1) / futureCount;
      branches[k] = b;
      k++;
    }
  }
  return { slices, branches };
}
