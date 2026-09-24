export type DimensionId = '0d' | '1d' | '2d';
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
};

export const SPECTATOR_NOTE = 'Spectator view: you watch this world from outside it, so the camera is always free.';

export function cameraRulesFor(dimension: DimensionId, view: ViewMode): CameraRules {
  return view === 'spectator' ? FREE : DIMENSIONS[dimension].inhabitant;
}
