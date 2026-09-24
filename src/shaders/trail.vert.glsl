attribute float aSlice;      // -1..0 = past, 0..1 = future, as a share of that horizon

uniform float uTemporal;     // 0 = no time axis, 1 = full 4D extrusion
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

varying vec3 vColor;
varying float vAlpha;

void main() {
  float horizon = aSlice < 0.0 ? uPast : uFuture;
  float dt = aSlice * horizon * uTemporal;

  // Same upright orientation the cloud reaches when it finishes curling into a sphere.
  float theta = (1.0 - uv.y) * PI;
  float phi = uv.x * 2.0 * PI;
  vec3 p = uSphereRadius * uSubjectScale * vec3(sin(theta) * cos(phi), cos(theta), -sin(theta) * sin(phi));
  p = spinY(uSpin + uSpinRate * dt) * p;
  p += subjectOffset(uMotionTime + dt);
  p.y += dt * uTimeScale;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = uPointSize * uPixelRatio * (8.0 / -mvPosition.z);

  float age = abs(aSlice);
  bool isPast = aSlice < 0.0;
  vColor = isPast ? mix(vec3(0.6, 0.45, 1.0), vec3(0.2, 0.25, 0.65), age) : vec3(0.35, 0.95, 0.9);
  vAlpha = pow(1.0 - age, 1.5) * (isPast ? 1.0 : 0.6) * uTemporal * uVisibility;
}
