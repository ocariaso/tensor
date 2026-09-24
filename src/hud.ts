import { Pane } from 'tweakpane';
import { isVisibleDimension, MAX_VISIBLE_LEVEL, type DimensionId, type ViewMode } from './dimensions';

export interface Settings {
  dimension: DimensionId;
  view: ViewMode;
  transitionSeconds: number;
  spin: boolean;
  spinSpeed: number;
  /** Random motion is recorded as it happens; scripted motion follows the hand-written sway. */
  randomMotion: boolean;
  timeFlows: boolean;
  playbackRate: number;
  /** Seconds from the present that the moment feed shows, negative for the past. */
  playhead: number;
  pastSeconds: number;
  futureSeconds: number;
  timeScale: number;
  trailOpacity: number;
  branchCount: number;
  branchSpread: number;
  /** Which future branch the moment feed follows and the structure feed can focus on. */
  watchBranch: number;
  /** How the structure feed draws the branches that are not in focus. */
  otherBranches: 'show' | 'dim' | 'hide';
  universeCount: number;
  universeSpacing: number;
  treeCount: number;
  treeSpacing: number;
  orchardSpacing: number;
  showPath: boolean;
  lawSpacing: number;
  pointSize: number;
  opacity: number;
  density: number;
  coreSize: number;
  omega: number;
  amplitude: number;
  waveNumber: number;
}

export interface Stats {
  fps: number;
  points: number;
}

export interface HudCallbacks {
  onStateChange: () => void;
  onMotionChange: () => void;
}

export function createHud(settings: Settings, stats: Stats, callbacks: HudCallbacks, container: HTMLElement): Pane {
  const pane = new Pane({ title: 'Controls', container });

  const world = pane.addFolder({ title: 'World' });
  world
    .addBinding(settings, 'dimension', {
      label: 'dimension',
      options: Object.fromEntries(
        Object.entries({
          '0D · Singularity': '0d',
          '1D · Line': '1d',
          '2D · Plane': '2d',
          '3D · Sphere': '3d',
          '4D · Spacetime': '4d',
          '5D · Branches': '5d',
          '6D · Parallel': '6d',
          '7D · Forest of Seeds': '7d',
          '8D · Orchard': '8d',
          '9D · Laws of Physics': '9d',
        }).filter(([, id]) => isVisibleDimension(id)),
      ),
    })
    .on('change', callbacks.onStateChange);
  world
    .addBinding(settings, 'view', {
      label: 'view',
      options: { Spectator: 'spectator', Inhabitant: 'inhabitant' },
    })
    .on('change', callbacks.onStateChange);
  world.addBinding(settings, 'transitionSeconds', { label: 'transition (s)', min: 0.2, max: 5, step: 0.1 });

  const harmonic = pane.addFolder({ title: 'Harmonic · sin(ωt − kr)' });
  harmonic.addBinding(settings, 'omega', { label: 'ω (rad/s)', min: 0.2, max: 12, step: 0.1 });
  harmonic.addBinding(settings, 'amplitude', { label: 'amplitude', min: 0, max: 0.9, step: 0.01 });
  harmonic.addBinding(settings, 'waveNumber', { label: 'k (wave)', min: 0, max: 16, step: 0.1 });

  const sphere = pane.addFolder({ title: '3D · Sphere' });
  sphere.addBinding(settings, 'spin', { label: 'spin' });
  sphere.addBinding(settings, 'spinSpeed', { label: 'speed (rad/s)', min: 0, max: 3, step: 0.05 });
  sphere.addBinding(settings, 'randomMotion', { label: 'random motion' }).on('change', callbacks.onMotionChange);

  const time = pane.addFolder({ title: '4D · Time (T)' });
  time.addBinding(settings, 'pastSeconds', { label: 'past (s)', min: 0.5, max: 3, step: 0.1 });
  time.addBinding(settings, 'futureSeconds', { label: 'future (s)', min: 0, max: 2, step: 0.1 });
  time.addBinding(settings, 'timeScale', { label: 'units / s', min: 0.2, max: 2, step: 0.05 });
  time.addBinding(settings, 'trailOpacity', { label: 'tube opacity', min: 0.02, max: 0.6, step: 0.01 });

  const branches = pane.addFolder({ title: '5D · Branches (W)' });
  branches
    .addBinding(settings, 'branchCount', { label: 'branches', min: 3, max: 5, step: 1 })
    .on('change', callbacks.onStateChange);
  branches.addBinding(settings, 'branchSpread', { label: 'W spread', min: 0.2, max: 3, step: 0.05 });

  const parallel = pane.addFolder({ title: '6D · Parallel (U)' });
  parallel
    .addBinding(settings, 'universeCount', { label: 'universes', min: 2, max: 5, step: 1 })
    .on('change', callbacks.onStateChange);
  parallel.addBinding(settings, 'universeSpacing', { label: 'U spacing', min: 1.5, max: 5, step: 0.05 });

  const forest = pane.addFolder({ title: '7D · Seeds (V)' });
  forest
    .addBinding(settings, 'treeCount', { label: 'trees', min: 2, max: 4, step: 1 })
    .on('change', callbacks.onStateChange);
  forest.addBinding(settings, 'treeSpacing', { label: 'V spacing', min: 3, max: 10, step: 0.1 });

  const orchard = pane.addFolder({ title: '8D · Orchard' });
  orchard.addBinding(settings, 'orchardSpacing', { label: 'column spacing', min: 4, max: 14, step: 0.1 });
  orchard.addBinding(settings, 'showPath', { label: 'path' });

  const laws = pane.addFolder({ title: '9D · Laws of Physics' });
  laws.addBinding(settings, 'lawSpacing', { label: 'world spacing', min: 5, max: 12, step: 0.1 });

  // Folders for hidden levels stay built but out of sight until those levels return.
  for (const [folder, level] of [
    [branches, 5],
    [parallel, 6],
    [forest, 7],
    [orchard, 8],
    [laws, 9],
  ] as const) {
    folder.hidden = level > MAX_VISIBLE_LEVEL;
  }

  const look = pane.addFolder({ title: 'Appearance', expanded: false });
  look.addBinding(settings, 'coreSize', { label: '0D size (px)', min: 16, max: 160, step: 1 });
  look.addBinding(settings, 'pointSize', { label: 'point size', min: 1, max: 8, step: 0.1 });
  look.addBinding(settings, 'opacity', { label: 'brightness', min: 0.05, max: 1, step: 0.01 });
  look.addBinding(settings, 'density', { label: 'density', min: 0.5, max: 6, step: 0.1 });

  const perf = pane.addFolder({ title: 'Performance', expanded: false });
  perf.addBinding(stats, 'fps', { readonly: true, view: 'graph', min: 0, max: 150 });
  perf.addBinding(stats, 'fps', { readonly: true, format: (v: number) => v.toFixed(0) });
  perf.addBinding(stats, 'points', { readonly: true, format: (v: number) => v.toFixed(0) });

  return pane;
}
