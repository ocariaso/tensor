uniform float uLevel;       // 0 = point, 1 = line
uniform float uExtent;      // half-length of the 1D line
uniform float uLonSegments;
uniform float uPointSize;
uniform float uPixelRatio;
uniform float uTime;
uniform float uOmega;
uniform float uAmplitude;
uniform float uWaveNumber;

varying vec3 vColor;
varying float vAlpha;

void main() {
  float stretch = clamp(uLevel, 0.0, 1.0);

  // Latitude sets the distance from the center and longitude picks the side, so 2D can later sweep the line open.
  float r = 1.0 - uv.y;
  float side = uv.x < 0.5 ? 1.0 : -1.0;
  float x = side * r * uExtent * stretch;

  vec4 mvPosition = modelViewMatrix * vec4(x, 0.0, 0.0, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Only the first column on each side is drawn because every other point sits on the same spot.
  float column = floor(uv.x * uLonSegments + 0.5);
  float representative = (column == 0.0 || column == uLonSegments * 0.5) ? 1.0 : 0.0;

  float size = uPointSize * uPixelRatio * mix(0.4, 1.0, stretch);
  gl_PointSize = size * (8.0 / -mvPosition.z) * representative;

  // At x = 0 this equals the 0D pulse, so the line's wave grows out of the singularity.
  float wave = 1.0 + uAmplitude * sin(uOmega * uTime - uWaveNumber * x);

  vColor = mix(vec3(0.35, 0.55, 1.0), vec3(0.75, 0.45, 1.0), r) * wave;
  vAlpha = smoothstep(0.0, 0.08, stretch) * representative;
}
