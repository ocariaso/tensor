import { CONFIDENCE_RADIUS, rescaled, type Forecast } from './forecast';
import { PredictionCheck, type CheckResult } from './predictionCheck';

/** The look-ahead times whose predictions are graded; the names double as keys in saved files. */
export const CHECK_HORIZONS = [
  { key: 'half', seconds: 0.5 },
  { key: 'one', seconds: 1 },
  { key: 'two', seconds: 2 },
  { key: 'three', seconds: 3 },
  { key: 'five', seconds: 5 },
] as const;

/**
 * Grades predictions at several look-ahead times and keeps a separate uncertainty correction for each,
 * so every confidence shown, near or far, is one that has been checked against what really happened.
 */
export class HorizonCalibration {
  readonly checks: Record<string, PredictionCheck> = Object.fromEntries(
    CHECK_HORIZONS.map(({ key, seconds }) => [key, new PredictionCheck(seconds, CONFIDENCE_RADIUS)]),
  );

  check(key: (typeof CHECK_HORIZONS)[number]['key']): PredictionCheck {
    return this.checks[key];
  }

  /** The uncertainty correction at any look-ahead, blended between the graded horizons and held beyond them. */
  scaleAt(seconds: number): number {
    const first = CHECK_HORIZONS[0];
    const last = CHECK_HORIZONS[CHECK_HORIZONS.length - 1];
    if (seconds <= first.seconds) return this.checks[first.key].noiseScale;
    if (seconds >= last.seconds) return this.checks[last.key].noiseScale;
    for (let i = 1; i < CHECK_HORIZONS.length; i++) {
      const a = CHECK_HORIZONS[i - 1];
      const b = CHECK_HORIZONS[i];
      if (seconds <= b.seconds) {
        const k = (seconds - a.seconds) / (b.seconds - a.seconds);
        return this.checks[a.key].noiseScale + (this.checks[b.key].noiseScale - this.checks[a.key].noiseScale) * k;
      }
    }
    return 1;
  }

  /** The forecast with each step's spread and confidence corrected for its own look-ahead time. */
  calibrate(forecast: Forecast, interval: number): Forecast {
    const steps = forecast.x.length;
    const spread = new Float32Array(steps);
    const confidence = new Float32Array(steps);
    for (let k = 0; k < steps; k++) {
      const corrected = rescaled(forecast, k, this.scaleAt((k + 1) * interval));
      spread[k] = corrected.spread;
      confidence[k] = corrected.confidence;
    }
    return { ...forecast, spread, confidence };
  }

  /** Remembers each horizon's prediction from a calibrated forecast made now. */
  record(now: number, forecast: Forecast, interval: number): void {
    for (const { key, seconds } of CHECK_HORIZONS) {
      const k = Math.round(seconds / interval) - 1;
      if (k < 0 || k >= forecast.x.length) continue;
      this.checks[key].record(now, forecast.x[k], forecast.z[k], forecast.confidence[k]);
    }
  }

  /** Grades every prediction whose moment has arrived, returning the one-second result for the ghost. */
  settle(now: number, x: number, z: number): CheckResult | null {
    let oneSecond: CheckResult | null = null;
    for (const { key } of CHECK_HORIZONS) {
      const result = this.checks[key].settle(now, x, z);
      if (key === 'one') oneSecond = result;
    }
    return oneSecond;
  }

  reset(): void {
    for (const check of Object.values(this.checks)) check.reset();
  }

  /** One short line per horizon: the confidence claimed, then how often it came true. */
  summary(): string {
    return CHECK_HORIZONS.map(({ key, seconds }) => {
      const c = this.checks[key];
      const label = `+${seconds} s`.padEnd(7);
      if (c.checks === 0) return `${label}waiting`;
      return `${label}${Math.round(c.claimed * 100)}% → ${Math.round(c.cameTrue * 100)}%`;
    }).join('\n');
  }
}
