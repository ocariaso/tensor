import { Pane } from 'tweakpane';
import type { DimensionId, ViewMode } from './dimensions';

export interface Settings {
  dimension: DimensionId;
  view: ViewMode;
  transitionSeconds: number;
  autoRotate: boolean;
  pointSize: number;
  opacity: number;
  omega: number;
  amplitude: number;
  coreSize: number;
}

export interface Stats {
  fps: number;
  points: number;
}

export interface HudCallbacks {
  onStateChange: () => void;
}

export function createHud(settings: Settings, stats: Stats, callbacks: HudCallbacks): Pane {
  const pane = new Pane({ title: 'Project N-D' });

  const world = pane.addFolder({ title: 'World' });
  world
    .addBinding(settings, 'dimension', {
      label: 'dimension',
      options: { 'Source shape (3D)': 'source', '0D · Singularity': '0d' },
    })
    .on('change', callbacks.onStateChange);
  world
    .addBinding(settings, 'view', {
      label: 'view',
      options: { Spectator: 'spectator', Inhabitant: 'inhabitant' },
    })
    .on('change', callbacks.onStateChange);
  world.addBinding(settings, 'transitionSeconds', { label: 'transition (s)', min: 0.2, max: 5, step: 0.1 });

  const shape = pane.addFolder({ title: 'Source shape' });
  shape.addBinding(settings, 'autoRotate', { label: 'rotate' });
  shape.addBinding(settings, 'pointSize', { label: 'point size', min: 1, max: 8, step: 0.1 });
  shape.addBinding(settings, 'opacity', { label: 'brightness', min: 0.05, max: 1, step: 0.01 });

  const zero = pane.addFolder({ title: '0D · f(t) = sin(ωt)' });
  zero.addBinding(settings, 'omega', { label: 'ω (rad/s)', min: 0.2, max: 12, step: 0.1 });
  zero.addBinding(settings, 'amplitude', { label: 'amplitude', min: 0, max: 0.9, step: 0.01 });
  zero.addBinding(settings, 'coreSize', { label: 'size (px)', min: 16, max: 160, step: 1 });

  const perf = pane.addFolder({ title: 'Performance', expanded: false });
  perf.addBinding(stats, 'fps', { readonly: true, view: 'graph', min: 0, max: 150 });
  perf.addBinding(stats, 'fps', { readonly: true, format: (v: number) => v.toFixed(0) });
  perf.addBinding(stats, 'points', { readonly: true, format: (v: number) => v.toFixed(0) });

  return pane;
}
