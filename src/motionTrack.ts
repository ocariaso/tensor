import * as THREE from 'three';
import type { Forecast } from './ml/forecast';
import type { MotionHistory } from './randomWalk';

/**
 * The recorded past and the predicted future on one evenly spaced timeline, so any instant can be looked up.
 * Each sample holds x, y, z and, in the fourth slot, how uncertain that position is (zero for the recorded past).
 */
export class MotionTrack {
  readonly buffer: Float32Array;
  readonly size: number;
  readonly confidence: Float32Array;
  start = 0;
  interval: number;
  /** Index of the present, the last recorded sample. */
  presentIndex: number;
  /** How many predicted samples follow the present; zero when no prediction is shown. */
  predicted = 0;

  constructor(
    readonly pastSamples: number,
    readonly futureSamples: number,
    interval: number,
  ) {
    this.size = pastSamples + futureSamples;
    this.buffer = new Float32Array(this.size * 4);
    this.confidence = new Float32Array(this.size);
    this.interval = interval;
    this.presentIndex = pastSamples - 1;
  }

  get presentTime(): number {
    return this.start + this.presentIndex * this.interval;
  }

  /** Copies the recording in, then the forecast after it, or holds the present position when there is none. */
  update(history: MotionHistory, forecast: Forecast | null): void {
    this.buffer.set(history.samples, 0);
    // The recorded past is certain, so its uncertainty slot is zero.
    for (let i = 0; i < this.pastSamples; i++) this.buffer[i * 4 + 3] = 0;
    this.start = history.start;
    this.interval = history.interval;
    this.confidence.fill(1, 0, this.pastSamples);
    const last = this.presentIndex * 4;
    this.predicted = forecast ? Math.min(forecast.x.length, this.futureSamples) : 0;
    for (let k = 0; k < this.futureSamples; k++) {
      const i = (this.pastSamples + k) * 4;
      if (forecast && k < this.predicted) {
        this.buffer.set([forecast.x[k], 0, forecast.z[k], forecast.spread[k]], i);
        this.confidence[this.pastSamples + k] = forecast.confidence[k];
      } else {
        this.buffer.set([this.buffer[last], this.buffer[last + 1], this.buffer[last + 2], 0], i);
        this.confidence[this.pastSamples + k] = 1;
      }
    }
  }

  private index(time: number): { i0: number; i1: number; k: number } {
    const f = Math.min(this.size - 1, Math.max(0, (time - this.start) / this.interval));
    const i0 = Math.floor(f);
    return { i0, i1: Math.min(i0 + 1, this.size - 1), k: f - i0 };
  }

  /** The position at a time, interpolated between samples and held at the timeline's ends. */
  sample(time: number, target: THREE.Vector3): THREE.Vector3 {
    const { i0, i1, k } = this.index(time);
    const b = this.buffer;
    return target.set(
      b[i0 * 4] + (b[i1 * 4] - b[i0 * 4]) * k,
      b[i0 * 4 + 1] + (b[i1 * 4 + 1] - b[i0 * 4 + 1]) * k,
      b[i0 * 4 + 2] + (b[i1 * 4 + 2] - b[i0 * 4 + 2]) * k,
    );
  }

  /** How uncertain the position at a time is, in world units. */
  spreadAt(time: number): number {
    const { i0, i1, k } = this.index(time);
    return this.buffer[i0 * 4 + 3] + (this.buffer[i1 * 4 + 3] - this.buffer[i0 * 4 + 3]) * k;
  }

  /** Chance the real subject lands within the confidence radius of the position at a time. */
  confidenceAt(time: number): number {
    const { i0, i1, k } = this.index(time);
    return this.confidence[i0] + (this.confidence[i1] - this.confidence[i0]) * k;
  }
}
