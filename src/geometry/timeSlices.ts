export interface SliceInstances {
  /** Offset as a share of each horizon: past in [-1, 0), present at 0, future in (0, 1]. */
  slices: Float32Array;
  /** Branch index, which is always 0 for the single shared past. */
  branches: Float32Array;
  /** Universe index, where 0 is ours. */
  universes: Float32Array;
}

/** Lays out one past and one future run per branch, ordered so the first branches can be drawn alone. */
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
  return { slices, branches, universes: new Float32Array(total) };
}

/** Lays out a present, past and one future run per branch for every universe except ours, ordered by universe. */
export function createUniverseInstances(
  pastCount: number,
  futureCount: number,
  universeCount: number,
  branchCount: number,
): SliceInstances {
  const perUniverse = 1 + pastCount + futureCount * branchCount;
  const total = perUniverse * (universeCount - 1);
  const slices = new Float32Array(total);
  const branches = new Float32Array(total);
  const universes = new Float32Array(total);

  let k = 0;
  for (let u = 1; u < universeCount; u++) {
    slices[k] = 0;
    universes[k++] = u;
    for (let i = 0; i < pastCount; i++) {
      slices[k] = -(i + 1) / pastCount;
      universes[k++] = u;
    }
    for (let b = 0; b < branchCount; b++) {
      for (let j = 0; j < futureCount; j++) {
        slices[k] = (j + 1) / futureCount;
        branches[k] = b;
        universes[k++] = u;
      }
    }
  }
  return { slices, branches, universes };
}
