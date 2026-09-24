export const MAX_BRANCHES = 5;
export const MIN_BRANCHES = 3;

// The scripted path sits at W = 0 and the rest alternate outward on each side.
const OFFSET_ORDER = [0, -0.5, 0.5, -1, 1];

export const BRANCH_COLORS = ['#59f2e6', '#ffb44d', '#ff6fb5', '#a6f25a', '#6fa8ff'];

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
