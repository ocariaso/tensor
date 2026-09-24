/** Slice offsets as a share of each horizon: past slices in [-1, 0), future slices in (0, 1]. */
export function createTimeSlices(pastCount: number, futureCount: number): Float32Array {
  const slices = new Float32Array(pastCount + futureCount);
  for (let i = 0; i < pastCount; i++) slices[i] = -(i + 1) / pastCount;
  for (let j = 0; j < futureCount; j++) slices[pastCount + j] = (j + 1) / futureCount;
  return slices;
}
