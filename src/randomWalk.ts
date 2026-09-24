import * as THREE from 'three';

export interface WalkTuning {
  /** How strongly the subject is pulled back toward the centre. */
  pull: number;
  /** How quickly its speed dies away without new pushes. */
  damping: number;
  /** How hard the random pushes are, per axis. */
  pushX: number;
  pushZ: number;
}

// Tuned so the subject typically stays within about one unit of the centre, keeping it in view.
export const DEFAULT_WALK: WalkTuning = { pull: 0.7, damping: 1.1, pushX: 0.8, pushZ: 0.35 };

// Fixed simulation step, so a paused or sped-up clock still moves the subject the same way per simulated second.
const SIM_STEP = 1 / 120;

/** Small seeded generator, used where a repeatable random path is needed, such as tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample from two uniform samples. */
export function gaussian(random: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
}

export interface HabitTuning {
  /** How often, per second, the subject switches between calm and restless. */
  moodSwitchRate: number;
  /** How hard it is pushed while calm and while restless, relative to the plain walk. */
  calmPush: number;
  restlessPush: number;
  /** How often, per second, it starts circling while not circling, and stops while circling. */
  circleStartRate: number;
  circleStopRate: number;
  /** Sideways acceleration that carries it around the centre while circling. */
  circleForce: number;
  /** Distance from the centre beyond which it reliably turns back, and how firmly. */
  edge: number;
  edgePull: number;
}

// Each habit lasts several seconds, long enough to be noticed and learned.
export const DEFAULT_HABITS: HabitTuning = {
  moodSwitchRate: 1 / 6,
  calmPush: 0.5,
  restlessPush: 1.5,
  circleStartRate: 1 / 5,
  circleStopRate: 1 / 4,
  circleForce: 1.2,
  edge: 0.9,
  edgePull: 12,
};

export type Mood = 'calm' | 'restless';

/**
 * A subject that drifts with momentum and random pushes, pulled gently back toward the centre.
 * With habits on it also circles for stretches, turns back near the edge, and switches between calm and restless moods.
 * Its path is not known in advance, so its history is recorded as it happens.
 */
export class RandomWalk {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  habits = false;
  mood: Mood = 'calm';
  /** Which way it is circling, 1 or -1, or 0 when not circling. */
  circling: -1 | 0 | 1 = 0;
  private carry = 0;

  constructor(
    private readonly random: () => number = Math.random,
    public tuning: WalkTuning = DEFAULT_WALK,
    public habitTuning: HabitTuning = DEFAULT_HABITS,
  ) {}

  /** An exact copy of the walk's full state, including its hidden habits, driven by its own randomness. */
  clone(random: () => number): RandomWalk {
    const copy = new RandomWalk(random, this.tuning, this.habitTuning);
    copy.position.copy(this.position);
    copy.velocity.copy(this.velocity);
    copy.habits = this.habits;
    copy.mood = this.mood;
    copy.circling = this.circling;
    return copy;
  }

  /** Advances the walk by dt seconds, calling onStep after every fixed step with the time reached. */
  advance(dt: number, startTime: number, onStep: (time: number) => void): void {
    this.carry += dt;
    let time = startTime;
    while (this.carry >= SIM_STEP) {
      this.carry -= SIM_STEP;
      this.step(SIM_STEP);
      time += SIM_STEP;
      onStep(time);
    }
  }

  private step(dt: number): void {
    const { pull, damping, pushX, pushZ } = this.tuning;
    const kick = Math.sqrt(dt);
    const p = this.position;
    let ax = -pull * p.x - damping * this.velocity.x;
    let az = -pull * p.z - damping * this.velocity.z;
    let pushScale = 1;

    if (this.habits) {
      const h = this.habitTuning;
      if (this.random() < h.moodSwitchRate * dt) this.mood = this.mood === 'calm' ? 'restless' : 'calm';
      if (this.circling === 0) {
        if (this.random() < h.circleStartRate * dt) this.circling = this.random() < 0.5 ? 1 : -1;
      } else if (this.random() < h.circleStopRate * dt) {
        this.circling = 0;
      }
      pushScale = this.mood === 'calm' ? h.calmPush : h.restlessPush;

      const r = Math.hypot(p.x, p.z);
      if (this.circling !== 0 && r > 0.05) {
        // (z, -x) is perpendicular to the direction from the centre, so it carries the subject around it.
        ax += (p.z / r) * h.circleForce * this.circling;
        az += (-p.x / r) * h.circleForce * this.circling;
      }
      if (r > h.edge) {
        ax -= (p.x / r) * h.edgePull * (r - h.edge);
        az -= (p.z / r) * h.edgePull * (r - h.edge);
      }
    }

    this.velocity.x += ax * dt + pushX * pushScale * gaussian(this.random) * kick;
    this.velocity.z += az * dt + pushZ * pushScale * gaussian(this.random) * kick;
    this.position.addScaledVector(this.velocity, dt);
  }
}

/** Evenly spaced recent positions, oldest first, so any past instant can be looked up. */
export class MotionHistory {
  readonly samples: Float32Array;
  /** Time of the oldest sample. */
  start = 0;
  private count = 0;

  constructor(
    readonly size: number,
    readonly interval: number,
  ) {
    this.samples = new Float32Array(size * 4);
  }

  get newestTime(): number {
    return this.start + (this.size - 1) * this.interval;
  }

  /** Fills the whole window with one position, as if the subject had been resting there. */
  reset(position: THREE.Vector3, time: number): void {
    for (let i = 0; i < this.size; i++) this.samples.set([position.x, position.y, position.z, 1], i * 4);
    this.start = time - (this.size - 1) * this.interval;
    this.count = this.size;
  }

  /** Fills the window ending at a time with positions from another source, so a recording can take over from it seamlessly. */
  fill(time: number, source: (t: number, target: THREE.Vector3) => THREE.Vector3): void {
    const at = new THREE.Vector3();
    this.start = time - (this.size - 1) * this.interval;
    for (let i = 0; i < this.size; i++) {
      source(this.start + i * this.interval, at);
      this.samples.set([at.x, at.y, at.z, 1], i * 4);
    }
    this.count = this.size;
  }

  /** Adds the newest sample and drops the oldest, keeping the window's spacing. */
  push(position: THREE.Vector3): void {
    this.samples.copyWithin(0, 4);
    this.samples.set([position.x, position.y, position.z, 1], (this.size - 1) * 4);
    this.start += this.interval;
    this.count = Math.min(this.count + 1, this.size);
  }

  /** The recorded position at a time, interpolated between samples and held at the window's ends. */
  sample(time: number, target: THREE.Vector3): THREE.Vector3 {
    const f = Math.min(this.size - 1, Math.max(0, (time - this.start) / this.interval));
    const i0 = Math.floor(f);
    const i1 = Math.min(i0 + 1, this.size - 1);
    const k = f - i0;
    const s = this.samples;
    return target.set(
      s[i0 * 4] + (s[i1 * 4] - s[i0 * 4]) * k,
      s[i0 * 4 + 1] + (s[i1 * 4 + 1] - s[i0 * 4 + 1]) * k,
      s[i0 * 4 + 2] + (s[i1 * 4 + 2] - s[i0 * 4 + 2]) * k,
    );
  }
}
