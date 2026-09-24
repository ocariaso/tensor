export type DimensionId = '0d' | '1d' | '2d' | '3d' | '4d' | '5d' | '6d';
export type ViewMode = 'inhabitant' | 'spectator';
export type PanAxes = 'none' | 'x' | 'xy' | 'free';

export interface CameraRules {
  rotate: boolean;
  pan: PanAxes;
  zoom: boolean;
}

export interface DimensionSpec {
  id: DimensionId;
  tag: string;
  title: string;
  body: string;
  /** Position on the build-up ladder, which equals the dimension count. */
  level: number;
  inhabitant: CameraRules;
  inhabitantNote: string;
}

const FREE: CameraRules = { rotate: true, pan: 'free', zoom: true };

export const DIMENSIONS: Record<DimensionId, DimensionSpec> = {
  '0d': {
    id: '0d',
    tag: 'Zero Dimensions',
    title: '0D · The Singularity',
    body: 'A single point at (0, 0, 0) with no length, width or depth. It has no size, so its glow pulses with time, f(t) = sin(ωt), but never changes with distance.',
    level: 0,
    inhabitant: { rotate: false, pan: 'none', zoom: false },
    inhabitantNote: 'Inhabitant view: you are the point, so there is nowhere to move.',
  },
  '1d': {
    id: '1d',
    tag: 'One Dimension',
    title: '1D · The Line',
    body: 'The point stretches along X into a line with length but no width. Waves run outward from the center as brightness, f(x, t) = sin(ωt − k|x|), since there is no sideways direction to move in.',
    level: 1,
    inhabitant: { rotate: false, pan: 'x', zoom: false },
    inhabitantNote: 'Inhabitant view: you can only slide left and right along the line.',
  },
  '2d': {
    id: '2d',
    tag: 'Two Dimensions',
    title: '2D · The Plane',
    body: 'The line sweeps around its center into a flat disc with length and width but no depth. Waves now spread as rings, f(r, t) = sin(ωt − kr).',
    level: 2,
    inhabitant: { rotate: false, pan: 'xy', zoom: true },
    inhabitantNote: 'Inhabitant view: you can slide and zoom across the plane, but never tilt out of it.',
  },
  '3d': {
    id: '3d',
    tag: 'Three Dimensions',
    title: '3D · The Sphere',
    body: 'The disc curls up and closes into a sphere with length, width and depth. It drifts like a person shifting their weight, the amber meridian shows it spinning, and waves travel from pole to pole.',
    level: 3,
    inhabitant: FREE,
    inhabitantNote: 'Inhabitant view: this is our own world, so you can orbit, pan and zoom freely.',
  },
  '4d': {
    id: '4d',
    tag: 'Four Dimensions',
    title: '4D · Spacetime',
    body: 'Time becomes a direction you can see, pointing up. Past moments stack below into a solid world-tube and future moments rise above as ghosts. The motion here is a formula, so the future already exists, like in a block universe.',
    level: 4,
    inhabitant: FREE,
    inhabitantNote: 'Inhabitant view: like us, you only experience the present moment, so the world-tube is hidden. Switch to Spectator to see all of time at once.',
  },
  '5d': {
    id: '5d',
    tag: 'Five Dimensions · Speculative',
    title: '5D · Probability Branches',
    body: 'At the present moment the future splits along a new direction, W, into several possible branches that drift apart. Brighter branches are likelier. This follows the many-worlds interpretation, and the weights are illustrative rather than measured.',
    level: 5,
    inhabitant: FREE,
    inhabitantNote: 'Inhabitant view: you only ever live along one branch, and only in its present moment, so the others stay hidden.',
  },
  '6d': {
    id: '6d',
    tag: 'Six Dimensions · Speculative',
    title: '6D · Parallel Universes',
    body: 'Other universes split from ours at moments in the past and now run side by side along a new direction, U. The farther a universe sits along U, the longer ago it split. Each one keeps its own branching futures.',
    level: 6,
    inhabitant: FREE,
    inhabitantNote: 'Inhabitant view: you are bound to your own universe and its present moment, so the others are invisible to you.',
  },
};

export const SPECTATOR_NOTE = 'Spectator view: you watch this world from outside it, so the camera is always free.';

export function cameraRulesFor(dimension: DimensionId, view: ViewMode): CameraRules {
  return view === 'spectator' ? FREE : DIMENSIONS[dimension].inhabitant;
}
