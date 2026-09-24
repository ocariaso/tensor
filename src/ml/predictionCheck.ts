/** A prediction kept until its moment arrives, so it can be scored against what really happened. */
interface PendingPrediction {
  madeAt: number;
  x: number;
  z: number;
  confidence: number;
}

export interface CheckResult {
  /** Where the model said, one horizon ago, the subject would be now. */
  ghostX: number;
  ghostZ: number;
  error: number;
}

// How quickly the running averages follow new results; about the last 200 checks count.
const AVERAGE_RATE = 0.005;
// The uncertainty correction stays within these bounds, so one bad stretch cannot push it to an extreme.
export const MIN_NOISE_SCALE = 0.5;
export const MAX_NOISE_SCALE = 2.5;
// How strongly each check nudges the correction; stronger nudges overshoot, because the averages they react to lag behind.
const NUDGE = 0.02;
// A single wildly wrong prediction counts as at most this far off, so it cannot swamp the average miss.
const MAX_COUNTED_ERROR = 5;
/** Below this many checks a horizon's correction is too young to be worth saving. */
export const TRUSTED_CHECKS = 300;

function clampScale(scale: number): number {
  return Math.min(MAX_NOISE_SCALE, Math.max(MIN_NOISE_SCALE, scale));
}

/**
 * Scores predictions a fixed time ahead once that time arrives, and keeps the model's confidence honest:
 * if its claimed confidence runs above how often it is actually right, the uncertainty scale grows, and the other way round.
 */
export class PredictionCheck {
  private pending: PendingPrediction[] = [];
  averageError = 0;
  claimed = 0;
  cameTrue = 0;
  checks = 0;
  /** Multiplies the model's learned randomness when imagining futures. */
  noiseScale = 1;

  constructor(
    readonly horizon: number,
    readonly radius: number,
  ) {}

  /** Remembers what was predicted for one horizon after the present. */
  record(madeAt: number, x: number, z: number, confidence: number): void {
    const last = this.pending[this.pending.length - 1];
    if (last && madeAt <= last.madeAt) return;
    this.pending.push({ madeAt, x, z, confidence });
  }

  /** Scores every prediction whose moment has now arrived, and returns the newest as a ghost. */
  settle(now: number, actualX: number, actualZ: number): CheckResult | null {
    let result: CheckResult | null = null;
    while (this.pending.length && this.pending[0].madeAt + this.horizon <= now) {
      const p = this.pending.shift()!;
      const error = Math.hypot(actualX - p.x, actualZ - p.z);
      const rate = this.checks === 0 ? 1 : Math.max(AVERAGE_RATE, 1 / (this.checks + 1));
      this.averageError += rate * (Math.min(error, MAX_COUNTED_ERROR) - this.averageError);
      this.claimed += rate * (p.confidence - this.claimed);
      this.cameTrue += rate * ((error <= this.radius ? 1 : 0) - this.cameTrue);
      this.checks++;
      // Nudge the uncertainty toward agreement between what is claimed and what comes true.
      this.noiseScale = clampScale(this.noiseScale * Math.exp(NUDGE * (this.claimed - this.cameTrue)));
      result = { ghostX: p.x, ghostZ: p.z, error };
    }
    return result;
  }

  /** The running scores and calibration, without predictions still waiting for their moment. */
  save(): { averageError: number; claimed: number; cameTrue: number; checks: number; noiseScale: number } {
    const { averageError, claimed, cameTrue, checks, noiseScale } = this;
    return { averageError, claimed, cameTrue, checks, noiseScale };
  }

  load(data: unknown): boolean {
    const d = data as Record<string, unknown> | null;
    const keys = ['averageError', 'claimed', 'cameTrue', 'checks', 'noiseScale'] as const;
    if (!d || !keys.every((k) => typeof d[k] === 'number' && Number.isFinite(d[k]) && (d[k] as number) >= 0)) return false;
    this.averageError = d.averageError as number;
    this.claimed = d.claimed as number;
    this.cameTrue = d.cameTrue as number;
    this.checks = d.checks as number;
    this.noiseScale = clampScale(d.noiseScale as number);
    return true;
  }

  reset(): void {
    this.pending = [];
    this.averageError = 0;
    this.claimed = 0;
    this.cameTrue = 0;
    this.checks = 0;
    this.noiseScale = 1;
  }
}
