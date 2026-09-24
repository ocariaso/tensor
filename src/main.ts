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
import { createGuideLines, setSegments } from './objects/guideLines';
import { createLabelRenderer, Label } from './labels';
import { branchOffset, properTimeTicks, subjectOffset, treeMotion, treeVelocity } from './motion';
import { clockRate, effectiveConstants, LAW_WORLDS, pinchTowardMass, type LawWorld } from './physics';
import { levelBand, Transition } from './transition';
import {
  clampUniverseCount,
  MAX_UNIVERSES,
  UNIVERSE_AMPS,
  UNIVERSE_PHASES,
  UNIVERSE_SHIFTS,
  UNIVERSE_SPLITS,
  UNIVERSE_TINTS,
  universeLabel,
} from './universes';

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

const labelRenderer = createLabelRenderer();

function addLabel(text: string, variant?: string): Label {
  const label = new Label(text, variant);
  scene.add(label.object);
  return label;
}

interface TreeView {
  seed: TreeSeed;
  isOurs: boolean;
  /** The 9D laws this tree obeys, or null for trees under our own laws. */
  law: LawWorld | null;
  nameLabel: Label;
  seedLabel: Label;
  nowLabel: Label;
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
function makeTree(seed: TreeSeed, row: number, side: number, law: LawWorld | null = null): TreeView {
  const tree = createTreeUniforms(seed);
  const isOurs = row === 0 && side === 0 && !law;
  // Law-worlds share our seed, so their tint is set here instead of by their starting conditions.
  if (law) {
    tree.uTreeTint.value.setStyle(law.tint, THREE.LinearSRGBColorSpace);
    tree.uTreeTintAmount.value = 0.35;
  }
  const view: TreeView = {
    seed,
    isOurs,
    law,
    nameLabel: addLabel('', isOurs ? 'you' : ''),
    nowLabel: addLabel('its own now', 'axis'),
    seedLabel: addLabel(isOurs ? 'our seed · far below this view' : `✦ seed · began ${seed.age.toFixed(1)} s ago`, 'seed'),
    row,
    side,
    tree,
    cloud: createPointCloud(sphereData, { ...cloudUniforms, ...tree }),
    trail: createTrail(sliceData, createSliceInstances(PAST_SLICES, FUTURE_SLICES, MAX_BRANCHES), { ...trailUniforms, ...tree }),
    parallel:
      side === 0 && !law
        ? createTrail(
            sliceData,
            createUniverseInstances(PAST_SLICES, FUTURE_SLICES, MAX_UNIVERSES, MAX_BRANCHES),
            { ...trailUniforms, ...tree },
          )
        : null,
  };
  scene.add(view.cloud, view.trail);
  if (view.parallel) scene.add(view.parallel);
  if (!isOurs) view.nameLabel.setColor(law ? law.tint : seed.tint);
  return view;
}

const forest: TreeView[] = [
  ...TREES.map((seed, row) => makeTree(seed, row, 0)),
  ...TREES.flatMap((seed, row) => ORCHARD_COLUMNS.map((column) => makeTree(orchardSeed(seed, column), row, column.side))),
  ...LAW_WORLDS.map((law) => makeTree(TREES[0], 0, 0, law)),
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

const SPHERE_RADIUS = 1.2;
const nowLabel = addLabel('NOW', 'now');
const pastLabel = addLabel('PAST', 'time');
const futureLabel = addLabel('FUTURE', 'time');
const timeAxisLabel = addLabel('time ↑', 'axis');
const axisFutureLabel = addLabel('future', 'axis');
const axisNowLabel = addLabel('now', 'axis');
const axisPastLabel = addLabel('past', 'axis');
const timeAxis = createGuideLines(2, 0x8a8fa8);
const branchLabels = BRANCH_COLORS.map((color) => {
  const label = addLabel('', 'branch');
  label.setColor(color);
  return label;
});
const universeLabels = UNIVERSE_TINTS.map((tint, u) => {
  const label = addLabel(universeLabel(u), 'universe');
  label.setColor(tint);
  return label;
});
const splitLabels = UNIVERSE_TINTS.map(() => addLabel('', 'split'));
const pathLabel = addLabel('path between universes', 'path');
const rhythmAxisLabel = addLabel('rhythm:  slower  ←  →  faster', 'axis');
const birthAxisLabel = addLabel('different seeds  →', 'axis');
const orchardGrid = createGuideLines(3 + TREES.length, 0x8a8fa8);
const nowTicks = createGuideLines(TREES.length * 3 + LAW_WORLDS.length, 0xffffff);
const CLOCK_INTERVAL = 0.5;
const clockTicks = createGuideLines((LAW_WORLDS.length + 1) * 24, 0xffffff);
const clockLabels = [null, ...LAW_WORLDS].map(() => addLabel('', 'seed'));
const massLine = createGuideLines(1, 0xffd27a);
const massLabel = addLabel('central mass', 'path');
scene.add(timeAxis, orchardGrid, nowTicks, clockTicks, massLine);

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
  lawSpacing: 8,
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
type Framing = 'home' | 'forest' | 'orchard' | 'laws';
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

// Frames the row of law-worlds, which runs from one slot left of ours to two slots right.
function lawsView(): { position: THREE.Vector3; target: THREE.Vector3 } {
  // Aimed right of the row's centre so the row clears the HUD on the right edge.
  const centre = settings.lawSpacing * 0.5 + 3.5;
  return { position: new THREE.Vector3(centre, 3.5, 8 + settings.lawSpacing * 2.3), target: new THREE.Vector3(centre, 0, 0) };
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
  const framings: Partial<Record<DimensionId, Framing>> = { '7d': 'forest', '8d': 'orchard', '9d': 'laws' };
  const wanted: Framing = spectating ? (framings[spec.id] ?? 'home') : 'home';
  if (wanted !== framing && rules.rotate) {
    if (wanted === 'home') {
      rig.glideHome();
    } else {
      const { position, target } = { forest: forestView, orchard: orchardView, laws: lawsView }[wanted]();
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
  } else if (spec.id === '9d') {
    renderLegend([
      { color: '#ffffff', label: 'Ours · our laws (every world starts exactly like ours)' },
      ...LAW_WORLDS.map((w) => ({ color: w.tint, label: w.label })),
      { color: '#ffffff', label: 'White ticks: every 0.5 s of the subject’s own clock' },
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
  labelRenderer.setSize(width, height);
  rig.resize(width, height);
}
window.addEventListener('resize', resize);
resize();
applyState();

const at = new THREE.Vector3();
const shift = new THREE.Vector3();

// Each label group belongs to the level whose idea it explains, and fades out as the view moves past it.
function placeLabels(
  l: number,
  motionTime: number,
  subjectScale: number,
  temporal: number,
  branching: number,
  parallelness: number,
  orchardness: number,
  visibility: number,
  treeCount: number,
): void {
  const radius = SPHERE_RADIUS * subjectScale;
  const ts = settings.timeScale;
  const pastDt = -settings.pastSeconds * temporal;
  const futureDt = settings.futureSeconds * temporal;

  // 4D: our own world-tube, read along the time axis.
  subjectOffset(motionTime, at);
  nowLabel.update(at.add(shift.set(radius + 0.7, 0, 0)), levelBand(l, 4, 6));
  subjectOffset(motionTime + pastDt, at);
  pastLabel.update(at.add(shift.set(0, pastDt * ts - radius - 0.4, 0)), levelBand(l, 4, 6) * visibility);
  subjectOffset(motionTime + futureDt, at);
  futureLabel.update(at.add(shift.set(0, futureDt * ts + radius + 0.4, 0)), levelBand(l, 4, 4) * visibility);
  // Time stays the vertical direction at every level, so its axis moves out to the scene's edge as the scene widens.
  const axisAlpha = levelBand(l, 4, 9) * visibility;
  const lawness = THREE.MathUtils.clamp(l - 8, 0, 1);
  const axisX = THREE.MathUtils.lerp(
    -(2.4 + 0.6 * branching + 0.6 * parallelness + (settings.orchardSpacing - 1.1) * orchardness),
    -settings.lawSpacing - 2.4,
    lawness,
  );
  const axisZ = (-settings.treeSpacing * (treeCount - 1) * THREE.MathUtils.clamp(l - 6, 0, 1) * (1 - lawness)) / 2;
  const axisTop = futureDt * ts + radius + 0.2;
  const axisBottom = pastDt * ts;
  setSegments(
    timeAxis,
    [
      [new THREE.Vector3(axisX, axisBottom, axisZ), new THREE.Vector3(axisX, axisTop, axisZ)],
      [new THREE.Vector3(axisX - 0.15, 0, axisZ), new THREE.Vector3(axisX + 0.15, 0, axisZ)],
    ],
    axisAlpha * 0.6,
  );
  // Branches and parallel universes share one history's clock, but separate seeds share no clock at all.
  timeAxisLabel.setText(l > 6.5 ? 'time ↑ · within each universe' : l > 4.5 ? 'time ↑ · shared by this history' : 'time ↑');
  timeAxisLabel.update(at.set(axisX, axisTop + 0.35, axisZ), axisAlpha);
  // Tick names sit just inside the axis so they stay on screen however wide the scene gets.
  axisFutureLabel.update(at.set(axisX + 0.7, axisTop - 0.2, axisZ), axisAlpha);
  axisNowLabel.setText(l > 6.5 ? 'no shared now · each tree has its own' : 'now');
  axisNowLabel.update(at.set(axisX + (l > 6.5 ? 2 : 0.6), 0.25, axisZ), axisAlpha);
  axisPastLabel.update(at.set(axisX + 0.6, axisBottom + 0.2, axisZ), axisAlpha);

  // 5D: each branch's name and probability at the tip of its future.
  const layout = layoutBranches(settings.branchCount);
  branchLabels.forEach((label, b) => {
    const p = layout.probabilities[b];
    label.setText(`${String.fromCharCode(65 + b)} · ${Math.round(p * 100)}%`);
    subjectOffset(motionTime + futureDt, at).add(branchOffset(b, layout.offsets[b], settings.branchSpread, futureDt, branching, shift));
    at.y += futureDt * ts + radius + 0.35;
    label.update(at, p > 0 ? levelBand(l, 5, 5) * visibility : 0);
  });

  // 6D: each universe's name above its present, and where it split from our history.
  const universeCount = clampUniverseCount(settings.universeCount);
  universeLabels.forEach((label, u) => {
    subjectOffset(motionTime + UNIVERSE_PHASES[u], at).multiplyScalar(UNIVERSE_AMPS[u]);
    if (u === 0) subjectOffset(motionTime, at);
    at.x += UNIVERSE_SHIFTS[u] * settings.universeSpacing * parallelness;
    at.y += futureDt * ts + radius + 0.45;
    label.update(at, u < universeCount ? levelBand(l, 6, 6) * visibility : 0);
  });
  splitLabels.forEach((label, u) => {
    const splitAgo = UNIVERSE_SPLITS[u] * settings.pastSeconds;
    label.setText(`${universeLabel(u)} splits off · ${splitAgo.toFixed(1)} s ago`);
    subjectOffset(motionTime - splitAgo, at);
    at.x += Math.sign(UNIVERSE_SHIFTS[u]) * 1.6;
    at.y -= splitAgo * ts;
    label.update(at, u > 0 && u < universeCount ? levelBand(l, 6, 6) * visibility : 0);
  });

  // 7D and 8D: every tree's name above it, its own "now" beside it, and each seed where its tree began.
  const nowTickSegments: Array<[THREE.Vector3, THREE.Vector3]> = [];
  const treeNowAlpha = levelBand(l, 7, 9) * visibility;
  forest.forEach((view) => {
    const isOurs = view.isOurs;
    const offset = view.tree.uTreeOffset.value as THREE.Vector3;
    const presence = view.tree.uTreePresence.value as number;
    const shortName = view.seed.label.split(' · ')[0];
    const inOrchard = l > 7.5;
    view.nameLabel.setText(
      view.law
        ? view.law.label
        : isOurs
          ? '★ Ours · you are here'
          : view.side !== 0 || !inOrchard
            ? view.seed.label
            : `${shortName} · normal rhythm`,
    );
    treeMotion(view.seed, motionTime, at).add(offset);
    at.y += futureDt * ts + radius * view.seed.scale + 0.55;
    const nameBand = view.law
      ? levelBand(l, 9, 9)
      : isOurs
        ? levelBand(l, 7, 9)
        : view.side === 0
          ? levelBand(l, 7, 8)
          : levelBand(l, 8, 8);
    view.nameLabel.update(at, (isOurs ? 1 : presence) * nameBand);

    // Each tree's present gets its own tick, since no clock is shared between separate seeds.
    const shownNow = (isOurs ? 1 : presence) * treeNowAlpha;
    treeMotion(view.seed, motionTime, at).add(offset);
    const edge = at.x - radius * view.seed.scale - 0.15;
    if (shownNow > 0.01) nowTickSegments.push([new THREE.Vector3(edge - 0.5, 0, at.z), new THREE.Vector3(edge, 0, at.z)]);
    view.nowLabel.update(at.set(edge - 0.9, 0, at.z), view.side === 0 && !view.law ? levelBand(l, 7, 7) * shownNow : 0);

    if (view.side !== 0 || view.law) {
      view.seedLabel.update(at, 0);
      return;
    }
    const seedDt = isOurs ? pastDt : -view.seed.age * temporal;
    treeMotion(view.seed, motionTime + seedDt, at).add(offset);
    at.y += seedDt * ts - (isOurs ? radius : 0) - 0.4;
    const seedAlpha = view.row < treeCount ? levelBand(l, 7, 7) * (isOurs ? visibility : presence) : 0;
    view.seedLabel.update(at, seedAlpha);
  });
  setSegments(nowTicks, nowTickSegments, treeNowAlpha * 0.8);

  // 8D: a floor grid with named axes, and the path's name.
  const orchardAlpha = levelBand(l, 8, 8) * visibility;
  const depth = settings.treeSpacing * (treeCount - 1);
  const floor = pastDt * ts - 1;
  const columnX = settings.orchardSpacing * orchardness;
  const grid: Array<[THREE.Vector3, THREE.Vector3]> = [];
  for (const side of [-1, 0, 1]) {
    grid.push([new THREE.Vector3(side * columnX, floor, 2), new THREE.Vector3(side * columnX, floor, -depth - 2)]);
  }
  for (let row = 0; row < treeCount; row++) {
    const z = -settings.treeSpacing * row;
    grid.push([new THREE.Vector3(-columnX - 2, floor, z), new THREE.Vector3(columnX + 2, floor, z)]);
  }
  setSegments(orchardGrid, grid, orchardAlpha * 0.35);
  rhythmAxisLabel.update(at.set(0, floor, 3), orchardAlpha);
  birthAxisLabel.update(at.set(columnX + 3.5, floor, -depth / 2), orchardAlpha);

  const pathPositions = universePath.geometry.getAttribute('position') as THREE.BufferAttribute;
  at.fromBufferAttribute(pathPositions, 2).add(shift.fromBufferAttribute(pathPositions, 3)).multiplyScalar(0.5);
  at.y += 0.5;
  pathLabel.update(at, settings.showPath ? orchardAlpha : 0);
}

const velocity = new THREE.Vector3();
const local = new THREE.Vector3();

// 9D: ticks along each time tube at every half second of the subject's own clock, so clocks that run slow show wider gaps.
function placeClocks(l: number, motionTime: number, subjectScale: number, temporal: number, visibility: number): void {
  const band = levelBand(l, 9, 9);
  const radius = SPHERE_RADIUS * subjectScale;
  const ts = settings.timeScale;
  const segments: Array<[THREE.Vector3, THREE.Vector3]> = [];
  const worlds = forest.filter((view) => view.isOurs || view.law);

  worlds.forEach((view, i) => {
    const presence = view.isOurs ? visibility : (view.tree.uTreePresence.value as number);
    const alpha = band * presence;
    const label = clockLabels[i];
    if (alpha < 0.01) {
      label.update(at, 0);
      return;
    }
    const offset = view.tree.uTreeOffset.value as THREE.Vector3;
    const lightSpeed = view.tree.uLightSpeed.value as number;
    const gravity = view.tree.uGravity.value as number;
    const rateAt = (dt: number): number => {
      const speed = treeVelocity(view.seed, motionTime + dt, velocity).length();
      treeMotion(view.seed, motionTime + dt, local);
      return clockRate(speed, lightSpeed, gravity, Math.hypot(local.x, local.z));
    };

    for (const tick of properTimeTicks(rateAt, settings.pastSeconds * temporal, settings.futureSeconds * temporal, CLOCK_INTERVAL)) {
      pinchTowardMass(treeMotion(view.seed, motionTime + tick, local), gravity).add(offset);
      local.y = tick * ts;
      const start = local.x + radius + 0.1;
      segments.push([new THREE.Vector3(start, local.y, local.z), new THREE.Vector3(start + 0.4, local.y, local.z)]);
    }

    label.setText(`own clock: ${rateAt(0).toFixed(2)} s per s`);
    pinchTowardMass(treeMotion(view.seed, motionTime, at), gravity).add(offset);
    label.update(at.set(at.x + radius + 1.6, -0.35, at.z), alpha);
  });
  setSegments(clockTicks, segments, band * visibility * 0.85);

  // The strong-gravity world's mass runs straight up through time at that world's centre.
  const gravityWorld = worlds.find((view) => view.law && view.law.dials.gravityExp > 0);
  const massAlpha = gravityWorld ? band * (gravityWorld.tree.uTreePresence.value as number) : 0;
  const centre = gravityWorld ? (gravityWorld.tree.uTreeOffset.value as THREE.Vector3) : at.set(0, 0, 0);
  const bottom = -settings.pastSeconds * temporal * ts;
  const top = settings.futureSeconds * temporal * ts + radius;
  setSegments(massLine, [[new THREE.Vector3(centre.x, bottom, centre.z), new THREE.Vector3(centre.x, top, centre.z)]], massAlpha * 0.7);
  massLabel.update(local.set(centre.x, bottom - 0.4, centre.z), massAlpha);
}

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
  const lawness = THREE.MathUtils.clamp(l - 8, 0, 1);
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
    const isOurs = view.isOurs;
    let presence: number;
    if (view.law) {
      // Law-worlds slide out from ours in 9D while their constants move from our values to theirs.
      presence = lawness * visibility;
      view.tree.uTreeOffset.value.set(view.law.slot * settings.lawSpacing * lawness, 0, 0);
      const constants = effectiveConstants(view.law.dials, lawness);
      view.tree.uLightSpeed.value = constants.lightSpeed;
      view.tree.uUncertainty.value = constants.uncertainty;
      view.tree.uGravity.value = constants.gravity;
    } else {
      // Other trees exist from 7D, side columns from 8D, and the orchard folds away as 9D's law-worlds take over.
      const growth = view.side === 0 ? forestness : orchardness;
      presence = isOurs ? 1 : view.row < treeCount ? growth * visibility * (1 - lawness) : 0;
      // Side columns slide out from the 7D row, spreading its line of starting points into a plane.
      view.tree.uTreeOffset.value.set(view.side * settings.orchardSpacing * orchardness, 0, -settings.treeSpacing * view.row);
    }
    view.tree.uTreePresence.value = presence;

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
  pathUniforms.uOpacity.value = settings.showPath ? orchardness * (1 - lawness) * visibility : 0;
  universePath.visible = pathUniforms.uOpacity.value > 0.001;

  placeLabels(l, motionTime, subjectScale, temporal, branching, parallelness, orchardness, visibility, treeCount);
  placeClocks(l, motionTime, subjectScale, temporal, visibility);

  rig.update(dt);
  renderer.render(scene, rig.camera);
  labelRenderer.render(scene, rig.camera);
});
