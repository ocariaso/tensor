export const MAX_BRANCHES = 5;
export const MIN_BRANCHES = 3;

// The scripted path sits at W = 0 and the rest alternate outward on each side.
const OFFSET_ORDER = [0, -0.5, 0.5, -1, 1];

export const BRANCH_COLORS = ['#59f2e6', '#ffb44d', '#ff6fb5', '#a6f25a', '#6fa8ff'];

/** How a branch's future movement differs from the present motion it leaves. */
export interface BranchMotion {
  /** Sway speed relative to the present motion, where a negative value reverses it. */
  tempo: number;
  /** Sway distance relative to the present motion. */
  sway: number;
  /** Spin speed relative to the present motion. */
  spin: number;
  behaviour: string;
}

// Branch A carries on unchanged, and the less likely branches depart from it more.
export const BRANCH_MOTIONS: BranchMotion[] = [
  { tempo: 1, sway: 1, spin: 1, behaviour: 'carries on' },
  { tempo: 0.5, sway: 0.6, spin: 0.4, behaviour: 'slows and settles' },
  { tempo: 1.7, sway: 1.35, spin: 1.8, behaviour: 'speeds up, sways wider' },
  { tempo: -0.9, sway: 1.1, spin: 2.6, behaviour: 'reverses, spins faster' },
  { tempo: 1.2, sway: 0.4, spin: 0.8, behaviour: 'steadies in place' },
];

// How long after the split a branch takes to adopt its own movement, in seconds.
const DIVERGENCE_TIME = 0.35;

/** Mirrors branchBlend in trail.vert.glsl; its slope is zero at the split, so position and speed stay continuous. */
export function branchBlend(dt: number, branching: number): number {
  if (dt <= 0) return 0;
  return (1 - Math.exp(-(dt * dt) / (DIVERGENCE_TIME * DIVERGENCE_TIME))) * branching;
}

export interface BranchLayout {
  /** Position of each branch along W in [-1, 1], padded to MAX_BRANCHES. */
  offsets: number[];
  /** Normalized probability of each branch, with 0 for unused slots. */
  probabilities: number[];
}

/** Illustrative weights that fall off with distance from the scripted path, not a physical model. */
export function layoutBranches(count: number): BranchLayout {
  const active = Math.min(MAX_BRANCHES, Math.max(MIN_BRANCHES, Math.round(count)));
  const offsets = OFFSET_ORDER.map((w, i) => (i < active ? w : 0));
  const raw = offsets.map((w, i) => (i < active ? Math.exp(-2.5 * w * w) : 0));
  const total = raw.reduce((sum, value) => sum + value, 0);
  return { offsets, probabilities: raw.map((value) => value / total) };
}
