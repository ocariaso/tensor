import * as THREE from 'three';
import { wrapAngle } from './angle';
import { BRANCH_COLORS, layoutBranches, MAX_BRANCHES } from './branches';
import { CameraRig } from './cameraRig';
import { cameraRulesFor, DIMENSIONS, SPECTATOR_NOTE, type DimensionId } from './dimensions';
import { clampTreeCount, ORCHARD_COLUMNS, orchardSeed, TREES, type TreeSeed } from './forest';
import { createSliceInstances, createUniverseInstances } from './geometry/timeSlices';
import { createUvSphere } from './geometry/uvSphere';
import { createHud, type Settings, type Stats } from './hud';
import { setupInfoPanel } from './infoPanel';
import { createCloudUniforms, createPointCloud, type PointCloud } from './objects/pointCloud';
import { createSingularity } from './objects/singularity';
import { createTrail, createTrailUniforms, type Trail } from './objects/trail';
import { createTreeUniforms, type TreeUniforms } from './objects/treeUniforms';
import { createUniversePath } from './objects/universePath';
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
const toggleInfo = setupInfoPanel(
  document.querySelector<HTMLElement>('#info')!,
  document.querySelector<HTMLButtonElement>('#info-toggle')!,
);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const pixelRatio = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setClearColor(0x05060d);

const scene = new THREE.Scene();
const rig = new CameraRig(canvas);

const sphereData = createUvSphere(LAT_SEGMENTS, LON_SEGMENTS);
const sliceData = createUvSphere(SLICE_LAT, SLICE_LON);
const cloudUniforms = createCloudUniforms(LAT_SEGMENTS, LON_SEGMENTS, pixelRatio);
const trailUniforms = createTrailUniforms(pixelRatio);
const singularity = createSingularity(pixelRatio);
scene.add(singularity);

interface TreeView {
  row: number;
  /** 0 for the 7D row itself, -1 or +1 for the 8D orchard's side columns. */
  side: number;
  tree: TreeUniforms;
  cloud: PointCloud;
  trail: Trail;
  /** Side trees are drawn simplified, so only the 7D row carries parallel universes. */
  parallel: Trail | null;
}

// Every tree reuses the shared uniforms and adds its own starting conditions on top.
function makeTree(seed: TreeSeed, row: number, side: number): TreeView {
  const tree = createTreeUniforms(seed);
  const view: TreeView = {
    row,
    side,
    tree,
    cloud: createPointCloud(sphereData, { ...cloudUniforms, ...tree }),
    trail: createTrail(sliceData, createSliceInstances(PAST_SLICES, FUTURE_SLICES, MAX_BRANCHES), { ...trailUniforms, ...tree }),
    parallel:
      side === 0
        ? createTrail(
            sliceData,
            createUniverseInstances(PAST_SLICES, FUTURE_SLICES, MAX_UNIVERSES, MAX_BRANCHES),
            { ...trailUniforms, ...tree },
          )
        : null,
  };
  scene.add(view.cloud, view.trail);
  if (view.parallel) scene.add(view.parallel);
  return view;
}

const forest: TreeView[] = [
  ...TREES.map((seed, row) => makeTree(seed, row, 0)),
  ...TREES.flatMap((seed, row) => ORCHARD_COLUMNS.map((column) => makeTree(orchardSeed(seed, column), row, column.side))),
];

// The path snakes from our tree through neighbouring universes to the far corner of the orchard.
const PATH_CELLS: Array<[side: number, row: number]> = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 2],
];
const universePath = createUniversePath(PATH_CELLS.length);
scene.add(universePath);

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
  treeCount: 3,
  treeSpacing: 5,
  orchardSpacing: 7,
  showPath: true,
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
type Framing = 'home' | 'forest' | 'orchard';
let framing: Framing = 'home';

interface LegendItem {
  color: string;
  label: string;
}

// Frames the forest from the front and above so ours stands in front and the others recede up the screen.
function forestView(): { position: THREE.Vector3; target: THREE.Vector3 } {
  const depth = settings.treeSpacing * (clampTreeCount(settings.treeCount) - 1);
  const target = new THREE.Vector3(0, 0, -depth / 2);
  return { position: new THREE.Vector3(-2.5, 3 + depth * 0.35, 7), target };
}

// Frames the whole orchard from higher up and farther back so all three columns fit.
function orchardView(): { position: THREE.Vector3; target: THREE.Vector3 } {
  const depth = settings.treeSpacing * (clampTreeCount(settings.treeCount) - 1);
  const target = new THREE.Vector3(0, 0, -depth / 2);
  return { position: new THREE.Vector3(2, 7 + depth * 0.5, 12 + settings.orchardSpacing), target };
}

function applyState(): void {
  const spec = DIMENSIONS[settings.dimension];
  level.duration = settings.transitionSeconds;
  level.retarget(spec.level);
  tubeVisibility.retarget(settings.view === 'spectator' ? 1 : 0);
  const rules = cameraRulesFor(settings.dimension, settings.view);
  rig.apply(rules);

  // Only the Spectator sees the forest and orchard, so the camera pulls back for them and returns home otherwise.
  const spectating = settings.view === 'spectator';
  const wanted: Framing = spectating && spec.id === '7d' ? 'forest' : spectating && spec.id === '8d' ? 'orchard' : 'home';
  if (wanted !== framing && rules.rotate) {
    if (wanted === 'home') {
      rig.glideHome();
    } else {
      const { position, target } = wanted === 'forest' ? forestView() : orchardView();
      rig.glideTo(position, target);
    }
  }
  framing = wanted;

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
  } else if (spec.id === '6d') {
    renderLegend(
      Array.from({ length: universeCount }, (_, i) => ({ color: UNIVERSE_TINTS[i], label: universeLabel(i) })),
    );
  } else if (spec.id === '7d') {
    renderLegend(TREES.slice(0, clampTreeCount(settings.treeCount)).map((t) => ({ color: t.tint, label: t.label })));
  } else if (spec.id === '8d') {
    renderLegend([
      ...TREES.slice(0, clampTreeCount(settings.treeCount)).map((t) => ({ color: t.tint, label: `Row: ${t.label}` })),
      { color: '#8a8fa8', label: 'Left column: slower rhythm' },
      { color: '#8a8fa8', label: 'Right column: faster rhythm' },
      { color: '#ffd27a', label: 'Path between universes' },
    ]);
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

const pane = createHud(settings, stats, { onStateChange: applyState });

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) return;
  const key = event.key.toLowerCase();
  if (key === 'i') {
    toggleInfo();
    return;
  }
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
  const branching = THREE.MathUtils.clamp(l - 4, 0, 1);
  const parallelness = THREE.MathUtils.clamp(l - 5, 0, 1);
  const forestness = THREE.MathUtils.clamp(l - 6, 0, 1);
  const orchardness = THREE.MathUtils.clamp(l - 7, 0, 1);
  const subjectScale = THREE.MathUtils.lerp(1, SUBJECT_SCALE_4D, temporal);
  const spinning = settings.spin && l >= 3;
  // Spin only builds up on the finished sphere so leaving 3D unwinds at most half a turn.
  if (spinning) spin = wrapAngle(spin + worldDt * settings.spinSpeed);

  cloudUniforms.uLevel.value = l;
  cloudUniforms.uSpin.value = spin;
  cloudUniforms.uTime.value = elapsed;
  cloudUniforms.uMotionTime.value = motionTime;
  cloudUniforms.uSubjectScale.value = subjectScale;
  cloudUniforms.uOmega.value = settings.omega;
  cloudUniforms.uAmplitude.value = settings.amplitude;
  cloudUniforms.uWaveNumber.value = settings.waveNumber;
  cloudUniforms.uPointSize.value = settings.pointSize;
  // Sprites shrink with distance as fast as the view grows, so their world width depends only on screen height.
  cloudUniforms.uSpriteWorld.value = (settings.pointSize * 16 * Math.tan(THREE.MathUtils.degToRad(rig.camera.fov / 2))) / window.innerHeight;
  cloudUniforms.uOpacity.value = settings.opacity;
  cloudUniforms.uDensity.value = settings.density;

  const coreUniforms = singularity.material.uniforms;
  coreUniforms.uTime.value = elapsed;
  coreUniforms.uOmega.value = settings.omega;
  coreUniforms.uAmplitude.value = settings.amplitude;
  coreUniforms.uBaseSize.value = settings.coreSize;
  coreUniforms.uPresence.value = 1 - THREE.MathUtils.smoothstep(l, 0, 0.15);
  singularity.visible = coreUniforms.uPresence.value > 0.001;

  const visibility = tubeVisibility.update(dt);
  trailUniforms.uTemporal.value = temporal;
  trailUniforms.uBranching.value = branching;
  trailUniforms.uParallel.value = parallelness;
  trailUniforms.uBranchSpread.value = settings.branchSpread;
  trailUniforms.uUniverseSpacing.value = settings.universeSpacing;
  trailUniforms.uSubjectScale.value = subjectScale;
  trailUniforms.uVisibility.value = visibility;
  trailUniforms.uTime.value = elapsed;
  trailUniforms.uMotionTime.value = motionTime;
  trailUniforms.uPast.value = settings.pastSeconds;
  trailUniforms.uFuture.value = settings.futureSeconds;
  trailUniforms.uTimeScale.value = settings.timeScale;
  trailUniforms.uSpin.value = spin;
  trailUniforms.uSpinRate.value = spinning && settings.timeFlows ? settings.spinSpeed : 0;
  trailUniforms.uOpacity.value = settings.trailOpacity;

  // Only the slices that can show are sent to the GPU, since hidden instances still cost vertex work.
  const futureRuns = branching > 0 ? settings.branchCount : 1;
  const otherUniverses = parallelness > 0 ? clampUniverseCount(settings.universeCount) - 1 : 0;
  const treeCount = clampTreeCount(settings.treeCount);
  let points = singularity.visible ? 1 : 0;

  forest.forEach((view) => {
    const isOurs = view.row === 0 && view.side === 0;
    const inRange = view.row < treeCount;
    // Other trees exist only from 7D, side columns only from 8D, and like everything beyond the present only for the Spectator.
    const growth = view.side === 0 ? forestness : orchardness;
    const presence = isOurs ? 1 : inRange ? growth * visibility : 0;
    view.tree.uTreePresence.value = presence;
    // Side columns slide out from the 7D row, spreading its line of starting points into a plane.
    view.tree.uTreeOffset.value.set(view.side * settings.orchardSpacing * orchardness, 0, -settings.treeSpacing * view.row);

    // The singularity stands in for our cloud while everything sits on the origin.
    view.cloud.visible = presence > 0.001 && l > 0.001;
    view.trail.geometry.instanceCount = PAST_SLICES + FUTURE_SLICES * (view.parallel ? futureRuns : 1);
    view.trail.visible = presence > 0.001 && temporal * visibility > 0.001;
    if (view.cloud.visible) points += sphereData.count;
    if (view.trail.visible) points += sliceData.count * view.trail.geometry.instanceCount;

    if (view.parallel) {
      view.parallel.geometry.instanceCount = SLICES_PER_UNIVERSE * otherUniverses;
      view.parallel.visible = view.trail.visible && otherUniverses > 0;
      if (view.parallel.visible) points += sliceData.count * view.parallel.geometry.instanceCount;
    }
  });
  stats.points = points;

  // The path's stops sit where each tree stands at the present moment.
  const pathPositions = universePath.geometry.getAttribute('position') as THREE.BufferAttribute;
  PATH_CELLS.forEach(([side, row], k) => {
    const r = Math.min(row, treeCount - 1);
    pathPositions.setXYZ(k, side * settings.orchardSpacing * orchardness, 0, -settings.treeSpacing * r);
  });
  pathPositions.needsUpdate = true;
  const pathUniforms = universePath.material.uniforms;
  pathUniforms.uTime.value = elapsed;
  pathUniforms.uOpacity.value = settings.showPath ? orchardness * visibility : 0;
  universePath.visible = pathUniforms.uOpacity.value > 0.001;

  rig.update(dt);
  renderer.render(scene, rig.camera);
});
