uniform float uLevel;       // 0 = point, 1 = line, 2 = disc
uniform float uExtent;      // radius of the line and disc
uniform float uLatSegments;
uniform float uLonSegments;
uniform float uSpriteWorld; // world-space width of one point sprite
uniform float uDensity;     // how many sprites may overlap one spot of the disc
uniform float uPointSize;
uniform float uPixelRatio;
uniform float uTime;
uniform float uOmega;
uniform float uAmplitude;
uniform float uWaveNumber;

varying vec3 vColor;
varying float vAlpha;

const float PI = 3.141592653589793;

void main() {
  float stretch = clamp(uLevel, 0.0, 1.0);
  float sweep = clamp(uLevel - 1.0, 0.0, 1.0);

  // Latitude sets the distance from the center and longitude sets the final angle on the disc.
  float r = 1.0 - uv.y;
  float phi = uv.x * 2.0 * PI;
  float lineAngle = uv.x < 0.5 ? 0.0 : PI;
  float angle = mix(lineAngle, phi, sweep);
  vec2 p = vec2(cos(angle), sin(angle)) * r * uExtent * stretch;

  vec4 mvPosition = modelViewMatrix * vec4(p, 0.0, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // On the line only the first column per side is drawn because the rest share its spot.
  float column = floor(uv.x * uLonSegments + 0.5);
  bool representative = column == 0.0 || column == uLonSegments * 0.5;

  // Where sprites overlap, a random share of points is skipped so the disc stays evenly bright without dimming below one color step.
  float radius = uExtent * stretch;
  float ringGap = radius / uLatSegments;
  float arcGap = r * radius * sweep * PI / (uLonSegments * 0.5);
  float discChance = min(1.0, uDensity * min(1.0, arcGap / uSpriteWorld) * min(1.0, ringGap / uSpriteWorld));
  float keepChance = representative ? mix(1.0, discChance, sweep) : discChance;
  float hash = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
  float kept = hash < keepChance ? 1.0 : 0.0;

  float size = uPointSize * uPixelRatio * mix(0.4, 1.0, stretch);
  gl_PointSize = size * (8.0 / -mvPosition.z) * kept;

  // At the center this equals the 0D pulse, so every wave grows out of the singularity.
  float wave = 1.0 + uAmplitude * sin(uOmega * uTime - uWaveNumber * length(p));

  vColor = mix(vec3(0.35, 0.55, 1.0), vec3(0.75, 0.45, 1.0), r) * wave;
  vAlpha = smoothstep(0.0, 0.08, stretch) * kept;
}
