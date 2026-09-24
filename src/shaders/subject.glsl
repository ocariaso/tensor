const float PI = 3.141592653589793;

uniform vec3 uTreeOffset;     // where this tree stands in the forest
uniform float uTreeScale;     // subject size relative to ours
uniform float uTreePhase;     // seconds into its own sway cycle at the start
uniform float uTreeTempo;     // sway speed relative to ours
uniform float uTreeSway;      // sway distance relative to ours
uniform float uTreeSpin;      // spin speed relative to ours
uniform float uTreeAge;       // seconds since this tree's seed
uniform vec3 uTreeTint;
uniform float uTreeTintAmount;
uniform float uTreePresence;  // 0 = hidden, 1 = fully shown

// A time warp slows the drift to near pauses, and slow sines sway it like a person shifting their weight.
vec3 subjectOffset(float t) {
  float period = 6.0;
  float warped = t - 0.8 * period / (2.0 * PI) * sin(2.0 * PI * t / period);
  return vec3(
    0.8 * sin(0.45 * warped) + 0.2 * sin(1.1 * warped + 1.0),
    0.0,
    0.35 * sin(0.3 * warped + 2.0)
  );
}

// The same sway under this tree's own starting conditions.
vec3 treeMotion(float t) {
  return subjectOffset(t * uTreeTempo + uTreePhase) * uTreeSway;
}

vec3 treeVelocity(float t) {
  return (treeMotion(t + 0.01) - treeMotion(t - 0.01)) / 0.02;
}

mat3 spinY(float angle) {
  return mat3(cos(angle), 0.0, -sin(angle), 0.0, 1.0, 0.0, sin(angle), 0.0, cos(angle));
}
