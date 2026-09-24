import * as THREE from 'three';
import { CameraRig } from './cameraRig';
import { cameraRulesFor, DIMENSIONS, SPECTATOR_NOTE, type DimensionId } from './dimensions';
import { createUvSphere } from './geometry/uvSphere';
import { createHud, type Settings, type Stats } from './hud';
import { createPointCloud } from './objects/pointCloud';
import { createSingularity } from './objects/singularity';
import { Transition } from './transition';

// 128 x 256 uses half the point budget in a panorama-shaped grid.
const LAT_SEGMENTS = 128;
const LON_SEGMENTS = 256;

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const infoTag = document.querySelector<HTMLElement>('#info-tag')!;
const infoTitle = document.querySelector<HTMLElement>('#info-title')!;
const infoBody = document.querySelector<HTMLElement>('#info-body')!;
const infoView = document.querySelector<HTMLElement>('#info-view')!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const pixelRatio = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setClearColor(0x05060d);

const scene = new THREE.Scene();
const rig = new CameraRig(canvas);

const sphereData = createUvSphere(LAT_SEGMENTS, LON_SEGMENTS);
const cloud = createPointCloud(sphereData, LON_SEGMENTS, pixelRatio);
const singularity = createSingularity(pixelRatio);
scene.add(cloud, singularity);

const settings: Settings = {
  dimension: '0d',
  view: 'spectator',
  transitionSeconds: 1.6,
  pointSize: 4,
  opacity: 0.9,
  coreSize: 64,
  omega: 2,
  amplitude: 0.6,
  waveNumber: 4,
};
const stats: Stats = { fps: 0, points: 0 };

// Deep links: ?dim=1d&view=inhabitant
const params = new URLSearchParams(window.location.search);
const dimParam = params.get('dim');
if (dimParam && dimParam in DIMENSIONS) settings.dimension = dimParam as DimensionId;
const viewParam = params.get('view');
if (viewParam === 'spectator' || viewParam === 'inhabitant') settings.view = viewParam;

const level = new Transition(DIMENSIONS[settings.dimension].level, settings.transitionSeconds);

function applyState(): void {
  const spec = DIMENSIONS[settings.dimension];
  level.duration = settings.transitionSeconds;
  level.retarget(spec.level);
  rig.apply(cameraRulesFor(settings.dimension, settings.view));

  infoTag.textContent = spec.tag;
  infoTitle.textContent = spec.title;
  infoBody.textContent = spec.body;
  infoView.textContent = settings.view === 'spectator' ? SPECTATOR_NOTE : spec.inhabitantNote;
}

const pane = createHud(settings, stats, { onStateChange: applyState });

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) return;
  const key = event.key.toLowerCase();
  const dimension = `${key}d`;
  if (dimension in DIMENSIONS) settings.dimension = dimension as DimensionId;
  else if (key === 'v') settings.view = settings.view === 'spectator' ? 'inhabitant' : 'spectator';
  else return;
  pane.refresh();
  applyState();
});

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  rig.resize(width, height);
}
window.addEventListener('resize', resize);
resize();
applyState();

let elapsed = 0;
let last = performance.now();

renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  elapsed += dt;
  stats.fps += (1 / Math.max(dt, 1e-4) - stats.fps) * 0.05;

  const l = level.update(dt);

  const cloudUniforms = cloud.material.uniforms;
  cloudUniforms.uLevel.value = l;
  cloudUniforms.uTime.value = elapsed;
  cloudUniforms.uOmega.value = settings.omega;
  cloudUniforms.uAmplitude.value = settings.amplitude;
  cloudUniforms.uWaveNumber.value = settings.waveNumber;
  cloudUniforms.uPointSize.value = settings.pointSize;
  cloudUniforms.uOpacity.value = settings.opacity;
  // The singularity stands in for the cloud while everything sits on the origin.
  cloud.visible = l > 0.001;

  const coreUniforms = singularity.material.uniforms;
  coreUniforms.uTime.value = elapsed;
  coreUniforms.uOmega.value = settings.omega;
  coreUniforms.uAmplitude.value = settings.amplitude;
  coreUniforms.uBaseSize.value = settings.coreSize;
  coreUniforms.uPresence.value = 1 - THREE.MathUtils.smoothstep(l, 0, 0.15);
  singularity.visible = coreUniforms.uPresence.value > 0.001;

  stats.points = (cloud.visible ? sphereData.count : 0) + (singularity.visible ? 1 : 0);

  rig.update(dt);
  renderer.render(scene, rig.camera);
});
