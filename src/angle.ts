/** Wraps an angle into [-PI, PI) so unwinding it always takes the shortest turn. */
export function wrapAngle(radians: number): number {
  const turn = Math.PI * 2;
  return ((((radians + Math.PI) % turn) + turn) % turn) - Math.PI;
}
