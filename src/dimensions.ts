export type DimensionId = 'source' | '0d';
export type ViewMode = 'inhabitant' | 'spectator';

export interface CameraRules {
  rotate: boolean;
  pan: boolean;
  zoom: boolean;
}

export interface DimensionSpec {
  id: DimensionId;
  tag: string;
  title: string;
  body: string;
  /** 1 = full source shape, 0 = collapsed to the origin. */
  collapse: number;
  inhabitant: CameraRules;
  inhabitantNote: string;
}

const FREE: CameraRules = { rotate: true, pan: true, zoom: true };
const LOCKED: CameraRules = { rotate: false, pan: false, zoom: false };

export const DIMENSIONS: Record<DimensionId, DimensionSpec> = {
  source: {
    id: 'source',
    tag: 'Reference · 3D',
    title: 'Source Shape',
    body: 'A UV-sphere point cloud: the stand-in for "you" that every dimension transforms. The amber meridian makes its rotation visible.',
    collapse: 1,
    inhabitant: FREE,
    inhabitantNote: 'A 3D inhabitant can orbit, pan and zoom freely.',
  },
  '0d': {
    id: '0d',
    tag: 'Zero Dimensions',
    title: '0D · The Singularity',
    body: 'Width, height and depth are all zero. The whole shape collapses into one point at (0, 0, 0). It has no size, so its glow pulses with time, f(t) = sin(ωt), but never with distance.',
    collapse: 0,
    inhabitant: LOCKED,
    inhabitantNote: 'Inhabitant view: you are the point. There is nowhere to move, so the camera is locked.',
  },
};

export const SPECTATOR_NOTE =
  'Spectator view: you watch this world from outside it, so the camera is always free. Zooming in on the 0D point changes nothing.';

export function cameraRulesFor(dimension: DimensionId, view: ViewMode): CameraRules {
  return view === 'spectator' ? FREE : DIMENSIONS[dimension].inhabitant;
}

export function isLocked(rules: CameraRules): boolean {
  return !rules.rotate && !rules.pan && !rules.zoom;
}
