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

uniform float uRandomMotion;   // 1 = read the recorded random path, 0 = the scripted sway
uniform sampler2D uHistory;    // recorded positions, oldest first, one per texel
uniform float uHistoryStart;   // time of the oldest recorded position
uniform float uHistoryStep;    // seconds between recorded positions
uniform float uHistorySize;

// A time warp slows the drift to near pauses, and slow sines sway it like a person shifting their weight.
vec3 scriptedOffset(float t) {
  float period = 6.0;
  float warped = t - 0.8 * period / (2.0 * PI) * sin(2.0 * PI * t / period);
  return vec3(
    0.8 * sin(0.45 * warped) + 0.2 * sin(1.1 * warped + 1.0),
    0.0,
    0.35 * sin(0.3 * warped + 2.0)
  );
}

// Mirrors MotionHistory.sample: interpolates between recorded positions and holds at the window's ends.
vec3 recordedOffset(float t) {
  float f = clamp((t - uHistoryStart) / uHistoryStep, 0.0, uHistorySize - 1.0);
  float i0 = floor(f);
  float i1 = min(i0 + 1.0, uHistorySize - 1.0);
  vec3 a = texture2D(uHistory, vec2((i0 + 0.5) / uHistorySize, 0.5)).xyz;
  vec3 b = texture2D(uHistory, vec2((i1 + 0.5) / uHistorySize, 0.5)).xyz;
  return mix(a, b, f - i0);
}

// How uncertain the subject's position is at a time: zero for the recorded past, growing along a prediction.
float subjectSpread(float t) {
  if (uRandomMotion < 0.5) return 0.0;
  float f = clamp((t - uHistoryStart) / uHistoryStep, 0.0, uHistorySize - 1.0);
  float i0 = floor(f);
  float i1 = min(i0 + 1.0, uHistorySize - 1.0);
  float a = texture2D(uHistory, vec2((i0 + 0.5) / uHistorySize, 0.5)).w;
  float b = texture2D(uHistory, vec2((i1 + 0.5) / uHistorySize, 0.5)).w;
  return mix(a, b, f - i0);
}

vec3 subjectOffset(float t) {
  return uRandomMotion > 0.5 ? recordedOffset(t) : scriptedOffset(t);
}

// The same sway under this tree's own starting conditions.
vec3 treeMotion(float t) {
  return subjectOffset(t * uTreeTempo + uTreePhase) * uTreeSway;
}

// A recording ends at the present, so its slope there can only be read from the moments just before.
vec3 treeVelocity(float t) {
  float ahead = uRandomMotion > 0.5 ? 0.0 : 0.01;
  return (treeMotion(t + ahead) - treeMotion(t + ahead - 0.02)) / 0.02;
}

mat3 spinY(float angle) {
  return mat3(cos(angle), 0.0, -sin(angle), 0.0, 1.0, 0.0, sin(angle), 0.0, cos(angle));
}
