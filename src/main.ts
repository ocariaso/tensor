import * as THREE from 'three';
import { wrapAngle } from './angle';
import { BRANCH_COLORS, layoutBranches, MAX_BRANCHES } from './branches';
import { CameraRig } from './cameraRig';
import { cameraRulesFor, DIMENSIONS, SPECTATOR_NOTE, type DimensionId } from './dimensions';
import { createSliceInstances, createUniverseInstances } from './geometry/timeSlices';
import { createUvSphere } from './geometry/uvSphere';
import { effectiveConstants } from './physics';
import { createHud, type Settings, type Stats } from './hud';
import { createCentralMass } from './objects/centralMass';
import { createPointCloud } from './objects/pointCloud';
import { createSingularity } from './objects/singularity';
import { createTrail, createTrailUniforms } from './objects/trail';
import { Transition } from './transition';
import { clampUniverseCount, MAX_UNIVERSES, UNIVERSE_TINTS, universeLabel } from './universes';

// 128 x 256 uses half the point budget in a panorama-shaped grid.
const LAT_SEGMENTS = 128;
const LON_SEGMENTS = 256;
// Each time slice is a coarse 2,048-point sphere so hundreds of slices stay affordable.
const SLICE_LAT = 32;
const SLICE_LON = 64;
const PAST_SLICES = 60;
const FUTURE_SLICES = 24;
const SLICES_PER_UNIVERSE = 1 + PAST_SLICES + FUTURE_SLICES * MAX_BRANCHES;
const SUBJECT_SCALE_4D = 0.45;

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const infoTag = document.querySelector<HTMLElement>('#info-tag')!;
const infoTitle = document.querySelector<HTMLElement>('#info-title')!;
const infoBody = document.querySelector<HTMLElement>('#info-body')!;
const infoView = document.querySelector<HTMLElement>('#info-view')!;
const infoLegend = document.querySelector<HTMLUListElement>('#info-legend')!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const pixelRatio = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setClearColor(0x05060d);

const scene = new THREE.Scene();
const rig = new CameraRig(canvas);

const sphereData = createUvSphere(LAT_SEGMENTS, LON_SEGMENTS);
const cloud = createPointCloud(sphereData, LAT_SEGMENTS, LON_SEGMENTS, pixelRatio);
const singularity = createSingularity(pixelRatio);
const sliceData = createUvSphere(SLICE_LAT, SLICE_LON);
const trailUniforms = createTrailUniforms(pixelRatio);
const trail = createTrail(sliceData, createSliceInstances(PAST_SLICES, FUTURE_SLICES, MAX_BRANCHES), trailUniforms);
const parallel = createTrail(sliceData, createUniverseInstances(PAST_SLICES, FUTURE_SLICES, MAX_UNIVERSES, MAX_BRANCHES), trailUniforms);
const centralMass = createCentralMass();
scene.add(cloud, singularity, trail, parallel, centralMass);

const settings: Settings = {
  dimension: '0d',
  view: 'spectator',
  transitionSeconds: 1.6,
  spin: true,
  spinSpeed: 0.35,
  timeFlows: true,
  scrub: 0,
  pastSeconds: 2.5,
  futureSeconds: 1.5,
  timeScale: 0.8,
  trailOpacity: 0.18,
  branchCount: 4,
  branchSpread: 1.2,
  universeCount: 3,
  universeSpacing: 1.9,
  // 7D opens on a visibly different universe; the reset button returns every dial to ours.
  lightSpeedExp: -3,
  uncertaintyExp: 2.3,
  gravityExp: 3.5,
  pointSize: 4,
  opacity: 0.9,
  density: 2,
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
const tubeVisibility = new Transition(settings.view === 'spectator' ? 1 : 0, 0.6);

interface LegendItem {
  color: string;
  label: string;
}

function applyState(): void {
  const spec = DIMENSIONS[settings.dimension];
  level.duration = settings.transitionSeconds;
  level.retarget(spec.level);
  tubeVisibility.retarget(settings.view === 'spectator' ? 1 : 0);
  rig.apply(cameraRulesFor(settings.dimension, settings.view));

  infoTag.textContent = spec.tag;
  infoTitle.textContent = spec.title;
  infoBody.textContent = spec.body;
  infoView.textContent = settings.view === 'spectator' ? SPECTATOR_NOTE : spec.inhabitantNote;

  const layout = layoutBranches(settings.branchCount);
  const universeCount = clampUniverseCount(settings.universeCount);
  trailUniforms.uBranchCount.value = settings.branchCount;
  trailUniforms.uBranchW.value = layout.offsets;
  trailUniforms.uBranchP.value = layout.probabilities;
  trailUniforms.uUniverseCount.value = universeCount;

  if (spec.id === '5d') {
    renderLegend(
      layout.probabilities
        .map((p, i) => ({ color: BRANCH_COLORS[i], label: `${String.fromCharCode(65 + i)} ${Math.round(p * 100)}%`, p }))
        .filter(({ p }) => p > 0),
    );
  } else if (spec.level >= 6) {
    renderLegend(
      Array.from({ length: universeCount }, (_, i) => ({ color: UNIVERSE_TINTS[i], label: universeLabel(i) })),
    );
  } else {
    renderLegend([]);
  }
}

function renderLegend(items: LegendItem[]): void {
  infoLegend.replaceChildren(
    ...items.map(({ color, label }) => {
      const item = document.createElement('li');
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = color;
      item.append(swatch, label);
      return item;
    }),
  );
}

const pane = createHud(settings, stats, {
  onStateChange: applyState,
  onResetConstants: () => {
    settings.lightSpeedExp = 0;
    settings.uncertaintyExp = 0;
    settings.gravityExp = 0;
    pane.refresh();
  },
});

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
let spin = 0;
let last = performance.now();

renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  stats.fps += (1 / Math.max(dt, 1e-4) - stats.fps) * 0.05;
  const worldDt = settings.timeFlows ? dt : 0;
  elapsed += worldDt;
  const motionTime = elapsed + settings.scrub;

  const l = level.update(dt);
  const temporal = THREE.MathUtils.clamp(l - 3, 0, 1);
  const parallelness = THREE.MathUtils.clamp(l - 5, 0, 1);
  const branching = THREE.MathUtils.clamp(l - 4, 0, 1);
  const lawShift = THREE.MathUtils.clamp(l - 6, 0, 1);
  const physics = effectiveConstants(settings, lawShift);
  const subjectScale = THREE.MathUtils.lerp(1, SUBJECT_SCALE_4D, temporal);
  const spinning = settings.spin && l >= 3;
  // Spin only builds up on the finished sphere so leaving 3D unwinds at most half a turn.
  if (spinning) spin = wrapAngle(spin + worldDt * settings.spinSpeed);

  const cloudUniforms = cloud.material.uniforms;
  cloudUniforms.uLevel.value = l;
  cloudUniforms.uSpin.value = spin;
  cloudUniforms.uTime.value = elapsed;
  cloudUniforms.uMotionTime.value = motionTime;
  cloudUniforms.uLightSpeed.value = physics.lightSpeed;
  cloudUniforms.uUncertainty.value = physics.uncertainty;
  cloudUniforms.uGravity.value = physics.gravity;
  cloudUniforms.uSubjectScale.value = subjectScale;
  cloudUniforms.uOmega.value = settings.omega;
  cloudUniforms.uAmplitude.value = settings.amplitude;
  cloudUniforms.uWaveNumber.value = settings.waveNumber;
  cloudUniforms.uPointSize.value = settings.pointSize;
  // Sprites shrink with distance as fast as the view grows, so their world width depends only on screen height.
  cloudUniforms.uSpriteWorld.value = (settings.pointSize * 16 * Math.tan(THREE.MathUtils.degToRad(rig.camera.fov / 2))) / window.innerHeight;
  cloudUniforms.uOpacity.value = settings.opacity;
  cloudUniforms.uDensity.value = settings.density;
  // The singularity stands in for the cloud while everything sits on the origin.
  cloud.visible = l > 0.001;

  const coreUniforms = singularity.material.uniforms;
  coreUniforms.uTime.value = elapsed;
  coreUniforms.uOmega.value = settings.omega;
  coreUniforms.uAmplitude.value = settings.amplitude;
  coreUniforms.uBaseSize.value = settings.coreSize;
  coreUniforms.uPresence.value = 1 - THREE.MathUtils.smoothstep(l, 0, 0.15);
  singularity.visible = coreUniforms.uPresence.value > 0.001;

  const visibility = tubeVisibility.update(dt);
  // The mass's world-line shows only while its pull is dialed above ours, and only to the Spectator.
  centralMass.material.opacity = 0.6 * lawShift * visibility * THREE.MathUtils.clamp(settings.gravityExp / 2, 0, 1);
  centralMass.visible = centralMass.material.opacity > 0.001;
  trailUniforms.uTemporal.value = temporal;
  trailUniforms.uBranching.value = branching;
  trailUniforms.uParallel.value = parallelness;
  trailUniforms.uBranchSpread.value = settings.branchSpread;
  trailUniforms.uUniverseSpacing.value = settings.universeSpacing;
  trailUniforms.uSubjectScale.value = subjectScale;
  trailUniforms.uVisibility.value = visibility;
  trailUniforms.uTime.value = elapsed;
  trailUniforms.uMotionTime.value = motionTime;
  trailUniforms.uLightSpeed.value = physics.lightSpeed;
  trailUniforms.uUncertainty.value = physics.uncertainty;
  trailUniforms.uGravity.value = physics.gravity;
  trailUniforms.uPast.value = settings.pastSeconds;
  trailUniforms.uFuture.value = settings.futureSeconds;
  trailUniforms.uTimeScale.value = settings.timeScale;
  trailUniforms.uSpin.value = spin;
  trailUniforms.uSpinRate.value = spinning && settings.timeFlows ? settings.spinSpeed : 0;
  trailUniforms.uOpacity.value = settings.trailOpacity;

  // Only the slices that can show are sent to the GPU, since hidden instances still cost vertex work.
  const futureRuns = branching > 0 ? settings.branchCount : 1;
  const otherUniverses = parallelness > 0 ? clampUniverseCount(settings.universeCount) - 1 : 0;
  trail.geometry.instanceCount = PAST_SLICES + FUTURE_SLICES * futureRuns;
  parallel.geometry.instanceCount = SLICES_PER_UNIVERSE * otherUniverses;
  trail.visible = temporal * visibility > 0.001;
  parallel.visible = trail.visible && otherUniverses > 0;

  stats.points =
    (cloud.visible ? sphereData.count : 0) +
    (singularity.visible ? 1 : 0) +
    (trail.visible ? sliceData.count * trail.geometry.instanceCount : 0) +
    (parallel.visible ? sliceData.count * parallel.geometry.instanceCount : 0);

  rig.update(dt);
  renderer.render(scene, rig.camera);
});
