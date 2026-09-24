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
      this.averageError += rate * (error - this.averageError);
      this.claimed += rate * (p.confidence - this.claimed);
      this.cameTrue += rate * ((error <= this.radius ? 1 : 0) - this.cameTrue);
      this.checks++;
      // Nudge the uncertainty toward agreement between what is claimed and what comes true.
      this.noiseScale = Math.min(4, Math.max(0.25, this.noiseScale * Math.exp(0.02 * (this.claimed - this.cameTrue))));
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
    this.noiseScale = d.noiseScale as number;
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
