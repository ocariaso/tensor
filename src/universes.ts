export const MAX_UNIVERSES = 5;
export const MIN_UNIVERSES = 2;

// Ours sits at U = 0 and the rest alternate outward on each side.
export const UNIVERSE_SHIFTS = [0, -1, 1, -2, 2];
// Each parallel history runs on its own rhythm and sway strength.
export const UNIVERSE_PHASES = [0, 1.7, 3.9, 5.2, 7.4];
export const UNIVERSE_AMPS = [1, 0.75, 1.25, 0.9, 1.15];
export const UNIVERSE_TINTS = ['#ffffff', '#ff9d5c', '#5cd6ff', '#c77dff', '#7dffa0'];
// How long ago each universe split from ours, as a share of the visible past, so farther universes split earlier.
export const UNIVERSE_SPLITS = [0, 0.6, 0.7, 0.85, 0.95];

export function clampUniverseCount(count: number): number {
  return Math.min(MAX_UNIVERSES, Math.max(MIN_UNIVERSES, Math.round(count)));
}

export function universeLabel(index: number): string {
  if (index === 0) return 'Ours';
  const shift = UNIVERSE_SHIFTS[index];
  return `U${shift > 0 ? '+' : '−'}${Math.abs(shift)}`;
}
