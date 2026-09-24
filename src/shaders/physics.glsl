uniform float uLightSpeed;   // world units per second
uniform float uUncertainty;  // positional blur radius in world units
uniform float uGravity;      // pull strength toward the central mass

vec3 subjectVelocity(float t) {
  return (subjectOffset(t + 0.01) - subjectOffset(t - 0.01)) / 0.02;
}

// Length contraction shortens a moving shape along its motion by sqrt(1 - v^2 / c^2).
vec3 contract(vec3 shape, vec3 velocity) {
  float speed = length(velocity);
  if (speed < 1e-5) return shape;
  vec3 dir = velocity / speed;
  float beta = min(speed / uLightSpeed, 0.99);
  return shape - dir * dot(shape, dir) * (1.0 - sqrt(1.0 - beta * beta));
}

float hash12(vec2 v) {
  return fract(sin(dot(v, vec2(12.9898, 78.233))) * 43758.5453);
}

// Quantum uncertainty re-rolls each point's position 24 times a second within a blur that grows with h.
vec3 uncertain(vec3 p, vec2 seed, float t) {
  float frame = mod(floor(t * 24.0), 997.0);
  vec2 s = seed + frame * 0.137;
  // Averaging two samples per axis clusters points near the true position like a probability cloud.
  vec3 a = vec3(hash12(s), hash12(s + 3.1), hash12(s + 7.7));
  vec3 b = vec3(hash12(s + 11.3), hash12(s + 17.9), hash12(s + 23.5));
  return p + (a + b - 1.0) * uUncertainty;
}

// Gravity pinches space toward a mass on the central axis, bending every world-tube inward.
vec3 gravitate(vec3 p) {
  float d = length(p.xz);
  if (d < 1e-4) return p;
  // Capping the pull at part of the distance keeps points from collapsing into a line on the axis.
  float pull = min(uGravity / (d + 0.25), d * 0.45);
  p.xz -= p.xz / d * pull;
  return p;
}
