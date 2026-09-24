/** Where the subject is and how fast it is going, in the ground plane. */
export interface MotionState {
  x: number;
  z: number;
  vx: number;
  vz: number;
}

/**
 * Anything that can learn how the subject moves from one recorded step to the next.
 * A neural network can replace the linear model by implementing the same four members.
 */
export interface MotionModel {
  /** Learns from one example: the state at one step and the velocity it had at the next. */
  observe(state: MotionState, nextVx: number, nextVz: number): void;
  /** The most likely velocity at the next step. */
  predictVelocity(state: MotionState): { vx: number; vz: number };
  /** How far a real next velocity typically lands from the prediction, per axis. */
  noise(): { x: number; z: number };
  reset(): void;
  readonly lessons: number;
  /** Everything learned, as plain data that can be stored. */
  save(): unknown;
  /** Restores what was learned from saved data, returning false and changing nothing if the data does not fit. */
  load(data: unknown): boolean;
}

interface SavedLinearModel {
  kind: 'linear';
  weightsX: number[];
  weightsZ: number[];
  covariance: number[];
  varianceX: number;
  varianceZ: number;
  lessons: number;
}

function finiteArray(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every((v) => typeof v === 'number' && Number.isFinite(v));
}

const FEATURES = 5;
// Old lessons fade out slowly, so the model can keep adapting if the motion changes.
const FORGETTING = 0.999;
// How quickly the noise estimate follows new errors.
const NOISE_RATE = 0.01;
// Bounds on how sure the model may be about each weight; too sure and it stops adapting, too unsure and it swings.
const MIN_COVARIANCE = 1e-6;
const MAX_COVARIANCE = 100;
// A deliberately wide starting guess, so an untrained model reports low confidence.
const INITIAL_NOISE_VARIANCE = 1;

/** Linear model of the next velocity from position, velocity and a constant, trained online by recursive least squares. */
export class LinearMotionModel implements MotionModel {
  private weightsX = new Float64Array(FEATURES);
  private weightsZ = new Float64Array(FEATURES);
  private covariance = new Float64Array(FEATURES * FEATURES);
  private varianceX = INITIAL_NOISE_VARIANCE;
  private varianceZ = INITIAL_NOISE_VARIANCE;
  private readonly phi = new Float64Array(FEATURES);
  private readonly gain = new Float64Array(FEATURES);
  private readonly pPhi = new Float64Array(FEATURES);
  lessons = 0;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.weightsX.fill(0);
    this.weightsZ.fill(0);
    this.covariance.fill(0);
    for (let i = 0; i < FEATURES; i++) this.covariance[i * FEATURES + i] = 100;
    this.varianceX = INITIAL_NOISE_VARIANCE;
    this.varianceZ = INITIAL_NOISE_VARIANCE;
    this.lessons = 0;
  }

  save(): SavedLinearModel {
    return {
      kind: 'linear',
      weightsX: Array.from(this.weightsX),
      weightsZ: Array.from(this.weightsZ),
      covariance: Array.from(this.covariance),
      varianceX: this.varianceX,
      varianceZ: this.varianceZ,
      lessons: this.lessons,
    };
  }

  load(data: unknown): boolean {
    const d = data as Partial<SavedLinearModel> | null;
    if (!d || d.kind !== 'linear') return false;
    if (!finiteArray(d.weightsX, FEATURES) || !finiteArray(d.weightsZ, FEATURES)) return false;
    if (!finiteArray(d.covariance, FEATURES * FEATURES)) return false;
    if (![d.varianceX, d.varianceZ, d.lessons].every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0)) return false;
    this.weightsX.set(d.weightsX);
    this.weightsZ.set(d.weightsZ);
    this.covariance.set(d.covariance);
    this.varianceX = d.varianceX!;
    this.varianceZ = d.varianceZ!;
    this.lessons = d.lessons!;
    return true;
  }

  predictVelocity(state: MotionState): { vx: number; vz: number } {
    this.fill(state);
    return { vx: this.dot(this.weightsX), vz: this.dot(this.weightsZ) };
  }

  noise(): { x: number; z: number } {
    return { x: Math.sqrt(this.varianceX), z: Math.sqrt(this.varianceZ) };
  }

  /** Exposes the learned weights, in the order x, z, vx, vz, constant, for display and tests. */
  weights(): { x: number[]; z: number[] } {
    return { x: Array.from(this.weightsX), z: Array.from(this.weightsZ) };
  }

  observe(state: MotionState, nextVx: number, nextVz: number): void {
    this.fill(state);
    const errorX = nextVx - this.dot(this.weightsX);
    const errorZ = nextVz - this.dot(this.weightsZ);
    // Errors are measured before learning from the example, so the noise estimate reflects real prediction errors.
    this.varianceX += NOISE_RATE * (errorX * errorX - this.varianceX);
    this.varianceZ += NOISE_RATE * (errorZ * errorZ - this.varianceZ);

    const P = this.covariance;
    let denominator = FORGETTING;
    for (let i = 0; i < FEATURES; i++) {
      let sum = 0;
      for (let j = 0; j < FEATURES; j++) sum += P[i * FEATURES + j] * this.phi[j];
      this.pPhi[i] = sum;
      denominator += this.phi[i] * sum;
    }
    for (let i = 0; i < FEATURES; i++) this.gain[i] = this.pPhi[i] / denominator;
    for (let i = 0; i < FEATURES; i++) {
      this.weightsX[i] += this.gain[i] * errorX;
      this.weightsZ[i] += this.gain[i] * errorZ;
    }
    // P is symmetric, so the row P·phi equals the column used in the update.
    for (let i = 0; i < FEATURES; i++) {
      for (let j = 0; j < FEATURES; j++) {
        P[i * FEATURES + j] = (P[i * FEATURES + j] - this.gain[i] * this.pPhi[j]) / FORGETTING;
      }
    }
    // Rounding slowly breaks P's symmetry and forgetting can inflate it, which in time wrecks the weights,
    // so it is re-symmetrised and its diagonal kept within bounds after every lesson.
    for (let i = 0; i < FEATURES; i++) {
      for (let j = i + 1; j < FEATURES; j++) {
        const mean = (P[i * FEATURES + j] + P[j * FEATURES + i]) / 2;
        P[i * FEATURES + j] = mean;
        P[j * FEATURES + i] = mean;
      }
      P[i * FEATURES + i] = Math.min(MAX_COVARIANCE, Math.max(MIN_COVARIANCE, P[i * FEATURES + i]));
    }
    this.lessons++;
  }

  private fill(state: MotionState): void {
    this.phi[0] = state.x;
    this.phi[1] = state.z;
    this.phi[2] = state.vx;
    this.phi[3] = state.vz;
    this.phi[4] = 1;
  }

  private dot(weights: Float64Array): number {
    let sum = 0;
    for (let i = 0; i < FEATURES; i++) sum += weights[i] * this.phi[i];
    return sum;
  }
}
