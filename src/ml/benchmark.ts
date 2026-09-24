import { mulberry32, type RandomWalk } from '../randomWalk';

/**
 * The best possible guess at where the subject will be some seconds ahead: the average of many futures
 * simulated from its exact current state, hidden mood and circling included, using the true rules of its motion.
 * A model that only watches the motion cannot beat this, so it marks the limit of what is predictable.
 */
export function bestPossibleGuess(walk: RandomWalk, seconds: number, samples = 32, seed = 4321): { x: number; z: number } {
  const random = mulberry32(seed);
  let x = 0;
  let z = 0;
  for (let n = 0; n < samples; n++) {
    const future = walk.clone(random);
    future.advance(seconds, 0, () => {});
    x += future.position.x;
    z += future.position.z;
  }
  return { x: x / samples, z: z / samples };
}
