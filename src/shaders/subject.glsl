const float PI = 3.141592653589793;

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

mat3 spinY(float angle) {
  return mat3(cos(angle), 0.0, -sin(angle), 0.0, 1.0, 0.0, sin(angle), 0.0, cos(angle));
}
