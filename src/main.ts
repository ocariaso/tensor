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
const cloud = createPointCloud(sphereData, pixelRatio);
const singularity = createSingularity(pixelRatio);
scene.add(cloud, singularity);

const settings: Settings = {
  dimension: 'source',
  view: 'spectator',
  transitionSeconds: 1.6,
  autoRotate: true,
  pointSize: 3,
  opacity: 0.35,
  omega: 2,
  amplitude: 0.35,
  coreSize: 64,
};
const stats: Stats = { fps: 0, points: sphereData.count };

// Deep links: ?dim=0d&view=inhabitant
const params = new URLSearchParams(window.location.search);
const dimParam = params.get('dim');
if (dimParam && dimParam in DIMENSIONS) settings.dimension = dimParam as DimensionId;
const viewParam = params.get('view');
if (viewParam === 'spectator' || viewParam === 'inhabitant') settings.view = viewParam;

const collapse = new Transition(DIMENSIONS[settings.dimension].collapse, settings.transitionSeconds);

function applyState(): void {
  const spec = DIMENSIONS[settings.dimension];
  collapse.duration = settings.transitionSeconds;
  collapse.retarget(spec.collapse);
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
  if (key === 's') settings.dimension = 'source';
  else if (key === '0') settings.dimension = '0d';
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

  const c = collapse.update(dt);

  if (settings.autoRotate) cloud.rotation.y += dt * 0.25;
  const cloudUniforms = cloud.material.uniforms;
  cloudUniforms.uCollapse.value = c;
  cloudUniforms.uPointSize.value = settings.pointSize;
  cloudUniforms.uOpacity.value = settings.opacity;
  // The singularity replaces the cloud once the collapse finishes.
  cloud.visible = c > 0.001;

  const coreUniforms = singularity.material.uniforms;
  coreUniforms.uTime.value = elapsed;
  coreUniforms.uOmega.value = settings.omega;
  coreUniforms.uAmplitude.value = settings.amplitude;
  coreUniforms.uBaseSize.value = settings.coreSize;
  coreUniforms.uPresence.value = 1 - THREE.MathUtils.smoothstep(c, 0, 0.15);
  singularity.visible = coreUniforms.uPresence.value > 0.001;

  stats.points = (cloud.visible ? sphereData.count : 0) + (singularity.visible ? 1 : 0);

  rig.update(dt);
  renderer.render(scene, rig.camera);
});
