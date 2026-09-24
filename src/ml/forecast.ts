import { gaussian, mulberry32 } from '../randomWalk';
import type { MotionModel, MotionState } from './motionModel';

/** Feeds a model one lesson per recorded step, using the last three positions to know velocity before and after. */
export class MotionLearner {
  private recent: Array<{ x: number; z: number }> = [];

  constructor(
    readonly model: MotionModel,
    readonly interval: number,
  ) {}

  observe(x: number, z: number): void {
    this.recent.push({ x, z });
    if (this.recent.length > 3) this.recent.shift();
    if (this.recent.length < 3) return;
    const [a, b, c] = this.recent;
    const state: MotionState = { x: b.x, z: b.z, vx: (b.x - a.x) / this.interval, vz: (b.z - a.z) / this.interval };
    this.model.observe(state, (c.x - b.x) / this.interval, (c.z - b.z) / this.interval);
  }

  /** Forgets the recent positions but keeps what was learned, so the next lessons do not straddle a jump. */
  restart(): void {
    this.recent = [];
  }

  /** Forgets everything, including what the model learned. */
  reset(): void {
    this.restart();
    this.model.reset();
  }
}

export interface Forecast {
  /** Most likely position at each future step, starting one step after the present. */
  x: Float32Array;
  z: Float32Array;
  /** How far the imagined futures typically land from the most likely path, in world units. */
  spread: Float32Array;
  /** Share of imagined futures that land within the confidence radius of the most likely path. */
  confidence: Float32Array;
}

// Enough imagined futures for smooth percentages, few enough to redo every frame.
export const FORECAST_SAMPLES = 64;
// A prediction counts as right when the real subject lands within this distance of it.
export const CONFIDENCE_RADIUS = 0.5;

/**
 * Plays the learned motion forward from the present: once without randomness for the most likely path,
 * and many times with the learned randomness to see how far the real future could stray from it.
 * A fixed seed keeps the imagined futures steady from frame to frame, so the cone does not flicker.
 */
export function forecast(
  model: MotionModel,
  start: MotionState,
  steps: number,
  interval: number,
  noiseScale = 1,
  seed = 1234,
): Forecast {
  const result: Forecast = {
    x: new Float32Array(steps),
    z: new Float32Array(steps),
    spread: new Float32Array(steps),
    confidence: new Float32Array(steps),
  };

  const s = { ...start };
  for (let k = 0; k < steps; k++) {
    const v = model.predictVelocity(s);
    s.vx = v.vx;
    s.vz = v.vz;
    s.x += v.vx * interval;
    s.z += v.vz * interval;
    result.x[k] = s.x;
    result.z[k] = s.z;
  }

  const noise = model.noise();
  const random = mulberry32(seed);
  const squared = new Float32Array(steps);
  const within = new Float32Array(steps);
  for (let n = 0; n < FORECAST_SAMPLES; n++) {
    const m = { ...start };
    for (let k = 0; k < steps; k++) {
      const v = model.predictVelocity(m);
      m.vx = v.vx + noise.x * noiseScale * gaussian(random);
      m.vz = v.vz + noise.z * noiseScale * gaussian(random);
      m.x += m.vx * interval;
      m.z += m.vz * interval;
      const d2 = (m.x - result.x[k]) ** 2 + (m.z - result.z[k]) ** 2;
      squared[k] += d2;
      if (d2 <= CONFIDENCE_RADIUS * CONFIDENCE_RADIUS) within[k]++;
    }
  }
  for (let k = 0; k < steps; k++) {
    result.spread[k] = Math.sqrt(squared[k] / FORECAST_SAMPLES);
    result.confidence[k] = within[k] / FORECAST_SAMPLES;
  }
  return result;
}
