import { gaussian, mulberry32 } from '../randomWalk';
import type { MotionModel, MotionState } from './motionModel';

/** How many recent positions the motion is judged from; two means the velocity of the single latest step, which predicts best. */
export const VELOCITY_WINDOW = 2;

export interface Point {
  x: number;
  z: number;
}

/** How far from the centre and how fast the forecast may place the subject. */
export interface MotionLimits {
  reach: number;
  speed: number;
}

const UNLIMITED: MotionLimits = { reach: Infinity, speed: Infinity };
// Room beyond anything observed, since the subject may yet go a little further or faster than it has so far.
const LIMIT_MARGIN = 1.5;

// Fixed weights of a least-squares line through the window, centred so they sum to zero.
const SLOPE_WEIGHTS = (() => {
  const mid = (VELOCITY_WINDOW - 1) / 2;
  const denominator = Array.from({ length: VELOCITY_WINDOW }, (_, i) => (i - mid) ** 2).reduce((a, b) => a + b, 0);
  return Array.from({ length: VELOCITY_WINDOW }, (_, i) => (i - mid) / denominator);
})();

/**
 * The state at the newest of the given positions: where it is, and the velocity of a straight line fitted through the window.
 */
export function stateFromWindow(points: readonly Point[], interval: number): MotionState {
  const offset = points.length - VELOCITY_WINDOW;
  let vx = 0;
  let vz = 0;
  for (let i = 0; i < VELOCITY_WINDOW; i++) {
    vx += SLOPE_WEIGHTS[i] * points[offset + i].x;
    vz += SLOPE_WEIGHTS[i] * points[offset + i].z;
  }
  const last = points[points.length - 1];
  return { x: last.x, z: last.z, vx: vx / interval, vz: vz / interval };
}

/**
 * Feeds a model one lesson per recorded step: the state judged from the window ending at one step,
 * and the actual velocity of the single step that followed it.
 */
export class MotionLearner {
  private recent: Point[] = [];
  private furthest = 0;
  private fastest = 0;

  constructor(
    readonly model: MotionModel,
    readonly interval: number,
  ) {}

  observe(x: number, z: number): void {
    this.recent.push({ x, z });
    this.furthest = Math.max(this.furthest, Math.abs(x), Math.abs(z));
    if (this.recent.length > VELOCITY_WINDOW + 1) this.recent.shift();
    if (this.recent.length < VELOCITY_WINDOW + 1) return;
    const window = this.recent.slice(0, VELOCITY_WINDOW);
    const before = window[VELOCITY_WINDOW - 1];
    const after = this.recent[VELOCITY_WINDOW];
    this.fastest = Math.max(this.fastest, Math.hypot(after.x - before.x, after.z - before.z) / this.interval);
    this.model.observe(stateFromWindow(window, this.interval), (after.x - before.x) / this.interval, (after.z - before.z) / this.interval);
  }

  /** Forgets the recent positions but keeps what was learned, so the next lessons do not straddle a jump. */
  restart(): void {
    this.recent = [];
  }

  /** Forgets everything, including what the model learned. */
  reset(): void {
    this.restart();
    this.furthest = 0;
    this.fastest = 0;
    this.model.reset();
  }

  /**
   * A half-trained model can be slightly unstable, which compounds into absurd long forecasts,
   * so forecasts stay within a margin of the furthest and fastest motion actually seen.
   */
  limits(): MotionLimits {
    return { reach: this.furthest * LIMIT_MARGIN + 0.5, speed: this.fastest * LIMIT_MARGIN + 0.5 };
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
  /** How far each imagined future strays from the most likely path at each step, sample by sample. */
  deviation: Float32Array;
}

/**
 * Spread and confidence at one step if the imagined randomness were scaled by a factor.
 * For a linear model the imagined futures stray exactly in proportion to the randomness, so rescaling
 * the recorded distances is the same as imagining them again; a nonlinear model would make this an approximation.
 */
export function rescaled(forecast: Forecast, step: number, scale: number): { spread: number; confidence: number } {
  const steps = forecast.x.length;
  let within = 0;
  for (let n = 0; n < FORECAST_SAMPLES; n++) {
    if (forecast.deviation[n * steps + step] * scale <= CONFIDENCE_RADIUS) within++;
  }
  return { spread: forecast.spread[step] * scale, confidence: within / FORECAST_SAMPLES };
}

// Enough imagined futures for smooth percentages, few enough to redo every frame.
export const FORECAST_SAMPLES = 64;
// A prediction counts as right when the real subject lands within this distance of it.
export const CONFIDENCE_RADIUS = 0.5;

/** Steps one path forward, judging each step from the same window the model learned from. */
function rollOut(
  model: MotionModel,
  recent: readonly Point[],
  steps: number,
  interval: number,
  push: (() => { x: number; z: number }) | null,
  limits: MotionLimits,
  visit: (k: number, x: number, z: number) => void,
): void {
  const clampSpeed = (v: number) => Math.max(-limits.speed, Math.min(limits.speed, v));
  const clampReach = (p: number) => Math.max(-limits.reach, Math.min(limits.reach, p));
  const window = recent.slice(-VELOCITY_WINDOW).map((p) => ({ ...p }));
  for (let k = 0; k < steps; k++) {
    const v = model.predictVelocity(stateFromWindow(window, interval));
    const kick = push ? push() : { x: 0, z: 0 };
    const last = window[window.length - 1];
    const next = {
      x: clampReach(last.x + clampSpeed(v.vx + kick.x) * interval),
      z: clampReach(last.z + clampSpeed(v.vz + kick.z) * interval),
    };
    window.shift();
    window.push(next);
    visit(k, next.x, next.z);
  }
}

/**
 * Plays the learned motion forward from the newest recorded positions: once without randomness for the most likely path,
 * and many times with the learned randomness to see how far the real future could stray from it.
 * A fixed seed keeps the imagined futures steady from frame to frame, so the cone does not flicker.
 */
export function forecast(
  model: MotionModel,
  recent: readonly Point[],
  steps: number,
  interval: number,
  noiseScale = 1,
  limits: MotionLimits = UNLIMITED,
  seed = 1234,
): Forecast {
  const result: Forecast = {
    x: new Float32Array(steps),
    z: new Float32Array(steps),
    spread: new Float32Array(steps),
    confidence: new Float32Array(steps),
    deviation: new Float32Array(steps * FORECAST_SAMPLES),
  };
  rollOut(model, recent, steps, interval, null, limits, (k, x, z) => {
    result.x[k] = x;
    result.z[k] = z;
  });

  const noise = model.noise();
  const random = mulberry32(seed);
  const push = () => ({ x: noise.x * noiseScale * gaussian(random), z: noise.z * noiseScale * gaussian(random) });
  const squared = new Float32Array(steps);
  const within = new Float32Array(steps);
  for (let n = 0; n < FORECAST_SAMPLES; n++) {
    rollOut(model, recent, steps, interval, push, limits, (k, x, z) => {
      const d2 = (x - result.x[k]) ** 2 + (z - result.z[k]) ** 2;
      result.deviation[n * steps + k] = Math.sqrt(d2);
      squared[k] += d2;
      if (d2 <= CONFIDENCE_RADIUS * CONFIDENCE_RADIUS) within[k]++;
    });
  }
  for (let k = 0; k < steps; k++) {
    result.spread[k] = Math.sqrt(squared[k] / FORECAST_SAMPLES);
    result.confidence[k] = within[k] / FORECAST_SAMPLES;
  }
  return result;
}
