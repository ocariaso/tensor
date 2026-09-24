attribute float aSlice;      // -1..0 = past, 0..1 = future, as a share of that horizon
attribute float aBranch;     // which future branch this slice belongs to

uniform float uTemporal;     // 0 = no time axis, 1 = full 4D extrusion
uniform float uBranching;    // 0 = one future, 1 = fully split into branches
uniform float uVisibility;   // 0 = present only, 1 = whole world-tube
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

varying vec3 vColor;
varying float vAlpha;

void main() {
  bool isPast = aSlice < 0.0;
  float horizon = isPast ? uPast : uFuture;
  float dt = aSlice * horizon * uTemporal;
  int b = int(aBranch + 0.5);

  // Same upright orientation the cloud reaches when it finishes curling into a sphere.
  float theta = (1.0 - uv.y) * PI;
  float phi = uv.x * 2.0 * PI;
  vec3 p = uSphereRadius * uSubjectScale * vec3(sin(theta) * cos(phi), cos(theta), -sin(theta) * sin(phi));
  p = spinY(uSpin + uSpinRate * dt) * p;
  p += subjectOffset(uMotionTime + dt);

  // Branches start together at the present and drift apart along W, drawn as the X direction.
  if (!isPast && b > 0) {
    float fb = float(b);
    vec3 drift = vec3(uBranchW[b] * uBranchSpread * dt * dt, 0.0, 0.0);
    vec3 wobble = vec3(sin(dt * (2.0 + fb * 1.3) + fb), 0.0, sin(dt * (1.5 + fb * 0.9) + 2.0 * fb)) * 0.15 * dt;
    p += (drift + wobble) * uBranching;
  }
  p.y += dt * uTimeScale;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Brighter branches are likelier, and extra branches only exist once 5D begins.
  float likelihood = uBranchP[b] / uBranchP[0];
  float branchAlpha = b == 0 ? mix(1.0, likelihood, uBranching) : likelihood * uBranching;
  float inUse = isPast || float(b) < uBranchCount ? 1.0 : 0.0;
  if (isPast) branchAlpha = 1.0;

  gl_PointSize = uPointSize * uPixelRatio * (8.0 / -mvPosition.z) * inUse * step(0.001, branchAlpha);

  float age = abs(aSlice);
  vec3 futureColor = mix(vec3(0.35, 0.95, 0.9), uBranchColors[b], uBranching);
  vColor = isPast ? mix(vec3(0.6, 0.45, 1.0), vec3(0.2, 0.25, 0.65), age) : futureColor;
  float futureGain = mix(0.6, 1.6, uBranching);
  vAlpha = pow(1.0 - age, 1.5) * (isPast ? 1.0 : futureGain) * branchAlpha * uTemporal * uVisibility;
}
