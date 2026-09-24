attribute float aSlice;      // -1..0 = past, 0 = present, 0..1 = future, as a share of that horizon
attribute float aBranch;     // which future branch this slice belongs to
attribute float aUniverse;   // which universe this slice belongs to, where 0 is ours

uniform float uTemporal;     // 0 = no time axis, 1 = full 4D extrusion
uniform float uBranching;    // 0 = one future, 1 = fully split into branches
uniform float uParallel;     // 0 = only ours, 1 = parallel universes fully slid out
uniform float uVisibility;   // 0 = present only, 1 = whole world-tube
uniform float uTime;
uniform float uMotionTime;
uniform float uPast;         // seconds
uniform float uFuture;       // seconds
uniform float uTimeScale;    // world units per second along the time axis
uniform float uSphereRadius;
uniform float uSubjectScale;
uniform float uSpin;
uniform float uSpinRate;
uniform float uPointSize;
uniform float uPixelRatio;
uniform float uBranchCount;
uniform float uBranchSpread; // W distance a branch reaches after one second
uniform float uBranchW[5];
uniform float uBranchP[5];
uniform vec3 uBranchColors[5];
uniform float uFocusBranch;  // branch in focus, or -1 for no focus
uniform float uOthersAlpha;  // how visible the other branches stay while one is in focus
uniform float uUniverseCount;
uniform float uUniverseSpacing;
uniform float uUniverseShift[5];
uniform float uUniversePhase[5];
uniform float uUniverseAmp[5];
uniform float uUniverseSplit[5]; // how long ago each universe split from ours, as a share of the past
uniform vec3 uUniverseTints[5];

uniform float uBranchTempo[5];
uniform float uBranchSway[5];
uniform float uBranchSpinRate[5];

varying vec3 vColor;
varying float vAlpha;

// Its slope is zero at the split, so a branch leaves the present with the shared position and speed.
float branchBlend(float dt) {
  return dt <= 0.0 ? 0.0 : (1.0 - exp(-(dt * dt) / (0.35 * 0.35))) * uBranching;
}

// A parallel universe follows its tree's history until its split, then peels away onto its own path.
vec3 historyAt(int u, float dt, float splitAgo) {
  float apart = u == 0 ? 1.0 : smoothstep(0.0, splitAgo, dt + splitAgo);
  vec3 ours = treeMotion(uMotionTime + dt);
  vec3 theirs = treeMotion(uMotionTime + dt + uUniversePhase[u]) * uUniverseAmp[u];
  return mix(ours, theirs, apart);
}

// After the present, each branch gradually takes on its own tempo and sway.
vec3 branchPath(int u, int b, float dt, float splitAgo) {
  vec3 base = historyAt(u, dt, splitAgo);
  float blend = branchBlend(dt);
  if (blend <= 0.0) return base;
  vec3 variant = historyAt(u, dt * uBranchTempo[b], splitAgo) * uBranchSway[b];
  return mix(base, variant, blend);
}

void main() {
  bool isPast = aSlice < 0.0;
  bool isPresent = aSlice == 0.0;
  float horizon = isPast ? uPast : uFuture;
  float dt = aSlice * horizon * uTemporal;
  int b = int(aBranch + 0.5);
  int u = int(aUniverse + 0.5);

  // Same upright orientation the cloud reaches when it finishes curling into a sphere.
  float theta = (1.0 - uv.y) * PI;
  float phi = uv.x * 2.0 * PI;
  // A tree grows out of its seed, so its trunk tapers to a single point at the moment it began.
  float sinceSeed = dt + uTreeAge;
  float growth = smoothstep(0.0, 0.35, sinceSeed);
  vec3 p = uSphereRadius * uSubjectScale * uTreeScale * growth * vec3(sin(theta) * cos(phi), cos(theta), -sin(theta) * sin(phi));
  float spinRate = uSpinRate * mix(1.0, uBranchSpinRate[b], branchBlend(dt));
  p = spinY((uSpin + spinRate * dt) * uTreeSpin) * p;

  // A parallel universe's split can only come after its tree's seed.
  float splitAgo = min(uUniverseSplit[u] * uPast, 0.8 * uTreeAge);
  float apart = u == 0 ? 1.0 : smoothstep(0.0, splitAgo, dt + splitAgo);
  // A predicted moment could be anywhere within its uncertainty, so its sphere widens by that much and fades.
  float spread = isPast ? 0.0 : subjectSpread(uMotionTime + dt);
  float bodyRadius = uSphereRadius * uSubjectScale * uTreeScale;
  p *= 1.0 + spread / max(bodyRadius, 1e-3);
  vec3 center = branchPath(u, b, dt, splitAgo);
  vec3 velocity = (branchPath(u, b, dt + 0.01, splitAgo) - branchPath(u, b, dt - 0.01, splitAgo)) / 0.02;
  p = contract(p, velocity) + center;

  // Branches start together at the present and drift apart along W, drawn as the X direction.
  if (!isPast && b > 0) {
    float fb = float(b);
    vec3 drift = vec3(uBranchW[b] * uBranchSpread * dt * dt, 0.0, 0.0);
    vec3 wobble = vec3(sin(dt * (2.0 + fb * 1.3) + fb), 0.0, sin(dt * (1.5 + fb * 0.9) + 2.0 * fb)) * 0.15 * dt;
    p += (drift + wobble) * uBranching;
  }

  // Parallel universes slide out from ours along U, also drawn along X.
  p.x += uUniverseShift[u] * uUniverseSpacing * uParallel * apart;
  p = gravitate(uncertain(p, uv + vec2(aSlice * 3.1 + aBranch * 0.9, aUniverse * 1.7), uTime));
  p.y += dt * uTimeScale;
  p += uTreeOffset;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Brighter branches are likelier, and extra branches only exist once 5D begins.
  float likelihood = uBranchP[b] / uBranchP[0];
  float branchAlpha = b == 0 ? mix(1.0, likelihood, uBranching) : likelihood * uBranching;
  if (isPast || isPresent) branchAlpha = 1.0;
  else if (uFocusBranch >= 0.0 && float(b) != uFocusBranch) branchAlpha *= uOthersAlpha;

  // Before its split a parallel universe is our own history, which our trail already draws.
  float universeAlpha = u == 0 ? 1.0 : uParallel * step(0.001, apart) * (float(u) < uUniverseCount ? 1.0 : 0.0);
  // Nothing of this tree exists before its seed, and no future is drawn while it is switched off.
  universeAlpha *= step(0.0, sinceSeed);
  if (aSlice > 0.0 && uFuture <= 0.0) universeAlpha = 0.0;
  float shown = step(0.001, branchAlpha * universeAlpha);
  gl_PointSize = uPointSize * uPixelRatio * (8.0 / -mvPosition.z) * shown;

  float age = abs(aSlice);
  vec3 futureColor = mix(vec3(0.35, 0.95, 0.9), uBranchColors[b], uBranching);
  vec3 color = isPast ? mix(vec3(0.6, 0.45, 1.0), vec3(0.2, 0.25, 0.65), age) : futureColor;
  // The tint marks a universe's history strongly but only lightly touches its branch colors.
  color = u == 0 ? color : mix(color, uUniverseTints[u], isPast || isPresent ? 0.65 : 0.35);
  vColor = mix(color, uTreeTint, uTreeTintAmount);

  // A parallel universe's present is drawn from this sparse slice, so it needs extra gain to read as solid.
  float sliceGain = isPresent ? 5.0 : (isPast ? 1.0 : mix(0.6, 1.6, uBranching));
  // The past dims with age; the future instead dims with uncertainty, but never so far that it disappears.
  float certainty = 1.0 / (1.0 + 3.0 * spread);
  float fade = isPast ? pow(1.0 - age, 1.5) : mix(0.3, 1.0, certainty * certainty);
  vAlpha = fade * sliceGain * branchAlpha * universeAlpha * uTemporal * uVisibility * uTreePresence;
}
