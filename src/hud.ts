import { Pane } from 'tweakpane';
import type { DimensionId, ViewMode } from './dimensions';

export interface Settings {
  dimension: DimensionId;
  view: ViewMode;
  transitionSeconds: number;
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
}

export function createHud(settings: Settings, stats: Stats, callbacks: HudCallbacks): Pane {
  const pane = new Pane({ title: 'OmniSpec' });

  const world = pane.addFolder({ title: 'World' });
  world
    .addBinding(settings, 'dimension', {
      label: 'dimension',
      options: { '0D · Singularity': '0d', '1D · Line': '1d', '2D · Plane': '2d' },
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

  const look = pane.addFolder({ title: 'Appearance' });
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
