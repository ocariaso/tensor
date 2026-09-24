export const MAX_TREES = 4;
export const MIN_TREES = 2;

/** Starting conditions for one universe's tree; the laws of physics are the same for every tree. */
export interface TreeSeed {
  label: string;
  tint: string;
  /** Subject size relative to ours. */
  scale: number;
  /** Where in its own sway cycle the subject started, in seconds. */
  phase: number;
  /** How fast its sway runs relative to ours. */
  tempo: number;
  /** How far it sways relative to ours. */
  sway: number;
  /** How fast it spins relative to ours. */
  spin: number;
  /** Seconds since its seed, where Infinity means the seed lies beyond the visible past. */
  age: number;
}

// Separate universes share no clock, so each tree is shown a fixed time after its own seed.
export const TREES: TreeSeed[] = [
  { label: 'Ours', tint: '#ffffff', scale: 1, phase: 0, tempo: 1, sway: 1, spin: 1, age: Infinity },
  { label: 'Seed B · born larger, slower', tint: '#ffcf7a', scale: 1.35, phase: 2.1, tempo: 0.7, sway: 1.2, spin: 0.6, age: 2.2 },
  { label: 'Seed C · born smaller, fast spin', tint: '#8affc4', scale: 0.7, phase: 4.4, tempo: 1.3, sway: 0.8, spin: 3, age: 1.6 },
  { label: 'Seed D · born latest', tint: '#ff8ad8', scale: 1, phase: 1, tempo: 1.1, sway: 1.1, spin: 1.4, age: 0.9 },
];

export function clampTreeCount(count: number): number {
  return Math.min(MAX_TREES, Math.max(MIN_TREES, Math.round(count)));
}

/** The 8D orchard's side columns, which keep each row's birth conditions but change the rhythm it was born with. */
export const ORCHARD_COLUMNS = [
  { side: -1, tempo: 0.6, label: 'slower rhythm' },
  { side: 1, tempo: 1.6, label: 'faster rhythm' },
] as const;

export type OrchardColumn = (typeof ORCHARD_COLUMNS)[number];

/** A neighbour of a row's tree in the 8D plane, so it grows from its own seed a little earlier or later. */
export function orchardSeed(row: TreeSeed, column: OrchardColumn): TreeSeed {
  const age = Number.isFinite(row.age) ? Math.max(0.6, row.age + column.side * 0.3) : column.side < 0 ? 2 : 1.3;
  return {
    label: `${row.label.split(' · ')[0]} · ${column.label}`,
    tint: row.age === Infinity ? '#c9d4ff' : row.tint,
    scale: row.scale,
    phase: row.phase + column.side * 1.3,
    tempo: row.tempo * column.tempo,
    sway: row.sway,
    spin: row.spin * column.tempo,
    age,
  };
}
